window.DashboardMetricCards = function DashboardMetricCards({
  data,
  alertsCount
}) {
  const { getSemaforoClasses, getSeverityBadgeClasses, parseEvidenceSummary } = window;

  const getEvidenceData = () => {
    if (!data || !data.analyst_narratives) return null;
    const evidenceNarrative = data.analyst_narratives.find(n => n.narrative_id.includes('EVIDENCE'));
    return evidenceNarrative ? parseEvidenceSummary(evidenceNarrative.summary) : null;
  };

  const info = getEvidenceData();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
      
      {/* Tarjeta 1: Score y Semáforo Radial */}
      <div className="bg-theme-surface backdrop-blur-md rounded-3xl border border-theme-border p-6 flex flex-col items-center justify-between text-center shadow-sm relative overflow-hidden min-h-[220px]">
        <div className="absolute top-0 left-0 w-24 h-24 bg-indigo-500/2 rounded-full blur-2xl" />
        <span className="text-[10px] text-theme-textMuted font-extrabold uppercase tracking-widest block mb-2">Semáforo Consolidado</span>
        
        <div className={`h-24 w-24 rounded-full flex flex-col items-center justify-center border-4 ${getSemaforoClasses(data.risk_level).border} ${getSemaforoClasses(data.risk_level).bgLight} shadow-md ${getSemaforoClasses(data.risk_level).glow} transition-all duration-500 relative my-auto`}>
          <div className={`absolute inset-0 opacity-10 blur-xl ${getSemaforoClasses(data.risk_level).bg}`} />
          <span className="text-3xl font-extrabold text-theme-textPrimary tracking-tighter z-10 leading-none">
            {data.overall_score}
          </span>
          <span className="text-[9px] text-theme-textSecondary mt-1.5 font-bold z-10 uppercase tracking-widest">
            Score
          </span>
        </div>
        
        <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${getSemaforoClasses(data.risk_level).border} ${getSemaforoClasses(data.risk_level).text} ${getSemaforoClasses(data.risk_level).bgLight}`}>
          Riesgo Compuesto: {data.risk_level}
        </span>
      </div>

      {/* Tarjeta 2: Pesos y Auditoría Global */}
      <div className="bg-theme-surface backdrop-blur-md rounded-3xl border border-theme-border p-6 flex flex-col justify-between shadow-sm min-h-[220px]">
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] text-theme-textMuted font-extrabold uppercase tracking-widest">Pesos y Auditoría</span>
            <span className="px-2.5 py-1 rounded bg-theme-bg text-theme-textSecondary text-[10px] font-black border border-theme-border font-mono">
              Alertas: {alertsCount}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-theme-textSecondary font-semibold font-mono">
            <div className="flex justify-between border-b border-theme-border/50 pb-1">
              <span className="font-sans font-medium text-theme-textMuted">Monto:</span> <span>25%</span>
            </div>
            <div className="flex justify-between border-b border-theme-border/50 pb-1">
              <span className="font-sans font-medium text-theme-textMuted">Doc:</span> <span>30%</span>
            </div>
            <div className="flex justify-between border-b border-theme-border/50 pb-1">
              <span className="font-sans font-medium text-theme-textMuted">Historial:</span> <span>25%</span>
            </div>
            <div className="flex justify-between border-b border-theme-border/50 pb-1">
              <span className="font-sans font-medium text-theme-textMuted">Identidad:</span> <span>20%</span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-theme-bg border border-theme-border rounded-2xl flex items-center justify-between text-xs font-bold text-theme-textSecondary">
          <span>Siniestro: <span className="font-mono text-theme-textPrimary">{data.claim_id}</span></span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-theme-success animate-ping" />
            Auditoría Activa
          </span>
        </div>
      </div>

      {/* Tarjeta 3: Métricas de Evidencias */}
      <div className="bg-theme-surface backdrop-blur-md rounded-3xl border border-theme-border p-6 flex flex-col justify-between shadow-sm min-h-[220px]">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] text-theme-textMuted font-extrabold uppercase tracking-widest">Metadata de Evidencias</span>
          <span className="px-2.5 py-1 rounded bg-theme-bg text-theme-successText text-[10px] font-black border border-theme-border font-mono">
            EXIF/Text
          </span>
        </div>

        {info ? (
          <div className="grid grid-cols-2 gap-2 my-auto">
            <div className="bg-theme-bg p-2 rounded-xl border border-theme-border text-center flex flex-col justify-center">
              <span className="text-[9px] text-theme-textMuted font-extrabold uppercase block leading-none mb-1">Fotos</span>
              <span className="text-sm sm:text-base font-black text-theme-textPrimary font-mono">📷 {info.fotos || 0}</span>
            </div>
            <div className="bg-theme-bg p-2 rounded-xl border border-theme-border text-center flex flex-col justify-center">
              <span className="text-[9px] text-theme-textMuted font-extrabold uppercase block leading-none mb-1">Coordenadas</span>
              <span className="text-sm sm:text-base font-black text-theme-textPrimary font-mono">📍 {info['gps detectado'] || 0}</span>
            </div>
            <div className="bg-theme-bg p-2 rounded-xl border border-theme-border text-center flex flex-col justify-center">
              <span className="text-[9px] text-theme-textMuted font-extrabold uppercase block leading-none mb-1">Documento</span>
              <span className="text-[10px] font-black text-theme-textPrimary truncate uppercase mt-0.5 block">{info.documento || 'No'}</span>
            </div>
            <div className="bg-theme-bg p-2 rounded-xl border border-theme-border text-center flex flex-col justify-center">
              <span className="text-[9px] text-theme-textMuted font-extrabold uppercase block leading-none mb-1">Dispositivo</span>
              <span className="text-[10px] font-black text-theme-accent truncate font-mono mt-0.5 block">{info.camaras || 'N/A'}</span>
            </div>
          </div>
        ) : (
          <div className="my-auto text-center py-4 bg-theme-bg border border-theme-border border-dashed rounded-2xl">
            <span className="text-[10px] text-theme-textMuted font-bold italic">Sin archivos multimedia adjuntos</span>
          </div>
        )}
      </div>

    </div>
  );
};
