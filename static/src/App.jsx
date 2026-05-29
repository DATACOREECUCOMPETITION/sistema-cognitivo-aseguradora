window.App = function App() {
  const [analyzedClaim, setAnalyzedClaim] = React.useState(null);
  const [activeView, setActiveView] = React.useState('analysis'); // 'analysis', 'chat' o 'create_claim'
  const [globalClaimId, setGlobalClaimId] = React.useState('CLM-2026-001');
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [bypassGemini, setBypassGemini] = React.useState(false);
  const [showTechnicalModal, setShowTechnicalModal] = React.useState(false);

  const handleAnalyzeStart = () => {
    setAnalyzedClaim(null);
  };

  const handleAnalyzeEnd = (result) => {
    setAnalyzedClaim(result);
    if (result && result.claim_id) {
      setGlobalClaimId(result.claim_id);
    }
  };

  // Cierra el menú desplegable si se hace clic fuera del contenedor (para una UX premium)
  React.useEffect(() => {
    const handleOutsideClick = () => {
      setDropdownOpen(false);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setDropdownOpen(!dropdownOpen);
  };

  const getActiveViewLabel = () => {
    switch (activeView) {
      case 'analysis':
        return 'Análisis de Siniestros';
      case 'chat':
        return 'Peritaje Conversacional (Chat)';
      case 'create_claim':
        return 'Registro de Nuevo Siniestro';
      case 'handwriting_analysis':
        return 'Análisis de Caligrafía';
      default:
        return 'Análisis de Siniestros';
    }
  };

  return (
    <div className="min-h-screen bg-theme-bg text-theme-textPrimary flex flex-col font-sans selection:bg-indigo-500/30 selection:text-white transition-colors duration-300 relative">
      
      {/* SUTIL GLOW METÁLICO DE FONDO */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/2 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-indigo-500/2 rounded-full blur-[120px] pointer-events-none" />

      {/* BARRA DE NAVEGACIÓN PREMIUM */}
      <header className="sticky top-0 z-50 bg-theme-surface/85 backdrop-blur-md border-b border-theme-border px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo e Identidad Corporativa */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-slate-650 to-indigo-650 rounded-xl shadow-md text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-md font-extrabold tracking-tight bg-gradient-to-r from-theme-textPrimary to-theme-textSecondary bg-clip-text text-transparent">
                ASEGURADORA DEL SUR
              </h1>
              <p className="text-[10px] text-theme-textMuted font-bold uppercase tracking-widest leading-none">
                SISTEMA COGNITIVO ANTIFRAUDE CORE v1.0.0
              </p>
            </div>
          </div>
          
          {/* Menú Desplegable y Estado de Conexión */}
          <div className="flex items-center gap-4">
            
            {/* MENÚ DESPLEGABLE DE MÓDULOS (NAVIGATION DROPDOWN) */}
            <div className="relative">
              <button
                onClick={toggleDropdown}
                className="px-4 py-2 bg-theme-surface border border-theme-border hover:bg-theme-bg hover:border-theme-border active:scale-95 text-theme-textPrimary text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                <span>Módulo: {getActiveViewLabel()}</span>
                <svg className={`h-4 w-4 text-theme-textMuted transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-theme-panel border border-theme-border rounded-xl shadow-xl overflow-hidden z-[100] animate-fade-in">
                  
                  {/* Opción 1: Análisis de Siniestros */}
                  <button
                    onClick={() => setActiveView('analysis')}
                    className={`w-full px-4 py-3 text-left text-xs flex items-center gap-3 hover:bg-theme-bg transition-all ${activeView === 'analysis' ? 'text-theme-textPrimary bg-theme-bg/50' : 'text-theme-textSecondary'}`}
                  >
                    <div className={`p-1.5 rounded-lg ${activeView === 'analysis' ? 'bg-theme-bg text-theme-textPrimary' : 'bg-transparent text-theme-textMuted'}`}>
                      <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-theme-textPrimary">Análisis de Siniestros</p>
                      <p className="text-[9px] text-theme-textMuted font-medium">Panel de Semáforos e Históricos</p>
                    </div>
                  </button>
                  
                  {/* Opción 2: Chat Conversacional */}
                  <button
                    onClick={() => setActiveView('chat')}
                    className={`w-full px-4 py-3 text-left text-xs flex items-center gap-3 hover:bg-theme-bg transition-all ${activeView === 'chat' ? 'text-theme-textPrimary bg-theme-bg/50' : 'text-theme-textSecondary'}`}
                  >
                    <div className={`p-1.5 rounded-lg ${activeView === 'chat' ? 'bg-theme-bg text-theme-textPrimary' : 'bg-transparent text-theme-textMuted'}`}>
                      <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-theme-textPrimary">Chat Conversacional</p>
                      <p className="text-[9px] text-theme-textMuted font-medium">Interacción directa con Gemini 2.5</p>
                    </div>
                  </button>

                  {/* Opción 3: Registro de Nuevo Siniestro */}
                  <button
                    onClick={() => setActiveView('create_claim')}
                    className={`w-full px-4 py-3 text-left text-xs flex items-center gap-3 hover:bg-theme-bg transition-all ${activeView === 'create_claim' ? 'text-theme-textPrimary bg-theme-bg/50' : 'text-theme-textSecondary'}`}
                  >
                    <div className={`p-1.5 rounded-lg ${activeView === 'create_claim' ? 'bg-theme-bg text-theme-textPrimary' : 'bg-transparent text-theme-textMuted'}`}>
                      <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-theme-textPrimary">Registrar Siniestro</p>
                      <p className="text-[9px] text-theme-textMuted font-medium">Ingresar Caso de Prueba Semilla</p>
                    </div>
                  </button>

                  {/* Opción 4: Análisis de Caligrafía */}
                  <button
                    onClick={() => setActiveView('handwriting_analysis')}
                    className={`w-full px-4 py-3 text-left text-xs flex items-center gap-3 hover:bg-theme-bg transition-all ${activeView === 'handwriting_analysis' ? 'text-theme-textPrimary bg-theme-bg/50' : 'text-theme-textSecondary'}`}
                  >
                    <div className={`p-1.5 rounded-lg ${activeView === 'handwriting_analysis' ? 'bg-theme-bg text-theme-textPrimary' : 'bg-transparent text-theme-textMuted'}`}>
                      <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-theme-textPrimary">Análisis de Caligrafía</p>
                      <p className="text-[9px] text-theme-textMuted font-medium">Inspección de Escritura Directa</p>
                    </div>
                  </button>

                </div>
              )}
            </div>

            {/* INTERRUPTOR DE CONTINGENCIA COGNITIVA (BYPASS GEMINI) */}
            <div className="flex items-center gap-2 px-2 py-1 bg-theme-bg/60 border border-theme-border rounded-xl">
              <span className={`text-[9px] font-extrabold uppercase tracking-widest transition-colors ${bypassGemini ? 'text-theme-warningText animate-pulse' : 'text-theme-textMuted'}`}>
                {bypassGemini ? '🚨 Contingencia Activa' : 'Bypass Gemini'}
              </span>
              <button
                onClick={() => setBypassGemini(!bypassGemini)}
                title="Toggles Contingency/Bypass Mode (Local/Data-driven only, no network latency)"
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-300 border focus:outline-none ${
                  bypassGemini 
                    ? 'bg-theme-warning/20 border-theme-warning/50 shadow-sm' 
                    : 'bg-theme-surface border-theme-border hover:border-theme-textMuted'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full transition-all duration-300 ${
                    bypassGemini 
                      ? 'translate-x-4.5 bg-theme-warning' 
                      : 'translate-x-0.5 bg-theme-textMuted'
                  }`}
                />
              </button>
            </div>

            {/* Separador Visual */}
            <span className="h-4 w-px bg-theme-border hidden sm:block" />

            {/* Estado del Sistema */}
            <div className="flex items-center gap-1.5 text-[10px] text-theme-textMuted font-mono hidden sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-theme-success animate-pulse" />
              <span>Conexión Segura</span>
            </div>

          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL ADAPTABLE CON ANIMACIÓN */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 z-10">
        <div className="animate-fade-in">
          
          {activeView === 'analysis' && (
            // VISTA 1: ANÁLISIS DE SINIESTROS (A PANTALLA COMPLETA)
            <div className="w-full">
              <window.DashboardSemaphor 
                onAnalyzeStart={handleAnalyzeStart}
                onAnalyzeEnd={handleAnalyzeEnd}
                bypassGemini={bypassGemini}
                defaultClaimId={globalClaimId}
                onShowTechnicalAudit={() => setShowTechnicalModal(true)}
              />
            </div>
          )}

          {activeView === 'chat' && (
            // VISTA 2: CHAT AGÉNTICO CON ENFOQUE MODULAR Y LIMPIO
            <div className="max-w-4xl mx-auto flex flex-col gap-6">
              
              {/* Tarjeta Contextual de Guía */}
              <div className="bg-theme-surface/70 backdrop-blur-md rounded-2xl border border-theme-border p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex-1">
                  <h2 className="text-xs font-extrabold text-theme-textSecondary uppercase tracking-widest mb-1.5 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-theme-accent animate-ping" />
                    Peritaje Conversacional e IA
                  </h2>
                  <p className="text-theme-textSecondary text-xs leading-relaxed">
                    Interactúa con nuestro perito cognitivo Gemini 2.5 Flash en un entorno aislado. Si tienes un siniestro analizado previamente, el perito tendrá acceso al contexto de sus alertas de manera automática.
                  </p>
                </div>
                
                {analyzedClaim ? (
                  <div className="px-3 py-1.5 bg-theme-successBg border border-theme-successBorder text-theme-successText text-[10px] font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all duration-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-theme-success animate-pulse" />
                    Contexto Cargado: {analyzedClaim.claim_id}
                  </div>
                ) : (
                  <div className="px-3 py-1.5 bg-theme-bg border border-theme-border text-theme-textSecondary text-[10px] font-bold rounded-xl flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-theme-textMuted" />
                    Sin Caso Seleccionado
                  </div>
                )}
              </div>
              
              {/* Chatbox Principal */}
              <window.ChatInterface analyzedClaim={analyzedClaim} bypassGemini={bypassGemini} />

            </div>
          )}

          {activeView === 'create_claim' && (
            // VISTA 3: REGISTRO DE NUEVO SINIESTRO SEMILLA
            <div className="w-full">
              <window.ClaimCreateView 
                onAnalyzeEnd={handleAnalyzeEnd}
                bypassGemini={bypassGemini}
                setActiveView={setActiveView}
                setGlobalClaimId={setGlobalClaimId}
              />
            </div>
          )}

          {activeView === 'handwriting_analysis' && (
            // VISTA 4: MÓDULO INDEPENDIENTE DE ANÁLISIS DE CALIGRAFÍA
            <div className="w-full">
              <window.DashboardHandwriting />
            </div>
          )}

        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-theme-border px-6 py-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-theme-textMuted">
          <p>© 2026 Aseguradora del Sur S.A. Todos los derechos reservados.</p>
          <div className="flex items-center gap-3">
            <span>Servicio de Red Segura</span>
            <span>•</span>
            <span>Auditoría en Tiempo Real</span>
          </div>
        </div>
      </footer>

      {/* MODAL DE AUDITORÍA Y DETALLES TÉCNICOS INTEGRALES (RENDERIZADO A NIVEL VIEWPORT ROOT) */}
      <window.DashboardTechnicalModal 
        technicalAudit={analyzedClaim?.technical_audit} 
        isOpen={showTechnicalModal} 
        onClose={() => setShowTechnicalModal(false)} 
      />

    </div>
  );
};
