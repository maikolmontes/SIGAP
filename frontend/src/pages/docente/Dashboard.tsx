import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Layout from '../../components/common/Layout';
import {
  Clock,
  TrendingUp,
  Building2,
  AlertTriangle,
  Calendar,
  BookOpen,
  FileCheck,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  Hourglass,
  Activity,
  Zap,
  BarChart3,
  Target
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface DocenteData {
  nombre: string;
  programa: string;
  tipoContrato: string;
  periodo: string;
  cierre: string;
  totalHorasContrato: number;
  periodoActivo: boolean;
  perfilDocente: string;
}

interface PeriodoMetrica {
  idPeriodo: number;
  label: string;
  pendientes?: number;
  subidas?: number;
}

interface Metricas {
  totalHoras: number;
  avancePromedioSemana8: number;
  funcionesSustantivas: number;
  evidenciasPendientes: number;
  totalHorasEjecucion: number;
  avanceGeneral: number;
  evidenciasPorPeriodo?: PeriodoMetrica[];
  evidenciasSubidasPorPeriodo?: PeriodoMetrica[];
}

interface DistribucionHoras {
  funcion: string;
  horas: number;
}

interface AvanceItem {
  actividad: string;
  porcentaje: number;
  ejec8: number;
  ejec16: number;
  meta: number;
}

interface EstadoAgenda {
  semana8: string;
  semana16: string;
  funcionesAsignadas: boolean;
}

interface DashboardData {
  docente: DocenteData;
  metricas: Metricas;
  distribucionHoras: DistribucionHoras[];
  avanceSemana8: AvanceItem[];
  estadoAgenda: EstadoAgenda;
}

const COLORS = ['#6366f1', '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444'];

// Barra de progreso animada
function ProgressBar({ value, color = 'indigo', animated = false }: { value: number; color?: string; animated?: boolean }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 120);
    return () => clearTimeout(t);
  }, [value]);

  const colorMap: Record<string, string> = {
    indigo: 'from-indigo-400 to-indigo-600',
    blue: 'from-blue-400 to-blue-600',
    purple: 'from-purple-400 to-purple-600',
    emerald: 'from-emerald-400 to-emerald-600',
    amber: 'from-amber-400 to-amber-500',
  };

  return (
    <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 bg-gradient-to-r ${colorMap[color] || colorMap.indigo} rounded-full transition-all duration-700 ease-out`}
        style={{ width: `${width}%` }}
      />
      {animated && value > 0 && value < 100 && (
        <div
          className="absolute inset-y-0 rounded-full opacity-30"
          style={{
            left: `${Math.max(0, width - 6)}%`,
            width: '12px',
            background: 'white',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      )}
    </div>
  );
}

// Badge estado
function EstadoBadge({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  if (pct >= 100) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ Completo</span>;
  if (pct > 0) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">En progreso</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Sin registrar</span>;
}

const POLL_INTERVAL = 15000; // 15 segundos

export default function DashboardDocente() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [funciones, setFunciones] = useState<any[]>([]);
  const [semanaActiva, setSemanaActiva] = useState(false);
  const [tiempoRestanteTexto, setTiempoRestanteTexto] = useState('');
  const [historicalAgendas, setHistoricalAgendas] = useState<any[]>([]);
  const [pulseAvance, setPulseAvance] = useState(false);
  const prevAvanceRef = useRef<number>(0);

  const fetchDashboard = useCallback(async (silently = false) => {
    try {
      if (!silently) setLoading(true);
      else setRefreshing(true);
      setError(null);

      // 1. Semanas
      try {
        const semanasRes = await api.get('/semanas');
        const semanaCero = semanasRes.data.find((s: any) => s.numero_semana === '0');
        if (semanaCero?.habilitada && semanaCero?.fecha_inicio && semanaCero?.fecha_fin) {
          const ahora = new Date();
          const inicio = new Date(semanaCero.fecha_inicio); inicio.setHours(0, 0, 0, 0);
          const fin = new Date(semanaCero.fecha_fin); fin.setHours(23, 59, 59, 999);
          if (ahora >= inicio && ahora <= fin) {
            setSemanaActiva(true);
            const diffMs = fin.getTime() - ahora.getTime();
            const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const horas = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            setTiempoRestanteTexto(`Sem. 0: ${dias}d ${horas}h`);
          } else {
            setSemanaActiva(false);
            setTiempoRestanteTexto('Semana 0 Finalizada');
          }
        } else {
          setSemanaActiva(false);
          setTiempoRestanteTexto(semanaCero ? 'Sem. 0 Deshabilitada' : '');
        }
      } catch { /* ignore */ }

      // 2. Dashboard principal
      const response = await api.get('/docente/dashboard');
      const newData: DashboardData = response.data;

      // Detectar cambio en avance para animación de pulso
      const newAvance = newData.metricas?.avanceGeneral ?? 0;
      if (silently && prevAvanceRef.current !== newAvance) {
        setPulseAvance(true);
        setTimeout(() => setPulseAvance(false), 2000);
      }
      prevAvanceRef.current = newAvance;
      setData(newData);
      setLastUpdated(new Date());

      // 3. Funciones reales
      const userId = (user as any)?.id_usuario || user?.id;
      if (userId) {
        try {
          const agRes = await api.get(`/agenda/base/${userId}`);
          setFunciones(agRes.data.funciones || []);
        } catch { /* ignore */ }
      }

      // 4. Historial
      if (!newData.docente?.periodoActivo) {
        try {
          const histRes = await api.get('/docente/agendas-por-periodo');
          setHistoricalAgendas(histRes.data);
        } catch { /* ignore */ }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Error desconocido';
      if (err.response?.status === 404) setError('No hay período activo o no se encontró información del docente.');
      else if (err.response?.status === 401) setError('Sesión expirada. Por favor inicia sesión nuevamente.');
      else if (err.code === 'ERR_NETWORK') setError('No se pudo conectar con el servidor.');
      else setError(`Error: ${msg}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboard();
    // Polling cada 15 segundos para datos en tiempo real
    const interval = setInterval(() => fetchDashboard(true), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error al cargar</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { docente, metricas, distribucionHoras, avanceSemana8, estadoAgenda } = data;

  const getEstadoColor = (estado: string) => {
    if (estado === 'Revisado' || estado === 'Aprobado') return 'bg-emerald-500';
    if (estado === 'Pendiente') return 'bg-gray-400';
    if (estado === 'Rechazado') return 'bg-red-500';
    return 'bg-gray-400';
  };

  const totalMeta = avanceSemana8.reduce((s, i) => s + (i.meta || 0), 0);
  const totalEjec8 = avanceSemana8.reduce((s, i) => s + (i.ejec8 || 0), 0);
  const totalEjec16 = avanceSemana8.reduce((s, i) => s + (i.ejec16 || 0), 0);

  return (
    <Layout rol="docente" path="Inicio / Dashboard">
      {/* Banner de bienvenida */}
      <div className="bg-gradient-to-r from-[#1a2744] to-[#0f3460] rounded-2xl px-6 py-6 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm gap-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        <div className="relative z-10">
          <h1 className="text-xl font-bold text-white mb-1">
            Bienvenido, {docente.nombre.split(' ')[0]}
          </h1>
          <p className="text-blue-200 text-xs mb-3">
            {docente.programa} · {docente.tipoContrato} · Periodo {docente.periodo}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 text-[11px] font-bold rounded uppercase tracking-wider ${docente.perfilDocente === 'INCONSISTENCIAS EN AGENDA AC 30' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-indigo-500/30 text-indigo-100 border border-indigo-500/50'}`}>
              {docente.perfilDocente || 'Calculando perfil...'}
            </span>
            {lastUpdated && (
              <span className="text-[10px] text-blue-300/70 flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Actualizado {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {tiempoRestanteTexto && (
            <div className={`px-4 py-2 w-full sm:w-auto rounded-lg font-bold text-sm shrink-0 ${semanaActiva ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" />
                {tiempoRestanteTexto}
              </div>
            </div>
          )}
          <button
            onClick={() => fetchDashboard(true)}
            disabled={refreshing}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm font-medium transition-colors border border-white/20 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {!docente.periodoActivo && (
        <div className="p-4 mb-6 rounded-xl flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 shadow-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">El periodo académico actual está cerrado.</p>
            <p className="text-xs mt-0.5">Puedes visualizar tu información, pero no se permiten modificaciones en la agenda o reportes.</p>
          </div>
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Horas registradas',
            value: `${metricas.totalHorasEjecucion}h`,
            sub: `de ${docente.totalHorasContrato}h`,
            icon: Clock,
            color: 'blue',
            bg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            border: 'border-blue-100'
          },
          {
            label: 'Avance general',
            value: `${metricas.avanceGeneral}%`,
            sub: metricas.avanceGeneral >= 100 ? '✓ Completado' : 'del total',
            icon: TrendingUp,
            color: 'emerald',
            bg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            border: 'border-emerald-100',
            pulse: pulseAvance
          },
          {
            label: 'Funciones',
            value: metricas.funcionesSustantivas,
            sub: 'sustantivas',
            icon: Building2,
            color: 'purple',
            bg: 'bg-purple-50',
            iconColor: 'text-purple-600',
            border: 'border-purple-100'
          },
          {
            label: 'Evidencias',
            value: metricas.evidenciasPendientes,
            sub: metricas.evidenciasPendientes === 0 ? '✓ Al día' : 'pendientes',
            icon: AlertTriangle,
            color: metricas.evidenciasPendientes > 0 ? 'red' : 'emerald',
            bg: metricas.evidenciasPendientes > 0 ? 'bg-red-50' : 'bg-emerald-50',
            iconColor: metricas.evidenciasPendientes > 0 ? 'text-red-600' : 'text-emerald-600',
            border: metricas.evidenciasPendientes > 0 ? 'border-red-100' : 'border-emerald-100'
          },
        ].map(m => (
          <div key={m.label} className={`bg-white border ${m.border} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden ${(m as any).pulse ? 'ring-2 ring-emerald-400 ring-opacity-50' : ''}`}>
            {(m as any).pulse && (
              <div className="absolute inset-0 bg-emerald-50 animate-ping opacity-20 rounded-2xl" />
            )}
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2.5 ${m.bg} rounded-xl`}>
                <m.icon className={`w-5 h-5 ${m.iconColor}`} />
              </div>
              <span className="text-xs font-bold tracking-wider uppercase text-gray-500">{m.label}</span>
            </div>
            <div className="text-2xl font-black text-gray-800">{m.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Sección principal - Distribución + Avance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Distribución de horas (dona) */}
        <div className="col-span-1 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-xs font-bold text-gray-500 mb-4 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            Distribución de horas
          </h3>
          <div className="space-y-2.5 mb-6">
            {distribucionHoras.map((item, index) => (
              <div key={item.funcion} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-xs font-medium text-gray-700 truncate">{item.funcion}</span>
                </div>
                <span className="text-sm font-bold text-gray-900 shrink-0 ml-2">{item.horas}h</span>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Total asignado</span>
              <span className="text-lg font-bold text-gray-900">{metricas.totalHoras}h / {docente.totalHorasContrato}h</span>
            </div>
            <ProgressBar value={docente.totalHorasContrato > 0 ? Math.min((metricas.totalHoras / docente.totalHorasContrato) * 100, 100) : 0} color="indigo" />
          </div>
          <div className="mt-4 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distribucionHoras} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="horas">
                  {distribucionHoras.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [`${v}h`, 'Horas']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Avance de Actividades - TIEMPO REAL */}
        <div className="col-span-1 lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-500" />
                Avance de Actividades
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  En vivo
                </span>
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Se actualiza automáticamente cada 15 segundos</p>
            </div>
          </div>

          {/* Resumen global */}
          {avanceSemana8.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: 'Meta total', value: totalMeta, icon: Target, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' },
                { label: 'Avance registrado', value: totalEjec8 + totalEjec16, icon: CheckCircle2, color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-100' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-3 text-center`}>
                  <s.icon className={`w-4 h-4 ${s.color} mx-auto mb-1`} />
                  <div className={`text-lg font-black ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-gray-500 font-semibold uppercase">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {avanceSemana8.length > 0 ? (
            <div className="space-y-5 flex-1 overflow-y-auto pr-1" style={{ maxHeight: 340 }}>
              {avanceSemana8.map((item, index) => {
                const meta = item.meta || 0;
                const ejec8 = item.ejec8 || 0;
                const ejec16 = item.ejec16 || 0;
                const totalPct = meta > 0 ? Math.min(Math.round(((ejec8 + ejec16) / meta) * 100), 100) : 0;

                return (
                  <div key={index} className="bg-gray-50 rounded-xl p-4 border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/20 transition-all">
                    {/* Encabezado actividad */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-sm font-bold text-gray-800 truncate">{item.actividad}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <EstadoBadge value={ejec8 + ejec16} total={meta} />
                        <span className={`text-sm font-black ${totalPct >= 100 ? 'text-emerald-600' : totalPct > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                          {totalPct}%
                        </span>
                      </div>
                    </div>

                    {/* Barra global */}
                    <div>
                      <ProgressBar value={totalPct} color={totalPct >= 100 ? 'emerald' : 'indigo'} animated={totalPct > 0 && totalPct < 100} />
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-semibold">
                        <span>Progreso de Actividad</span>
                        <span>{ejec8 + ejec16} / {meta}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 flex-1">
              <FileCheck className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-sm font-medium">Sin datos de avance registrados</p>
              <p className="text-xs text-gray-400 mt-1">Acepta tu agenda y registra avances en Semana 8 y 16</p>
            </div>
          )}
        </div>
      </div>

      {/* Mis Funciones */}
      {funciones.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              Mis Funciones — Periodo Activo
            </h3>
            <span className="text-xs text-gray-400">{funciones.filter(f => f.estado_agenda === 'Aceptado').length}/{funciones.length} aceptadas</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0 divide-x divide-y divide-gray-100">
            {funciones.map((f: any) => {
              const aceptada = f.estado_agenda === 'Aceptado';
              const aprobada = f.estado_agenda === 'Aprobada';
              const devuelta = f.estado_agenda === 'Devuelta';
              return (
                <div key={f.id_funciones} className={`p-4 flex items-start gap-3 ${aprobada ? 'bg-emerald-50/40' : aceptada ? 'bg-blue-50/30' : devuelta ? 'bg-red-50/30' : 'bg-white'}`}>
                  <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${aprobada ? 'bg-emerald-100' : aceptada ? 'bg-blue-100' : devuelta ? 'bg-red-100' : 'bg-yellow-50'}`}>
                    {aprobada ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
                     aceptada ? <CheckCircle2 className="w-4 h-4 text-blue-600" /> :
                     devuelta ? <AlertTriangle className="w-4 h-4 text-red-500" /> :
                     <Hourglass className="w-4 h-4 text-yellow-500" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 leading-tight truncate">{f.funcion_sustantiva}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{parseFloat(f.horas_funcion).toFixed(0)}h asignadas</p>
                    <span className={`mt-1 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full ${aprobada ? 'bg-emerald-100 text-emerald-700' : aceptada ? 'bg-blue-100 text-blue-700' : devuelta ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {f.estado_agenda || 'Pendiente'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Evidencias por Periodo */}
      {metricas.evidenciasSubidasPorPeriodo && metricas.evidenciasSubidasPorPeriodo.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-indigo-500" />
            Evidencias por Periodo Académico
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metricas.evidenciasSubidasPorPeriodo.map((item) => {
              const pendingItem = metricas.evidenciasPorPeriodo?.find(p => p.idPeriodo === item.idPeriodo);
              const subidas = item.subidas ?? 0;
              const pendientes = pendingItem?.pendientes ?? 0;
              const total = subidas + pendientes;
              const pct = total > 0 ? Math.round((subidas / total) * 100) : 0;

              return (
                <div key={item.idPeriodo} className="bg-gray-50 border border-gray-200 hover:border-indigo-100 hover:bg-indigo-50/10 rounded-xl p-4 transition-all">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-gray-800 text-sm">Periodo {item.label}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pct === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {pct}% al día
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>{subidas} subidas</span>
                    <span>{pendientes} pendientes</span>
                  </div>
                  <ProgressBar value={pct} color={pct === 100 ? 'emerald' : 'indigo'} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Estado de Agenda */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto mb-1 sm:mb-0">
              <Calendar className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-bold text-gray-700">Estado de la agenda</span>
            </div>
            {[
              { label: `Corte 1 (Sem 8)`, estado: estadoAgenda.semana8 },
              { label: `Corte 2 (Sem 16)`, estado: estadoAgenda.semana16 },
            ].map(e => (
              <div key={e.label} className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                <span className={`w-2.5 h-2.5 rounded-full ${getEstadoColor(e.estado)}`} />
                <span className="text-xs font-medium text-gray-600">{e.label}: {e.estado}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
              <span className={`w-2.5 h-2.5 rounded-full ${estadoAgenda.funcionesAsignadas ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <span className="text-xs font-medium text-gray-600">
                Funciones {estadoAgenda.funcionesAsignadas ? 'distribuidas' : 'por distribuir'}
              </span>
            </div>
          </div>
          <button
            disabled={!docente.periodoActivo}
            className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors w-full xl:w-auto justify-end sm:justify-start xl:justify-end mt-2 xl:mt-0 pt-3 border-t xl:border-0 border-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Ver detalles completos
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Historial */}
      {!docente.periodoActivo && historicalAgendas.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            Historial de Agendas por Periodo
          </h2>
          <div className="space-y-6">
            {historicalAgendas.map((agenda, index) => (
              <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
                  <span className="font-bold text-blue-900">Periodo {agenda.periodo.anio}-{agenda.periodo.semestre}</span>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold uppercase">Cerrado (Solo Lectura)</span>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {agenda.funciones.map((func: any) => (
                      <div key={func.id_funciones} className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                        <h4 className="font-bold text-sm text-indigo-900 mb-2">{func.funcion_sustantiva}</h4>
                        <div className="flex justify-between text-xs text-indigo-700">
                          <span>Horas: {func.horas_funcion}h</span>
                          <span className="font-bold">{func.estado_agenda}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
