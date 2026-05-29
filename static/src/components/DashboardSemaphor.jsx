window.DashboardSemaphor = function DashboardSemaphor({ onAnalyzeStart, onAnalyzeEnd, bypassGemini = false, defaultClaimId = 'CLM-2026-001', onShowTechnicalAudit }) {
  const { getSemaforoClasses, getSeverityBadgeClasses, parseEvidenceSummary } = window;

  const [claimId, setClaimId] = React.useState(defaultClaimId);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [data, setData] = React.useState(null);
  const [showFullReport, setShowFullReport] = React.useState(false);

  // Estados para el catálogo de siniestros al inicio
  const [allClaims, setAllClaims] = React.useState([]);
  const [loadingClaims, setLoadingClaims] = React.useState(true);
  const [filterQuery, setFilterQuery] = React.useState('');
  const [selectedAlert, setSelectedAlert] = React.useState(null);
  const [handwritingFile, setHandwritingFile] = React.useState(null);
  const [handwritingResult, setHandwritingResult] = React.useState(null);
  const [handwritingError, setHandwritingError] = React.useState(null);
  const [handwritingLoading, setHandwritingLoading] = React.useState(false);

  const isFirstLoad = React.useRef(true);

  // Carga física del catálogo de siniestros
  const fetchClaims = async () => {
    try {
      const catalogs = await window.ClaimsService.getClaimsCatalogs();
      if (catalogs && catalogs.siniestros) {
        setAllClaims(catalogs.siniestros);
      }
    } catch (err) {
      console.error("Error al cargar la lista de siniestros:", err);
    } finally {
      setLoadingClaims(false);
    }
  };

  const runAnalysis = async (targetId) => {
    const cleanId = targetId.trim();
    if (!cleanId) return;

    setLoading(true);
    setError(null);
    setData(null);
    setShowFullReport(false); // Reinicia la visualización al iniciar análisis
    setHandwritingFile(null);
    setHandwritingResult(null);
    setHandwritingError(null);
    setHandwritingLoading(false);
    if (onAnalyzeStart) onAnalyzeStart();

    try {
      const result = await window.ClaimsService.analyzeClaim(cleanId, bypassGemini);
      setData(result);
      if (onAnalyzeEnd) onAnalyzeEnd(result);
    } catch (err) {
      setError(err.message || 'Error de red con el servidor analítico.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchClaims();
    
    // Evita analizar automáticamente en la carga inicial ("lápiz")
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    
    if (defaultClaimId) {
      setClaimId(defaultClaimId);
      runAnalysis(defaultClaimId);
    }
  }, [defaultClaimId]);

  const handleAnalyze = async (e) => {
    if (e) e.preventDefault();
    runAnalysis(claimId);
  };

  const handleHandwritingFileChange = (event) => {
    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    setHandwritingFile(file);
    setHandwritingResult(null);
    setHandwritingError(null);
  };

  const runHandwritingAnalysis = async () => {
    if (!handwritingFile) {
      setHandwritingError('Seleccione una imagen JPG o PNG antes de analizar.');
      return;
    }

    setHandwritingLoading(true);
    setHandwritingError(null);

    try {
      const result = await window.ClaimsService.analyzeHandwritingDocument(handwritingFile);
      setHandwritingResult(result);
    } catch (err) {
      setHandwritingError(err.message || 'No se pudo analizar el documento.');
    } finally {
      setHandwritingLoading(false);
    }
  };

  // Helper para contar alertas totales en el reporte
  const getAlertsCount = () => {
    if (!data || !data.categories) return 0;
    return Object.values(data.categories).reduce((acc, cat) => acc + (cat.alerts ? cat.alerts.length : 0), 0);
  };

  // Filtrado reactivo de los siniestros del catálogo
  const filteredClaims = allClaims.filter(c =>
    c.claim_id.toLowerCase().includes(filterQuery.toLowerCase()) ||
    c.asegurado_id.toLowerCase().includes(filterQuery.toLowerCase()) ||
    c.ramo.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="w-full text-theme-textPrimary font-sans">
      
      {/* CABECERA Y BUSCADOR MANUAL (SÓLO SI NO ESTÁ EN REPORTE COMPLETO) */}
      {!showFullReport && (
        <div className="bg-theme-surface backdrop-blur-md rounded-3xl border border-theme-border p-6 mb-6 shadow-sm transition-all duration-300">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-theme-textPrimary via-theme-textSecondary to-theme-textSecondary bg-clip-text text-transparent">
                Detector de Fraude Aseguradora del Sur
              </h1>
              <p className="text-theme-textSecondary text-xs mt-1">
                Plataforma Analítica Integral Híbrida & IA Estilométrica
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              { (data || error) && (
                <button
                  onClick={() => { setData(null); setError(null); setShowFullReport(false); }}
                  className="px-4 py-2.5 bg-theme-bg hover:bg-theme-surface border border-theme-border text-theme-textSecondary hover:text-theme-textPrimary rounded-2xl text-xs font-bold transition-all active:scale-95 flex items-center gap-2 cursor-pointer select-none"
                  title="Volver al Catálogo de Casos"
                >
                  <svg className="h-4 w-4 text-theme-textMuted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Volver al Catálogo</span>
                </button>
              )}
              <form onSubmit={handleAnalyze} className="flex gap-2 flex-1 sm:flex-initial">
                <input
                  type="text"
                  value={claimId}
                  onChange={(e) => setClaimId(e.target.value)}
                  placeholder="ID Siniestro..."
                  required
                  className="w-full sm:w-44 px-3 py-2.5 bg-theme-inputBg border border-theme-inputBorder rounded-2xl focus:outline-none focus:ring-2 focus:ring-theme-accent focus:border-transparent text-xs text-theme-inputText transition-all font-mono placeholder:text-theme-textMuted shadow-inner"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-theme-accent hover:bg-theme-accentHover active:scale-95 disabled:scale-100 rounded-2xl font-bold text-xs text-white transition-all shadow-sm flex items-center justify-center gap-2 min-w-[95px] cursor-pointer border border-transparent"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Auditando</span>
                    </>
                  ) : (
                    'Auditar ID'
                  )}
                </button>
              </form>
            </div>
          </div>

          {bypassGemini && (
            <div className="mt-4 p-3 bg-theme-warningBg border border-theme-warningBorder text-theme-warningText text-[10px] font-bold rounded-2xl flex items-center gap-2 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-theme-warning animate-pulse" />
              <span>Modo de Contingencia Activo: Las llamadas externas a Gemini API están desactivadas. Los scores e informes lingüísticos se calcularán localmente analizando patrones heurísticos del siniestro.</span>
            </div>
          )}
        </div>
      )}

      {/* MANEJO DE ESTADOS DE CARGA Y ERROR DE AUDITORÍA */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 bg-theme-surface rounded-3xl border border-theme-border shadow-sm animate-pulse">
          <div className="relative flex items-center justify-center mb-6">
            <div className="absolute h-16 w-16 rounded-full border border-theme-accent/10 animate-ping" />
            <div className="h-12 w-12 rounded-full border-4 border-theme-border border-t-theme-accent animate-spin" />
          </div>
          <p className="text-theme-textSecondary text-xs font-semibold tracking-wider uppercase">
            Analizando Expediente con Modelos Híbridos e IA...
          </p>
        </div>
      )}

      {error && (
        <div className="bg-theme-dangerBg border border-theme-dangerBorder rounded-3xl p-6 mb-6 flex gap-4 items-start shadow-sm animate-fade-in text-left">
          <div className="p-2.5 bg-theme-dangerBg rounded-2xl text-theme-dangerText">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-theme-dangerText text-xs font-black tracking-widest uppercase">Fallo en el Análisis</h3>
            <p className="text-theme-textSecondary text-xs mt-1 leading-relaxed font-medium">{error}</p>
            <button
              onClick={() => { setError(null); setData(null); }}
              className="mt-3 px-3 py-1.5 bg-theme-bg hover:bg-theme-surface border border-theme-border rounded-lg text-[9px] font-bold text-theme-textSecondary transition-all cursor-pointer"
            >
              Volver al Catálogo
            </button>
          </div>
        </div>
      )}

      {/* ESTADO INICIAL: CATÁLOGO / LISTADO COMPLETO DE CASOS DISPONIBLES */}
      {!loading && !error && !data && (
        <window.DashboardClaimsTable
          loadingClaims={loadingClaims}
          filteredClaims={filteredClaims}
          filterQuery={filterQuery}
          setFilterQuery={setFilterQuery}
          runAnalysis={runAnalysis}
        />
      )}

      {/* RENDER DEL RESULTADO DE AUDITORÍA (RESUMEN EJECUTIVO / REPORTE) */}
      {!loading && !error && data && (
        <div className="w-full transition-all duration-300">
          
          {/* VISTA 1: RESUMEN EJECUTIVO (PANTALLA LIMPIA - ESPERANDO CLIC EN "VER INFORME") */}
          {!showFullReport && (
            <div className="bg-theme-surface border border-theme-border p-8 rounded-3xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden animate-fade-in text-left">
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/2 rounded-full blur-[100px] pointer-events-none" />
              
              {/* Bloque Izquierdo: Semáforo Compacto */}
              <div className="flex flex-col sm:flex-row items-center gap-6 z-10">
                <div className={`h-28 w-28 rounded-full flex flex-col items-center justify-center border-4 ${getSemaforoClasses(data.risk_level).border} ${getSemaforoClasses(data.risk_level).bgLight} shadow-md ${getSemaforoClasses(data.risk_level).glow} transition-all duration-500 relative`}>
                  <div className={`absolute inset-0 opacity-10 blur-lg ${getSemaforoClasses(data.risk_level).bg}`} />
                  <span className="text-3xl font-extrabold text-theme-textPrimary tracking-tighter z-10 leading-none">
                    {data.overall_score}
                  </span>
                  <span className="text-[9px] text-theme-textSecondary mt-1 font-bold z-10 uppercase tracking-widest">
                    Score
                  </span>
                </div>
                
                <div>
                  <span className="text-[9px] text-theme-textMuted font-extrabold uppercase tracking-widest">Siniestro Procesado</span>
                  <h2 className="text-xl font-black text-theme-textPrimary tracking-tight leading-none mt-1 mb-2 font-mono">
                    {data.claim_id}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest border ${getSemaforoClasses(data.risk_level).border} ${getSemaforoClasses(data.risk_level).text} ${getSemaforoClasses(data.risk_level).bgLight} uppercase`}>
                      RIESGO {data.risk_level}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-theme-bg border border-theme-border text-theme-textSecondary text-[8px] font-bold uppercase tracking-wider">
                      Híbrido Consolidado
                    </span>
                  </div>
                </div>
              </div>

              {/* Bloque Centro: Estado de Categorías Rápidas (Estructura Vertical Anticolapso) */}
              <div className="flex-1 min-w-[190px] max-w-[240px] border-t border-b sm:border-t-0 sm:border-b-0 border-theme-border py-4 sm:py-0 px-3 z-10 flex flex-col justify-center">
                <p className="text-[9px] text-theme-textMuted font-extrabold uppercase tracking-widest mb-2 text-center sm:text-left">Semáforos por Dimensión</p>
                <div className="flex flex-col gap-1.5 text-[10px] text-theme-textSecondary font-medium w-full">
                  {Object.entries(data.categories).map(([name, cat]) => {
                    const colors = getSemaforoClasses(cat.status);
                    return (
                      <div key={name} className="flex items-center justify-between bg-theme-bg px-3 py-1.5 rounded-xl border border-theme-border hover:border-theme-border hover:bg-theme-surface transition-all duration-200 w-full">
                        <span className="capitalize text-theme-textSecondary font-bold text-[10px]">{name}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`h-1.5 w-1.5 rounded-full ${colors.bg} animate-pulse`} />
                          <span className="font-mono font-bold text-theme-textPrimary text-[10px]">{cat.subscore}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bloque Derecho: Botones de Acción */}
              <div className="z-10 flex flex-col sm:flex-row md:flex-col lg:flex-row items-center gap-3 w-full md:w-auto">
                <button
                  onClick={() => { setData(null); setShowFullReport(false); }}
                  className="w-full sm:w-auto md:w-full lg:w-auto flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl text-[10px] font-bold text-theme-textSecondary hover:text-theme-textPrimary bg-theme-bg hover:bg-theme-surface border border-theme-border hover:border-theme-border transition-all active:scale-95 cursor-pointer select-none"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Volver al Catálogo</span>
                </button>

                <button
                  onClick={() => { if (onShowTechnicalAudit) onShowTechnicalAudit(); }}
                  className="w-full sm:w-auto md:w-full lg:w-auto flex items-center justify-center gap-1.5 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider text-theme-accent hover:text-theme-accentHover bg-theme-bg hover:bg-theme-surface border border-theme-accent/20 hover:border-theme-accent/40 transition-all active:scale-95 cursor-pointer select-none"
                  title="Ver Todos los Datos Forenses, EXIF y de IA"
                >
                  <svg className="h-4 w-4 text-theme-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Ver Todos los Datos</span>
                </button>

                <button
                  onClick={() => setShowFullReport(true)}
                  className="w-full sm:w-auto md:w-full lg:w-auto relative flex items-center justify-center gap-3 px-8 py-3 rounded-2xl text-xs font-black tracking-widest uppercase transition-all duration-300 active:scale-95 group text-white bg-theme-accent hover:bg-theme-accentHover border border-transparent shadow-sm select-none overflow-hidden cursor-pointer"
                >
                  <span className="z-10 flex items-center gap-2">
                    <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Ver Informe</span>
                  </span>
                  
                  <svg className="h-4 w-4 text-white group-hover:translate-x-1 transition-all duration-300 z-10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

            </div>
          )}

          {/* VISTA 2: SECCIÓN DEDICADA COMPLETA (INFORME FORENSE REFACTORIZADO Y MODULAR) */}
          {showFullReport && (
            <div className="w-full animate-fade-in space-y-6 text-left">
              
              {/* Barra Superior del Informe */}
              <div className="bg-theme-surface backdrop-blur-md rounded-3xl border border-theme-border px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm transition-all duration-300">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowFullReport(false)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-black tracking-wider uppercase text-theme-textSecondary hover:text-theme-textPrimary bg-theme-bg hover:bg-theme-surface border border-theme-border hover:border-theme-border rounded-xl transition-all duration-205 active:scale-95 cursor-pointer select-none"
                    title="Volver a la vista del Resumen Ejecutivo"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>Volver</span>
                  </button>
                  
                  <button
                    onClick={() => { setData(null); setError(null); setShowFullReport(false); }}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-black tracking-wider uppercase text-theme-textSecondary hover:text-theme-textPrimary bg-theme-bg hover:bg-theme-surface border border-theme-border hover:border-theme-border rounded-xl transition-all duration-205 active:scale-95 cursor-pointer select-none"
                    title="Salir al Catálogo General de Siniestros"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span>Catálogo</span>
                  </button>

                  <button
                    onClick={() => { if (onShowTechnicalAudit) onShowTechnicalAudit(); }}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-black tracking-wider uppercase text-theme-accent hover:text-theme-accentHover bg-theme-bg hover:bg-theme-surface border border-theme-accent/20 hover:border-theme-accent/40 rounded-xl transition-all duration-205 active:scale-95 cursor-pointer select-none"
                    title="Ver Todos los Datos de Auditoría Forense y de IA"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>Datos de Auditoría</span>
                  </button>

                  <span className="h-5 w-px bg-theme-border hidden sm:block" />
                  <div>
                    <h3 className="text-sm font-black text-theme-textPrimary uppercase tracking-widest flex items-center gap-2">
                      INFORME COGNITIVO & FORENSE DE SINIESTRO
                    </h3>
                    <p className="text-xs text-theme-textSecondary font-mono mt-0.5 leading-none">
                      Caso: {data.claim_id} · Score Compuesto: {data.overall_score}/100
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-black border ${getSemaforoClasses(data.risk_level).border} ${getSemaforoClasses(data.risk_level).text} ${getSemaforoClasses(data.risk_level).bgLight} uppercase tracking-widest`}>
                    RIESGO {data.risk_level}
                  </span>
                  {bypassGemini && (
                    <span className="px-2.5 py-1 rounded-full bg-theme-warningBg border border-theme-warningBorder text-theme-warningText text-[10px] font-bold uppercase tracking-wider animate-pulse">
                      Offline Contingency
                    </span>
                  )}
                </div>
              </div>

              {/* BLOQUE SUPERIOR SIMÉTRICO: 3 TARJETAS ALINEADAS */}
              <window.DashboardMetricCards data={data} alertsCount={getAlertsCount()} />

              {/* BLOQUE INTERMEDIO SIMÉTRICO: CATEGORÍAS OBLIGATORIAS EXTENDIDAS A PANTALLA COMPLETA */}
              <div className="bg-theme-surface backdrop-blur-md rounded-3xl border border-theme-border p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-3 border-b border-theme-border pb-4">
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-theme-textPrimary uppercase tracking-widest">
                      Categorías Obligatorias de Negocio
                    </h3>
                    <p className="text-[10px] text-theme-textMuted uppercase tracking-widest font-extrabold mt-1">
                      Dimensiones core para la evaluación de legitimidad y comportamiento del siniestro
                    </p>
                  </div>
                  <span className="px-3.5 py-1 bg-theme-bg border border-theme-border rounded-xl text-theme-textSecondary text-[10px] font-black uppercase tracking-wider font-mono">
                    Áreas Evaluadas: 4 / 4
                  </span>
                </div>
                
                {/* Lista vertical de categorías usando el 100% del ancho de la pantalla */}
                <div className="space-y-4">
                  {Object.entries(data.categories).map(([name, cat]) => (
                    <window.DashboardCategoryRow 
                      key={name}
                      name={name}
                      cat={cat}
                      setSelectedAlert={setSelectedAlert}
                    />
                  ))}
                </div>
              </div>

              {/* BLOQUE INFERIOR SIMÉTRICO: DICTAMEN DE IA Y BANDERAS ROJAS */}
              <window.DashboardAnalystNarratives data={data} />

            </div>
          )}
        </div>
      )}

      {/* MODAL DETALLADO DE EXPANSIÓN PARA ALERTAS FORENSES */}
      <window.DashboardAlertModal selectedAlert={selectedAlert} setSelectedAlert={setSelectedAlert} />

    </div>
  );
};
