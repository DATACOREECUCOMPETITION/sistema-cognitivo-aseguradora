/**
 * Contratos de tipos de TypeScript que replican de forma estricta los
 * esquemas analíticos de Pydantic V2 de Aseguradora del Sur.
 */

export type ColorSemaforo = 'VERDE' | 'AMARILLO' | 'ROJO';

export type NivelGravedad = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface AlertaSiniestro {
  alert_id: string;
  alert_type: string;
  severity: NivelGravedad;
  description: string;
  evidence_refs: string[];
  forensic_metadata?: Record<string, any> | null;
}

export interface EvaluacionCategoria {
  subscore: number;
  status: ColorSemaforo;
  alerts: AlertaSiniestro[];
}

export interface DesgloseCategorias {
  monto: EvaluacionCategoria;
  documental: EvaluacionCategoria;
  historial: EvaluacionCategoria;
  identidad: EvaluacionCategoria;
}

export interface NarrativaAnalista {
  narrative_id: string;
  title: string;
  summary: string;
  actionable_recommendation: string;
  severity_weight: NivelGravedad;
  agent_identity: string;
}

export interface ClaimAnalysisResponse {
  claim_id: string;
  overall_score: number;
  risk_level: ColorSemaforo;
  categories: DesgloseCategorias;
  analyst_narratives: NarrativaAnalista[];
}
