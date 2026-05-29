window.DashboardClaimsTable = function DashboardClaimsTable({
  loadingClaims,
  filteredClaims,
  filterQuery,
  setFilterQuery,
  runAnalysis
}) {
  return (
    <div className="bg-theme-surface backdrop-blur-md rounded-3xl border border-theme-border p-8 shadow-sm relative overflow-hidden animate-fade-in text-left">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/2 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-theme-border pb-5 mb-6 gap-4">
        <div>
          <h2 className="text-md font-extrabold text-theme-textPrimary tracking-tight">
            📂 Catálogo de Expedientes Registrados
          </h2>
          <p className="text-[10px] text-theme-textMuted uppercase tracking-widest font-extrabold mt-1">
            Selecciona un caso del sandbox para iniciar los motores de auditoría forense
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            placeholder="Filtrar expediente..."
            className="px-3 py-1.5 bg-theme-inputBg border border-theme-inputBorder rounded-xl text-[10px] text-theme-inputText placeholder:text-theme-textMuted focus:outline-none focus:ring-1 focus:ring-theme-accent transition-all font-mono"
          />
          <span className="px-3 py-1.5 rounded-full bg-theme-bg border border-theme-border text-theme-textSecondary text-[9px] font-extrabold font-mono uppercase">
            {filteredClaims.length} Casos
          </span>
        </div>
      </div>

      {loadingClaims ? (
        <div className="flex flex-col items-center justify-center py-16 text-theme-textSecondary text-xs">
          <div className="h-8 w-8 border-2 border-theme-border border-t-theme-accent rounded-full animate-spin mb-4" />
          <span>Cargando expediente analítico...</span>
        </div>
      ) : filteredClaims.length > 0 ? (
        <div className="overflow-x-auto w-full overflow-y-auto" style={{ maxHeight: '420px' }}>
          <table className="w-full text-xs text-theme-textSecondary border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="text-theme-textSecondary font-extrabold uppercase tracking-wider text-[9px] bg-theme-bg border-b border-theme-border">
                <th className="px-4 py-3 text-left">Expediente ID</th>
                <th className="px-4 py-3 text-left">Asegurado</th>
                <th className="px-4 py-3 text-left">Ramo</th>
                <th className="px-4 py-3 text-left">Fecha del Siniestro</th>
                <th className="px-4 py-3 text-left">Monto Reclamado</th>
                <th className="px-4 py-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {filteredClaims.map((claim) => (
                <tr 
                  key={claim.claim_id} 
                  className="hover:bg-theme-bg/60 hover:text-theme-textPrimary transition-colors group"
                >
                  <td className="px-4 py-3 font-mono font-bold text-theme-textPrimary select-all">
                    📂 {claim.claim_id}
                  </td>
                  <td className="px-4 py-3 text-theme-textSecondary">
                    👤 {claim.asegurado_id}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-lg bg-theme-surface border border-theme-border text-[8px] font-extrabold text-theme-textSecondary uppercase tracking-wider">
                      {claim.ramo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-theme-textSecondary font-mono">
                    {claim.fecha_siniestro}
                  </td>
                  <td className="px-4 py-3 font-bold text-theme-successText font-mono">
                    $ {claim.monto_reclamado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => runAnalysis(claim.claim_id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider text-theme-accent hover:text-white bg-theme-accent/10 hover:bg-theme-accent border border-theme-accent/20 hover:border-transparent transition-all duration-200 active:scale-95 cursor-pointer shadow-sm"
                    >
                      <svg className="h-3.5 w-3.5 text-theme-accent group-hover:text-white transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Auditar Siniestro</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-12 text-center text-theme-textMuted font-medium italic">
          Ningún siniestro registrado coincide con los términos de búsqueda.
        </div>
      )}
    </div>
  );
};
