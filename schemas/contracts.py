from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

class ColorSemaforo(str, Enum):
    """
    Representa el estado del semáforo de riesgo analítico.
    """
    VERDE = "VERDE"
    AMARILLO = "AMARILLO"
    ROJO = "ROJO"

class NivelGravedad(str, Enum):
    """
    Define los niveles de gravedad estándar para las alertas de siniestros.
    """
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class ClaimAnalysisRequest(BaseModel):
    """
    Esquema de entrada para solicitar el análisis de un siniestro (claim).
    """
    model_config = ConfigDict(populate_by_name=True)

    claim_id: str = Field(
        ...,
        pattern=r"^CLM-[0-9]{4}-[0-9]+$",
        description="Identificador único institucional del siniestro con formato CLM-YYYY-ID."
    )
    bypass_gemini: Optional[bool] = Field(
        default=None,
        description="Fuerza el bypass manual de las llamadas a Gemini en este análisis."
    )

class AlertaSiniestro(BaseModel):
    """
    Representa una alerta individual detectada durante el análisis del siniestro.
    """
    model_config = ConfigDict(populate_by_name=True)

    alert_id: str = Field(..., description="ID único de la alerta.")
    alert_type: str = Field(..., description="Categoría o tipo de alerta detectada.")
    severity: NivelGravedad = Field(..., description="Nivel de gravedad de la alerta.")
    description: str = Field(..., description="Descripción detallada de la anomalía hallada.")
    evidence_refs: List[str] = Field(..., description="Lista de referencias de evidencias (URLs, IDs de archivos).")
    forensic_metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Metadatos forenses adicionales opcionales para análisis detallado."
    )

class EvaluacionCategoria(BaseModel):
    """
    Evaluación agregada para una dimensión específica de riesgo.
    """
    model_config = ConfigDict(populate_by_name=True)

    subscore: int = Field(
        ...,
        ge=0,
        le=100,
        description="Puntaje de riesgo de la dimensión (0 a 100)."
    )
    status: ColorSemaforo = Field(..., description="Estado del semáforo para esta dimensión.")
    alerts: List[AlertaSiniestro] = Field(..., description="Lista de alertas asociadas a esta dimensión.")

class DesgloseCategorias(BaseModel):
    """
    Mapeo de las 4 dimensiones obligatorias analizadas por el motor de detección de fraude.
    """
    model_config = ConfigDict(populate_by_name=True)

    monto: EvaluacionCategoria = Field(..., description="Evaluación asociada al monto reclamado.")
    documental: EvaluacionCategoria = Field(..., description="Evaluación de la integridad y validez de los documentos.")
    historial: EvaluacionCategoria = Field(..., description="Evaluación del historial de siniestros previos del asegurado/vehículo.")
    identidad: EvaluacionCategoria = Field(..., description="Evaluación de fraude de identidad y suplantación.")

class NarrativaAnalista(BaseModel):
    """
    Narrativa descriptiva generada por el analista o modelo para dar explicabilidad al caso.
    """
    model_config = ConfigDict(populate_by_name=True)

    narrative_id: str = Field(..., description="ID de la narrativa.")
    title: str = Field(..., description="Título de la narrativa o conclusión.")
    summary: str = Field(..., description="Resumen analítico detallado.")
    actionable_recommendation: str = Field(..., description="Recomendación accionable para el liquidador de siniestros.")
    severity_weight: NivelGravedad = Field(..., description="Peso de gravedad sugerido por la narrativa.")
    agent_identity: str = Field(..., description="Identidad del agente (humano o modelo de IA) que generó la narrativa.")

class ClaimAnalysisResponse(BaseModel):
    """
    Esquema de respuesta principal que representa el reporte analítico consolidado.
    """
    model_config = ConfigDict(populate_by_name=True)

    claim_id: str = Field(
        ...,
        pattern=r"^CLM-[0-9]{4}-[0-9]+$",
        description="Identificador único institucional del siniestro con formato CLM-YYYY-ID."
    )
    overall_score: int = Field(
        ...,
        ge=0,
        le=100,
        description="Puntaje general de riesgo consolidado (0 a 100)."
    )
    risk_level: ColorSemaforo = Field(..., description="Nivel general de riesgo consolidado en semáforo.")
    categories: DesgloseCategorias = Field(..., description="Desglose detallado por dimensiones obligatorias.")
    analyst_narratives: List[NarrativaAnalista] = Field(..., description="Lista de narrativas generadas para la explicabilidad.")
    technical_audit: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Datos técnicos y metadatos forenses en crudo para auditoría analítica profunda."
    )

class ClaimCreateRequest(BaseModel):
    """
    Esquema de entrada para registrar un nuevo siniestro de prueba en el sistema.
    """
    model_config = ConfigDict(populate_by_name=True)

    claim_id: str = Field(
        ...,
        pattern=r"^CLM-[0-9]{4}-[0-9]+$",
        description="Identificador único institucional del siniestro con formato CLM-YYYY-ID."
    )
    poliza_id: str = Field(..., description="ID de la póliza asociada.")
    asegurado_id: str = Field(..., description="ID del asegurado asociado.")
    proveedor_id: str = Field(..., description="ID del proveedor/taller asociado.")
    ramo: str = Field(default="VEHICULOS", description="Ramo del seguro (VEHICULOS, SALUD, etc.).")
    fecha_siniestro: str = Field(..., description="Fecha del siniestro en formato YYYY-MM-DD.")
    fecha_reporte: str = Field(..., description="Fecha de reporte en formato YYYY-MM-DD.")
    monto_reclamado: float = Field(..., description="Monto reclamado por el siniestro.")
    lat_siniestro: float = Field(default=-0.18, description="Latitud de ocurrencia del siniestro.")
    lon_siniestro: float = Field(default=-78.46, description="Longitud de ocurrencia del siniestro.")
    severidad: str = Field(default="LOW", description="Severidad del siniestro (LOW, MEDIUM, HIGH, CRITICAL).")
    narrativa_libre: str = Field(..., description="Narrativa del siniestro en texto libre.")

