/**
 * Cliente de servicios asíncrono que consume la API del Motor Híbrido Antifraude.
 * Excursa fetch nativo y expone la clase en el ámbito global (window) para Babel Standalone.
 */
class ClaimsService {
  static BASE_URL = window.location.origin + '/api/v1';

  /**
   * Envía una solicitud de análisis híbrido para un siniestro específico.
   * 
   * @param {string} claimId Identificador institucional del siniestro.
   * @returns {Promise<Object>} Reporte analítico consolidado.
   */
  static async analyzeClaim(claimId, bypassGemini = false) {
    const url = `${this.BASE_URL}/claims/analyze`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          claim_id: claimId,
          bypass_gemini: bypassGemini
        })
      });

      if (!response.ok) {
        let errorMessage = `Error en el servidor (${response.status})`;
        try {
          const errData = await response.json();
          if (errData && errData.detail) {
            errorMessage = errData.detail;
          }
        } catch (e) {
          // Ignorar fallo al parsear JSON
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error(`[ClaimsService.analyzeClaim] Fallo en la llamada analítica:`, error);
      throw new Error(error.message || 'Error de red o conexión con el servidor analítico.');
    }
  }

  /**
   * Envía una consulta en lenguaje natural al chat agéntico para interactuar con Gemini.
   * 
   * @param {string} query Pregunta analítica en lenguaje natural.
   * @param {Array} [contextClaims] Contexto de siniestros cargados.
   * @returns {Promise<Object>} Explicación del agente y banderas rojas.
   */
  static async sendAgentChat(query, contextClaims = null, bypassGemini = false, targetLock = null) {
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
          context_claims: contextClaims,
          bypass_gemini: bypassGemini,
          target_lock: targetLock
        })
      });

      if (!response.ok) {
        throw new Error(`Fallo al consultar el chat agéntico (${response.status})`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[ClaimsService.sendAgentChat] Fallo al consultar el agente cognitivo:`, error);
      throw new Error(error.message || 'Error al conectar con el servidor cognitivo.');
    }
  }

  /**
   * Registra un nuevo siniestro de prueba en el backend.
   * 
   * @param {Object} claimData Objeto conteniendo las variables del siniestro.
   * @returns {Promise<Object>} Resultado de la creación.
   */
  static async createClaim(claimData) {
    const url = `${this.BASE_URL}/claims/create`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(claimData)
      });

      if (!response.ok) {
        let errorMessage = `Error en el servidor (${response.status})`;
        try {
          const errData = await response.json();
          if (errData && errData.detail) {
            errorMessage = errData.detail;
          }
        } catch (e) {
          // Ignorar
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error(`[ClaimsService.createClaim] Fallo al crear el siniestro:`, error);
      throw new Error(error.message || 'Error de red al registrar el siniestro.');
    }
  }

  /**
   * Registra un nuevo siniestro con evidencias (fotos + PDF) usando multipart/form-data.
   * 
   * @param {FormData} formData FormData con campos del siniestro y archivos.
   * @returns {Promise<Object>} Resultado de la creación.
   */
  static async createClaimWithEvidence(formData) {
    const url = `${this.BASE_URL}/claims/create-with-evidence`;

    try {
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
        } catch (e) {
          // Ignorar
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error(`[ClaimsService.createClaimWithEvidence] Fallo al crear siniestro con evidencias:`, error);
      throw new Error(error.message || 'Error de red al registrar el siniestro con evidencias.');
    }
  }

  /**
   * Obtiene los catálogos y siguientes IDs autogenerados consistentes desde el backend.
   * 
   * @returns {Promise<Object>} Catálogos de proveedores y próximos IDs.
   */
  static async getClaimsCatalogs() {
    const url = `${this.BASE_URL}/claims/catalogs`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Fallo al consultar catálogos del sistema (${response.status})`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[ClaimsService.getClaimsCatalogs] Fallo al cargar catálogos:`, error);
      throw new Error(error.message || 'Error de red al consultar catálogos analíticos.');
    }
  }

  /**
   * Analiza la caligrafia de un documento escrito a mano (JPG/PNG).
   * 
   * @param {File} file Archivo de imagen (JPG/PNG).
   * @returns {Promise<Object>} Resultado del analisis de caligrafia.
   */
  static async analyzeHandwritingDocument(file) {
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
        } catch (e) {
          // Ignorar
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error(`[ClaimsService.analyzeHandwritingDocument] Fallo en el analisis:`, error);
      throw new Error(error.message || 'Error de red al analizar el documento.');
    }
  }
}

// Registrar en el objeto global para acceso directo desde los componentes React en Babel
window.ClaimsService = ClaimsService;
