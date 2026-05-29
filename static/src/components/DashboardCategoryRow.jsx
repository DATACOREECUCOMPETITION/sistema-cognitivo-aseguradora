window.DashboardCategoryRow = function DashboardCategoryRow({
  name,
  cat,
  setSelectedAlert
}) {
  const { getSemaforoClasses, getSeverityBadgeClasses } = window;
  const colors = getSemaforoClasses(cat.status);

  // Emoji e íconos temáticos para cada dimensión de negocio
  let icon = "📂";
  let descriptionText = "Análisis de riesgo y consistencia en el ramo";
  if (name === "monto") {
    icon = "💵";
    descriptionText = "Consistencia del valor reclamado, desvíos estadísticos y umbrales de severidad";
  } else if (name === "documental") {
    icon = "📄";
    descriptionText = "Integridad de soportes físicos, metadatos de imágenes EXIF y timestamps";
  } else if (name === "historial") {
    icon = "⏳";
    descriptionText = "Comportamiento previo del asegurado, recurrencia y patrones de siniestralidad";
  } else if (name === "identidad") {
    icon = "👤";
    descriptionText = "Validación tributaria ante el SRI y consistencia de datos de personería jurídica/natural";
  }

  return (
    <div 
      className="p-6 bg-theme-surface rounded-3xl border border-theme-border hover:border-theme-textMuted transition-all duration-300 flex flex-col lg:flex-row gap-6 items-stretch shadow-sm hover:shadow-md group text-left"
    >
      {/* Bloque Izquierdo (Info Categoría): 1/3 de ancho en pantallas grandes, 100% en móviles */}
      <div className="lg:w-1/3 flex flex-col justify-between pr-0 lg:pr-6 border-b lg:border-b-0 lg:border-r border-theme-border pb-5 lg:pb-0">
        <div>
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl select-none group-hover:scale-110 transition-transform duration-200">{icon}</span>
              <span className="text-base sm:text-lg font-black capitalize text-theme-textPrimary tracking-tight">
                {name}
              </span>
            </div>
            <span className={`px-3 py-1 rounded-xl text-xs font-black border ${colors.border} ${colors.text} ${colors.bgLight} uppercase tracking-wider`}>
              {cat.status}
            </span>
          </div>
          <p className="text-theme-textSecondary text-xs font-medium leading-relaxed mt-1.5">
            {descriptionText}
          </p>
        </div>
        
        <div className="mt-6">
          <div className="flex justify-between items-center text-xs text-theme-textSecondary font-bold mb-2">
            <span>Subscore de Riesgo:</span>
            <span className="font-mono font-black text-sm text-theme-textPrimary">{cat.subscore} / 100</span>
          </div>
          
          {/* Barra de Progreso más visible y ancha */}
          <div className="h-2 w-full bg-theme-bg rounded-full overflow-hidden relative shadow-inner">
            <div
              className={`h-full ${colors.bg} rounded-full transition-all duration-500`}
              style={{ width: `${cat.subscore}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Bloque Derecho (Alertas Reportadas): 2/3 de ancho en pantallas grandes, 100% en móviles */}
      <div className="lg:w-2/3 flex flex-col justify-center pl-0 lg:pl-2 w-full">
        {cat.alerts && cat.alerts.length > 0 ? (
          <div className="space-y-3 w-full">
            <span className="text-[10px] text-theme-textMuted font-extrabold uppercase tracking-widest block mb-1">
              Alertas Forenses Reportadas ({cat.alerts.length})
            </span>
            
            {/* Grid de Alertas de 2 columnas en Desktop/Tablet, con excelente espacio para lectura */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {cat.alerts.map((alert) => (
                <div 
                  key={alert.alert_id} 
                  className={`w-full bg-theme-bg p-4.5 rounded-2xl border border-theme-border hover:border-theme-textMuted transition-all flex flex-col justify-between shadow-sm ${
                    cat.alerts.length === 1 ? 'md:col-span-2' : ''
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-center gap-2 mb-2.5 pb-2 border-b border-theme-border/50">
                      <span className="font-black text-theme-textPrimary text-xs sm:text-sm truncate flex items-center gap-1.5">
                        ⚠️ {alert.alert_type}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-extrabold tracking-wider whitespace-nowrap ${getSeverityBadgeClasses(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-theme-textSecondary leading-relaxed text-xs sm:text-[13px] font-medium">
                      {alert.description}
                    </p>
                  </div>
                  
                  <div className="mt-4 pt-2 border-t border-theme-border/40 flex justify-between items-center text-[10px] text-theme-textMuted font-mono">
                    <div className="flex flex-col gap-0.5">
                      <span>Alerta ID: {alert.alert_id}</span>
                      <span className="text-[8px] text-theme-textMuted font-sans font-bold uppercase tracking-wider">Verificación Forense</span>
                    </div>
                    
                    <button
                      onClick={() => setSelectedAlert({ ...alert, category: name })}
                      className="px-2.5 py-1 bg-theme-surface hover:bg-theme-bg border border-theme-border hover:border-theme-textMuted text-theme-accent hover:text-theme-accentHover rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 active:scale-95 cursor-pointer flex items-center gap-1 select-none"
                      title="Expandir Alerta y ver detalles completos"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                      <span>Expandir</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Banner de Sin Alertas de pantalla completa (100% de la columna de alertas)
          <div className="flex flex-col items-center justify-center py-8 px-6 bg-theme-successBg/30 border border-theme-successBorder border-dashed rounded-3xl text-center w-full">
            <div className="h-10 w-10 rounded-full bg-theme-successBg flex items-center justify-center text-theme-successText mb-3 shadow-inner">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-theme-successText font-black uppercase tracking-wider text-xs sm:text-sm">
              Sin Alertas Reportadas en esta Categoría
            </span>
            <span className="text-theme-textSecondary text-xs font-semibold max-w-md mt-2 leading-relaxed">
              La validación heurística y los cruces de base de datos deterministas no identificaron ninguna inconsistencia en este módulo.
            </span>
          </div>
        )}
      </div>
      
    </div>
  );
};
