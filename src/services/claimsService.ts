import { ClaimAnalysisResponse } from '../types/insurance';

/**
 * Contrato de respuesta de chat conversacional agéntico.
 */
export interface AgentChatResponse {
  query: string;
  response: string;
  red_flags_summary: string[];
}

export interface HandwritingAnalysisResponse {
  analisis_exitoso: boolean;
  caligrafia_consistente: boolean;
  detalles_analisis: string;
  regla_activada: string;
  score_riesgo: number;
}

/**
 * Cliente de servicios asíncrono que consume la API del Motor Híbrido Antifraude.
 * Utiliza fetch nativo e implementa tipado estricto e inmunización ante caídas.
 */
export class ClaimsService {
  private static BASE_URL = 'http://localhost:8000/api/v1';

  /**
   * Envía una solicitud de análisis híbrido para un siniestro específico.
   * 
   * @param claimId Identificador institucional del siniestro (formato CLM-YYYY-ID).
   * @returns Promesa fuertemente tipada con el reporte analítico consolidado.
   */
  public static async analyzeClaim(claimId: string): Promise<ClaimAnalysisResponse> {
    const url = `${this.BASE_URL}/claims/analyze`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ claim_id: claimId })
      });

      if (!response.ok) {
        let errorMessage = `Error en el servidor (${response.status})`;
        try {
          const errData = await response.json();
          if (errData && errData.detail) {
            errorMessage = errData.detail;
          }
        } catch {
          // Ignorar fallo al parsear el error JSON
        }
        throw new Error(errorMessage);
      }

      const data: ClaimAnalysisResponse = await response.json();
      return data;

    } catch (error: any) {
      console.error(`[ClaimsService.analyzeClaim] Fallo en la llamada analítica:`, error);
      // Re-lanzar una excepción tipada comprensible para los componentes de React
      throw new Error(error.message || 'Error de red o conexión con el servidor analítico.');
    }
  }

  /**
   * Envía una consulta en lenguaje natural al chat agéntico para interactuar con Gemini 2.5 Flash.
   * 
   * @param query Pregunta analítica en lenguaje natural redactada por el usuario.
   * @param contextClaims Lista opcional de contexto de siniestros cargados.
   * @returns Promesa fuertemente tipada con la explicación del agente y banderas rojas.
   */
  public static async sendAgentChat(query: string, contextClaims?: any[]): Promise<AgentChatResponse> {
    const url = `${this.BASE_URL}/agent/chat`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          query: query,
          context_claims: contextClaims || null
        })
      });

      if (!response.ok) {
        throw new Error(`Fallo al consultar el chat agéntico (${response.status})`);
      }

      const data: AgentChatResponse = await response.json();
      return data;

    } catch (error: any) {
      console.error(`[ClaimsService.sendAgentChat] Fallo al consultar el agente cognitivo:`, error);
      throw new Error(error.message || 'Error al conectar con el servidor cognitivo.');
    }
  }

  /**
   * Analiza la caligrafia de un documento escrito a mano (JPG/PNG).
   * 
   * @param file Archivo de imagen (JPG/PNG).
   * @returns Resultado del analisis de caligrafia.
   */
  public static async analyzeHandwritingDocument(file: File): Promise<HandwritingAnalysisResponse> {
    const url = `${this.BASE_URL}/analizar-caligrafia-documento`;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(url, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errorMessage = `Error en el servidor (${response.status})`;
        try {
          const errData = await response.json();
          if (errData && errData.detail) {
            errorMessage = errData.detail;
          }
        } catch {
          // Ignorar fallo al parsear el error JSON
        }
        throw new Error(errorMessage);
      }

      const data: HandwritingAnalysisResponse = await response.json();
      return data;
    } catch (error: any) {
      console.error(`[ClaimsService.analyzeHandwritingDocument] Fallo en el analisis:`, error);
      throw new Error(error.message || 'Error de red al analizar el documento.');
    }
  }
}
