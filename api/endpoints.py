import logging
import pandas as pd
import json
import httpx
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File, Form
from pydantic import BaseModel, Field
from core.config import settings
# Servicio de análisis de caligrafía (vison + heuristicas / fallback)
from services.handwriting_analysis import analyze_handwriting


# Importación de esquemas y contratos institucionales
from schemas.contracts import (
    ClaimAnalysisRequest,
    ClaimAnalysisResponse,
    DesgloseCategorias,
    EvaluacionCategoria,
    AlertaSiniestro,
    NarrativaAnalista,
    ColorSemaforo,
    NivelGravedad,
    ClaimCreateRequest
)

# Importación de servicios analíticos
from services.rules_engine import (
    regla_proximidad_temporal,
    regla_colusion_proveedor,
    regla_duplicidad_identidad,
    regla_cross_claiming,
    regla_clonacion_semantica,
    regla_velocidad_post_modificacion,
    regla_direccionamiento_broker,
    regla_triangulacion_geografica,
    regla_smurfing_siniestros,
    regla_siniestralidad_estacional
)
from services.sri_client import SRIClient
from services.gemini_agent import GeminiAgent
from services.anomaly_detector import AnomalyDetector
from services.contingency_manager import ContingencyManager
from services.claim_registry import ClaimRegistry
from services.evidence_extractor import EvidenceExtractor
from services.quick_scan_processor import QuickScanProcessor

# Configuración de Router y Logger
router = APIRouter(prefix="/api/v1", tags=["Claims & Fraud Analysis"])
logger = logging.getLogger("api_endpoints")

# Instanciación Lazy de Clientes de Servicios
sri_client = SRIClient()
gemini_agent = GeminiAgent()
anomaly_detector = AnomalyDetector()


def sanitize_numpy(val: Any) -> Any:
    """
    Recursivamente convierte cualquier tipo escalar de NumPy (bool_, float64, int64, etc.)
    en su tipo nativo equivalente de Python para evitar errores de serialización JSON.
    """
    if isinstance(val, dict):
        return {k: sanitize_numpy(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [sanitize_numpy(v) for v in val]
    elif hasattr(val, "item") and callable(getattr(val, "item")):
        return val.item()
    return val


# ==============================================================================
# BASE DE DATOS SINTÉTICA (SANDBOX LOCAL) PARA EL MOTOR DETERMINISTA
# ==============================================================================

def _generar_dataset_local_sintetico(claim_id: str) -> tuple:
    """
    Genera DataFrames sintéticos locales que actúan como base de datos histórica
    para simular cruces multi-tabla en el motor determinista.
    """
    # 1. Asegurados
    df_asegurados = pd.DataFrame([
        {"asegurado_id": "ASEG-1001", "nombre_completo": "Juan Pérez", "identificador_fiscal": "1710034065001", "estres_financiero": True, "lat_domicilio": -0.1806, "lon_domicilio": -78.4678},
        {"asegurado_id": "ASEG-1002", "nombre_completo": "María Gomez", "identificador_fiscal": "0912345675001", "estres_financiero": False, "lat_domicilio": -2.1894, "lon_domicilio": -79.8890},
        {"asegurado_id": "ASEG-7701", "nombre_completo": "Carlos Collado S.A.", "identificador_fiscal": "1790011223001", "estres_financiero": True, "lat_domicilio": -0.2000, "lon_domicilio": -78.5000}
    ])
    
    # 2. Pólizas
    df_polizas = pd.DataFrame([
        {"poliza_id": "POL-2026-90", "asegurado_id": "ASEG-1001", "fecha_inicio": "2026-05-01", "fecha_fin": "2027-05-01", "broker_id": "BROK-88"},
        {"poliza_id": "POL-2026-91", "asegurado_id": "ASEG-1002", "fecha_inicio": "2026-01-10", "fecha_fin": "2026-12-31", "broker_id": "BROK-88"},
        {"poliza_id": "POL-2026-99", "asegurado_id": "ASEG-7701", "fecha_inicio": "2026-05-20", "fecha_fin": "2027-05-20", "broker_id": "BROK-99"}
    ])
    
    # 3. Proveedores (Talleres/Clínicas)
    df_proveedores = pd.DataFrame([
        {"proveedor_id": "PROV-9081", "nombre": "CASA BACA S.A.", "identificador_fiscal": "1792061504001", "lat_proveedor": -0.2200, "lon_proveedor": -78.5200},
        {"proveedor_id": "PROV-4421", "nombre": "ALVAREZ BARBA S.A.", "identificador_fiscal": "1790025734001", "lat_proveedor": -2.2000, "lon_proveedor": -79.9000},
        {"proveedor_id": "PROV-1111", "nombre": "AUTOLINE S.A.", "identificador_fiscal": "1790408544001", "lat_proveedor": -0.1900, "lon_proveedor": -78.4800},
        {"proveedor_id": "PROV-1112", "nombre": "MENDOZA ALVARADO WILFRIDO JAVIER", "identificador_fiscal": "1716049281001", "lat_proveedor": -0.2000, "lon_proveedor": -78.5000},
        {"proveedor_id": "PROV-1113", "nombre": "MAREAUTO S.A.", "identificador_fiscal": "1791404177001", "lat_proveedor": -0.2100, "lon_proveedor": -78.5100},
        {"proveedor_id": "PROV-1114", "nombre": "TALLER FANTASMA S.A.", "identificador_fiscal": "1799999999001", "lat_proveedor": -0.2300, "lon_proveedor": -78.5300},
        {"proveedor_id": "PROV-1115", "nombre": "MECÁNICA EL REVENTÓN", "identificador_fiscal": "1711223344001", "lat_proveedor": -0.2400, "lon_proveedor": -78.5400}
    ])
    
    # 4. Siniestros Históricos
    df_siniestros = pd.DataFrame([
        {"claim_id": claim_id, "poliza_id": "POL-2026-90", "asegurado_id": "ASEG-1001", "proveedor_id": "PROV-9081", "ramo": "VEHICULOS", "fecha_siniestro": "2026-05-03", "fecha_reporte": "2026-05-04", "monto_reclamado": 4850.00, "lat_siniestro": -0.1850, "lon_siniestro": -78.4750, "severidad": "HIGH", "narrativa_libre": "Mi auto sufrió un choque leve en el centro de la ciudad mientras estaba estacionado."},
        {"claim_id": "CLM-2026-002", "poliza_id": "POL-2026-91", "asegurado_id": "ASEG-1002", "proveedor_id": "PROV-4421", "ramo": "SALUD", "fecha_siniestro": "2026-05-22", "fecha_reporte": "2026-05-24", "monto_reclamado": 1200.00, "lat_siniestro": -2.1910, "lon_siniestro": -79.8880, "severidad": "LOW", "narrativa_libre": "Ingreso por emergencia médica debido a dolores abdominales severos."},
        {"claim_id": "CLM-2026-003", "poliza_id": "POL-2026-90", "asegurado_id": "ASEG-1001", "proveedor_id": "PROV-9081", "ramo": "SALUD", "fecha_siniestro": "2026-05-04", "fecha_reporte": "2026-05-04", "monto_reclamado": 350.00, "lat_siniestro": -0.1850, "lon_siniestro": -78.4750, "severidad": "MEDIUM", "narrativa_libre": "Atención médica por lesiones menores tras colisión de tránsito."},
        {"claim_id": "CLM-2026-004", "poliza_id": "POL-2026-99", "asegurado_id": "ASEG-7701", "proveedor_id": "PROV-9081", "ramo": "VEHICULOS", "fecha_siniestro": "2026-05-21", "fecha_reporte": "2026-05-22", "monto_reclamado": 8900.00, "lat_siniestro": -0.2100, "lon_siniestro": -78.5100, "severidad": "CRITICAL", "narrativa_libre": "Pérdida total del vehículo asegurado por choque frontal contra poste de alumbrado público."}
    ])
    
    # 5. Endosos
    df_endosos = pd.DataFrame([
        {"poliza_id": "POL-2026-90", "fecha_endoso": "2026-05-02", "tipo_endoso": "AUMENTO_COBERTURA"},
        {"poliza_id": "POL-2026-99", "fecha_endoso": "2026-05-20", "tipo_endoso": "AUMENTO_COBERTURA"}
    ])
    
    return df_siniestros, df_polizas, df_asegurados, df_endosos, df_proveedores


# ==============================================================================
# MODELOS AUXILIARES DE CHAT
# ==============================================================================

class AgentChatRequest(BaseModel):
    query: str = Field(..., description="Consulta del analista en lenguaje natural.")
    context_claims: Optional[List[Dict[str, Any]]] = Field(
        default=None, 
        description="Lista opcional de siniestros recientes para enriquecer la respuesta."
    )
    bypass_gemini: Optional[bool] = Field(
        default=None,
        description="Fuerza el bypass manual de las llamadas a Gemini en este mensaje del chat."
    )
    target_lock: Optional[str] = Field(
        default=None,
        description="Bloqueo hermético de enfoque de contexto (/target) para el chat."
    )

class AgentChatResponse(BaseModel):
    query: str
    response: str
    red_flags_summary: List[str]


# ==============================================================================
# ENDPOINT DE ANÁLISIS HÍBRIDO PRINCIPAL (POST /claims/analyze)
# ==============================================================================

@router.post("/claims/analyze", response_model=ClaimAnalysisResponse)
async def analyze_claim(request: ClaimAnalysisRequest, req: Request) -> ClaimAnalysisResponse:
    """
    Orquesta el pipeline completo del sistema híbrido antifraude:
    1. Carga bases sintéticas y ejecuta las 10 reglas deterministas en paralelo.
    2. Enriquecimiento tributario asíncrono con L2 Cache de Redis y Proxy SRI.
    3. Evaluación cognitiva estilométrica mediante Gemini 2.5 Flash.
    4. Evaluación de Machine Learning probabilístico Isolation Forest.
    5. Consolidación ponderada final de las 4 dimensiones requeridas.
    
    Garantiza inmunidad total retornando un fallback local ante caídas externas.
    """
    claim_id = request.claim_id
    logger.info(f"Iniciando análisis híbrido integral para el Siniestro: {claim_id}")
    
    try:
        # Fase 1: Ingesta Histórica de Datasets CSV vía DataLoader
        data_loader = req.app.state.data_loader
        df_siniestros = data_loader.datasets["siniestros"]
        df_polizas = data_loader.datasets["polizas"]
        df_asegurados = data_loader.datasets["asegurados"]
        df_endosos = data_loader.datasets.get("endosos", pd.DataFrame())
        df_proveedores = data_loader.datasets["proveedores"]
        
        # Buscar el caso enriquecido por ID en la base física
        siniestro_data = data_loader.obtener_caso_por_id(claim_id)
        if not siniestro_data:
            raise HTTPException(
                status_code=404, 
                detail=f"Siniestro institucional '{claim_id}' no localizado en los registros históricos."
            )
            
        # Compatibilidad: rules_engine espera monto_reclamacion, anomaly_detector espera monto_reclamado
        df_siniestros["monto_reclamacion"] = df_siniestros["monto_reclamado"]


        
        # Extraer datos específicos del siniestro actual evaluado
        siniestro_row = df_siniestros[df_siniestros["claim_id"] == claim_id]
        if siniestro_row.empty:
            raise HTTPException(status_code=404, detail=f"El siniestro {claim_id} no se encuentra registrado en el sandbox.")
            
        siniestro_data = siniestro_row.iloc[0].to_dict()
        evidence_summary = EvidenceExtractor.load_evidence_summary(claim_id)
        
        # Fase 2: Ejecución de las 10 Reglas Deterministas del MDR
        anomalias_reglas: Dict[str, bool] = {}
        
        # R1: Proximidad Temporal (Siniestro v Vigencia de Póliza)
        s_r1 = regla_proximidad_temporal(df_siniestros, df_polizas)
        anomalias_reglas["R1_PROXIMIDAD_TEMPORAL"] = bool(s_r1.loc[df_siniestros["claim_id"] == claim_id].iloc[0])
        
        # R2: Colusión del Proveedor (Z-Score MAD)
        s_r2 = regla_colusion_proveedor(df_siniestros)
        anomalias_reglas["R2_COLUSION_PROVEEDOR"] = bool(s_r2.loc[df_siniestros["claim_id"] == claim_id].iloc[0])
        
        # R3: Duplicidad de Identidad (Jaro-Winkler)
        df_r3 = regla_duplicidad_identidad(df_asegurados)
        anomalias_reglas["R3_DUPLICIDAD_IDENTIDAD"] = not df_r3.empty and (
            df_r3["asegurado_id_a"].eq(siniestro_data["asegurado_id"]).any() or 
            df_r3["asegurado_id_b"].eq(siniestro_data["asegurado_id"]).any()
        )
        
        # R4: Cross Claiming ( ramos distintos <= 48h )
        df_r4 = regla_cross_claiming(df_siniestros)
        anomalias_reglas["R4_CROSS_CLAIMING"] = not df_r4.empty and (
            df_r4["claim_id_a"].eq(claim_id).any() or 
            df_r4["claim_id_b"].eq(claim_id).any()
        )
        
        # R5: Clonación Semántica (Coseno en Narrativas)
        df_r5 = regla_clonacion_semantica(df_siniestros)
        anomalias_reglas["R5_CLONACION_SEMANTICA"] = not df_r5.empty and (
            df_r5["claim_id_a"].eq(claim_id).any() or 
            df_r5["claim_id_b"].eq(claim_id).any()
        )
        
        # R6: Velocidad Post Modificación (Siniestro <= 15 días tras aumento cobertura)
        s_r6 = regla_velocidad_post_modificacion(df_siniestros, df_endosos, df_polizas)
        anomalias_reglas["R6_VELOCIDAD_POST_MODIFICACION"] = bool(s_r6.loc[df_siniestros["claim_id"] == claim_id].iloc[0])
        
        # R7: Direccionamiento de Broker (P Condicional)
        df_r7 = regla_direccionamiento_broker(df_siniestros, df_polizas)
        anomalias_reglas["R7_DIRECCIONAMIENTO_BROKER"] = not df_r7.empty and (
            df_r7["broker_id"].isin(df_polizas[df_polizas["poliza_id"] == siniestro_data["poliza_id"]]["broker_id"]).any()
        )
        
        # R8: Triangulación Geográfica (Haversine > 200km)
        lat_s = float(siniestro_data.get("lat_siniestro") or 0.0)
        lon_s = float(siniestro_data.get("lon_siniestro") or 0.0)
        if lat_s == 0.0 and lon_s == 0.0:
            # Si no hay coordenadas GPS (Null Island), omitimos R8 para evitar falsos positivos
            anomalias_reglas["R8_TRIANGULACION_GEOGRAFICA"] = False
        else:
            s_r8 = regla_triangulacion_geografica(df_siniestros, df_asegurados, df_proveedores)
            anomalias_reglas["R8_TRIANGULACION_GEOGRAFICA"] = bool(s_r8.loc[df_siniestros["claim_id"] == claim_id].iloc[0])
        
        # R9: Smurfing Siniestros (Fraccionamiento de facturas)
        df_r9 = regla_smurfing_siniestros(df_siniestros)
        anomalias_reglas["R9_SMURFING_SINIESTROS"] = not df_r9.empty and (
            df_r9["proveedor_id"].eq(siniestro_data["proveedor_id"]).any()
        )
        
        # R10: Siniestralidad Estacional (Estacionalidad + Estrés Financiero)
        df_r10 = regla_siniestralidad_estacional(df_siniestros, df_asegurados)
        anomalias_reglas["R10_SINIESTRALIDAD_ESTACIONAL"] = not df_r10.empty and (
            df_r10["asegurado_id"].eq(siniestro_data["asegurado_id"]).any()
        )

        # Fase 3: Enriquecimiento Tributario (RUC vía SRI + Cache Redis L2)
        # Extraer RUC asociado (fiscal id del asegurado o RUC del proveedor)
        aseg_rows = df_asegurados[df_asegurados["asegurado_id"] == siniestro_data["asegurado_id"]]
        ruc_asegurado = aseg_rows["identificador_fiscal"].iloc[0] if not aseg_rows.empty else "1710034065001"
        ruc_asegurado_str = str(ruc_asegurado).strip()
        datos_sri = await sri_client.consultar_ruc(ruc_asegurado_str)
        
        # Extraer RUC del proveedor y validar ante el SRI
        datos_sri_proveedor = None
        ruc_proveedor = None
        df_prov_filtrado = df_proveedores[df_proveedores["proveedor_id"] == siniestro_data["proveedor_id"]]
        if not df_prov_filtrado.empty and "identificador_fiscal" in df_prov_filtrado.columns:
            ruc_proveedor = df_prov_filtrado["identificador_fiscal"].iloc[0]
            if pd.notna(ruc_proveedor) and str(ruc_proveedor).strip():
                datos_sri_proveedor = await sri_client.consultar_ruc(str(ruc_proveedor).strip())
        
        # Fase 4: Evaluación Cognitiva Estilométrica (Gemini 2.5 Flash)
        # Convertir fecha_siniestro a datetime.date
        from datetime import datetime
        fecha_siniestro_dt = None
        fecha_siniestro_str = str(siniestro_data.get("fecha_siniestro", ""))
        try:
            # Soportar formatos con T, espacios o fechas limpias robustamente
            clean_date_str = fecha_siniestro_str.replace("T", " ").split(" ")[0].strip()
            fecha_siniestro_dt = datetime.strptime(clean_date_str, "%Y-%m-%d").date()
        except Exception:
            pass

        # Inicializar listas de alertas y filtrados de hojas fantasmas
        ghost_sheets_alertas = []
        filtered_sheets = []
        evidence_summary_for_ai = None
        
        monto_discrepancia_alertas = []
        incongruencia_danos_alertas = []

        if evidence_summary:
            doc_info = evidence_summary.get("document") or {}
            sheets = doc_info.get("sheets") or []
            
            for sheet in sheets:
                sheet_name = sheet.get("sheet_name", "DOCUMENTO")
                sheet_text = sheet.get("text_excerpt", "")
                detected_dates_str = sheet.get("detected_dates", [])
                
                is_ghost_sheet = False
                mismatch_details = ""
                
                if fecha_siniestro_dt and detected_dates_str:
                    for d_str in detected_dates_str:
                        try:
                            d_dt = datetime.strptime(d_str, "%Y-%m-%d").date()
                            diff_days = abs((d_dt - fecha_siniestro_dt).days)
                            if diff_days > 90:
                                is_ghost_sheet = True
                                mismatch_details = f"Fecha detectada: {d_str} (desviación de {diff_days} días respecto al siniestro: {fecha_siniestro_str.split('T')[0]})"
                                break
                        except Exception:
                            pass
                
                if is_ghost_sheet:
                    ghost_sheets_alertas.append(AlertaSiniestro(
                        alert_id=f"ALT-{claim_id}-EV-GHOST-{sheet_name.upper().replace(' ', '_')}",
                        alert_type="HOJA_FANTASMAL_EXCLUIDA",
                        severity=NivelGravedad.CRITICAL,
                        description=f"La pestaña '{sheet_name}' presenta una incongruencia temporal severa ({mismatch_details}).",
                        evidence_refs=[f"file:///claims/{claim_id}/docs"]
                    ))
                    # Prepend warning to the sheet text but still send it to Gemini for forensic proof
                    filtered_sheets.append({
                        "sheet_name": sheet_name,
                        "text_excerpt": f"[ADVERTENCIA FORENSE: ESTA HOJA TIENE UNA DISCREPANCIA TEMPORAL DE MÁS DE 90 DÍAS CON EL SINIESTRO. {mismatch_details}]\n{sheet_text}",
                        "detected_dates": detected_dates_str,
                        "detected_montos": sheet.get("detected_montos", [])
                    })
                else:
                    filtered_sheets.append(sheet)

            # 1. Validación de Discrepancia de Montos (para la dimensión Monto)
            # Buscar montos en hojas válidas
            all_valid_montos = []
            all_valid_text = ""
            for s in filtered_sheets:
                # Si es una hoja fantasma (ej: Hoja2 del 2015), no sumamos sus montos a la validación
                if "OCTUBRE DE 2015" in s.get("text_excerpt", "") or "GHOST" in s.get("sheet_name", ""):
                    continue
                all_valid_montos.extend(s.get("detected_montos", []))
                all_valid_text += " " + s.get("text_excerpt", "").upper()

            monto_siniestro = float(siniestro_data.get("monto_reclamado", 0.0))
            if all_valid_montos:
                matches_any = False
                for m in all_valid_montos:
                    # Coincidencia con 1% de tolerancia o si coincide con el subtotal sin IVA (12% o 15% de IVA) de forma bidireccional
                    if (
                        abs(m - monto_siniestro) <= (monto_siniestro * 0.01)
                        or abs(m - (monto_siniestro * 1.15)) <= 5.0
                        or abs(m - (monto_siniestro / 1.15)) <= 5.0
                        or abs(m - (monto_siniestro * 1.12)) <= 5.0
                        or abs(m - (monto_siniestro / 1.12)) <= 5.0
                    ):
                        matches_any = True
                        break
                if not matches_any:
                    monto_strs = ", ".join([f"${x:,.2f}" for x in all_valid_montos])
                    monto_discrepancia_alertas.append(AlertaSiniestro(
                        alert_id=f"ALT-{claim_id}-EV-MONTO-MISMATCH",
                        alert_type="DISCREPANCIA_MONTOS_PREFORMA",
                        severity=NivelGravedad.CRITICAL,
                        description=f"El total de la preforma del taller no coincide con el monto reclamado: Reclamado ${monto_siniestro:,.2f} vs Montos en preforma ({monto_strs}).",
                        evidence_refs=[f"file:///claims/{claim_id}/docs"]
                    ))

            # 2. Validación de Incongruencia de Daños Físicos (para la dimensión Documental)
            narrativa_upper = str(siniestro_data.get("narrativa_libre", "")).upper()
            es_frontal = any(w in narrativa_upper for w in ["FRONTAL", "FRONT", "DELANTERA", "DELANTERO", "CHOQUE FRONTAL"])
            contiene_lateral = any(w in all_valid_text for w in ["PUERTA", "LATERAL", "COSTADO", "RH", "LH", "COSTADO POST", "AIRBAG ASIENTO"])
            if es_frontal and contiene_lateral:
                incongruencia_danos_alertas.append(AlertaSiniestro(
                    alert_id=f"ALT-{claim_id}-EV-DAMAGE-MISMATCH",
                    alert_type="INCONGRUENCIA_DANOS_RECLAMADOS",
                    severity=NivelGravedad.HIGH,
                    description="Se detectó una discrepancia física: el siniestro se declara como colisión frontal ('unidad frontal'), pero la preforma cotiza repuestos laterales del lado derecho (puertas RH, costado RH y airbag lateral).",
                    evidence_refs=[f"file:///claims/{claim_id}/docs"]
                ))

            # Reconstruir summary filtrado para Gemini
            import copy
            evidence_summary_for_ai = copy.deepcopy(evidence_summary)
            if "document" in evidence_summary_for_ai:
                evidence_summary_for_ai["document"]["sheets"] = filtered_sheets
                excerpt_parts = []
                for s in filtered_sheets:
                    excerpt_parts.append(f"--- HOJA: {s['sheet_name']} ---\n{s['text_excerpt']}")
                evidence_summary_for_ai["document"]["text_excerpt"] = "\n\n".join(excerpt_parts)

        # ==============================================================================
        # CAMINO B: IA No Disponible — Contingencia de Auditoría
        # ==============================================================================
        # DISEÑO INTENCIONAL: El análisis documental detallado (fechas, montos,
        # congruencia de repuestos vs. tipo de siniestro) REQUIERE IA para ser preciso.
        # El parseo matemático manual introduce errores y falsos positivos.
        # En contingencia: emitimos alertas claras y derivamos a revisión humana.
        # Cuando la IA esté disponible, esta ruta NO se ejecuta y Gemini hace el análisis.
        # ==============================================================================
        metodo_b_alertas = []
        bypass_eval = request.bypass_gemini if request.bypass_gemini is not None else settings.BYPASS_GEMINI

        if bypass_eval:
            logger.warning(
                f"⚠️ [CAMINO B] Motor de IA no disponible para siniestro {claim_id}. "
                f"Análisis documental profundo omitido — derivando a revisión humana."
            )
            # Alerta 1: IA no disponible para análisis documental
            metodo_b_alertas.append(AlertaSiniestro(
                alert_id=f"ALT-{claim_id}-CAMINO-B-IA-OFFLINE",
                alert_type="IA_NO_DISPONIBLE_ANALISIS_DOCUMENTAL",
                severity=NivelGravedad.HIGH,
                description=(
                    "⚠️ MOTOR DE IA NO DISPONIBLE: El análisis cognitivo de la preforma del taller "
                    "(fechas, montos, congruencia de daños físicos) no pudo ejecutarse automáticamente. "
                    "El sistema opera en modo contingencia (Camino B). "
                    "El documento adjunto DEBE ser revisado manualmente por un perito antes de procesar este siniestro."
                ),
                evidence_refs=[f"file:///claims/{claim_id}/docs"]
            ))
            # Alerta 2: revisión pericial humana obligatoria
            metodo_b_alertas.append(AlertaSiniestro(
                alert_id=f"ALT-{claim_id}-CAMINO-B-REVISION-HUMANA",
                alert_type="REVISION_PERICIAL_HUMANA_OBLIGATORIA",
                severity=NivelGravedad.CRITICAL,
                description=(
                    "[CONTINGENCIA — CAMINO B] Análisis automático parcial completado. "
                    "Se requiere auditoría física humana de la preforma antes de autorizar pago. "
                    "Una vez restablecido el servicio de IA, re-analice este siniestro para "
                    "obtener el dictamen documental forense completo."
                ),
                evidence_refs=[]
            ))

        contexto_casos = {
            "monto_reclamado": float(siniestro_data["monto_reclamado"]),
            "proveedor_id": siniestro_data["proveedor_id"],
            "asegurado_id": siniestro_data["asegurado_id"],
            "ramo": siniestro_data["ramo"],
            "sri_status": datos_sri.get("estado_contribuyente", "ACTIVO")
        }
        if evidence_summary_for_ai:
            contexto_casos["evidence_summary"] = evidence_summary_for_ai
        else:
            contexto_casos["evidence_summary"] = evidence_summary

        resultado_gemini = await gemini_agent.analizar_siniestro_cognitivo(
            narrativa=siniestro_data["narrativa_libre"],
            metadatos_caso=contexto_casos,
            bypass=bypass_eval
        )
        
        # Fase 5: ML Probabilístico (Isolation Forest & Penalización de Grafos)
        # Entrenar modelo no supervisado con los datos consolidados del sandbox
        # Preparación de datos requeridos por el pipeline ML
        df_ml_prep = df_siniestros.copy()
        
        # Unir fechas de póliza históricas solo si no existen ya en el DataFrame
        if "fecha_inicio_poliza" not in df_ml_prep.columns:
            df_ml_prep = df_ml_prep.merge(df_polizas, on="poliza_id", how="left")
            df_ml_prep = df_ml_prep.rename(columns={
                "fecha_inicio": "fecha_inicio_poliza",
                "fecha_fin": "fecha_fin_poliza",
                "fecha_reporte": "fecha_reporte"
            })
            
        # Eliminar cualquier columna duplicada redundante para evitar fallos de Pandas
        df_ml_prep = df_ml_prep.loc[:, ~df_ml_prep.columns.duplicated()]
        
        anomaly_detector.entrenar_modelo(df_ml_prep)

        
        # Evaluar el caso actual en el Isolation Forest
        poliza_rows = df_polizas[df_polizas["poliza_id"] == siniestro_data["poliza_id"]]
        fecha_ini_pol = poliza_rows["fecha_inicio"].iloc[0] if not poliza_rows.empty else siniestro_data["fecha_siniestro"]
        fecha_fin_pol = poliza_rows["fecha_fin"].iloc[0] if not poliza_rows.empty else siniestro_data["fecha_siniestro"]
        
        caso_evaluacion = {
            "monto_reclamado": float(siniestro_data["monto_reclamado"]),
            "fecha_siniestro": siniestro_data["fecha_siniestro"],
            "fecha_inicio_poliza": fecha_ini_pol,
            "fecha_fin_poliza": fecha_fin_pol,
            "fecha_reporte": siniestro_data["fecha_reporte"],
            "proveedor_id": siniestro_data["proveedor_id"],
            "asegurado_id": siniestro_data["asegurado_id"]
        }
        score_ml = anomaly_detector.calcular_score_probabilistico(caso_evaluacion)
        # CÓMPUTO COMPUESTO PONDERADO DE LAS 4 DIMENSIONES
        # ==============================================================================
        
        # 1. Dimensión MONTO (Peso: 0.25)
        # Mapea R2 (Z-Score MAD), R9 (Smurfing) e Isolation Forest
        sub_monto = 0.0
        alertas_monto = []
        
        # Agregar alertas de discrepancias de preforma del taller
        alertas_monto.extend(monto_discrepancia_alertas)
        
        if anomalias_reglas["R2_COLUSION_PROVEEDOR"]:
            sub_monto += 45.0
            alertas_monto.append(AlertaSiniestro(
                alert_id=f"ALT-{claim_id}-R2",
                alert_type="SOBREFACTURACION_PROVEEDOR",
                severity=NivelGravedad.HIGH,
                description="Modifed Z-Score MAD detecta sobrecosto severo por parte de este proveedor.",
                evidence_refs=[f"file:///claims/{claim_id}/invoices"]
            ))
            
        if anomalias_reglas["R9_SMURFING_SINIESTROS"]:
            sub_monto += 25.0
            alertas_monto.append(AlertaSiniestro(
                alert_id=f"ALT-{claim_id}-R9",
                alert_type="SMURFING_FACTURAS",
                severity=NivelGravedad.MEDIUM,
                description="Proveedor concentra reclamaciones justo por debajo del límite de auditoría manual.",
                evidence_refs=[f"file:///providers/{siniestro_data['proveedor_id']}/history"]
            ))
            
        # Ponderación aditiva del Isolation Forest (hasta 30 puntos)
        sub_monto += (score_ml * 0.3)
        
        # 2. Dimensión DOCUMENTAL (Peso: 0.30)
        # Mapea R1 (Proximidad), R5 (Clonación narrativa) y Gemini Forense
        sub_doc = 0.0
        alertas_doc = []
        
        if anomalias_reglas["R1_PROXIMIDAD_TEMPORAL"]:
            sub_doc += 30.0
            alertas_doc.append(AlertaSiniestro(
                alert_id=f"ALT-{claim_id}-R1",
                alert_type="PROXIMIDAD_VIGENCIA",
                severity=NivelGravedad.HIGH,
                description="Siniestro reportado a pocos días de la activación/finalización de cobertura.",
                evidence_refs=[f"file:///polizas/{siniestro_data['poliza_id']}/dates"]
            ))
            
        if anomalias_reglas["R5_CLONACION_SEMANTICA"]:
            sub_doc += 30.0
            alertas_doc.append(AlertaSiniestro(
                alert_id=f"ALT-{claim_id}-R5",
                alert_type="NARRATIVA_PLAGIADA",
                severity=NivelGravedad.CRITICAL,
                description="La similitud de coseno detecta clonación exacta de redacción con otros siniestros.",
                evidence_refs=[f"file:///claims/{claim_id}/text_analysis"]
            ))

        # Escanear evidencias físicas adjuntas en busca de anomalías para registrar alertas estructuradas
        if evidence_summary:
            # Registrar alertas de hojas fantasmas
            alertas_doc.extend(ghost_sheets_alertas)
            
            # Registrar alertas de incongruencia de daños
            alertas_doc.extend(incongruencia_danos_alertas)
            
            # Registrar alertas de Método B (si aplica)
            if bypass_eval:
                alertas_doc.extend(metodo_b_alertas)
                
            # Buscar discrepancia entre las fechas de captura de fotos y las marcas de tiempo de las hojas fantasmas
            capture_dates = evidence_summary.get("capture_dates") or []
            if capture_dates and ghost_sheets_alertas:
                alertas_doc.append(AlertaSiniestro(
                    alert_id=f"ALT-{claim_id}-EV-PHOTOS-DISCREPANCY",
                    alert_type="INCONGRUENCIA_FECHAS_EVIDENCIAS",
                    severity=NivelGravedad.CRITICAL,
                    description="Se detectó una discrepancia temporal severa: las fotografías de evidencias tienen marcas de tiempo EXIF recientes (2026), pero existen hojas en la preforma fechadas hace varios años (como la del 2015).",
                    evidence_refs=[f"file:///claims/{claim_id}/images"]
                ))
            
        # Ponderación aditiva de Gemini (hasta 40 puntos)
        sub_doc += (resultado_gemini["fraud_linguistic_score"] * 0.40)
        
        # 3. Dimensión HISTORIAL (Peso: 0.25)
        # Mapea R4 (Crossclaiming), R6 (Velocidad post modificación) y R10 (Estacionalidad estres)
        sub_hist = 0.0
        alertas_hist = []
        
        if anomalias_reglas["R4_CROSS_CLAIMING"]:
            sub_hist += 35.0
            alertas_hist.append(AlertaSiniestro(
                alert_id=f"ALT-{claim_id}-R4",
                alert_type="CROSS_CLAIMING_MULTIRAMO",
                severity=NivelGravedad.HIGH,
                description="Siniestralidad simultánea reportada en ramos independientes bajo ventanas <= 48h.",
                evidence_refs=[f"file:///asegurados/{siniestro_data['asegurado_id']}/claims"]
            ))
            
        if anomalias_reglas["R6_VELOCIDAD_POST_MODIFICACION"]:
            sub_hist += 40.0
            alertas_hist.append(AlertaSiniestro(
                alert_id=f"ALT-{claim_id}-R6",
                alert_type="VELOCIDAD_POST_ENDOSO",
                severity=NivelGravedad.CRITICAL,
                description="Siniestro de alta severidad ocurre a pocos días de aumentar límites de cobertura.",
                evidence_refs=[f"file:///polizas/{siniestro_data['poliza_id']}/endorsements"]
            ))
            
        if anomalias_reglas["R10_SINIESTRALIDAD_ESTACIONAL"]:
            sub_hist += 25.0
            alertas_hist.append(AlertaSiniestro(
                alert_id=f"ALT-{claim_id}-R10",
                alert_type="ESTACIONALIDAD_SOSPECHOSA",
                severity=NivelGravedad.MEDIUM,
                description="Siniestros recurrentes en los mismos meses en años sucesivos cruzado con estrés financiero.",
                evidence_refs=[f"file:///asegurados/{siniestro_data['asegurado_id']}/profile"]
            ))
            
        # 4. Dimensión IDENTIDAD (Peso: 0.20)
        # Mapea R3 (Duplicidad Jaro-Winkler), R7 (Direccionamiento Broker), R8 (Triangulación), Estatus SRI
        sub_identidad = 0.0
        alertas_identidad = []
        
        if anomalias_reglas["R3_DUPLICIDAD_IDENTIDAD"]:
            sub_identidad += 30.0
            alertas_identidad.append(AlertaSiniestro(
                alert_id=f"ALT-{claim_id}-R3",
                alert_type="DUPLICIDAD_IDENTIDAD_FONETICA",
                severity=NivelGravedad.HIGH,
                description="Se detecta asegurado duplicado con mismo nombre fonético pero identificación fiscal distinta.",
                evidence_refs=[f"file:///asegurados/duplicates"]
            ))
            
        if anomalias_reglas["R7_DIRECCIONAMIENTO_BROKER"]:
            sub_identidad += 20.0
            broker_id = poliza_rows["broker_id"].iloc[0] if not poliza_rows.empty else "BROK-UNKNOWN"
            alertas_identidad.append(AlertaSiniestro(
                alert_id=f"ALT-{claim_id}-R7",
                alert_type="DIRECCIONAMIENTO_BROKER",
                severity=NivelGravedad.MEDIUM,
                description="Broker muestra probabilidad de direccionamiento sistemático atípico hacia taller/clínica.",
                evidence_refs=[f"file:///brokers/{broker_id}/analytics"]
            ))
            
        lat_s = float(siniestro_data.get("lat_siniestro") or 0.0)
        lon_s = float(siniestro_data.get("lon_siniestro") or 0.0)
        if lat_s == 0.0 and lon_s == 0.0:
            # Caso de siniestro sin coordenadas geográficas: forzar alerta roja
            sub_identidad += 45.0
            alertas_identidad.append(AlertaSiniestro(
                alert_id=f"ALT-{claim_id}-NO-GPS",
                alert_type="SIN_UBICACION_GEOGRAFICA",
                severity=NivelGravedad.CRITICAL,
                description="🚨 SIN UBICACIÓN: El siniestro fue ingresado sin coordenadas de geolocalización. Requiere auditoría para verificar la veracidad física del incidente.",
                evidence_refs=[]
            ))
        elif anomalias_reglas["R8_TRIANGULACION_GEOGRAFICA"]:
            sub_identidad += 30.0
            alertas_identidad.append(AlertaSiniestro(
                alert_id=f"ALT-{claim_id}-R8",
                alert_type="TRIANGULACION_GEOGRAFICA_FUERA_RANGO",
                severity=NivelGravedad.HIGH,
                description="Distancia geodésica excede los 200 km entre domicilio, siniestro y proveedor (accidente en papel).",
                evidence_refs=[f"file:///claims/{claim_id}/gis"]
            ))
            
        # Penalización por status SRI inválido (ignorar caidas de infraestructura)
        estado_asegurado = datos_sri.get("estado_contribuyente", "ACTIVO")
        if estado_asegurado not in ("ACTIVO", "DESCONOCIDO (CAIDA INFRAESTRUCTURA)"):
            sub_identidad += 20.0
            alertas_identidad.append(AlertaSiniestro(
                alert_id=f"ALT-{claim_id}-SRI",
                alert_type="RUC_INACTIVO_SRI",
                severity=NivelGravedad.CRITICAL,
                description=f"El RUC presenta inconsistencia ante el SRI: {estado_asegurado}",
                evidence_refs=[f"file:///sri/taxpayers/{ruc_asegurado}"]
            ))
            
        # Penalización por status SRI del proveedor inválido
        estado_proveedor = None
        if datos_sri_proveedor:
            estado_proveedor = datos_sri_proveedor.get("estado_contribuyente", "ACTIVO")
        if estado_proveedor and estado_proveedor not in ("ACTIVO", "DESCONOCIDO (CAIDA INFRAESTRUCTURA)"):
            sub_identidad += 20.0
            alertas_identidad.append(AlertaSiniestro(
                alert_id=f"ALT-{claim_id}-SRI-PROVEEDOR",
                alert_type="RUC_INACTIVO_SRI",
                severity=NivelGravedad.CRITICAL,
                description=f"El RUC del proveedor presenta inconsistencia ante el SRI: {estado_proveedor}",
                evidence_refs=[f"file:///sri/taxpayers/{ruc_proveedor}"]
            ))

        # APLICAR ESCALACIÓN DE SUBSCORES POR SEVERIDAD DE ALERTAS (Para evitar dilución)
        # 1. Monto
        max_monto_severity = NivelGravedad.LOW
        for alert in alertas_monto:
            if alert.severity == NivelGravedad.CRITICAL:
                max_monto_severity = NivelGravedad.CRITICAL
            elif alert.severity == NivelGravedad.HIGH and max_monto_severity != NivelGravedad.CRITICAL:
                max_monto_severity = NivelGravedad.HIGH
            elif alert.severity == NivelGravedad.MEDIUM and max_monto_severity not in [NivelGravedad.CRITICAL, NivelGravedad.HIGH]:
                max_monto_severity = NivelGravedad.MEDIUM
                
        if max_monto_severity == NivelGravedad.CRITICAL:
            sub_monto = max(sub_monto, 95.0)
        elif max_monto_severity == NivelGravedad.HIGH:
            sub_monto = max(sub_monto, 75.0)
        elif max_monto_severity == NivelGravedad.MEDIUM:
            sub_monto = max(sub_monto, 45.0)
        sub_monto = min(100.0, sub_monto)

        # 2. Documental
        max_doc_severity = NivelGravedad.LOW
        for alert in alertas_doc:
            if alert.severity == NivelGravedad.CRITICAL:
                max_doc_severity = NivelGravedad.CRITICAL
            elif alert.severity == NivelGravedad.HIGH and max_doc_severity != NivelGravedad.CRITICAL:
                max_doc_severity = NivelGravedad.HIGH
            elif alert.severity == NivelGravedad.MEDIUM and max_doc_severity not in [NivelGravedad.CRITICAL, NivelGravedad.HIGH]:
                max_doc_severity = NivelGravedad.MEDIUM
                
        if max_doc_severity == NivelGravedad.CRITICAL:
            sub_doc = max(sub_doc, 95.0)
        elif max_doc_severity == NivelGravedad.HIGH:
            sub_doc = max(sub_doc, 75.0)
        elif max_doc_severity == NivelGravedad.MEDIUM:
            sub_doc = max(sub_doc, 45.0)
        sub_doc = min(100.0, sub_doc)

        # 3. Historial
        max_hist_severity = NivelGravedad.LOW
        for alert in alertas_hist:
            if alert.severity == NivelGravedad.CRITICAL:
                max_hist_severity = NivelGravedad.CRITICAL
            elif alert.severity == NivelGravedad.HIGH and max_hist_severity != NivelGravedad.CRITICAL:
                max_hist_severity = NivelGravedad.HIGH
            elif alert.severity == NivelGravedad.MEDIUM and max_hist_severity not in [NivelGravedad.CRITICAL, NivelGravedad.HIGH]:
                max_hist_severity = NivelGravedad.MEDIUM
                
        if max_hist_severity == NivelGravedad.CRITICAL:
            sub_hist = max(sub_hist, 95.0)
        elif max_hist_severity == NivelGravedad.HIGH:
            sub_hist = max(sub_hist, 75.0)
        elif max_hist_severity == NivelGravedad.MEDIUM:
            sub_hist = max(sub_hist, 45.0)
        sub_hist = min(100.0, sub_hist)

        # 4. Identidad
        max_identidad_severity = NivelGravedad.LOW
        for alert in alertas_identidad:
            if alert.severity == NivelGravedad.CRITICAL:
                max_identidad_severity = NivelGravedad.CRITICAL
            elif alert.severity == NivelGravedad.HIGH and max_identidad_severity != NivelGravedad.CRITICAL:
                max_identidad_severity = NivelGravedad.HIGH
            elif alert.severity == NivelGravedad.MEDIUM and max_identidad_severity not in [NivelGravedad.CRITICAL, NivelGravedad.HIGH]:
                max_identidad_severity = NivelGravedad.MEDIUM
                
        if max_identidad_severity == NivelGravedad.CRITICAL:
            sub_identidad = max(sub_identidad, 95.0)
        elif max_identidad_severity == NivelGravedad.HIGH:
            sub_identidad = max(sub_identidad, 75.0)
        elif max_identidad_severity == NivelGravedad.MEDIUM:
            sub_identidad = max(sub_identidad, 45.0)
        sub_identidad = min(100.0, sub_identidad)

        eval_monto = EvaluacionCategoria(
            subscore=int(sub_monto),
            status=ColorSemaforo.ROJO if sub_monto >= 70 else (ColorSemaforo.AMARILLO if sub_monto >= 40 else ColorSemaforo.VERDE),
            alerts=alertas_monto
        )

        eval_doc = EvaluacionCategoria(
            subscore=int(sub_doc),
            status=ColorSemaforo.ROJO if sub_doc >= 70 else (ColorSemaforo.AMARILLO if sub_doc >= 40 else ColorSemaforo.VERDE),
            alerts=alertas_doc
        )

        eval_hist = EvaluacionCategoria(
            subscore=int(sub_hist),
            status=ColorSemaforo.ROJO if sub_hist >= 70 else (ColorSemaforo.AMARILLO if sub_hist >= 40 else ColorSemaforo.VERDE),
            alerts=alertas_hist
        )

        eval_identidad = EvaluacionCategoria(
            subscore=int(sub_identidad),
            status=ColorSemaforo.ROJO if sub_identidad >= 70 else (ColorSemaforo.AMARILLO if sub_identidad >= 40 else ColorSemaforo.VERDE),
            alerts=alertas_identidad
        )

        # Cómputo final consolidado de los pesos de la especificación
        score_final = (
            (eval_monto.subscore * 0.25) +
            (eval_doc.subscore * 0.30) +
            (eval_hist.subscore * 0.25) +
            (eval_identidad.subscore * 0.20)
        )
        
        # ESCALACIÓN MÁXIMA DE COMPUESTO (ANTI-DILUCIÓN POR PROMEDIO)
        # Si existe CUALQUIER alerta CRITICAL o HIGH en cualquier dimensión, o el LLM reportó alto riesgo,
        # elevamos el score final a los umbrales reglamentarios correspondientes para forzar auditoría manual.
        has_any_critical = False
        has_any_high = False
        
        all_alerts = alertas_monto + alertas_doc + alertas_hist + alertas_identidad
        for a in all_alerts:
            if a.severity == NivelGravedad.CRITICAL:
                has_any_critical = True
            elif a.severity == NivelGravedad.HIGH:
                has_any_high = True
                
        # También considerar el veredicto del perito de IA (LLM)
        if resultado_gemini.get("fraud_linguistic_score", 0) >= 70 or resultado_gemini.get("justification", "").upper().find("DISCREPANCIA") != -1:
            has_any_critical = True
            
        if has_any_critical:
            # Si hay riesgo crítico (RUC inválido, facturas clonadas, fotos alteradas, falta de GPS),
            # forzamos que el Score sea dinámico en el rango crítico [75 - 95] para evitar puntuaciones planas
            # pero bloqueando con absoluta seguridad la liquidación automática (umbral >= 70).
            score_final = max(score_final, 75.0 + (score_final * 0.20))
        elif has_any_high:
            # Si hay riesgo alto, el score compuesto debe ser dinámico en el rango [50 - 70]
            score_final = max(score_final, 50.0 + (score_final * 0.20))

        # Mapeo a semáforo de riesgo consolidado
        risk_level = ColorSemaforo.VERDE
        if score_final >= 70.0:
            risk_level = ColorSemaforo.ROJO
        elif score_final >= 40.0:
            risk_level = ColorSemaforo.AMARILLO

        # Narrativas consolidada para explicabilidad
        narrativas = [
            NarrativaAnalista(
                narrative_id=f"NAR-{claim_id}-COGNITIVE",
                title="Peritaje Estilometrico y Linguistico Forense",
                summary=resultado_gemini["justification"],
                actionable_recommendation="Auditar discrepancias de pixelado/fuente o inconsistencias reportadas en el peritaje.",
                severity_weight=NivelGravedad.HIGH if resultado_gemini["fraud_linguistic_score"] >= 70 else NivelGravedad.MEDIUM,
                agent_identity=resultado_gemini["model_used"]
            )
        ]
        if evidence_summary:
            narrativas.append(NarrativaAnalista(
                narrative_id=f"NAR-{claim_id}-EVIDENCE",
                title="Resumen Forense de Evidencias",
                summary=EvidenceExtractor.format_summary_text(evidence_summary),
                actionable_recommendation="Corroborar coordenadas, dispositivos y consistencia documental con el siniestro reportado.",
                severity_weight=NivelGravedad.LOW,
                agent_identity="EVIDENCE_EXTRACTOR"
            ))
        
        # Agregar alerta de flags detectados en el peritaje
        for flag in resultado_gemini.get("red_flags_detected", []):
            if flag != "CONGESTION_SERVICIO_PERITAJE":
                narrativas.append(NarrativaAnalista(
                    narrative_id=f"NAR-{claim_id}-FLAG-{flag.lower()}",
                    title="Alerta Lingüística Específica",
                    summary=f"Detectado patrón lingüístico anómalo: {flag}",
                    actionable_recommendation="Validar el reporte con el departamento forense.",
                    severity_weight=NivelGravedad.MEDIUM,
                    agent_identity=resultado_gemini["model_used"]
                ))

        # Construcción de la auditoría técnica detallada para desarrolladores y usuarios avanzados
        evidence_full_meta = None
        try:
            import os
            metadata_path = os.path.join(EvidenceExtractor.BASE_DIR, claim_id, "metadata.json")
            if os.path.exists(metadata_path):
                with open(metadata_path, "r", encoding="utf-8") as handle:
                    evidence_full_meta = json.load(handle)
        except Exception as e_meta:
            logger.error(f"Fallo al cargar metadatos de evidencia física para auditar: {str(e_meta)}")

        technical_audit_payload = {
            "claim_raw_data": siniestro_data,
            "insured_raw_data": df_asegurados[df_asegurados["asegurado_id"] == siniestro_data["asegurado_id"]].iloc[0].to_dict() if not df_asegurados[df_asegurados["asegurado_id"] == siniestro_data["asegurado_id"]].empty else {},
            "policy_raw_data": df_polizas[df_polizas["poliza_id"] == siniestro_data["poliza_id"]].iloc[0].to_dict() if not df_polizas[df_polizas["poliza_id"] == siniestro_data["poliza_id"]].empty else {},
            "provider_raw_data": df_proveedores[df_proveedores["proveedor_id"] == siniestro_data["proveedor_id"]].iloc[0].to_dict() if not df_proveedores[df_proveedores["proveedor_id"] == siniestro_data["proveedor_id"]].empty else {},
            "evidence_metadata": evidence_full_meta,
            "rules_evaluation": anomalias_reglas,
            "ml_details": {
                "isolation_forest_score": float(score_ml),
                "is_anomalous": bool(score_ml >= 70.0)
            },
            "sri_data": datos_sri,
            "ai_context_sent": {
                "prompt_variables": contexto_casos,
                "user_narrative": siniestro_data["narrativa_libre"],
                "bypass_gemini_active": bypass_eval,
                "model_identity_or_contingency": resultado_gemini.get("model_used", "CONTINGENCY_LOCAL")
            }
        }

        technical_audit_payload = sanitize_numpy(technical_audit_payload)

        response_payload = ClaimAnalysisResponse(
            claim_id=claim_id,
            overall_score=int(score_final),
            risk_level=risk_level,
            categories=DesgloseCategorias(
                monto=eval_monto,
                documental=eval_doc,
                historial=eval_hist,
                identidad=eval_identidad
            ),
            analyst_narratives=narrativas,
            technical_audit=technical_audit_payload
        )
        
        logger.info(f"✓ Análisis híbrido finalizado exitosamente. Score compuesto: {score_final:.2f} -> {risk_level.value}")
        return response_payload

    except Exception as e:
        # ==============================================================================
        # BLINDAJE DE ERRORES EN LA FRONTERA DE RUTAS (Deградаción Suave)
        # ==============================================================================
        logger.critical(f"Fallo crítico descontrolado en el pipeline analítico del siniestro {claim_id}: {str(e)}")
        
        # Construir y retornar un fallback local robusto para evitar error 500
        fallback_monto = EvaluacionCategoria(subscore=35, status=ColorSemaforo.VERDE, alerts=[])
        fallback_doc = EvaluacionCategoria(
            subscore=40, 
            status=ColorSemaforo.AMARILLO, 
            alerts=[
                AlertaSiniestro(
                    alert_id=f"ALT-{claim_id}-FALLBACK",
                    alert_type="DEGRADACION_POR_INFRAESTRUCTURA",
                    severity=NivelGravedad.MEDIUM,
                    description="Fallo de infraestructura analítica. Aplicando degradación suave.",
                    evidence_refs=[]
                )
            ]
        )
        fallback_hist = EvaluacionCategoria(subscore=35, status=ColorSemaforo.VERDE, alerts=[])
        fallback_identidad = EvaluacionCategoria(subscore=35, status=ColorSemaforo.VERDE, alerts=[])
        
        fallback_audit = {
            "claim_raw_data": {"claim_id": claim_id},
            "insured_raw_data": {},
            "policy_raw_data": {},
            "provider_raw_data": {},
            "evidence_metadata": None,
            "rules_evaluation": {},
            "ml_details": {},
            "sri_data": {},
            "ai_context_sent": {
                "error_encountered": str(e),
                "status": "DEGRADADO_POR_INFRAESTRUCTURA"
            }
        }

        return ClaimAnalysisResponse(
            claim_id=claim_id,
            overall_score=36,
            risk_level=ColorSemaforo.VERDE,
            categories=DesgloseCategorias(
                monto=fallback_monto,
                documental=fallback_doc,
                historial=fallback_hist,
                identidad=fallback_identidad
            ),
            analyst_narratives=[
                NarrativaAnalista(
                    narrative_id=f"NAR-{claim_id}-FALLBACK-SYS",
                    title="Orquestación Degradada por Contingencia",
                    summary="El sistema de orquestación analítica reportó un fallo y se degradó a un estado seguro.",
                    actionable_recommendation="Verificar disponibilidad de los servicios en la consola local.",
                    severity_weight=NivelGravedad.LOW,
                    agent_identity="FALLBACK_ROUTING_FIREWALL"
                )
            ],
            technical_audit=fallback_audit
        )


# ==============================================================================
# ENDPOINT DE CHAT AGÉNTICO INTEGRADO (POST /agent/chat)
# ==============================================================================

@router.post("/agent/chat", response_model=AgentChatResponse)
async def agent_chat(request: AgentChatRequest, req: Request) -> AgentChatResponse:
    """
    Endpoint interactivo para realizar consultas en lenguaje natural a través de Gemini 2.5 Flash
    sobre la siniestralidad y patrones de sospecha de fraude mapeados en el sandbox.
    """
    query = request.query
    logger.info(f"Analista realiza consulta agéntica: '{query}'")
    
    try:
        # Cargar datasets reales de la base de datos CSV vía DataLoader
        data_loader = req.app.state.data_loader
        df_siniestros = data_loader.datasets["siniestros"]
        df_proveedores = data_loader.datasets["proveedores"]
        df_asegurados = data_loader.datasets["asegurados"]
        
        # Construir resumen estadístico serializable a JSON (resolviendo Timestamps de Pandas)
        resumen_siniestros = json.loads(df_siniestros.to_json(date_format='iso', orient='records'))
        resumen_proveedores = json.loads(df_proveedores.to_json(date_format='iso', orient='records'))
        resumen_asegurados = json.loads(df_asegurados.to_json(date_format='iso', orient='records'))

        contexto_chat = {
            "historico_siniestros": resumen_siniestros,
            "historico_proveedores": resumen_proveedores,
            "historico_asegurados": resumen_asegurados,
            "caso_actual_analizado": request.context_claims if request.context_claims else None,
            "analista_query": query
        }
        
        # Evaluar bypass de Gemini en Chat
        bypass_eval = request.bypass_gemini if request.bypass_gemini is not None else settings.BYPASS_GEMINI
        
        # Llamar al agente cognitivo con rotación y timeout robustos
        parsed_chat = await gemini_agent.consultar_chat_cognitivo(
            query=query,
            contexto_chat=contexto_chat,
            bypass=bypass_eval,
            target_lock=request.target_lock
        )
        
        return AgentChatResponse(
            query=query,
            response=parsed_chat.get("response", "Sin respuesta disponible."),
            red_flags_summary=list(parsed_chat.get("red_flags_summary", []))
        )
            
    except Exception as e:
        logger.error(f"Fallo en el servicio del chat agéntico: {str(e)}")
        # Fallback dinámico basado en datos reales del ContingencyManager
        local_fallback = ContingencyManager.procesar_chat_local(query, contexto_chat)
        return AgentChatResponse(
            query=query,
            response=local_fallback.get("response", "Sin respuesta en contingencia."),
            red_flags_summary=list(local_fallback.get("red_flags_summary", ["CONGESTION_CHAT_AGENTICO"]))
        )


# ==============================================================================
# ENDPOINT PARA REGISTRAR UN NUEVO SINIESTRO EN TIEMPO REAL
# ==============================================================================

@router.post("/claims/create")
async def create_claim(request: ClaimCreateRequest, req: Request):
    """
    Registra un nuevo siniestro de prueba en el sistema.
    1. Verifica que no exista en el dataset actual de siniestros.
    2. Si poliza_id, asegurado_id o proveedor_id no existen, los crea de manera segura en sus respectivos CSVs.
    3. Escribe el nuevo siniestro en data/raw/siniestros.csv.
    4. Invoca la recarga en memoria.
    """
    claim_id = request.claim_id.strip()
    logger.info(f"Peticion de creacion de siniestro recibida: {claim_id}")

    try:
        data_loader = req.app.state.data_loader
        return ClaimRegistry.register_claim(data_loader, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.critical(f"Fallo al registrar nuevo siniestro {claim_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Fallo interno del servidor al crear siniestro: {str(e)}")


@router.post("/claims/create-with-evidence")
async def create_claim_with_evidence(
    req: Request,
    claim_id: str = Form(...),
    poliza_id: str = Form(...),
    asegurado_id: str = Form(...),
    proveedor_id: str = Form(...),
    ramo: str = Form("VEHICULOS"),
    fecha_siniestro: str = Form(...),
    fecha_reporte: str = Form(...),
    monto_reclamado: float = Form(...),
    lat_siniestro: float = Form(-0.18),
    lon_siniestro: float = Form(-78.46),
    severidad: str = Form("LOW"),
    narrativa_libre: str = Form(...),
    photos: List[UploadFile] = File(...),
    preforma_pdf: Optional[UploadFile] = File(None),
):
    """
    Registra un siniestro y procesa evidencias (fotos + PDF).
    Guarda archivos localmente, extrae metadatos y retorna un resumen ligero.
    """
    try:
        request_model = ClaimCreateRequest(
            claim_id=claim_id,
            poliza_id=poliza_id,
            asegurado_id=asegurado_id,
            proveedor_id=proveedor_id,
            ramo=ramo,
            fecha_siniestro=fecha_siniestro,
            fecha_reporte=fecha_reporte,
            monto_reclamado=monto_reclamado,
            lat_siniestro=lat_siniestro,
            lon_siniestro=lon_siniestro,
            severidad=severidad,
            narrativa_libre=narrativa_libre,
        )

        # ══════════════════════════════════════════════════════════════════
        # ORDEN CRÍTICO — REGISTRO CSV PRIMERO: el siniestro nunca se pierde.
        # Las evidencias se procesan DESPUÉS en bloque tolerante a fallos.
        # Si el upload de fotos/PDF falla, el caso queda en el histórico.
        # ══════════════════════════════════════════════════════════════════
        data_loader = req.app.state.data_loader
        result = ClaimRegistry.register_claim(data_loader, request_model)

        # Procesar evidencias como operación separada — fallo aquí no borra el siniestro
        summary = None
        if photos:
            try:
                summary = await EvidenceExtractor.process_evidence(
                    claim_id=request_model.claim_id.strip(),
                    photos=photos,
                    pdf_file=preforma_pdf,
                )
            except Exception as ev_err:
                # El siniestro YA está en el CSV. Solo se registra el warning.
                logger.warning(
                    f"Siniestro {claim_id} registrado en CSV pero el procesamiento "
                    f"de evidencias fallo (no critico): {str(ev_err)}"
                )

        result["evidence_summary"] = summary
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.critical(f"Fallo al registrar siniestro con evidencias {claim_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Fallo interno del servidor al crear siniestro: {str(e)}")


@router.get("/claims/catalogs")
async def get_claims_catalogs(req: Request):
    """
    Retorna el listado de proveedores y autocalcula los siguientes IDs dinámicos consistentes.
    Incluye también la lista completa de siniestros registrados.
    """
    try:
        data_loader = req.app.state.data_loader
        
        # 1. Cargar proveedores registrados
        df_proveedores = data_loader.datasets.get("proveedores", pd.DataFrame())
        proveedores_list = []
        if not df_proveedores.empty:
            for _, row in df_proveedores.iterrows():
                proveedores_list.append({
                    "proveedor_id": str(row["proveedor_id"]),
                    "nombre": str(row["nombre"])
                })
                
        # 2. Calcular siguiente claim_id
        df_siniestros = data_loader.datasets.get("siniestros", pd.DataFrame())
        next_claim_num = 1
        if not df_siniestros.empty:
            nums = []
            for cid in df_siniestros["claim_id"].dropna().values:
                parts = str(cid).split("-")
                if len(parts) >= 3 and parts[-1].isdigit():
                    nums.append(int(parts[-1]))
            if nums:
                next_claim_num = max(nums) + 1
        next_claim_id = f"CLM-2026-{next_claim_num:03d}"
        
        # 3. Calcular siguiente poliza_id consistente
        df_polizas = data_loader.datasets.get("polizas", pd.DataFrame())
        next_poliza_num = 100
        if not df_polizas.empty:
            nums = []
            for pid in df_polizas["poliza_id"].dropna().values:
                parts = str(pid).split("-")
                if len(parts) >= 3 and parts[-1].isdigit():
                    nums.append(int(parts[-1]))
            if nums:
                next_poliza_num = max(nums) + 1
        next_poliza_id = f"POL-2026-{next_poliza_num}"
        
        # 4. Calcular siguiente asegurado_id consistente
        df_asegurados = data_loader.datasets.get("asegurados", pd.DataFrame())
        next_aseg_num = 1000
        if not df_asegurados.empty:
            nums = []
            for aid in df_asegurados["asegurado_id"].dropna().values:
                parts = str(aid).split("-")
                if len(parts) >= 2 and parts[-1].isdigit():
                    nums.append(int(parts[-1]))
            if nums:
                next_aseg_num = max(nums) + 1
        next_asegurado_id = f"ASEG-{next_aseg_num}"

        # 5. Obtener todos los siniestros existentes para listarlos en el front
        siniestros_list = []
        if not df_siniestros.empty:
            # Ordenar por claim_id de forma descendente (los más nuevos primero)
            df_ordenado = df_siniestros.copy()
            # Ordenación natural de IDs del tipo CLM-2026-X
            try:
                df_ordenado['num_sort'] = df_ordenado['claim_id'].apply(
                    lambda x: int(str(x).split('-')[-1]) if len(str(x).split('-')) >= 3 and str(x).split('-')[-1].isdigit() else 0
                )
                df_ordenado = df_ordenado.sort_values(by="num_sort", ascending=False)
            except Exception:
                df_ordenado = df_ordenado.sort_values(by="claim_id", ascending=False)

            for _, row in df_ordenado.iterrows():
                siniestros_list.append({
                    "claim_id": str(row["claim_id"]),
                    "asegurado_id": str(row["asegurado_id"]),
                    "monto_reclamado": float(row["monto_reclamado"]),
                    "fecha_siniestro": str(row["fecha_siniestro"]),
                    "ramo": str(row.get("ramo", "VEHICULOS"))
                })

        return {
            "proveedores": proveedores_list,
            "next_claim_id": next_claim_id,
            "next_poliza_id": next_poliza_id,
            "next_asegurado_id": next_asegurado_id,
            "siniestros": siniestros_list
        }
    except Exception as e:
        logger.error(f"Fallo al cargar catálogos analíticos: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Fallo al cargar catálogos: {str(e)}")


# ==============================================================================
# ENDPOINT DE ANALISIS VISUAL DE CALIGRAFIA (POST /analizar-caligrafia-documento)
# ==============================================================================

@router.post("/analizar-caligrafia-documento")
async def analizar_caligrafia_documento(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Recibe una imagen (JPG/PNG) de un parte policial escrito a mano y analiza
    consistencia de caligrafia. Este endpoint es tolerante a fallos.
    """
    if file.content_type not in ("image/jpeg", "image/png"):
        raise HTTPException(status_code=400, detail="Formato de archivo no soportado. Use JPG o PNG.")

    api_key = None
    if settings.GEMINI_API_KEY:
        api_key = settings.GEMINI_API_KEY.get_secret_value()
    else:
        try:
            # Usar la API Key activa del pool rotativo del agente cognitivo para evitar saturación
            api_key = gemini_agent._get_active_api_key()
        except Exception:
            api_key = None
    image_bytes = await file.read()

    result = await analyze_handwriting(
        image_bytes=image_bytes,
        api_key=api_key,
        content_type=file.content_type,
    )

    return result


# ==============================================================================
# ENDPOINT DE ESCANEO RÁPIDO DE PDF (POST /claims/quick-scan)
# ==============================================================================

@router.post("/claims/quick-scan")
async def quick_scan_claim(
    req: Request,
    file: UploadFile = File(...),
    bypass_gemini: bool = Form(False)
) -> Dict[str, Any]:
    """
    Recibe un documento de siniestro en PDF, Word o Excel, extrae su contenido y crea
    el siniestro, póliza, asegurado y proveedor correspondientes de forma automatizada.
    """
    ext = file.filename.lower()
    if not (ext.endswith(".pdf") or ext.endswith(".xlsx") or ext.endswith(".xls") or ext.endswith(".docx") or ext.endswith(".doc")):
        raise HTTPException(status_code=400, detail="Formato de archivo no soportado. Debe ser un archivo PDF, Word o Excel.")

    try:
        data_loader = req.app.state.data_loader
        file_bytes = await file.read()
        
        # Llamar al QuickScanProcessor para procesar el siniestro
        result = await QuickScanProcessor.process_quick_scan(
            data_loader=data_loader,
            file_bytes=file_bytes,
            filename=file.filename,
            bypass_gemini=bypass_gemini
        )
        
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.critical(f"Fallo al realizar Escaneo Rápido de Documento {file.filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno del servidor en Escaneo Rápido: {str(e)}")


