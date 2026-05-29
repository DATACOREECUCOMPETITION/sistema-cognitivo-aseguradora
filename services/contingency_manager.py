import logging
import re
from typing import Any, Dict, List, Optional
import pandas as pd
from services.evidence_extractor import EvidenceExtractor

logger = logging.getLogger("contingency_manager")
logging.basicConfig(level=logging.INFO)

# ==============================================================================
# MANEJADOR E IMPLEMENTACIÓN DE CONTINGENCIA COGNITIVA DESACOPLADA (DATOS REALES)
# ==============================================================================

class ContingencyManager:
    """
    Gestiona el estado y las operaciones del modo de contingencia cognitiva.
    
    En lugar de retornar datos simulados/estáticos, analiza lingüística y contextualment
    el caso en tiempo real sobre la base de datos física del sandbox y las heurísticas del texto.
    """
    
    # Registro en memoria de eventos de contingencia activados
    _registro_eventos: List[Dict[str, Any]] = []

    @classmethod
    def registrar_evento(cls, tipo_evento: str, detalle: str, claim_id: Optional[str] = None) -> None:
        """
        Registra un evento de contingencia para auditorías futuras (sentando las bases
        del registro de contingencias institucional).
        """
        evento = {
            "timestamp": pd.Timestamp.now().isoformat(),
            "tipo": tipo_evento,
            "detalle": detalle,
            "claim_id": claim_id or "N/A"
        }
        cls._registro_eventos.append(evento)
        logger.warning(f"🚨 REGISTRO DE CONTINGENCIA: [{tipo_evento}] - Siniestro: {claim_id} - Detalle: {detalle}")

    @classmethod
    def obtener_registro_eventos(cls) -> List[Dict[str, Any]]:
        """
        Retorna la lista de eventos de contingencia registrados hasta el momento.
        """
        return cls._registro_eventos

    @classmethod
    def analizar_narrativa_local(
        cls, 
        narrativa: str, 
        metadatos_caso: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analiza lingüísticamente la narrativa en local de manera factual (sin simulación estática).
        Evalúa el estilo, uso de voz, exclamaciones, y palabras sospechosas.
        
        Args:
            narrativa: Narrativa libre del siniestro.
            metadatos_caso: Datos contextuales del caso.
            
        Returns:
            Dict[str, Any] compatible con el esquema de GeminiAgent.
        """
        claim_id = metadatos_caso.get("claim_id") if metadatos_caso else None
        cls.registrar_evento(
            tipo_evento="ANALISIS_COGNITIVO_BYPASS",
            detalle="Ejecución de análisis lingüístico estilométrico heurístico local sobre narrativa física.",
            claim_id=claim_id
        )

        score_base = 15.0
        red_flags = []
        justificaciones = []

        # 1. Análisis de Excesiva Justificación / Extensión
        palabras = narrativa.split()
        if len(palabras) > 40:
            score_base += 15.0
            red_flags.append("EXCESO_EXPLICATIVO_NARRATIVA")
            justificaciones.append(f"Narrativa atípicamente larga ({len(palabras)} palabras) que busca sobre-justificar el siniestro.")
        elif len(palabras) < 6:
            score_base += 10.0
            red_flags.append("NARRATIVA_ULTRA_CORTA_EVASIVA")
            justificaciones.append("Narrativa evasiva o extremadamente escueta que omite detalles clave del suceso.")

        # 2. Análisis de Palabras Evasivas / Sospechosas (Distanciamiento de responsabilidad)
        palabras_sospechosas = {
            r"repentinamente": "Uso de adverbios de súbito para evadir culpa temporal.",
            r"de la nada": "Expresiones informales evasivas sobre causas externas.",
            r"súbitamente": "Evasión de culpa mediante eventos imprevistos no corroborados.",
            r"casualidad": "Apelación a coincidencia atípica.",
            r"coincidió": "Justificación basada en casualidades geográficas/temporales.",
            r"inesperadamente": "Narración estilística pasiva para deslindar control."
        }
        
        narrativa_lower = narrativa.lower()
        coincidencias_sospechosas = []
        for regex, desc in palabras_sospechosas.items():
            if re.search(regex, narrativa_lower):
                score_base += 10.0
                coincidencias_sospechosas.append(regex)
                if desc not in justificaciones:
                    justificaciones.append(desc)
                    
        if coincidencias_sospechosas:
            red_flags.append("LENGUAJE_EVASIVO_SOSPECHOSO")
            
        # 3. Análisis de distanciamiento pronominal (impersonalidad o voz pasiva)
        # Transición de posesivo personal ("mi auto") a descriptivo neutro ("el vehículo", "el carro")
        if re.search(r"\b(el vehículo|el carro|la unidad)\b", narrativa_lower) and not re.search(r"\b(mi auto|mi carro|mi vehículo|mi unidad)\b", narrativa_lower):
            score_base += 15.0
            red_flags.append("DISTANCIAMIENTO_PRONOMINAL")
            justificaciones.append("Uso de lenguaje impersonal neutro ('el vehículo') eludiendo la pertenencia directa de la propiedad.")

        # 4. Análisis de énfasis emocional/ortográfico (exclamaciones o mayúsculas)
        exclamaciones = narrativa.count("!")
        if exclamaciones > 1:
            score_base += 10.0
            red_flags.append("SOBRE_ENFASIS_EMOCIONAL")
            justificaciones.append(f"Uso atípico de exclamaciones ({exclamaciones}) que denota estrés lingüístico o fabulación emocional.")
            
        letras_mayus = sum(1 for c in narrativa if c.isupper())
        letras_total = sum(1 for c in narrativa if c.isalpha())
        if letras_total > 0 and (letras_mayus / letras_total) > 0.20:
            score_base += 10.0
            red_flags.append("NARRATIVA_MAYUSCULAS_ATIPICAS")
            justificaciones.append("Uso exagerado de mayúsculas (gritos tipográficos) para forzar veracidad.")

        # 5. Integración del contexto del RUC / Proveedor del SRI
        if metadatos_caso:
            sri_status = metadatos_caso.get("sri_status", "ACTIVO")
            if sri_status != "ACTIVO":
                score_base += 20.0
                red_flags.append("RIESGO_IDENTIDAD_CONTRIBUYENTE_SRI")
                justificaciones.append(f"El RUC del emisor reporta estatus tributario anómalo: {sri_status}.")

            monto = metadatos_caso.get("monto_reclamado", 0.0)
            if monto > 5000.0:
                score_base += 10.0
                justificaciones.append(f"Impacto financiero alto por monto superior al límite ($5,000): ${monto:,.2f}.")

            evidence_summary = metadatos_caso.get("evidence_summary")
            if evidence_summary:
                resumen = EvidenceExtractor.format_summary_text(evidence_summary)
                justificaciones.append(f"Evidencias: {resumen}")

        # Acotar score final
        score_final = int(min(100.0, score_base))
        justificacion_final = " | ".join(justificaciones) if justificaciones else "Análisis lingüístico local estándar sin alertas críticas de redacción detectadas."

        return {
            "valido": False,
            "fraud_linguistic_score": score_final,
            "red_flags_detected": red_flags if red_flags else ["ANALISIS_LOCAL_CONTINGENCIA"],
            "justification": f"[MODO CONTINGENCIA COGNITIVA LOCAL]: {justificacion_final}",
            "model_used": "CONTINGENCIA_ESTILOMETRICA_LOCAL",
            "key_index_used": -2
        }

    @classmethod
    def procesar_chat_local(
        cls, 
        query: str, 
        contexto_chat: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Procesa consultas analíticas sobre los DataFrames físicos reales de manera factual.
        Analiza la query buscando palabras clave y calcula datos sobre los siniestros o proveedores reales.
        
        Args:
            query: Consulta en lenguaje natural.
            contexto_chat: Diccionario con la base de datos serializada.
            
        Returns:
            Dict[str, Any] con "response" y "red_flags_summary".
        """
        cls.registrar_evento(
            tipo_evento="CONSULTA_CHAT_BYPASS",
            detalle=f"Consulta local resuelta mediante motor heurístico-analítico sobre bases de datos físicas."
        )

        query_lower = query.lower()
        
        # Recuperar listas del contexto
        siniestros = contexto_chat.get("historico_siniestros", [])
        proveedores = contexto_chat.get("historico_proveedores", [])
        asegurados = contexto_chat.get("historico_asegurados", [])

        # Convertir a DataFrames para manipulación relacional rápida
        df_sin = pd.DataFrame(siniestros) if siniestros else pd.DataFrame()
        df_prov = pd.DataFrame(proveedores) if proveedores else pd.DataFrame()
        df_aseg = pd.DataFrame(asegurados) if asegurados else pd.DataFrame()

        red_flags = ["CONTINGENCIA_ACTIVA"]
        response_text = ""

        # CASO 1: Consulta sobre proveedores/talleres
        if any(w in query_lower for w in ["proveedor", "proveedores", "taller", "talleres", "clínica", "clinica"]):
            if df_sin.empty or df_prov.empty:
                response_text = "El servicio de contingencia local no pudo analizar los proveedores debido a que el historial del sandbox está vacío."
            else:
                # Agrupar reclamos por proveedor para dar estadísticas reales
                conteo_proveedores = df_sin["proveedor_id"].value_counts()
                monto_proveedores = df_sin.groupby("proveedor_id")["monto_reclamado"].sum()
                
                # Mapear nombres de proveedores
                id_a_nombre = dict(zip(df_prov["proveedor_id"], df_prov["nombre"]))
                
                response_parts = [
                    "--- INFORME FACTUAL DE CONTINGENCIA: PROVEEDORES Y TALLERES ---",
                    "Se analizaron los proveedores históricos registrados en el sandbox local:"
                ]
                
                colusores = []
                for p_id, count in conteo_proveedores.items():
                    nombre = id_a_nombre.get(p_id, "Desconocido")
                    monto_total = monto_proveedores.get(p_id, 0.0)
                    response_parts.append(
                        f"• {nombre} ({p_id}): {count} siniestros tramitados | Monto total: ${monto_total:,.2f}"
                    )
                    # Alerta si un proveedor concentra muchas reclamaciones o montos altos
                    if count >= 2:
                        colusores.append(nombre)
                
                if colusores:
                    red_flags.append("CONCENTRACION_EXCESIVA_PROVEEDORES")
                    response_parts.append(
                        f"\n⚠️ ALERTA LOCAL: Se detecta concentración atípica de siniestralidad recurrente en: {', '.join(colusores)}."
                    )
                
                response_text = "\n".join(response_parts)

        # CASO 2: Consulta sobre asegurados / estres / fraudes
        elif any(w in query_lower for w in ["asegurado", "asegurados", "fraude", "estrés", "estres", "alertas", "riesgo"]):
            if df_sin.empty or df_aseg.empty:
                response_text = "La base de datos local está vacía en este sandbox."
            else:
                id_a_nombre = dict(zip(df_aseg["asegurado_id"], df_aseg["nombre_completo"]))
                id_a_estres = dict(zip(df_aseg["asegurado_id"], df_aseg["estres_financiero"]))
                
                response_parts = [
                    "--- INFORME FACTUAL DE CONTINGENCIA: RIESGO DE ASEGURADOS ---",
                    "Se inspeccionaron los perfiles de asegurados registrados en el sandbox:"
                ]
                
                con_estres = []
                for _, row in df_sin.iterrows():
                    aseg_id = row["asegurado_id"]
                    nombre = id_a_nombre.get(aseg_id, "Asegurado Desconocido")
                    estres = id_a_estres.get(aseg_id, False)
                    monto = row["monto_reclamado"]
                    
                    estres_str = "SÍ" if estres else "NO"
                    response_parts.append(
                        f"• Siniestro {row['claim_id']}: Asegurado: {nombre} ({aseg_id}) | Monto: ${monto:,.2f} | Estrés Financiero: {estres_str}"
                    )
                    
                    if estres:
                        con_estres.append(nombre)
                        
                if con_estres:
                    red_flags.append("ESTRES_FINANCIERO_ACTIVO")
                    response_parts.append(
                        f"\n⚠️ ALERTA LOCAL: Se detectan asegurados bajo estrés financiero con siniestros vigentes: {', '.join(set(con_estres))}."
                    )
                
                response_text = "\n".join(response_parts)

        # CASO 3: Respuesta general analítica sobre estadísticas de siniestros
        else:
            if df_sin.empty:
                response_text = "El sistema de contingencia local se encuentra activo. No hay siniestros cargados en el sandbox actual."
            else:
                total_reclamos = len(df_sin)
                monto_total = df_sin["monto_reclamado"].sum()
                monto_promedio = df_sin["monto_reclamado"].mean()
                
                response_text = (
                    "--- INFORME FACTUAL GENERAL DE CONTINGENCIA DE RED ---\n"
                    f"El chat de contingencia procesó tu consulta de manera local exitosamente.\n\n"
                    "📊 Estadísticas básicas del Sandbox:\n"
                    f"  • Total de reclamaciones físicas: {total_reclamos}\n"
                    f"  • Monto global reclamado: ${monto_total:,.2f}\n"
                    f"  • Costo medio por siniestro: ${monto_promedio:,.2f}\n\n"
                    "🔑 PALABRAS CLAVES DISPONIBLES EN CONTINGENCIA:\n"
                    "  • Escribe 'proveedores', 'talleres' o 'clínicas' para auditar colisiones y montos por taller.\n"
                    "  • Escribe 'asegurados', 'estrés', 'alerta' o 'riesgo' para identificar reclamaciones de asegurados en estrés financiero.\n\n"
                    "💡 SUGERENCIAS PARA EL BYPASS COGNITIVO:\n"
                    "  1. Si activaste el Switch manual, puedes apagarlo en la cabecera para regresar al modo híbrido con Gemini.\n"
                    "  2. Si estás experimentando caídas automáticas de Gemini, valida el estatus de las llaves en el pool del archivo `.env` (GEMINI_API_KEY_POOL).\n"
                    "  3. Asegúrate de levantar el servidor Redis local en el puerto `6379` para reactivar la Caché L2 y optimizar los tiempos de consulta del SRI."
                )

        return {
            "response": response_text,
            "red_flags_summary": red_flags
        }
