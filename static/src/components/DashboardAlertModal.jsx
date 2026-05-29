window.DashboardAlertModal = function DashboardAlertModal({
  selectedAlert,
  setSelectedAlert
}) {
  const { getSeverityBadgeClasses } = window;

  if (!selectedAlert) return null;

  return (
    <div 
      className="fixed inset-0 bg-theme-bg/85 backdrop-blur-md z-[1000] flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
      onClick={() => setSelectedAlert(null)}
    >
      <div 
        className="bg-theme-panel border border-theme-border rounded-3xl w-full max-w-xl p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col gap-6 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fondo Glow Estético */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        {/* Cabecera del Modal */}
        <div className="flex justify-between items-start gap-4 border-b border-theme-border pb-4">
          <div>
            <span className="px-2.5 py-1 rounded bg-theme-bg border border-theme-border text-theme-textSecondary text-[10px] font-black uppercase tracking-wider font-mono">
              Dimensión: {selectedAlert.category}
            </span>
            <h3 className="text-base sm:text-lg font-black text-theme-textPrimary uppercase tracking-widest mt-2 flex items-center gap-2">
              ⚠️ {selectedAlert.alert_type}
            </h3>
          </div>
          
          <button
            onClick={() => setSelectedAlert(null)}
            className="p-2 bg-theme-bg hover:bg-theme-surface border border-theme-border text-theme-textSecondary hover:text-theme-textPrimary rounded-xl transition-all duration-150 cursor-pointer active:scale-95 select-none"
            title="Cerrar ventana de detalles"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Severidad y Metadatos */}
        <div className="flex flex-wrap items-center gap-3">
          <span className={`px-3 py-1 rounded-xl text-xs font-black border uppercase tracking-wider ${getSeverityBadgeClasses(selectedAlert.severity)}`}>
            Severidad: {selectedAlert.severity}
          </span>
          <span className="px-3 py-1 rounded-xl bg-theme-bg border border-theme-border text-theme-textSecondary text-xs font-mono">
            Alerta ID: {selectedAlert.alert_id}
          </span>
        </div>

        {/* Descripción Completa con Scroll Cómodo */}
        <div className="bg-theme-bg p-5 rounded-2xl border border-theme-border">
          <span className="text-[10px] text-theme-textMuted font-extrabold uppercase tracking-widest block mb-2">Descripción Completa del Hallazgo</span>
          <div className="max-h-60 overflow-y-auto scrollbar pr-1">
            <p className="text-theme-textPrimary text-sm sm:text-base leading-relaxed font-semibold font-sans whitespace-pre-wrap">
              {selectedAlert.description}
            </p>
          </div>
        </div>

        {/* Recomendación Forense Sugerida */}
        <div className="p-4 bg-theme-warningBg rounded-2xl border border-theme-warningBorder text-xs flex flex-col gap-1 text-left">
          <h5 className="font-black text-theme-warningText uppercase tracking-widest text-[10px] flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-theme-warning animate-pulse" />
            Protocolo Analítico Sugerido
          </h5>
          <p className="text-theme-textSecondary text-xs sm:text-[13px] leading-relaxed font-medium">
            Se aconseja contrastar documentalmente la evidencia física y validar en origen ante el organismo tributario.
          </p>
        </div>

        {/* Botón de Cierre Inferior */}
        <div className="flex justify-end pt-2">
          <button
            onClick={() => setSelectedAlert(null)}
            className="px-6 py-2.5 bg-theme-accent hover:bg-theme-accentHover border border-transparent rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all active:scale-95 cursor-pointer select-none"
          >
            Cerrar Detalle
          </button>
        </div>

      </div>
    </div>
  );
};
