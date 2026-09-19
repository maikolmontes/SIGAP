import { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../../components/common/Layout';
import { BarChart3, AlertTriangle, RefreshCw, Calendar } from 'lucide-react';

import * as analitica from '../../services/analiticaService';
import type {
  MetricaAnalitica, PeriodoAnalitico, InterpretacionIA,
  FacultadAmbito, FiltroAmbito
} from '../../services/analiticaService';
import FiltroAmbitoSelector from '../../components/analitica/FiltroAmbitoSelector';

import KpiGrid from '../../components/analitica/KpiGrid';
import AgendasChart from '../../components/analitica/AgendasChart';
import HorasChart from '../../components/analitica/HorasChart';
import CortesComparisonChart from '../../components/analitica/CortesComparisonChart';
import DocentesAnalyticsTable from '../../components/analitica/DocentesAnalyticsTable';
import ConsolidadoProgramasTable from '../../components/analitica/ConsolidadoProgramasTable';
import BrechaEvidenciasTable from '../../components/analitica/BrechaEvidenciasTable';
import InterpretacionCard from '../../components/analitica/InterpretacionCard';

interface AnaliticaProps {
  rol: 'planeacion' | 'director' | 'consultor';
}

export default function Analitica({ rol }: AnaliticaProps) {
  const [periodos, setPeriodos] = useState<PeriodoAnalitico[]>([]);
  const [periodoId, setPeriodoId] = useState<number | undefined>(undefined);
  const [indicadores, setIndicadores] = useState<MetricaAnalitica[]>([]);
  const [detalle, setDetalle] = useState<MetricaAnalitica | undefined>(undefined);
  const [consolidado, setConsolidado] = useState<MetricaAnalitica | undefined>(undefined);
  const [brecha, setBrecha] = useState<MetricaAnalitica | undefined>(undefined);
  const [etiquetaPeriodo, setEtiquetaPeriodo] = useState<string>('');
  const [programa, setPrograma] = useState<string | null>(null);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [interpretacion, setInterpretacion] = useState<InterpretacionIA | null>(null);
  const [cargandoIA, setCargandoIA] = useState(false);

  // Filtro por facultad / programa (Planeación y Consultor)
  const [facultades, setFacultades] = useState<FacultadAmbito[]>([]);
  const [filtro, setFiltro] = useState<FiltroAmbito>({});
  const [ambitoBloqueado, setAmbitoBloqueado] = useState(true);

  // El Consultor no tiene acceso al balance contractual (IND-04)
  const puedeVerDetalle = rol !== 'consultor';

  const buscar = useCallback((id: string) => indicadores.find((i) => i.indicadorId === id), [indicadores]);

  // ---------------------------------------------------------------
  // Carga de las cifras. La interpretación va aparte, a propósito:
  // los gráficos no deben esperar a la IA.
  // ---------------------------------------------------------------
  const cargar = useCallback(async (id?: number, ambito: FiltroAmbito = {}) => {
    setCargando(true);
    setError(null);
    try {
      const resumen = await analitica.getResumen(id, ambito);
      setIndicadores(resumen.indicadores);
      setEtiquetaPeriodo(resumen.periodo.etiqueta);
      setPrograma(resumen.programa);
      setPeriodoId(resumen.periodo.id_periodo);
      setAmbitoBloqueado(resumen.ambito.bloqueado);

      // Las tablas son complementarias: si alguna falla, el resto del
      // panel sigue en pie. Van en paralelo para no encadenar esperas.
      const [cons, det, brec] = await Promise.allSettled([
        analitica.getConsolidadoProgramas(id, ambito),
        puedeVerDetalle ? analitica.getDetalleDocentes(id, ambito) : Promise.reject(),
        puedeVerDetalle ? analitica.getBrechaEvidencias(id, ambito) : Promise.reject()
      ]);
      setConsolidado(cons.status === 'fulfilled' ? cons.value : undefined);
      setDetalle(det.status === 'fulfilled' ? det.value : undefined);
      setBrecha(brec.status === 'fulfilled' ? brec.value : undefined);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'No se pudieron cargar los indicadores analíticos.');
      setIndicadores([]);
      setDetalle(undefined);
      setConsolidado(undefined);
      setBrecha(undefined);
    } finally {
      setCargando(false);
    }
  }, [puedeVerDetalle]);

  useEffect(() => {
    analitica.getPeriodos().then(setPeriodos).catch(() => setPeriodos([]));
    analitica.getAmbito()
      .then((a) => { setFacultades(a.facultades); setAmbitoBloqueado(a.bloqueado); })
      .catch(() => setFacultades([]));
  }, []);

  useEffect(() => {
    cargar(undefined, {});
  }, [cargar]);

  const pedirInterpretacion = useCallback(async (metricas: MetricaAnalitica[]) => {
    if (metricas.length === 0) return;
    setCargandoIA(true);
    try {
      setInterpretacion(await analitica.interpretar(metricas));
    } catch {
      setInterpretacion(null);
    } finally {
      setCargandoIA(false);
    }
  }, []);

  // Cuando llegan cifras nuevas, se pide la lectura descriptiva.
  useEffect(() => {
    if (!cargando && indicadores.length > 0) {
      pedirInterpretacion(indicadores);
    }
  }, [cargando, indicadores, pedirInterpretacion]);

  const cambiarPeriodo = (id: number) => {
    setPeriodoId(id);
    setInterpretacion(null);
    cargar(id, filtro);
    // El conteo de docentes por programa depende del período
    analitica.getAmbito(id).then((a) => setFacultades(a.facultades)).catch(() => undefined);
  };

  const cambiarAmbito = (nuevo: FiltroAmbito) => {
    setFiltro(nuevo);
    setInterpretacion(null);
    cargar(periodoId, nuevo);
  };

  const hayDatos = useMemo(
    () => indicadores.some((i) => (i.resumenNumerico.total ?? 0) > 0),
    [indicadores]
  );

  const tituloRol =
    rol === 'director' ? 'Analítica del Programa'
      : rol === 'consultor' ? 'Analítica Institucional'
      : 'Analítica y Reportes';

  return (
    <Layout rol={rol} path={`Reportes / ${tituloRol}`}>
      {/* Encabezado */}
      <div className="bg-[#1a2744] rounded-2xl px-6 py-5 mb-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-[#00a896]" />
              {tituloRol}
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              Indicadores descriptivos de la actividad profesoral
              {programa ? ` · ${programa}` : ' · toda la institución'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <FiltroAmbitoSelector
              facultades={facultades}
              filtro={filtro}
              bloqueado={ambitoBloqueado}
              onCambiar={cambiarAmbito}
            />

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
              <select
                value={periodoId ?? ''}
                onChange={(e) => cambiarPeriodo(Number(e.target.value))}
                className="pl-9 pr-8 py-2.5 rounded-xl text-sm font-semibold bg-white text-slate-700 border border-white/20 focus:outline-none focus:ring-2 focus:ring-[#00a896]/40 cursor-pointer appearance-none"
              >
                {periodos.map((p) => (
                  <option key={p.id_periodo} value={p.id_periodo}>
                    {p.etiqueta}{p.activo ? ' · activo' : ''} ({p.docentesConAgenda})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => cargar(periodoId, filtro)}
              disabled={cargando}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-5 rounded-xl border bg-rose-50 border-rose-200 text-rose-800 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="font-medium text-sm">{error}</p>
        </div>
      )}

      {cargando ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="animate-spin w-10 h-10 border-4 border-[#00a896] border-t-transparent rounded-full" />
          <p className="text-sm text-slate-500">Calculando indicadores del período…</p>
        </div>
      ) : (
        <div className="space-y-5">
          <KpiGrid
            agendas={buscar('IND-01')}
            devolucion={buscar('IND-02')}
            horas={buscar('IND-03')}
            evidencias={buscar('IND-07')}
          />

          {!hayDatos && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-900 text-sm">Sin actividad registrada en {etiquetaPeriodo}</h4>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Ningún docente tiene agenda cargada en este período. Seleccione otro período en el
                  desplegable superior para ver datos.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <AgendasChart metrica={buscar('IND-01')} />
            <HorasChart metrica={buscar('IND-03')} />
          </div>

          <CortesComparisonChart metrica={buscar('IND-06')} />

          <InterpretacionCard
            interpretacion={interpretacion}
            cargando={cargandoIA}
            onReintentar={() => pedirInterpretacion(indicadores)}
          />

          {/* Comparación entre programas: pierde sentido con uno solo */}
          {(consolidado?.filasTabla?.length ?? 0) > 1 && (
            <ConsolidadoProgramasTable metrica={consolidado} />
          )}

          {puedeVerDetalle && <BrechaEvidenciasTable metrica={brecha} />}

          {puedeVerDetalle && <DocentesAnalyticsTable metrica={detalle} />}

          <p className="text-[11px] text-slate-400 text-center pt-1">
            Datos calculados directamente sobre la base de datos institucional · período {etiquetaPeriodo}
          </p>
        </div>
      )}
    </Layout>
  );
}
