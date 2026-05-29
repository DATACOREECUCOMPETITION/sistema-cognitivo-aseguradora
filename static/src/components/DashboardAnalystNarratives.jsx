window.DashboardAnalystNarratives = function DashboardAnalystNarratives({
  data
}) {
  const { getSeverityBadgeClasses, parseEvidenceSummary } = window;

  const getEvidenceData = () => {
    if (!data || !data.analyst_narratives) return null;
    const evidenceNarrative = data.analyst_narratives.find(n => n.narrative_id.includes('EVIDENCE'));
    return evidenceNarrative ? parseEvidenceSummary(evidenceNarrative.summary) : null;
  };

  const info = getEvidenceData();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch text-left">
      
      {/* Columna Izquierda (lg:col-span-6): Dictamen Forense IA */}
      <div className="lg:col-span-6 flex flex-col justify-between">
        {data.analyst_narratives && data.analyst_narratives.filter(n => n.narrative_id.includes('COGNITIVE')).map((narrative) => (
          <div key={narrative.narrative_id} className="bg-theme-surface backdrop-blur-md rounded-3xl border border-theme-border p-6 shadow-sm relative overflow-hidden flex-1 flex flex-col justify-between min-h-[220px]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/2 rounded-full blur-2xl" />
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1 bg-theme-infoBg text-theme-infoText rounded-lg">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z" />
                    </svg>
                  </span>
                  <h4 className="text-sm font-black text-theme-textPrimary uppercase tracking-widest">{narrative.title}</h4>
                </div>
                <div className="flex gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider ${getSeverityBadgeClasses(narrative.severity_weight)}`}>
                    {narrative.severity_weight}
                  </span>
                  <span className="px-2.5 py-1 rounded bg-theme-bg text-theme-textSecondary text-[10px] font-black border border-theme-border font-mono">
                    {narrative.agent_identity}
                  </span>
                </div>
              </div>
              
              <p className="text-theme-textPrimary text-sm leading-relaxed mb-4 font-medium text-justify">
                {narrative.summary}
              </p>
            </div>
            
            {narrative.actionable_recommendation && (
              <div className="p-3.5 bg-theme-infoBg/50 rounded-2xl border border-theme-infoBorder text-xs mt-auto">
                <h5 className="font-black text-theme-infoText uppercase tracking-widest text-[10px] mb-1.5 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-theme-info animate-pulse" />
                  Recomendación Accionable Forense
                </h5>
                <p className="text-theme-textSecondary text-xs sm:text-sm leading-relaxed font-semibold text-left">
                  {narrative.actionable_recommendation}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Columna Derecha (lg:col-span-6): Banderas Rojas de IA & Consola Textual */}
      <div className="lg:col-span-6 space-y-6 flex flex-col justify-between">
        
        {/* Consola Monospace de Evidencia Textual (SÓLO SI EXISTE EXTRACTO) */}
        {info && info.extracto && (
          <div className="bg-theme-surface backdrop-blur-md rounded-3xl border border-theme-border p-6 shadow-sm space-y-2">
            <span className="text-[10px] text-theme-accent font-extrabold uppercase tracking-widest block mb-1">Extracto Textual Forense Documental</span>
            <pre className="text-xs text-theme-textPrimary font-mono bg-theme-bg p-4 rounded-2xl border border-theme-border overflow-x-auto whitespace-pre-wrap max-h-36 select-all scrollbar">
              {info.extracto}
            </pre>
          </div>
        )}

        {/* Banderas Rojas del Peritaje Cognitivo (Agrupación de alertas de IA) */}
        {data.analyst_narratives && data.analyst_narratives.filter(n => n.narrative_id.includes('FLAG')).length > 0 && (
          <div className="bg-theme-surface backdrop-blur-md rounded-3xl border border-theme-border p-6 shadow-sm flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="p-1 bg-theme-warningBg text-theme-warningText rounded-lg">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </span>
                <h4 className="text-sm font-black text-theme-textPrimary uppercase tracking-widest">
                  Banderas Rojas de Inteligencia Artificial (AI)
                </h4>
              </div>

              <div className="space-y-2.5 max-h-[220px] overflow-y-auto scrollbar pr-1">
                {data.analyst_narratives.filter(n => n.narrative_id.includes('FLAG')).map((narrative) => (
                  <div key={narrative.narrative_id} className="p-4 bg-theme-bg border border-theme-border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:border-theme-textMuted text-left">
                    <div className="flex-1">
                      <span className="text-[10px] font-extrabold text-theme-warningText uppercase tracking-widest block mb-0.5">Patrón Lingüístico Anómalo</span>
                      <p className="text-theme-textPrimary text-xs sm:text-sm font-bold mt-1 leading-relaxed">
                        {narrative.summary.replace("Detectado patrón lingüístico anómalo: ", "")}
                      </p>
                    </div>
                    {narrative.actionable_recommendation && (
                      <div className="px-3 py-1.5 bg-theme-surface border border-theme-border text-theme-textSecondary text-xs font-extrabold rounded-xl whitespace-nowrap uppercase tracking-wider text-center">
                        {narrative.actionable_recommendation.replace("Validar el reporte con el ", "")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
