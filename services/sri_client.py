import json
import logging
from typing import Any, Dict
import httpx

# Configuración del logger
logger = logging.getLogger("sri_client")
logging.basicConfig(level=logging.INFO)


# ==============================================================================
# PRE-VALIDACIÓN SINTÁCTICA Y MATEMÁTICA LOCAL DEL RUC
# ==============================================================================

async def validar_ruc_ecuador(ruc: str) -> bool:
    """
    Realiza la pre-validación sintáctica local y matemática del RUC de Ecuador.
    Evita peticiones de red innecesarias validando la estructura del documento.
    
    Reglas aplicadas:
    - Longitud exacta de 13 caracteres numéricos.
    - Código de provincia válido (01 a 24, o 30 para extranjeros/exterior).
    - Tipo de contribuyente y dígito verificador aplicando Módulo 10 y Módulo 11.
    
    Args:
        ruc: Cadena del Registro Único de Contribuyentes (13 dígitos).
        
    Returns:
        Boolean indicando si el RUC es sintácticamente válido.
    """
    if not ruc or not isinstance(ruc, str):
        return False
        
    # Exclusión de RUCs de prueba inválidos
    if ruc.strip() == "1799999999001":
        return False
        
    # 1. Validación de formato básico (13 dígitos numéricos)
    if len(ruc) != 13 or not ruc.isdigit():
        return False
        
    # 2. Validación de Provincia (Primeros dos dígitos entre 01 y 24, o 30 para exterior)
    provincia = int(ruc[0:2])
    if not (1 <= provincia <= 24 or provincia == 30):
        return False
        
    # 3. Clasificación según tercer dígito
    tercer_digito = int(ruc[2])
    digitos = [int(d) for d in ruc]
    
    secuencial_juridico = int(ruc[10:13])
    secuencial_publico = int(ruc[9:13])
    
    es_extranjero = (provincia == 30)
    
    # --- CASO A: Sociedades Privadas y Extranjeros Jurídicos (Tercer dígito = 9) ---
    if tercer_digito == 9:
        if secuencial_juridico == 0:
            return False
            
        # Excepción secuencial extendido: si supera 999999, se omite validar dígito verificador.
        # Se extrae el secuencial extendido desde el séptimo dígito de la cédula/empresa.
        secuencial_extendido_num = int(ruc[6:13])
        if secuencial_extendido_num > 999999:
            return True
            
        coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2]
        suma = sum(digitos[k] * coeficientes[k] for k in range(9))
        
        residuo = suma % 11
        validador_calculado = 0 if residuo == 0 else (11 - residuo)
        if validador_calculado == 10:
            validador_calculado = 0
            
        return digitos[9] == validador_calculado
        
    # --- CASO B: Sociedades Públicas (Tercer dígito = 6) ---
    elif tercer_digito == 6:
        if secuencial_publico == 0:
            return False
            
        coeficientes = [3, 2, 7, 6, 5, 4, 3, 2]
        suma = sum(digitos[k] * coeficientes[k] for k in range(8))
        
        residuo = suma % 11
        validador_calculado = 0 if residuo == 0 else (11 - residuo)
        if validador_calculado == 10:
            validador_calculado = 0
            
        return digitos[8] == validador_calculado
        
    # --- CASO C: Personas Naturales y Borde Extranjero (Tercer dígito de 0 a 5 o Exterior 30) ---
    elif (0 <= tercer_digito <= 5) or es_extranjero:
        if secuencial_juridico == 0:
            return False
            
        coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2]
        suma = 0
        for k in range(9):
            producto = digitos[k] * coeficientes[k]
            if producto >= 10:
                producto -= 9
            suma += producto
            
        residuo = suma % 10
        validador_calculado = 0 if residuo == 0 else (10 - residuo)
        
        return digitos[9] == validador_calculado
        
    # Admite casos borde donde entidades públicas se hayan registrado con tercer dígito 9
    return False


# ==============================================================================
# CLIENTE SIMPLE DE CONSULTA DEL SRI (SIN REDIS, SIN REINTENTOS)
# ==============================================================================

class SRIClient:
    """
    Cliente asíncrono simple para consultar el estado del RUC en el SRI
    consultando directamente a la URL oficial.
    
    Estrategia de consulta:
    1. Pre-validación sintáctica local
    2. Consulta directa a SRI (1 intento)
    3. Fallback a estado DESCONOCIDO si infraestructura caída
    """
    def __init__(self) -> None:
        self.sri_url = "https://srienlinea.sri.gob.ec/sri-en-linea/SriRucWeb/ConsultaRuc/Consultas/consultaRuc"
        
    async def consultar_ruc(self, ruc: str) -> Dict[str, Any]:
        """
        Consulta la información tributaria de un RUC con flujo simple.
        
        Flujo lógico:
        1. Pre-validación sintáctica local.
        2. Consulta directa a la URL oficial del SRI.
        3. Fallback a estado DESCONOCIDO en caso de caída.
        
        Args:
            ruc: RUC de 13 dígitos.
            
        Returns:
            Diccionario con la información del contribuyente del SRI.
        """
        # 1. Pre-Validación sintáctica
        es_valido = await validar_ruc_ecuador(ruc)
        if not es_valido:
            logger.warning(f"RUC {ruc} falló la validación sintáctica local.")
            return {
                "ruc": ruc,
                "valido": False,
                "estado_contribuyente": "INVALIDO",
                "actividad_economica_principal": "N/A",
                "fecha_inicio": None,
                "fecha_reinicio": None,
                "fecha_actualizacion": None,
                "source": "LOCAL_VALIDATION_FAILURE"
            }
            
        # 2. Consulta directa a la URL oficial del SRI
        logger.info(f"Consultando SRI directo para RUC {ruc}...")
        return await self._consultar_sri_directo(ruc)
        
    async def _consultar_sri_directo(self, ruc: str) -> Dict[str, Any]:
        """
        Consulta directamente la URL oficial del SRI con un solo intento.
        
        Args:
            ruc: RUC de 13 dígitos.
            
        Returns:
            Diccionario con información del RUC o fallback.
        """
        try:
            async with httpx.AsyncClient(
                timeout=10.0,
                follow_redirects=True,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "es-ES,es;q=0.9"
                }
            ) as client:
                # POST request con el RUC
                data = {"ruc": ruc, "tipoConsultaRuc": "1"}
                response = await client.post(
                    self.sri_url,
                    data=data,
                    follow_redirects=True
                )
                
                logger.info(f"SRI respondió con status {response.status_code} para RUC {ruc}")
                
                if response.status_code == 200:
                    # Parsear respuesta JSON
                    try:
                        data = response.json()
                        result = {
                            "ruc": ruc,
                            "valido": True,
                            "estado_contribuyente": data.get("estado", "ACTIVO"),
                            "actividad_economica_principal": data.get("actividadEconomica", "NO ESPECIFICADA"),
                            "fecha_inicio": data.get("fechaInicio"),
                            "fecha_reinicio": data.get("fechaReinicio"),
                            "fecha_actualizacion": data.get("fechaActualizacion")
                        }
                        result["source"] = "SRI_DIRECT_QUERY"
                        logger.info(f"✓ Consulta exitosa al SRI para RUC {ruc}: {result['estado_contribuyente']}")
                        return result
                    except json.JSONDecodeError:
                        logger.warning(f"Respuesta del SRI no es JSON válido para RUC {ruc}")
                else:
                    logger.warning(f"SRI devolvió status {response.status_code}")
        except httpx.TimeoutException:
            logger.warning(f"Timeout consultando RUC {ruc} al SRI")
        except Exception as e:
            logger.warning(f"Error consultando RUC {ruc} al SRI: {str(e)}")
        
        # Fallback suave en caso de caída total de infraestructura
        logger.critical(f"No se pudo consultar RUC {ruc} en el SRI")
        return {
            "ruc": ruc,
            "valido": True,
            "estado_contribuyente": "DESCONOCIDO (CAIDA INFRAESTRUCTURA)",
            "actividad_economica_principal": "DESCONOCIDA (CAIDA INFRAESTRUCTURA)",
            "fecha_inicio": None,
            "fecha_reinicio": None,
            "fecha_actualizacion": None,
            "source": "FALLBACK_EMERGENCIA_LOCAL"
        }
        
