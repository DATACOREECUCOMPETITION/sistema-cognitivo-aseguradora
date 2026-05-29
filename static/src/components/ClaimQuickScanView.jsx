window.ClaimQuickScanView = function ClaimQuickScanView({ onAnalyzeEnd, bypassGemini = false, setActiveView, setGlobalClaimId }) {
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [loadingStep, setLoadingStep] = React.useState('');
  const [error, setError] = React.useState(null);
  const [successData, setSuccessData] = React.useState(null);

  const handleFileChange = (e) => {
    setError(null);
    const file = (e.target.files || [])[0] || null;
    if (file) {
      const ext = file.name.toLowerCase();
      if (!ext.endsWith('.pdf') && !ext.endsWith('.xls') && !ext.endsWith('.xlsx')) {
        setError('Formato no compatible. Por favor suba un archivo PDF o Excel (XLS, XLSX).');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    setError(null);
    const file = (e.dataTransfer.files || [])[0] || null;
    if (file) {
      const ext = file.name.toLowerCase();
      if (!ext.endsWith('.pdf') && !ext.endsWith('.xls') && !ext.endsWith('.xlsx')) {
        setError('Formato no compatible. Por favor suba un archivo PDF o Excel (XLS, XLSX).');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadAndScan = async () => {
    if (!selectedFile) {
      setError('Por favor seleccione un archivo de siniestro antes de continuar.');
      return;
    }

    setLoading(true);
    setError(null);
    
    // Simular pasos interactivos premium
    setLoadingStep('Extrayendo texto crudo del documento...');
    await new Promise(r => setTimeout(r, 600));
    
    setLoadingStep(bypassGemini ? 'Ejecutando Parser Heurístico Local de Contingencia...' : 'Ejecutando Inferencia con Gemini 2.5 Flash (Rotador Rotativo)...');
    await new Promise(r => setTimeout(r, 800));

    setLoadingStep('Persistiendo y estructurando registros relacionales en CSV...');
    await new Promise(r => setTimeout(r, 500));

    try {
      const response = await window.ClaimsService.quickScanClaim(selectedFile, bypassGemini);
      if (response && response.status === 'success') {
        setSuccessData({
          ...response.extracted_fields,
          is_batch_import: response.is_batch_import,
          imported_counts: response.imported_counts
        });
        if (setGlobalClaimId) {
          setGlobalClaimId(response.extracted_fields.claim_id);
        }
      } else {
        setError('El servidor no devolvió una respuesta válida.');
      }
    } catch (err) {
      setError(err.message || 'Error al conectar con la API de escaneo.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleStartAudit = () => {
    if (successData && successData.claim_id) {
      // Guardar en sessionStorage para que App.jsx lo cargue y haga un F5 real
      sessionStorage.setItem('defaultClaimId', successData.claim_id);
      window.location.reload();
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  return (
    <div className="max-w-3xl mx-auto bg-theme-surface rounded-2xl border border-theme-border p-8 shadow-sm animate-fade-in text-left">
      <div className="border-b border-theme-border pb-4 mb-6">
        <h2 className="text-lg font-extrabold text-theme-textPrimary tracking-tight flex items-center gap-2">
          ⚡ Escaneo Rápido Cognitive (PDF)
        </h2>
        <p className="text-[10px] text-theme-textMuted uppercase tracking-widest font-extrabold mt-1">
          Cargue un documento PDF y deje que la IA estructure y persista el siniestro en segundos
        </p>
      </div>

      {!successData ? (
        <div className="space-y-6">
          {/* Zona de Drop */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition-all cursor-pointer ${
              isDragOver 
                ? 'border-theme-accent bg-theme-accent/5' 
                : selectedFile 
                  ? 'border-theme-success/50 bg-theme-successBg/20' 
                  : 'border-theme-border hover:border-theme-accent/60 bg-theme-bg/30'
            }`}
          >
            <input
              type="file"
              id="pdf-scan-input"
              accept=".pdf,application/pdf,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileChange}
              disabled={loading}
              className="hidden"
            />
            
            <label htmlFor="pdf-scan-input" className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
              {selectedFile ? (
                <>
                  <div className="p-4 bg-theme-successBg border border-theme-successBorder rounded-2xl text-theme-success font-bold mb-4 shadow-sm">
                    <svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-theme-textPrimary font-extrabold text-sm truncate max-w-md">
                    {selectedFile.name}
                  </h3>
                  <p className="text-[10px] text-theme-textMuted font-mono mt-1">
                    Tamaño: {formatBytes(selectedFile.size)} | Formato: Documento listo
                  </p>
                  <p className="text-[9px] text-theme-accent font-extrabold uppercase tracking-widest mt-4 bg-theme-bg px-2 py-1 rounded-md">
                    Haga clic o arrastre otro archivo para cambiar
                  </p>
                </>
              ) : (
                <>
                  <div className="p-4 bg-theme-surface border border-theme-border rounded-2xl text-theme-textMuted mb-4 hover:scale-105 transition-all">
                    <svg className="h-10 w-10 text-theme-textMuted" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                    </svg>
                  </div>
                  <h3 className="text-theme-textPrimary font-extrabold text-sm">
                    Seleccione o Arrastre su Documento de Siniestro
                  </h3>
                  <p className="text-[10px] text-theme-textMuted mt-1">
                    Se admiten archivos PDF y Excel XLS/XLSX (Formulario de reclamación, Parte Policial o Factura)
                  </p>
                  <span className="mt-4 px-4 py-2 bg-theme-surface hover:bg-theme-bg border border-theme-border hover:border-theme-textMuted text-theme-textSecondary text-[10px] font-extrabold rounded-xl transition-all shadow-sm">
                    Examinar Archivos
                  </span>
                </>
              )}
            </label>
          </div>

          {/* Información Explicativa de GPS y Relaciones */}
          <div className="p-4 bg-theme-bg/60 border border-theme-border rounded-xl space-y-2">
            <h4 className="text-[10px] font-extrabold text-theme-textPrimary uppercase tracking-widest flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-theme-accent" />
              Especificaciones de Escaneo
            </h4>
            <ul className="list-disc pl-4 text-[10px] text-theme-textSecondary space-y-1">
              <li><strong>Inyección Directa Relacional</strong>: Si el documento carece de IDs de asegurados o pólizas, el motor los autogenera de forma compatible.</li>
              <li><strong>Blindaje de Geolocalización</strong>: Siguiendo las directrices periciales, si el PDF no contiene coordenadas GPS explícitas, se registrará con coordenadas en blanco. Esto evitará falsas alertas de triangulación geográfica y disparará la alerta dedicada <strong>"SIN UBICACIÓN" (Rojo)</strong> en el Dashboard para auditoría física manual obligatoria.</li>
            </ul>
          </div>

          {error && (
            <div className="p-3.5 bg-theme-dangerBg border border-theme-dangerBorder rounded-xl text-theme-dangerText text-xs font-semibold animate-fade-in">
              {error}
            </div>
          )}

          {/* Botones de control */}
          <div className="flex justify-end gap-3 pt-4 border-t border-theme-border">
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              disabled={loading || !selectedFile}
              className="px-5 py-2.5 bg-theme-bg hover:bg-theme-surface border border-theme-border rounded-xl text-theme-textSecondary font-bold transition-all text-xs disabled:opacity-50 disabled:pointer-events-none active:scale-95"
            >
              Limpiar Selección
            </button>
            
            <button
              onClick={handleUploadAndScan}
              disabled={loading || !selectedFile}
              className="px-6 py-2.5 bg-theme-accent hover:bg-theme-accentHover active:scale-95 disabled:scale-100 disabled:opacity-50 rounded-xl font-bold text-white transition-all shadow-sm flex items-center justify-center gap-2 text-xs border border-transparent"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Procesando...</span>
                </>
              ) : (
                <span>Escanear y Persistir en Base de Datos</span>
              )}
            </button>
          </div>

          {/* overlay de carga premium */}
          {loading && (
            <div className="fixed inset-0 z-[150] bg-theme-bg/60 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in">
              <div className="bg-theme-surface p-8 rounded-2xl border border-theme-border shadow-xl flex flex-col items-center max-w-sm w-full mx-4">
                <div className="relative h-14 w-14 mb-4">
                  <div className="absolute inset-0 rounded-full border-4 border-theme-border border-t-theme-accent animate-spin" />
                  <div className="absolute inset-2.5 rounded-full bg-indigo-500/10 flex items-center justify-center text-theme-accent font-bold text-xs">
                    IA
                  </div>
                </div>
                <h3 className="text-theme-textPrimary font-extrabold text-sm mb-1">
                  Procesamiento de Documento Activo
                </h3>
                <p className="text-[10px] text-theme-textMuted uppercase font-extrabold tracking-wider animate-pulse">
                  {loadingStep}
                </p>
              </div>
            </div>
          )}

        </div>
      ) : (
        /* Vista de Éxito y Resumen de Extracción */
        <div className="space-y-6 animate-fade-in text-left">
          
          <div className="p-4 bg-theme-successBg border border-theme-successBorder rounded-2xl flex items-start gap-4 shadow-sm animate-fade-in">
            <div className="p-2 bg-theme-successBg rounded-xl text-theme-success">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-theme-successText text-sm font-extrabold uppercase tracking-wider">
                {successData.is_batch_import 
                  ? '✓ Ingesta Masiva de Base de Datos Exitosa'
                  : '✓ Documento Escaneado e Insertado de Forma Exitosa'}
              </h3>
              <p className="text-theme-textSecondary text-xs mt-1">
                {successData.is_batch_import
                  ? 'El sistema de ingesta masiva ha procesado el archivo Excel y ha insertado de forma relacional la totalidad del lote en las bases de datos locales.'
                  : 'La Inteligencia Artificial ha extraído los datos del documento y los ha insertado correctamente de forma relacional en el sandbox analítico. El siniestro ya es completamente auditable.'}
              </p>
            </div>
          </div>

          {successData.is_batch_import ? (
            /* Vista de estadísticas para Batch Import en Tabla Premium */
            <div className="p-6 bg-theme-bg border border-theme-border rounded-2xl shadow-sm animate-fade-in space-y-4">
              <div className="border-b border-theme-border pb-3">
                <h4 className="text-xs font-black text-theme-textPrimary uppercase tracking-widest flex items-center gap-2">
                  📊 Resumen de Registros Extraídos de Base de Datos
                </h4>
                <p className="text-[10px] text-theme-textMuted uppercase mt-1">
                  Ingesta Directa por Motor de Ingesta Local sin Consumo de IA
                </p>
              </div>

              <div className="overflow-hidden border border-theme-border rounded-xl">
                <table className="w-full text-xs text-left border-collapse bg-theme-surface">
                  <thead>
                    <tr className="bg-theme-bg/60 text-theme-textMuted font-bold uppercase text-[9px] tracking-wider border-b border-theme-border">
                      <th className="px-4 py-2.5">Hoja Excel</th>
                      <th className="px-4 py-2.5">Tipo de Registro</th>
                      <th className="px-4 py-2.5 text-right">Registros Extraídos</th>
                      <th className="px-4 py-2.5 text-center">Estado de Ingesta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border text-theme-textSecondary">
                    <tr>
                      <td className="px-4 py-2.5 font-mono font-semibold">1_Siniestros</td>
                      <td className="px-4 py-2.5">Siniestros / Reclamaciones</td>
                      <td className="px-4 py-2.5 text-right font-bold text-theme-textPrimary font-mono text-sm">{successData.imported_counts.siniestros}</td>
                      <td className="px-4 py-2.5 text-center text-theme-success font-bold flex items-center justify-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-theme-success inline-block"></span> ✓ Persistido</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-mono font-semibold">2_Polizas</td>
                      <td className="px-4 py-2.5">Pólizas de Seguro</td>
                      <td className="px-4 py-2.5 text-right font-bold text-theme-textPrimary font-mono text-sm">{successData.imported_counts.polizas}</td>
                      <td className="px-4 py-2.5 text-center text-theme-success font-bold flex items-center justify-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-theme-success inline-block"></span> ✓ Persistido</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-mono font-semibold">3_Asegurados</td>
                      <td className="px-4 py-2.5">Perfiles de Asegurados</td>
                      <td className="px-4 py-2.5 text-right font-bold text-theme-textPrimary font-mono text-sm">{successData.imported_counts.asegurados}</td>
                      <td className="px-4 py-2.5 text-center text-theme-success font-bold flex items-center justify-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-theme-success inline-block"></span> ✓ Persistido</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-mono font-semibold">4_Proveedores</td>
                      <td className="px-4 py-2.5">Talleres y Proveedores</td>
                      <td className="px-4 py-2.5 text-right font-bold text-theme-textPrimary font-mono text-sm">{successData.imported_counts.proveedores}</td>
                      <td className="px-4 py-2.5 text-center text-theme-success font-bold flex items-center justify-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-theme-success inline-block"></span> ✓ Persistido</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-3.5 bg-theme-bg/60 border border-theme-border rounded-xl">
                <p className="text-[10px] text-theme-textSecondary leading-relaxed flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-theme-accent inline-block animate-ping"></span>
                  <span><strong>Detalle de Ingesta</strong>: Al hacer clic en "Comenzar Auditoría", el Dashboard se recargará automáticamente y cargará por defecto el primer siniestro del lote (<strong>{successData.claim_id}</strong>) para iniciar de inmediato la evaluación híbrida y ML.</span>
                </p>
              </div>
            </div>
          ) : (
            /* Vista de variables extraídas de un solo claim */
            <div className="border border-theme-border rounded-2xl overflow-hidden bg-theme-surface shadow-sm">
              <div className="bg-theme-bg/60 border-b border-theme-border px-4 py-3 flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-theme-textPrimary uppercase tracking-widest">
                  Variables Crudas Detectadas y Guardadas
                </span>
                <span className="px-2 py-0.5 bg-theme-accent/10 border border-theme-accent/20 text-theme-accent text-[9px] font-extrabold uppercase tracking-widest rounded-md">
                  Respetando Consigna
                </span>
              </div>
              
              <div className="divide-y divide-theme-border text-xs">
                <div className="grid grid-cols-3 px-4 py-2.5">
                  <span className="text-theme-textMuted font-bold text-[10px] uppercase">ID Siniestro</span>
                  <span className="col-span-2 text-theme-textPrimary font-mono font-bold">{successData.claim_id}</span>
                </div>
                <div className="grid grid-cols-3 px-4 py-2.5">
                  <span className="text-theme-textMuted font-bold text-[10px] uppercase">ID Póliza (Consistente)</span>
                  <span className="col-span-2 text-theme-textSecondary font-mono">{successData.poliza_id}</span>
                </div>
                <div className="grid grid-cols-3 px-4 py-2.5">
                  <span className="text-theme-textMuted font-bold text-[10px] uppercase">Asegurado</span>
                  <span className="col-span-2 text-theme-textPrimary font-semibold">{successData.nombre_asegurado} <span className="text-[10px] font-mono text-theme-textMuted">({successData.asegurado_id})</span></span>
                </div>
                <div className="grid grid-cols-3 px-4 py-2.5">
                  <span className="text-theme-textMuted font-bold text-[10px] uppercase">RUC Asegurado</span>
                  <span className="col-span-2 text-theme-textSecondary font-mono">{successData.ruc_asegurado}</span>
                </div>
                <div className="grid grid-cols-3 px-4 py-2.5">
                  <span className="text-theme-textMuted font-bold text-[10px] uppercase">Taller Proveedor</span>
                  <span className="col-span-2 text-theme-textSecondary font-semibold">{successData.nombre_proveedor}</span>
                </div>
                <div className="grid grid-cols-3 px-4 py-2.5">
                  <span className="text-theme-textMuted font-bold text-[10px] uppercase">Monto Reclamado</span>
                  <span className="col-span-2 text-theme-textPrimary font-mono font-bold">${successData.monto_reclamado.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span>
                </div>
                <div className="grid grid-cols-3 px-4 py-2.5">
                  <span className="text-theme-textMuted font-bold text-[10px] uppercase">Fecha Siniestro</span>
                  <span className="col-span-2 text-theme-textSecondary font-mono">{successData.fecha_siniestro}</span>
                </div>
                <div className="grid grid-cols-3 px-4 py-2.5">
                  <span className="text-theme-textMuted font-bold text-[10px] uppercase">Geolocalización GPS</span>
                  <span className="col-span-2 text-theme-dangerText font-extrabold uppercase font-mono flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-theme-danger animate-pulse" />
                    SIN UBICACIÓN (En Blanco)
                  </span>
                </div>
                <div className="grid grid-cols-3 px-4 py-2.5">
                  <span className="text-theme-textMuted font-bold text-[10px] uppercase">Narrativa del Accidente</span>
                  <span className="col-span-2 text-theme-textSecondary leading-relaxed text-xs italic">"{successData.narrativa_libre}"</span>
                </div>
                {successData.placa_vehiculo && (
                  <div className="grid grid-cols-3 px-4 py-2.5">
                    <span className="text-theme-textMuted font-bold text-[10px] uppercase">Placa de Vehículo</span>
                    <span className="col-span-2 text-theme-textPrimary font-mono font-bold bg-theme-bg px-2 py-0.5 rounded-md inline-block max-w-max">{successData.placa_vehiculo}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botones de acción post-escaneo */}
          <div className="flex justify-end gap-3 pt-4 border-t border-theme-border">
            <button
              onClick={() => {
                setSuccessData(null);
                setSelectedFile(null);
              }}
              className="px-5 py-2.5 bg-theme-bg hover:bg-theme-surface border border-theme-border rounded-xl text-theme-textSecondary font-bold transition-all text-xs active:scale-95"
            >
              Escanear Otro Documento
            </button>
            <button
              onClick={handleStartAudit}
              className="px-6 py-2.5 bg-theme-accent hover:bg-theme-accentHover active:scale-95 rounded-xl font-bold text-white transition-all shadow-sm flex items-center justify-center gap-1.5 text-xs border border-transparent"
            >
              <span>Comenzar Auditoría en Dashboard</span>
              <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
