window.DashboardHandwriting = function DashboardHandwriting() {
  const [file, setFile] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setFile(selected);
    setResult(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError('Por favor, seleccione una imagen JPG o PNG antes de analizar.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await window.ClaimsService.analyzeHandwritingDocument(file);
      setResult(res);
    } catch (err) {
      setError(err.message || 'No se pudo completar el análisis caligráfico.');
    } finally {
      setLoading(false);
    }
  };

  // Función simple para maquetar el reporte con negritas
  const renderFormattedDetails = (text) => {
    if (!text) return 'Sin observaciones adicionales.';
    
    // Convertir marcas de markdown **texto** a elementos <strong> en JSX de forma segura
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-extrabold text-theme-textPrimary">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left">
      
      {/* Tarjeta de Encabezado */}
      <div className="bg-theme-surface backdrop-blur-md rounded-3xl border border-theme-border p-6 shadow-sm">
        <h2 className="text-lg font-black text-theme-textPrimary uppercase tracking-widest flex items-center gap-2">
          <svg className="h-5 w-5 text-theme-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Módulo de Caligrafía Independiente
        </h2>
        <p className="text-[10px] text-theme-textSecondary uppercase tracking-widest font-extrabold mt-1">
          Auditoría visual directa de partes policiales o declaraciones manuscritas sin mezclar con los reportes
        </p>
      </div>

      {/* Tarjeta de Carga de Documento */}
      <div className="bg-theme-surface backdrop-blur-md rounded-3xl border border-theme-border p-6 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        
        {/* Selector de archivos */}
        <div className="md:col-span-2 space-y-2">
          <label className="text-[10px] text-theme-textPrimary font-extrabold uppercase tracking-widest block">
            Seleccionar Parte Policial o Documento Manuscrito
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleFileChange}
            className="block w-full text-xs text-theme-textSecondary file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border file:border-theme-border file:bg-theme-surface file:text-theme-textPrimary file:text-[10px] file:font-black file:uppercase file:tracking-wider file:cursor-pointer hover:file:bg-theme-bg transition-colors"
          />
          <p className="text-[9px] text-theme-textSecondary font-semibold leading-relaxed">
            Soporta formatos JPG y PNG. Se realizará una inspección de morfología de trazos de forma directa y aislada.
          </p>
        </div>

        {/* Botón de acción */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleAnalyze}
            disabled={loading || !file}
            className="w-full py-3 bg-theme-accent hover:bg-theme-accentHover text-white text-xs font-black uppercase tracking-widest rounded-2xl active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Analizando...</span>
              </>
            ) : (
              'Analizar Caligrafía'
            )}
          </button>
          
          {file && (
            <p className="text-[9px] text-theme-textSecondary text-center font-mono truncate">
              Cargado: {file.name}
            </p>
          )}
        </div>

      </div>

      {/* Manejo de errores */}
      {error && (
        <div className="bg-theme-dangerBg border border-theme-dangerBorder rounded-3xl p-5 text-theme-dangerText text-xs font-medium shadow-sm flex items-center gap-3">
          <svg className="h-5 w-5 flex-shrink-0 text-theme-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Renderizado de Resultados */}
      {result && (
        <div className="bg-theme-surface border border-theme-border rounded-3xl p-6 shadow-sm space-y-5 animate-fade-in">
          
          {/* Cabecera del Dictamen */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-theme-border pb-4">
            <div className="flex items-center gap-3">
              <span className="h-9 w-9 rounded-xl bg-theme-infoBg border border-theme-infoBorder text-theme-infoText flex items-center justify-center shadow-sm">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              <div>
                <p className="text-[10px] text-theme-textPrimary font-extrabold uppercase tracking-widest">Dictamen Pericial Visual</p>
                <h4 className="text-sm font-black tracking-widest text-theme-textPrimary uppercase">
                  Consistencia Caligráfica del Documento
                </h4>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border shadow-sm ${result.caligrafia_consistente ? 'border-theme-successBorder text-theme-successText bg-theme-successBg' : 'border-theme-warningBorder text-theme-warningText bg-theme-warningBg'}`}>
                {result.caligrafia_consistente ? 'Consistente' : 'Inconsistencia Detectada'}
              </span>
            </div>
          </div>

          {/* Caja Monospace de Observaciones */}
          <div className="bg-theme-bg border border-theme-border rounded-2xl p-5 space-y-3">
            <p className="text-[10px] text-theme-textPrimary font-extrabold uppercase tracking-widest">
              Observaciones del Análisis Estilométrico
            </p>
            <div className="text-xs text-theme-textSecondary leading-relaxed whitespace-pre-wrap font-sans space-y-4">
              {renderFormattedDetails(result.detalles_analisis)}
            </div>
          </div>

          {/* Bloque Informativo de Reglas */}
          {!result.caligrafia_consistente && (
            <div className="bg-theme-warningBg/30 border border-theme-warningBorder/50 rounded-2xl p-4 flex gap-3 text-left">
              <div className="p-2 bg-theme-warningBg rounded-xl text-theme-warningText flex-shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-theme-warningText uppercase tracking-wider">Regla Activada: {result.regla_activada}</p>
                <p className="text-[10px] text-theme-textSecondary mt-0.5 leading-relaxed font-medium">
                  Se ha disparado la regla de detección de alteración caligráfica. Este dictamen incrementará automáticamente en +10 puntos el score de sospecha en el análisis híbrido documental del siniestro si se asocia posteriormente.
                </p>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
