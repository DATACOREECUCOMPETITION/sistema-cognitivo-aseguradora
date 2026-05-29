window.ClaimCreateView = function ClaimCreateView({ onAnalyzeEnd, bypassGemini = false, setActiveView, setGlobalClaimId }) {
  const [catalogs, setCatalogs] = React.useState(null);
  const [loadingCatalogs, setLoadingCatalogs] = React.useState(true);
  const [errorCatalogs, setErrorCatalogs] = React.useState(null);

  const [formLoading, setFormLoading] = React.useState(false);
  const [formError, setFormError] = React.useState(null);
  const [photoFiles, setPhotoFiles] = React.useState([]);
  const [pdfFile, setPdfFile] = React.useState(null);

  const getTodayISOString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const MIN_PHOTOS = 1;
  const MAX_PHOTOS = 7;
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const ALLOWED_DOC_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  const isAllowedImage = (file) => {
    if (!file) return false;
    if (ALLOWED_IMAGE_TYPES.includes(file.type)) return true;
    const ext = (file.name || '').toLowerCase();
    return ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png') || ext.endsWith('.webp');
  };

  const handlePhotoChange = (e) => {
    setFormError(null);
    const files = Array.from(e.target.files || []);
    const valid = files.filter(isAllowedImage);
    if (valid.length !== files.length) {
      setFormError('Algunas imagenes no son compatibles. Usa JPG, PNG o WEBP.');
    }
    if (valid.length > MAX_PHOTOS) {
      setFormError(`Maximo ${MAX_PHOTOS} fotos permitidas.`);
      setPhotoFiles(valid.slice(0, MAX_PHOTOS));
      return;
    }
    setPhotoFiles(valid);
  };

  const isAllowedDoc = (file) => {
    if (!file) return false;
    if (ALLOWED_DOC_TYPES.includes(file.type)) return true;
    const name = (file.name || '').toLowerCase();
    return name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx') || name.endsWith('.xls') || name.endsWith('.xlsx');
  };

  const handlePdfChange = (e) => {
    setFormError(null);
    const file = (e.target.files || [])[0] || null;
    if (file && !isAllowedDoc(file)) {
      setFormError('El archivo debe ser PDF, Word o Excel valido.');
      setPdfFile(null);
      return;
    }
    setPdfFile(file);
  };

  const [formData, setFormData] = React.useState({
    claim_id: '',
    poliza_id: '',
    asegurado_id: '',
    proveedor_id: '',
    ramo: 'VEHICULOS',
    fecha_siniestro: getTodayISOString(),
    fecha_reporte: getTodayISOString(),
    monto_reclamado: 1500.0,
    lat_siniestro: -0.18,
    lon_siniestro: -78.46,
    severidad: 'LOW',
    narrativa_libre: ''
  });

  // Cargar catálogos dinámicos al montar
  React.useEffect(() => {
    let active = true;
    const fetchCatalogs = async () => {
      try {
        const data = await window.ClaimsService.getClaimsCatalogs();
        if (active) {
          setCatalogs(data);
          setFormData(prev => ({
            ...prev,
            claim_id: data.next_claim_id,
            poliza_id: data.next_poliza_id,
            asegurado_id: data.next_asegurado_id,
            proveedor_id: data.proveedores && data.proveedores.length > 0 ? data.proveedores[0].proveedor_id : ''
          }));
          setLoadingCatalogs(false);
        }
      } catch (err) {
        if (active) {
          setErrorCatalogs(err.message || 'Error al cargar los catálogos del Excel.');
          setLoadingCatalogs(false);
        }
      }
    };
    fetchCatalogs();
    return () => { active = false; };
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    if (photoFiles.length < MIN_PHOTOS || photoFiles.length > MAX_PHOTOS) {
      setFormLoading(false);
      setFormError(`Debes subir entre ${MIN_PHOTOS} y ${MAX_PHOTOS} fotos del accidente.`);
      return;
    }

    if (!pdfFile) {
      setFormLoading(false);
      setFormError('Debes adjuntar el documento de preforma (PDF, Word o Excel).');
      return;
    }

    try {
      const payload = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        payload.append(key, String(value));
      });
      photoFiles.forEach((file) => {
        payload.append('photos', file, file.name);
      });
      payload.append('preforma_pdf', pdfFile, pdfFile.name);

      const response = await window.ClaimsService.createClaimWithEvidence(payload);
      if (response && response.status === 'success') {
        // Guardar en sessionStorage para que App.jsx lo cargue y haga un F5 real
        sessionStorage.setItem('defaultClaimId', formData.claim_id);
        window.location.reload();
      } else {
        setFormError('El servidor no devolvió una confirmación exitosa.');
      }
    } catch (err) {
      setFormError(err.message || 'Error de conexión al registrar el siniestro.');
    } finally {
      setFormLoading(false);
    }
  };

  if (loadingCatalogs) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-theme-surface rounded-2xl border border-theme-border">
        <div className="h-10 w-10 border-2 border-theme-border border-t-theme-accent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-semibold tracking-wider text-theme-textMuted uppercase animate-pulse">
          Calculando IDs Dinámicos y Cargando Catálogos...
        </p>
      </div>
    );
  }

  if (errorCatalogs) {
    return (
      <div className="bg-theme-dangerBg border border-theme-dangerBorder rounded-2xl p-6 flex gap-4 items-start shadow-sm max-w-2xl mx-auto">
        <div className="p-2 bg-theme-dangerBg rounded-xl text-theme-dangerText">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h3 className="text-theme-dangerText text-sm font-semibold">Error al Inicializar Catálogos</h3>
          <p className="text-theme-textSecondary text-xs mt-1">{errorCatalogs}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-3 px-3 py-1.5 bg-theme-dangerBg border border-theme-dangerBorder rounded-lg text-[10px] font-bold text-theme-dangerText hover:bg-theme-bg transition-all"
          >
            Reintentar Carga
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-theme-surface rounded-2xl border border-theme-border p-8 shadow-sm animate-fade-in text-left">
      <div className="border-b border-theme-border pb-4 mb-6">
        <h2 className="text-lg font-extrabold text-theme-textPrimary tracking-tight flex items-center gap-2">
          📥 Registro de Caso de Prueba en Tiempo Real
        </h2>
        <p className="text-[10px] text-theme-textMuted uppercase tracking-widest font-extrabold mt-1">
          Mecanismo dinámico sin alteración manual de código o reinicio de servidor
        </p>
      </div>

      <form onSubmit={handleCreate} className="space-y-6 text-xs text-theme-textSecondary">
        
        {/* Identificadores Calculados */}
        <div className="p-4 bg-theme-bg border border-theme-border rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <span className="block text-theme-textMuted text-[9px] font-bold uppercase tracking-wider mb-1">ID Siniestro Autogenerado</span>
            <span className="text-sm font-bold text-theme-textPrimary font-mono">{formData.claim_id}</span>
          </div>
          <div>
            <span className="block text-theme-textMuted text-[9px] font-bold uppercase tracking-wider mb-1">ID Póliza Asociada (Calculada)</span>
            <span className="text-sm font-semibold text-theme-textSecondary font-mono">{formData.poliza_id}</span>
          </div>
          <div>
            <span className="block text-theme-textMuted text-[9px] font-bold uppercase tracking-wider mb-1">ID Asegurado (Calculado)</span>
            <span className="text-sm font-semibold text-theme-textSecondary font-mono">{formData.asegurado_id}</span>
          </div>
        </div>

        {/* Datos Operativos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-theme-textSecondary font-bold uppercase tracking-wider text-[9px] mb-1.5">Ramo de la Operación</label>
            <select
              value={formData.ramo}
              onChange={(e) => setFormData({...formData, ramo: e.target.value})}
              className="w-full px-3 py-2.5 bg-theme-bg border border-theme-border rounded-xl focus:outline-none focus:ring-1 focus:ring-theme-accent focus:border-transparent text-theme-textSecondary"
            >
              <option value="VEHICULOS">Vehículos (Automotriz)</option>
              <option value="SALUD">Salud (Clínicas/Médico)</option>
            </select>
          </div>

          <div>
            <label className="block text-theme-textSecondary font-bold uppercase tracking-wider text-[9px] mb-1.5">Taller / Proveedor (Pre-cargados del Excel)</label>
            <select
              value={formData.proveedor_id}
              onChange={(e) => setFormData({...formData, proveedor_id: e.target.value})}
              className="w-full px-3 py-2.5 bg-theme-bg border border-theme-border rounded-xl focus:outline-none focus:ring-1 focus:ring-theme-accent focus:border-transparent text-theme-textSecondary font-medium"
            >
              {catalogs.proveedores && catalogs.proveedores.map(p => (
                <option key={p.proveedor_id} value={p.proveedor_id}>
                  {p.nombre} ({p.proveedor_id})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label className="block text-theme-textSecondary font-bold uppercase tracking-wider text-[9px] mb-1.5">Monto Reclamado ($ USD)</label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.monto_reclamado}
              onChange={(e) => setFormData({...formData, monto_reclamado: parseFloat(e.target.value) || 0.0})}
              placeholder="Ej: 3500.00"
              className="w-full px-3 py-2.5 bg-theme-bg border border-theme-border rounded-xl focus:outline-none focus:ring-1 focus:ring-theme-accent focus:border-transparent text-theme-textPrimary font-mono"
            />
          </div>

          <div>
            <label className="block text-theme-textSecondary font-bold uppercase tracking-wider text-[9px] mb-1.5">Fecha del Siniestro</label>
            <input
              type="date"
              required
              value={formData.fecha_siniestro}
              onChange={(e) => setFormData({...formData, fecha_siniestro: e.target.value})}
              className="w-full px-3 py-2.5 bg-theme-bg border border-theme-border rounded-xl focus:outline-none text-theme-textPrimary font-mono"
            />
          </div>

          <div>
            <label className="block text-theme-textSecondary font-bold uppercase tracking-wider text-[9px] mb-1.5">Fecha Reporte Aseguradora</label>
            <input
              type="date"
              required
              value={formData.fecha_reporte}
              onChange={(e) => setFormData({...formData, fecha_reporte: e.target.value})}
              className="w-full px-3 py-2.5 bg-theme-bg border border-theme-border rounded-xl focus:outline-none text-theme-textPrimary font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-theme-textSecondary font-bold uppercase tracking-wider text-[9px] mb-1.5">Severidad Declarada</label>
            <select
              value={formData.severidad}
              onChange={(e) => setFormData({...formData, severidad: e.target.value})}
              className="w-full px-3 py-2.5 bg-theme-bg border border-theme-border rounded-xl focus:outline-none focus:ring-1 focus:ring-theme-accent focus:border-transparent text-theme-textSecondary"
            >
              <option value="LOW">Baja (LOW)</option>
              <option value="MEDIUM">Media (MEDIUM)</option>
              <option value="HIGH">Alta (HIGH)</option>
              <option value="CRITICAL">Crítica (CRITICAL)</option>
            </select>
          </div>

          {/* Variables de Geolocalización Ocultas o Simplificadas con Defaults */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-theme-textMuted font-bold uppercase tracking-wider text-[8px] mb-1.5">Latitud (Default)</label>
              <input
                type="number"
                step="0.0001"
                value={formData.lat_siniestro}
                onChange={(e) => setFormData({...formData, lat_siniestro: parseFloat(e.target.value) || 0.0})}
                className="w-full px-3 py-2.5 bg-theme-bg/60 border border-theme-border rounded-xl text-theme-textSecondary font-mono"
              />
            </div>
            <div>
              <label className="block text-theme-textMuted font-bold uppercase tracking-wider text-[8px] mb-1.5">Longitud (Default)</label>
              <input
                type="number"
                step="0.0001"
                value={formData.lon_siniestro}
                onChange={(e) => setFormData({...formData, lon_siniestro: parseFloat(e.target.value) || 0.0})}
                className="w-full px-3 py-2.5 bg-theme-bg/60 border border-theme-border rounded-xl text-theme-textSecondary font-mono"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-theme-textSecondary font-bold uppercase tracking-wider text-[9px] mb-1.5">Descripción Narrativa Libre (Evidencia Lingüística)</label>
          <textarea
            required
            rows="4"
            value={formData.narrativa_libre}
            onChange={(e) => setFormData({...formData, narrativa_libre: e.target.value})}
            placeholder="Redacta cómo ocurrió el siniestro (ej: Siniestro ocurrido a las 24 horas del inicio de la póliza...)"
            className="w-full px-3 py-2.5 bg-theme-bg border border-theme-border rounded-xl focus:outline-none focus:ring-1 focus:ring-theme-accent focus:border-transparent text-theme-textPrimary leading-relaxed text-xs"
          />
          <p className="text-[10px] text-theme-textMuted mt-1">
            Tip: La narrativa libre es fundamental para que el motor de IA analice la estilometría y busque inconsistencias o duplicados semánticos.
          </p>
        </div>

        <div className="p-4 bg-theme-bg border border-theme-border rounded-xl space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-[11px] font-extrabold text-theme-textPrimary uppercase tracking-widest">
                Evidencias del Accidente
              </h3>
              <p className="text-[10px] text-theme-textMuted mt-1">
                Las imagenes y el PDF se almacenan localmente. Solo se extrae metadata y texto.
              </p>
            </div>
            <div className="text-[10px] font-mono text-theme-textSecondary">
              {photoFiles.length} / {MAX_PHOTOS} fotos
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-theme-textSecondary font-bold uppercase tracking-wider text-[9px] mb-1.5">
                Fotos del accidente (min {MIN_PHOTOS} / max {MAX_PHOTOS})
              </label>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                className="w-full text-[10px] text-theme-textSecondary file:mr-3 file:rounded-lg file:border-0 file:bg-theme-surface file:px-3 file:py-2 file:text-[10px] file:font-bold file:text-theme-textSecondary hover:file:bg-theme-bg"
              />
              {photoFiles.length > 0 && (
                <div className="mt-2 text-[10px] text-theme-textMuted space-y-1 max-h-24 overflow-y-auto">
                  {photoFiles.map((file, idx) => (
                    <div key={`${file.name}-${idx}`} className="truncate">• {file.name}</div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-theme-textSecondary font-bold uppercase tracking-wider text-[9px] mb-1.5">
                Documento de preforma del taller (PDF, Word o Excel)
              </label>
              <input
                type="file"
                accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handlePdfChange}
                className="w-full text-[10px] text-theme-textSecondary file:mr-3 file:rounded-lg file:border-0 file:bg-theme-surface file:px-3 file:py-2 file:text-[10px] file:font-bold file:text-theme-textSecondary hover:file:bg-theme-bg"
              />
              {pdfFile && (
                <div className="mt-2 text-[10px] text-theme-textMuted truncate">
                  • {pdfFile.name}
                </div>
              )}
            </div>
          </div>
        </div>

        {formError && (
          <div className="p-3.5 bg-theme-dangerBg border border-theme-dangerBorder rounded-xl text-theme-dangerText text-xs font-semibold">
            {formError}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-6 border-t border-theme-border">
          <button
            type="button"
            onClick={() => setActiveView('analysis')}
            className="px-5 py-2.5 bg-theme-bg hover:bg-theme-surface border border-theme-border hover:border-theme-border rounded-xl text-theme-textSecondary font-bold transition-all text-xs active:scale-95"
          >
            Cancelar y Volver
          </button>
          <button
            type="submit"
            disabled={formLoading}
            className="px-6 py-2.5 bg-theme-accent hover:bg-theme-accentHover active:scale-95 disabled:scale-100 rounded-xl font-bold text-white transition-all shadow-sm flex items-center justify-center gap-2 text-xs border border-transparent"
          >
            {formLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Registrando...</span>
              </>
            ) : (
              <span>Registrar e Iniciar Análisis Híbrido</span>
            )}
          </button>
        </div>

      </form>
    </div>
  );
};
