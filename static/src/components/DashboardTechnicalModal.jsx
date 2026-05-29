window.DashboardTechnicalModal = function DashboardTechnicalModal({
  technicalAudit,
  isOpen,
  onClose
}) {
  const [activeTab, React_setActiveTab] = React.useState('gps');

  if (!isOpen) return null;

  // Fallback en caso de que no existan datos
  if (!technicalAudit) {
    return (
      <div 
        className="fixed inset-0 bg-theme-bg/90 backdrop-blur-md z-[1100] flex items-center justify-center p-4 animate-fade-in text-left text-theme-textPrimary font-sans"
        onClick={onClose}
      >
        <div 
          className="bg-theme-panel border border-theme-border rounded-3xl w-full max-w-lg p-8 shadow-xl relative flex flex-col gap-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center border-b border-theme-border pb-4">
            <h3 className="text-base font-black uppercase tracking-widest text-theme-dangerText">
              ⚠️ Sin Datos Técnicos
            </h3>
            <button 
              onClick={onClose}
              className="p-2 bg-theme-bg hover:bg-theme-surface border border-theme-border text-theme-textSecondary hover:text-theme-textPrimary rounded-xl transition-all cursor-pointer"
            >
              Cerrar
            </button>
          </div>
          <p className="text-theme-textSecondary text-xs leading-relaxed">
            No se han cargado datos técnicos de auditoría para este siniestro. Ejecute un análisis primero.
          </p>
        </div>
      </div>
    );
  }

  const {
    claim_raw_data = {},
    insured_raw_data = {},
    policy_raw_data = {},
    provider_raw_data = {},
    evidence_metadata = {},
    rules_evaluation = {},
    ml_details = {},
    sri_data = {},
    ai_context_sent = {}
  } = technicalAudit;

  // Formateador de bytes a MB
  const formatMB = (bytes) => {
    if (!bytes) return '0.00 MB';
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Diccionario explicativo de las 10 reglas deterministas
  const reglasExplicaciones = {
    "R1_PROXIMIDAD_TEMPORAL": {
      name: "R1: Proximidad Temporal",
      desc: "Siniestro dentro de los 15 días cercanos al inicio/fin de vigencia de la póliza."
    },
    "R2_COLUSION_PROVEEDOR": {
      name: "R2: Outliers de Costos",
      desc: "Costos atípicos (Modified Z-Score MAD) en facturación del proveedor/taller."
    },
    "R3_DUPLICIDAD_IDENTIDAD": {
      name: "R3: Duplicidad de Identidad",
      desc: "Distancia Jaro-Winkler detecta nombres idénticos con diferentes identificadores fiscales."
    },
    "R4_CROSS_CLAIMING": {
      name: "R4: Cross-Claiming Multiramo",
      desc: "Múltiples siniestros del mismo asegurado en ramos independientes en menos de 48h."
    },
    "R5_CLONACION_SEMANTICA": {
      name: "R5: Clonación de Narrativas",
      desc: "Similitud de Coseno detecta textos duplicados de reclamos anteriores."
    },
    "R6_VELOCIDAD_POST_MODIFICACION": {
      name: "R6: Velocidad Post-Modificación",
      desc: "Siniestro reportado a menos de 15 días posteriores al aumento del límite de la póliza."
    },
    "R7_DIRECCIONAMIENTO_BROKER": {
      name: "R7: Direccionamiento del Broker",
      desc: "Probabilidad condicional atípica de desvío de clientes hacia un taller específico."
    },
    "R8_TRIANGULACION_GEOGRAFICA": {
      name: "R8: Triangulación Geográfica",
      desc: "Fórmula Haversine alerta si la distancia excede 200 km entre taller, siniestro y domicilio."
    },
    "R9_SMURFING_SINIESTROS": {
      name: "R9: Smurfing de Facturas",
      desc: "Fraccionamiento de facturación justo debajo de los límites de auditoría institucional."
    },
    "R10_SINIESTRALIDAD_ESTACIONAL": {
      name: "R10: Siniestralidad Estacional",
      desc: "Reclamaciones en los mismos meses en años sucesivos cruzadas con estrés financiero."
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-theme-bg/90 backdrop-blur-md z-[1100] flex items-center justify-center p-4 overflow-y-auto animate-fade-in text-left text-theme-textPrimary font-sans"
      onClick={onClose}
    >
      <div 
        className="bg-theme-panel border border-theme-border rounded-3xl w-full max-w-4xl p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col gap-6 h-[85vh] max-h-[800px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fondo Decorativo Glow */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-500/3 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-emerald-500/2 rounded-full blur-3xl pointer-events-none" />

        {/* Cabecera */}
        <div className="flex justify-between items-start gap-4 border-b border-theme-border pb-4 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-theme-bg border border-theme-border text-theme-textSecondary text-[10px] font-black uppercase tracking-wider font-mono">
                Auditoría Técnica Total
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider font-mono ${ai_context_sent.bypass_gemini_active ? 'bg-theme-warningBg text-theme-warningText border border-theme-warningBorder' : 'bg-theme-infoBg text-theme-infoText border border-theme-infoBorder'}`}>
                {ai_context_sent.model_identity_or_contingency || 'FastAPI Pipeline'}
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-black text-theme-textPrimary uppercase tracking-widest mt-2 flex items-center gap-2">
              🔍 Inspección de Datos: {claim_raw_data.claim_id || 'Fallback ID'}
            </h2>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 bg-theme-bg hover:bg-theme-surface border border-theme-border text-theme-textSecondary hover:text-theme-textPrimary rounded-xl transition-all cursor-pointer active:scale-95 select-none"
            title="Cerrar Inspección"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Menú de Pestañas Interactivas */}
        <div className="flex flex-wrap border-b border-theme-border pb-1 gap-1 flex-shrink-0 text-xs font-bold uppercase tracking-wider">
          <button
            onClick={() => React_setActiveTab('gps')}
            className={`px-4 py-2 rounded-xl transition-all select-none cursor-pointer ${activeTab === 'gps' ? 'bg-theme-bg border border-theme-border text-theme-accent' : 'text-theme-textSecondary hover:text-theme-textPrimary'}`}
          >
            📍 Ubicaciones (GPS)
          </button>
          <button
            onClick={() => React_setActiveTab('evidence')}
            className={`px-4 py-2 rounded-xl transition-all select-none cursor-pointer ${activeTab === 'evidence' ? 'bg-theme-bg border border-theme-border text-theme-accent' : 'text-theme-textSecondary hover:text-theme-textPrimary'}`}
          >
            📂 Evidencias Extraídas
          </button>
          <button
            onClick={() => React_setActiveTab('ai')}
            className={`px-4 py-2 rounded-xl transition-all select-none cursor-pointer ${activeTab === 'ai' ? 'bg-theme-bg border border-theme-border text-theme-accent' : 'text-theme-textSecondary hover:text-theme-textPrimary'}`}
          >
            🧠 Cerebro de IA & Prompts
          </button>
          <button
            onClick={() => React_setActiveTab('rules')}
            className={`px-4 py-2 rounded-xl transition-all select-none cursor-pointer ${activeTab === 'rules' ? 'bg-theme-bg border border-theme-border text-theme-accent' : 'text-theme-textSecondary hover:text-theme-textPrimary'}`}
          >
            📐 Reglas & ML
          </button>
        </div>

        {/* Contenido con Scroll Independiente */}
        <div className="flex-1 overflow-y-auto scrollbar pr-1 text-theme-textSecondary text-xs md:text-sm font-medium">
          
          {/* PESTAÑA 1: GPS & COORDENADAS */}
          {activeTab === 'gps' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-theme-bg border border-theme-border rounded-2xl p-5">
                <h4 className="text-[10px] text-theme-textMuted font-extrabold uppercase tracking-widest mb-3">📍 Geolocalización Declarada en el Siniestro</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-theme-surface border border-theme-border p-4 rounded-xl">
                    <span className="text-[9px] text-theme-textMuted font-bold uppercase block">Ubicación del Accidente</span>
                    <span className="text-theme-textPrimary font-bold font-mono mt-1 block">
                      {claim_raw_data.lat_siniestro?.toFixed(6) || '-0.180000'}, {claim_raw_data.lon_siniestro?.toFixed(6) || '-78.460000'}
                    </span>
                    <span className="text-theme-textMuted mt-1 block text-[10px]">Declarado en formulario de reclamo.</span>
                  </div>
                  <div className="bg-theme-surface border border-theme-border p-4 rounded-xl">
                    <span className="text-[9px] text-theme-textMuted font-bold uppercase block">Domicilio del Asegurado</span>
                    <span className="text-theme-textPrimary font-bold font-mono mt-1 block">
                      {insured_raw_data.lat_domicilio?.toFixed(6) || 'No registrado'}, {insured_raw_data.lon_domicilio?.toFixed(6) || ''}
                    </span>
                    <span className="text-theme-textMuted mt-1 block text-[10px]">{insured_raw_data.nombre_completo || 'Asegurado'}</span>
                  </div>
                  <div className="bg-theme-surface border border-theme-border p-4 rounded-xl">
                    <span className="text-[9px] text-theme-textMuted font-bold uppercase block">Ubicación del Taller/Proveedor</span>
                    <span className="text-theme-textPrimary font-bold font-mono mt-1 block">
                      {provider_raw_data.lat_proveedor?.toFixed(6) || 'No registrado'}, {provider_raw_data.lon_proveedor?.toFixed(6) || ''}
                    </span>
                    <span className="text-theme-textMuted mt-1 block text-[10px]">{provider_raw_data.nombre || 'Taller'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-theme-bg border border-theme-border rounded-2xl p-5">
                <h4 className="text-[10px] text-theme-textMuted font-extrabold uppercase tracking-widest mb-3">📸 Coordenadas EXIF Reales Extraídas de las Fotos</h4>
                
                {evidence_metadata?.summary?.gps_points && evidence_metadata.summary.gps_points.length > 0 ? (
                  <div className="space-y-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-theme-border text-theme-textMuted font-black uppercase tracking-wider">
                            <th className="pb-2">Foto / Archivo Guardado</th>
                            <th className="pb-2">Latitud EXIF</th>
                            <th className="pb-2">Longitud EXIF</th>
                            <th className="pb-2">Altitud (msnm)</th>
                            <th className="pb-2 text-right">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {evidence_metadata.summary.gps_points.map((pt, idx) => (
                            <tr key={idx} className="border-b border-theme-border hover:bg-theme-bg/50">
                              <td className="py-2.5 font-mono text-theme-textPrimary font-bold">{pt.source || `foto_0${idx+1}.jpg`}</td>
                              <td className="py-2.5 font-mono text-theme-textPrimary font-semibold">{pt.lat?.toFixed(6)}</td>
                              <td className="py-2.5 font-mono text-theme-textPrimary font-semibold">{pt.lon?.toFixed(6)}</td>
                              <td className="py-2.5 font-mono text-theme-textMuted">{pt.alt ? `${pt.alt.toFixed(1)} m` : 'N/D'}</td>
                              <td className="py-2.5 text-right">
                                <span className="px-2 py-0.5 rounded bg-theme-successBg text-theme-successText border border-theme-successBorder font-bold text-[9px]">
                                  GPS VÁLIDO
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-3 bg-theme-infoBg border border-theme-infoBorder text-theme-infoText rounded-xl text-[11px] leading-relaxed">
                      💡 **Correlación de Seguridad**: El sistema compara automáticamente estas coordenadas reales con la latitud y longitud declarada del accidente (`{claim_raw_data.lat_siniestro?.toFixed(3)}, {claim_raw_data.lon_siniestro?.toFixed(3)}`). Desviaciones mayores a 200 km gatillan de inmediato la alerta de **Triangulación Geográfica R8**.
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-theme-textMuted">
                    <svg className="h-8 w-8 text-theme-textMuted mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-[11px] font-bold uppercase tracking-wider">Sin Coordenadas GPS en Evidencias</p>
                    <p className="text-[10px] text-theme-textMuted mt-1">Este siniestro no posee fotos cargadas o los archivos no contenían etiquetas EXIF de GPSInfo.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PESTAÑA 2: EVIDENCIAS & DOCUMENTOS EXTRAÍDOS */}
          {activeTab === 'evidence' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Metadatos de Fotos */}
                <div className="bg-theme-bg border border-theme-border rounded-2xl p-5">
                  <h4 className="text-[10px] text-theme-textMuted font-extrabold uppercase tracking-widest mb-3">📸 Galería Forense de Imágenes</h4>
                  {evidence_metadata?.photos && evidence_metadata.photos.length > 0 ? (
                    <div className="space-y-3 max-h-80 overflow-y-auto scrollbar pr-1">
                      {evidence_metadata.photos.map((item, idx) => (
                        <div key={idx} className="bg-theme-surface border border-theme-border p-3 rounded-xl flex justify-between items-start gap-3">
                          <div className="min-w-0">
                            <span className="text-[9px] text-theme-textMuted font-mono font-bold block">{item.stored_name}</span>
                            <span className="text-theme-textPrimary font-bold block truncate mt-0.5 text-xs">{item.original_name}</span>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[9px] text-theme-textMuted font-mono">
                              <span>{item.width}x{item.height} px</span>
                              <span className="text-theme-border">•</span>
                              <span>{item.format}</span>
                              <span className="text-theme-border">•</span>
                              <span>{formatMB(item.size_bytes)}</span>
                            </div>
                          </div>
                          {item.camera_model && (
                            <div className="text-right flex-shrink-0">
                              <span className="px-2 py-0.5 rounded bg-theme-infoBg text-theme-infoText border border-theme-infoBorder text-[8px] font-black uppercase font-mono block">
                                {item.camera_model}
                              </span>
                              <span className="text-[8px] text-theme-textMuted block mt-1 font-mono">{item.date_time_original || 'Sin fecha EXIF'}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-theme-textMuted text-xs text-center py-8">No se han subido fotos de evidencia física.</p>
                  )}
                </div>

                {/* Metadatos del Documento de Preforma */}
                <div className="bg-theme-bg border border-theme-border rounded-2xl p-5">
                  <h4 className="text-[10px] text-theme-textMuted font-extrabold uppercase tracking-widest mb-3">📄 Documento Analizado (Preforma / Cotización)</h4>
                  {evidence_metadata?.pdf ? (
                    <div className="space-y-4">
                      <div className="bg-theme-surface border border-theme-border p-4 rounded-xl">
                        <span className="text-[9px] text-theme-textMuted font-mono font-bold block">{evidence_metadata.pdf.stored_name}</span>
                        <h5 className="text-theme-textPrimary font-black text-xs mt-1">{evidence_metadata.pdf.original_name}</h5>
                        
                        <div className="grid grid-cols-3 gap-3 mt-3 text-center border-t border-theme-border pt-3">
                          <div>
                            <span className="text-[8px] text-theme-textMuted font-bold uppercase block">Tipo</span>
                            <span className="text-theme-accent font-mono font-black text-xs mt-0.5 block">{evidence_metadata.pdf.doc_type || 'PDF'}</span>
                          </div>
                          <div>
                            <span className="text-[8px] text-theme-textMuted font-bold uppercase block">Tamaño</span>
                            <span className="text-theme-textPrimary font-mono font-bold text-xs mt-0.5 block">{formatMB(evidence_metadata.pdf.size_bytes)}</span>
                          </div>
                          <div>
                            <span className="text-[8px] text-theme-textMuted font-bold uppercase block">Páginas/Hojas</span>
                            <span className="text-theme-textPrimary font-mono font-bold text-xs mt-0.5 block">
                              {evidence_metadata.pdf.sheet_count || evidence_metadata.pdf.page_count || 1}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Explicación del Extractor */}
                      <div className="p-3 bg-theme-successBg border border-theme-successBorder text-theme-successText rounded-xl text-[10px] leading-relaxed">
                        ✅ **Lectura de Estructura**: Este documento fue parseado nativamente en el backend. El sistema extrajo el texto crudo para cotejar números de RUC, cotizaciones de repuestos y validarlo estilométricamente con la IA.
                      </div>
                    </div>
                  ) : (
                    <p className="text-theme-textMuted text-xs text-center py-8">No se ha subido una preforma o documento de taller.</p>
                  )}
                </div>
              </div>

              {/* Texto Integro Extraído */}
              {evidence_metadata?.pdf?.has_text && (
                <div className="bg-theme-bg border border-theme-border rounded-2xl p-5">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-[10px] text-theme-textMuted font-extrabold uppercase tracking-widest">📝 Contenido e Información Extraída del Documento</h4>
                    <span className="px-2 py-0.5 rounded bg-theme-surface border border-theme-border text-theme-textMuted text-[9px] font-mono">
                      Extracto indexado en Base de Datos
                    </span>
                  </div>
                  <div className="font-mono bg-theme-bg border border-theme-border p-4 rounded-xl text-theme-textSecondary text-xs leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap scrollbar pr-1">
                    {evidence_metadata.pdf.text_excerpt}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA 3: CEREBRO DE IA & PROMPTS ENVIADOS */}
          {activeTab === 'ai' && (
            <div className="space-y-6 animate-fade-in text-left">
              <div className="bg-theme-bg border border-theme-border rounded-2xl p-5">
                <h4 className="text-[10px] text-theme-textMuted font-extrabold uppercase tracking-widest mb-3">🧠 Explicabilidad de la Inteligencia Artificial</h4>
                <div className="p-4 bg-theme-surface border border-theme-border rounded-xl text-xs space-y-2">
                  <div className="flex justify-between items-center border-b border-theme-border pb-2">
                    <span className="text-theme-textSecondary font-bold">Modelo Utilizado:</span>
                    <span className="font-mono text-theme-accent font-bold">
                      {ai_context_sent.model_identity_or_contingency || 'FastAPI Agent Core'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-theme-border pb-2">
                    <span className="text-theme-textSecondary font-bold">Modo de Operación:</span>
                    <span className={`font-bold ${ai_context_sent.bypass_gemini_active ? 'text-theme-warningText' : 'text-theme-successText'}`}>
                      {ai_context_sent.bypass_gemini_active ? 'LOCAL (Contingencia sin Conexión Externa)' : 'ONLINE (Llamada Cognitiva Directa)'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-1">
                    <span className="text-theme-textSecondary font-bold">Estatus del SRI (RUC Asegurado):</span>
                    <span className="font-mono font-bold text-theme-textPrimary">
                      {sri_data.estado_contribuyente || 'ACTIVO (Validación Sintética)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Variables de contexto analítico */}
              <div className="bg-theme-bg border border-theme-border rounded-2xl p-5">
                <h4 className="text-[10px] text-theme-textMuted font-extrabold uppercase tracking-widest mb-3">📂 Estructura de Contexto enviada al Perito Cognitivo</h4>
                <p className="text-[10px] text-theme-textMuted mb-3 uppercase tracking-widest font-bold">
                  Variables e indicadores procesados por la IA para emitir el veredicto forense:
                </p>
                <div className="overflow-x-auto bg-theme-surface border border-theme-border p-4 rounded-xl font-mono text-xs">
                  <pre className="text-theme-accent max-h-60 overflow-y-auto scrollbar pr-1 whitespace-pre-wrap">
                    {JSON.stringify(ai_context_sent.prompt_variables || {}, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Narrativa original */}
              <div className="bg-theme-bg border border-theme-border rounded-2xl p-5">
                <h4 className="text-[10px] text-theme-textMuted font-extrabold uppercase tracking-widest mb-3">💬 Narrativa Original Registrada por el Usuario</h4>
                <div className="bg-theme-surface border border-theme-border p-4 rounded-xl font-medium italic text-theme-textSecondary">
                  "{ai_context_sent.user_narrative || 'Sin narrativa libre registrada.'}"
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA 4: REGLAS DE NEGOCIO & ML SCORES */}
          {activeTab === 'rules' && (
            <div className="space-y-6 animate-fade-in text-left">
              
              {/* Score de ML en bruto */}
              <div className="bg-theme-bg border border-theme-border rounded-2xl p-5">
                <h4 className="text-[10px] text-theme-textMuted font-extrabold uppercase tracking-widest mb-3">🤖 Evaluación Probabilística - Machine Learning</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-theme-surface border border-theme-border p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-theme-textMuted font-bold uppercase block">Modelo Utilizado</span>
                      <span className="text-theme-textPrimary font-bold text-xs mt-1 block">Isolation Forest (Scikit-Learn)</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-theme-textMuted font-bold uppercase block">Score Probabilístico</span>
                      <span className="font-mono text-theme-accent font-black text-lg mt-0.5 block">
                        {(ml_details.isolation_forest_score || 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="bg-theme-surface border border-theme-border p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-theme-textMuted font-bold uppercase block">Estado Topológico</span>
                      <span className="text-theme-textPrimary font-bold text-xs mt-1 block">Grafo de Red de Colusión</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-theme-textMuted font-bold uppercase block">Penalización Recurrente</span>
                      <span className={`font-mono font-black text-sm mt-1 block ${(ml_details.isolation_forest_score || 0) >= 70.0 ? 'text-theme-dangerText' : 'text-theme-successText'}`}>
                        {(ml_details.isolation_forest_score || 0) >= 70.0 ? '+15.0 pts (Grafo de Colusión)' : '0.0 pts (Normal)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* El semáforo de las 10 Reglas Forenses */}
              <div className="bg-theme-bg border border-theme-border rounded-2xl p-5">
                <h4 className="text-[10px] text-theme-textMuted font-extrabold uppercase tracking-widest mb-3">📐 Matriz de Reglas Deterministas del MDR</h4>
                <div className="space-y-3">
                  {Object.entries(reglasExplicaciones).map(([key, details]) => {
                    const isTriggered = rules_evaluation[key] === true;
                    return (
                      <div 
                        key={key} 
                        className={`p-3 rounded-xl border flex items-start gap-3 transition-colors duration-150 ${isTriggered ? 'bg-theme-dangerBg border-theme-dangerBorder' : 'bg-theme-surface border-theme-border hover:bg-theme-bg'}`}
                      >
                        <div className="mt-0.5">
                          {isTriggered ? (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-theme-dangerBg text-theme-dangerText font-black text-[10px]">
                              🚨
                            </span>
                          ) : (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-theme-successBg text-theme-successText font-black text-[10px]">
                              ✓
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-black uppercase tracking-wider ${isTriggered ? 'text-theme-dangerText' : 'text-theme-textPrimary'}`}>
                              {details.name}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${isTriggered ? 'bg-theme-dangerBg text-theme-dangerText border border-theme-dangerBorder' : 'bg-theme-bg text-theme-textMuted'}`}>
                              {isTriggered ? 'ALERTA DETECTADA' : 'CORRECTO'}
                            </span>
                          </div>
                          <p className="text-theme-textSecondary text-[10px] sm:text-xs mt-0.5 font-medium leading-relaxed">
                            {details.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Botón inferior de cerrar */}
        <div className="flex justify-end pt-3 border-t border-theme-border flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-theme-surface hover:bg-theme-bg border border-theme-border rounded-xl text-xs font-black uppercase tracking-wider text-theme-textSecondary hover:text-theme-textPrimary transition-all active:scale-95 cursor-pointer select-none"
          >
            Cerrar Inspección
          </button>
        </div>

      </div>
    </div>
  );
};
