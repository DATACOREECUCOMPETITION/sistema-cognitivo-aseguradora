import json
import logging
from typing import Any, Dict, List, Optional
import httpx
from core.config import settings
from services.contingency_manager import ContingencyManager

# Configuración del logger
logger = logging.getLogger("gemini_agent")
logging.basicConfig(level=logging.INFO)

# ==============================================================================
# ORQUESTADOR COGNITIVO CON GEMINI 2.5 FLASH Y ESCUDO ROTATIVO
# ==============================================================================

class GeminiAgent:
    """
    Agente Cognitivo y Perito Judicial en Lingüística Forense que utiliza
    Gemini 2.5 Flash con un pool rotativo de 5 API Keys de forma asíncrona.
    
    Implementa Súper Escudo de Reintentos contra Error 429 y un Cortafuegos de Emergencia.
    """
    
    # Índice o puntero global en memoria compartido por todas las instancias
    _key_index: int = 0

    def __init__(self) -> None:
        self.model_name = "gemini-2.5-flash"
        self.system_instruction = (
            "Actúa como un Perito Judicial en Lingüística Forense de Aseguradora del Sur. "
            "Tu tarea es auditar reclamaciones de siniestros e inspeccionar evidencias analíticamente buscando fraudes.\n\n"
            "Debes auditar:\n"
            "1. En Texto Libre (Narrativas): Busca distanciamiento pronominal (voz pasiva, transición de 'mi auto' a 'el vehículo'), "
            "deslizamientos de tiempo al presente histórico, o excesivas justificaciones innecesarias.\n"
            "2. En Evidencias (Fotos/Documentos): Realiza inspección analítica buscando incongruencias de diseño, "
            "parches superpuestos en montos numéricos, cambios de fuentes de texto u otras adulteraciones.\n\n"
            "Tu salida DEBE ser estrictamente un objeto JSON plano y limpio con este esquema exacto:\n"
            "{\n"
            "  \"fraud_linguistic_score\": <int entre 0 y 100>,\n"
            "  \"red_flags_detected\": [<lista de strings>],\n"
            "  \"justification\": \"<breve cadena con la fundamentación forense citando fragmentos evaluados>\"\n"
            "}"
        )

    def _get_active_api_key(self) -> str:
        """
        Retorna la API Key activa según el puntero global _key_index.
        """
        return settings.get_gemini_key(GeminiAgent._key_index)

    def _rotate_api_key(self) -> None:
        """
        Incrementa el puntero global utilizando operación módulo para conmutar a la siguiente API Key.
        """
        old_index = GeminiAgent._key_index
        GeminiAgent._key_index = (GeminiAgent._key_index + 1) % 5
        logger.warning(
            f"ROTACIÓN DE API KEY GEMINI: Conmutando índice {old_index} -> {GeminiAgent._key_index} debido a saturación o error."
        )

    async def analizar_siniestro_cognitivo(
        self,
        narrativa: str,
        metadatos_caso: Optional[Dict[str, Any]] = None,
        bypass: bool = False
    ) -> Dict[str, Any]:
        """
        Analiza de manera cognitiva la narrativa y metadatos de un siniestro utilizando Gemini 2.5 Flash.
        Soporta bypass instantáneo para modo de contingencia local basado en datos reales.
        """
        if bypass or settings.BYPASS_GEMINI:
            logger.warning("⚠️ BYPASS COGNITIVO ACTIVO: Ejecutando análisis lingüístico heurístico real en ContingencyManager.")
            return ContingencyManager.analizar_narrativa_local(narrativa, metadatos_caso)

        # Preparación del prompt de usuario
        contexto_adicional = json.dumps(metadatos_caso, indent=2) if metadatos_caso else "Ninguno"
        user_prompt = (
            f"--- NARRATIVA DEL SINIESTRO ---\n{narrativa}\n\n"
            f"--- CONTEXTO Y METADATOS DEL CASO ---\n{contexto_adicional}\n\n"
            f"Realiza el peritaje estilométrico y forense. Retorna únicamente el JSON estructurado."
        )

        max_attempts = 5
        
        for attempt in range(max_attempts):
            api_key = self._get_active_api_key()
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent?key={api_key}"
            
            headers = {"Content-Type": "application/json"}
            
            # Payload estructurado de acuerdo con la especificación de Gemini API
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": user_prompt}
                        ]
                    }
                ],
                "systemInstruction": {
                    "parts": [
                        {"text": self.system_instruction}
                    ]
                },
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.2
                }
            }

            try:
                logger.info(f"Iniciando intento {attempt + 1}/{max_attempts} de análisis cognitivo con API Key en índice {GeminiAgent._key_index}...")
                
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(url, headers=headers, json=payload)
                    
                    # Interceptar cuota agotada o límite de tasa (HTTP 429)
                    if response.status_code == 429:
                        logger.error(f"HTTP Error 429 (ResourceExhausted) en intento {attempt + 1} con API Key index {GeminiAgent._key_index}.")
                        self._rotate_api_key()
                        continue
                        
                    response.raise_for_status()
                    
                    # Parsear respuesta oficial de Gemini
                    result_json = response.json()
                    candidates = result_json.get("candidates", [])
                    if not candidates:
                        raise ValueError("No se recibieron candidatos válidos en la respuesta de Gemini.")
                        
                    content_text = candidates[0]["content"]["parts"][0]["text"].strip()
                    parsed_response = json.loads(content_text)
                    
                    logger.info("✓ Análisis cognitivo de Gemini completado con éxito.")
                    return {
                        "valido": True,
                        "fraud_linguistic_score": int(parsed_response.get("fraud_linguistic_score", 0)),
                        "red_flags_detected": list(parsed_response.get("red_flags_detected", [])),
                        "justification": str(parsed_response.get("justification", "Peritaje finalizado.")),
                        "model_used": self.model_name,
                        "key_index_used": GeminiAgent._key_index
                    }
                    
            except httpx.HTTPStatusError as e:
                status_code = e.response.status_code
                logger.error(f"HTTP Status Error {status_code} en intento {attempt + 1}: {str(e)}")
                # Si el error es 429, ya se rotó arriba, para cualquier otro error de API rotamos para diversificar
                self._rotate_api_key()
                
            except Exception as e:
                logger.error(f"Error inesperado en intento {attempt + 1}: {str(e)}")
                self._rotate_api_key()

        # ==============================================================================
        # CORTAFUEGOS DE EMERGENCIA LOCAL CON DATOS REALES (Caer de Pie)
        # ==============================================================================
        logger.critical("🚨 CORTAFUEGOS DE EMERGENCIA: Pool completo de API Keys agotado o saturado. Aplicando fallback de ContingencyManager con datos reales.")
        return ContingencyManager.analizar_narrativa_local(narrativa, metadatos_caso)

    async def consultar_chat_cognitivo(
        self,
        query: str,
        contexto_chat: Dict[str, Any],
        bypass: bool = False,
        target_lock: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Ejecuta consultas en lenguaje natural al chat agéntico utilizando Gemini 2.5 Flash.
        Soporta bypass, fallback y bloqueo de contexto /target basado en datos reales.
        """
        if bypass or settings.BYPASS_GEMINI:
            logger.warning("⚠️ BYPASS CHAT ACTIVO: Resolviendo consulta localmente a través de ContingencyManager.")
            return ContingencyManager.procesar_chat_local(query, contexto_chat)

        system_instructions_chat = (
            "Actúas como un Analista de Fraudes Senior e Inteligencia de Datos de Aseguradora del Sur. "
            "Tu tarea es responder a las preguntas analíticas del analista humano basadas exactamente en los datos de la base del sandbox proporcionados.\n\n"
            "Reglas:\n"
            "1. Responde de manera exacta, técnica, directa y estructurada.\n"
            "2. Identifica anomalías (como si un proveedor concentra colisiones o reclamaciones repetidas).\n"
            "3. NUNCA alucines información que no se encuentre explícitamente en el diccionario histórico.\n"
            "4. Si se te solicita, detalla las banderas rojas halladas.\n\n"
            "Tu salida debe ser estrictamente un JSON plano con el siguiente formato:\n"
            "{\n"
            "  \"response\": \"<explicación detallada en lenguaje natural respondiendo de forma exacta al analista>\",\n"
            "  \"red_flags_summary\": [<lista de strings detallando las banderas rojas identificadas en los datos>]\n"
            "}"
        )

        if target_lock:
            system_instructions_chat += (
                f"\n\n⚠️ REGLA DE ENFOQUE HERMÉTICO (/target) ACTIVA:\n"
                f"El usuario ha bloqueado el enfoque al tema: '{target_lock}'.\n"
                f"Debes ignorar cualquier otro siniestro, asegurado, o dato que no se relacione con este foco y responder única y exclusivamente sobre él. Sé extremadamente severo en mantener este límite."
            )
        
        user_prompt = (
            f"--- CONTEXTO DE LA BASE DE DATOS DEL SANDBOX ---\n"
            f"{json.dumps(contexto_chat, indent=2)}\n\n"
            f"--- CONSULTA DEL ANALISTA HUMANO ---\n"
            f"Pregunta: {query}\n\n"
            f"Por favor, responde estrictamente de acuerdo con las instrucciones de sistema provistas."
        )

        max_attempts = 5
        
        for attempt in range(max_attempts):
            api_key = self._get_active_api_key()
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent?key={api_key}"
            
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": user_prompt}
                        ]
                    }
                ],
                "systemInstruction": {
                    "parts": [
                        {"text": system_instructions_chat}
                    ]
                },
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.1
                }
            }
            
            try:
                logger.info(f"Iniciando intento {attempt + 1}/{max_attempts} de chat cognitivo con API Key en índice {GeminiAgent._key_index}...")
                
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(url, headers=headers, json=payload)
                    
                    if response.status_code == 429:
                        logger.error(f"HTTP Error 429 en chat en intento {attempt + 1} con API Key index {GeminiAgent._key_index}.")
                        self._rotate_api_key()
                        continue
                        
                    response.raise_for_status()
                    
                    result_json = response.json()
                    candidates = result_json.get("candidates", [])
                    if not candidates:
                        raise ValueError("No se recibieron candidatos válidos en la respuesta de chat de Gemini.")
                        
                    content_text = candidates[0]["content"]["parts"][0]["text"].strip()
                    parsed_response = json.loads(content_text)
                    
                    logger.info("✓ Consulta de chat de Gemini completada con éxito.")
                    return parsed_response
                    
            except httpx.HTTPStatusError as e:
                status_code = e.response.status_code
                logger.error(f"HTTP Status Error {status_code} en chat en intento {attempt + 1}: {str(e)}")
                self._rotate_api_key()
                
            except Exception as e:
                logger.error(f"Error inesperado en chat en intento {attempt + 1}: {str(e)}")
                self._rotate_api_key()

        # Cortafuegos de emergencia del chat con ContingencyManager real
        logger.critical("🚨 CORTAFUEGOS DE EMERGENCIA CHAT: Pool completo de API Keys agotado o saturado. Aplicando fallback de ContingencyManager.")
        return ContingencyManager.procesar_chat_local(query, contexto_chat)

