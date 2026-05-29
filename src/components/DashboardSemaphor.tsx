import React, { useState } from 'react';
import { ColorSemaforo, NivelGravedad, ClaimAnalysisResponse } from '../types/insurance';
import { ClaimsService } from '../services/claimsService';

export const DashboardSemaphor: React.FC = () => {
  // Estados de control de la UI
  const [claimId, setClaimId] = useState<string>('CLM-2026-001');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ClaimAnalysisResponse | null>(null);

  /**
   * Ejecuta la consulta de análisis al backend mediante el servicio ClaimsService
   */
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = claimId.trim();
    if (!cleanId) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await ClaimsService.analyzeClaim(cleanId);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Error inesperado al conectar con el servidor analítico.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Helper para asignar clases de color de Tailwind basadas en el ColorSemaforo
   */
  const getSemaforoClasses = (color: ColorSemaforo) => {
    switch (color) {
      case 'VERDE':
        return {
          bg: 'bg-emerald-500',
          text: 'text-emerald-500',
          border: 'border-emerald-500/20',
          bgLight: 'bg-emerald-500/10',
          glow: 'shadow-emerald-500/20'
        };
      case 'AMARILLO':
        return {
          bg: 'bg-amber-500',
          text: 'text-amber-500',
          border: 'border-amber-500/20',
          bgLight: 'bg-amber-500/10',
          glow: 'shadow-amber-500/20'
        };
      case 'ROJO':
        return {
          bg: 'bg-rose-500',
          text: 'text-rose-500',
          border: 'border-rose-500/20',
          bgLight: 'bg-rose-500/10',
          glow: 'shadow-rose-500/20'
        };
      default:
        return {
          bg: 'bg-slate-500',
          text: 'text-slate-500',
          border: 'border-slate-500/20',
          bgLight: 'bg-slate-500/10',
          glow: 'shadow-slate-500/20'
        };
    }
  };

  /**
   * Helper para asignar clases de color basadas en la gravedad
   */
  const getSeverityBadgeClasses = (severity: NivelGravedad) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'HIGH':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'LOW':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 text-slate-100 font-sans">
      
      {/* 1. SECCIÓN CABECERA Y BUSCADOR */}
      <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 mb-8 shadow-xl shadow-slate-950/50">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Detector de Fraude - Aseguradora del Sur
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Plataforma Analítica e Inteligencia Artificial Multimodal Híbrida
            </p>
          </div>
          
          <form onSubmit={handleAnalyze} className="flex gap-3 w-full md:w-auto">
            <input
              type="text"
              value={claimId}
              onChange={(e) => setClaimId(e.target.value)}
              placeholder="Ej: CLM-2026-001"
              required
              className="flex-1 md:w-64 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-100 transition-all font-mono placeholder:text-slate-600"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-95 disabled:scale-100 rounded-xl font-medium text-white transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 min-w-[120px]"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Analizando</span>
                </>
              ) : (
                'Analizar'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* 2. MANEJO DE ESTADOS DE CARGA Y ERROR */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 rounded-2xl border border-slate-850">
          <div className="relative flex items-center justify-center">
            <div className="h-16 w-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <div className="absolute h-10 w-10 rounded-full border-4 border-purple-500/20 border-b-purple-500 animate-spin [animation-direction:reverse]" />
          </div>
          <p className="mt-6 text-slate-400 text-sm font-medium animate-pulse">
            Ejecutando algoritmos deterministas y modelos Isolation Forest...
          </p>
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 mb-8 flex gap-4 items-start shadow-lg shadow-rose-950/10">
          <div className="p-2 bg-rose-500/10 rounded-xl text-rose-500">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-rose-500 font-semibold">Fallo en el Análisis</h3>
            <p className="text-slate-400 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* 3. VISTA DE DATOS ANALIZADOS (DASHBOARD RENDER) */}
      {!loading && !error && data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* PANEL IZQUIERDO: SEMÁFORO DE RIESGO GLOBAL */}
          <div className="lg:col-span-1 flex flex-col gap-8">
            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 flex flex-col items-center text-center shadow-xl">
              <h2 className="text-slate-400 font-semibold text-sm uppercase tracking-wider mb-6">
                Evaluación Consolidada
              </h2>
              
              {/* Círculo dinámico de Semáforo con Glow */}
              <div className={`h-40 w-40 rounded-full flex flex-col items-center justify-center border-4 ${getSemaforoClasses(data.risk_level).border} ${getSemaforoClasses(data.risk_level).bgLight} shadow-2xl ${getSemaforoClasses(data.risk_level).glow} transition-all duration-500 relative overflow-hidden group`}>
                <div className={`absolute inset-0 opacity-10 blur-xl ${getSemaforoClasses(data.risk_level).bg}`} />
                <span className="text-5xl font-extrabold text-white tracking-tighter z-10">
                  {data.overall_score}
                </span>
                <span className="text-xs text-slate-400 mt-1 font-semibold z-10">
                  Puntaje Compuesto
                </span>
              </div>

              <div className="mt-6">
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-widest border ${getSemaforoClasses(data.risk_level).border} ${getSemaforoClasses(data.risk_level).text} ${getSemaforoClasses(data.risk_level).bgLight}`}>
                  RIESGO {data.risk_level}
                </span>
              </div>

              <div className="border-t border-slate-800/80 w-full mt-6 pt-6 text-left">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Especificación de Pesos</h4>
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <span>Monto:</span> <span className="font-mono text-slate-300">25%</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <span>Documental:</span> <span className="font-mono text-slate-300">30%</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <span>Historial:</span> <span className="font-mono text-slate-300">25%</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-1.5">
                    <span>Identidad:</span> <span className="font-mono text-slate-300">20%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PANEL CENTRAL Y DERECHO: DESGLOSE DE CATEGORÍAS */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            
            {/* GRID DE LAS 4 DIMENSIONES OBLIGATORIAS */}
            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl">
              <h3 className="text-lg font-bold text-slate-300 mb-6">
                Desglose Dimensional del Motor Antifraude
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(data.categories).map(([name, cat]: [string, any]) => {
                  const colors = getSemaforoClasses(cat.status);
                  return (
                    <div key={name} className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-semibold capitalize text-slate-300">{name}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${colors.border} ${colors.text} ${colors.bgLight}`}>
                            {cat.status}
                          </span>
                        </div>
                        
                        {/* Barra de Progreso Manual con Tailwind */}
                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden mt-3 relative">
                          <div
                            className={`h-full ${colors.bg} rounded-full`}
                            style={{ width: `${cat.subscore}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-1.5 text-xs text-slate-400">
                          <span>Subscore de Riesgo:</span>
                          <span className="font-mono font-bold text-slate-200">{cat.subscore} / 100</span>
                        </div>
                      </div>

                      {/* Listado de alertas por categoría */}
                      {cat.alerts && cat.alerts.length > 0 ? (
                        <div className="mt-4 border-t border-slate-900 pt-3">
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                            Alertas Detectadas ({cat.alerts.length})
                          </h4>
                          <div className="flex flex-col gap-2">
                            {cat.alerts.map((alert: any) => (
                              <div key={alert.alert_id} className="text-xs bg-slate-900/50 p-2 rounded border border-slate-850">
                                <div className="flex justify-between items-center gap-2 mb-1">
                                  <span className="font-semibold text-slate-300 text-[11px] truncate max-w-[150px]">{alert.alert_type}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${getSeverityBadgeClasses(alert.severity)}`}>
                                    {alert.severity}
                                  </span>
                                </div>
                                <p className="text-slate-400 text-[10px] leading-relaxed">{alert.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 border-t border-slate-900 pt-3 text-center">
                          <p className="text-slate-600 text-[10px] italic">Sin alertas reportadas</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECCIÓN NARRATIVAS DE EXPLICABILIDAD */}
            {data.analyst_narratives && data.analyst_narratives.length > 0 && (
              <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl">
                <h3 className="text-lg font-bold text-slate-300 mb-6">
                  Informe de Peritaje Forense y Recomendaciones
                </h3>
                
                <div className="flex flex-col gap-6">
                  {data.analyst_narratives.map((narrative) => (
                    <div key={narrative.narrative_id} className="p-4 bg-slate-950 rounded-xl border border-slate-850 flex flex-col md:flex-row gap-4">
                      
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                          <h4 className="text-sm font-bold text-indigo-400">{narrative.title}</h4>
                          <div className="flex gap-2">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${getSeverityBadgeClasses(narrative.severity_weight)}`}>
                              Gravedad: {narrative.severity_weight}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[9px] font-bold border border-slate-700">
                              Autor: {narrative.agent_identity}
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-slate-300 text-xs leading-relaxed mb-4">
                          {narrative.summary}
                        </p>
                        
                        {narrative.actionable_recommendation && (
                          <div className="p-3 bg-indigo-500/5 rounded-lg border border-indigo-500/10">
                            <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">
                              Recomendación Accionable para el Analista
                            </h5>
                            <p className="text-slate-400 text-xs leading-relaxed">
                              {narrative.actionable_recommendation}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* 4. MENSAJE EN ESPERA / INICIO */}
      {!loading && !error && !data && (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800 border-dashed text-center">
          <div className="p-4 bg-slate-900/50 rounded-full text-slate-500 border border-slate-850 mb-6">
            <svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-300">Esperando Identificador de Siniestro</h3>
          <p className="text-slate-400 text-sm mt-2 max-w-sm px-6">
            Ingresa un `claim_id` válido en la caja superior (ej: <span className="font-mono text-indigo-400">CLM-2026-001</span>) y haz clic en "Analizar" para evaluar anomalías deterministas y probabilísticas.
          </p>
        </div>
      )}

    </div>
  );
};
