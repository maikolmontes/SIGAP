import { useState, useEffect, useCallback } from 'react';
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
  Hourglass
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
}

interface Metricas {
  totalHoras: number;
  avancePromedioSemana8: number;
  funcionesSustantivas: number;
  evidenciasPendientes: number;
  totalHorasEjecucion: number;
  avanceGeneral: number;
}

interface DistribucionHoras {
  funcion: string;
  horas: number;
}

interface AvanceSemana8 {
  actividad: string;
  porcentaje: number;
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
  avanceSemana8: AvanceSemana8[];
  estadoAgenda: EstadoAgenda;
}

const COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981'];

export default function DashboardDocente() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [funciones, setFunciones] = useState<any[]>([]);

  const [semanaActiva, setSemanaActiva] = useState(false);
  const [tiempoRestanteTexto, setTiempoRestanteTexto] = useState('');
  const [historicalAgendas, setHistoricalAgendas] = useState<any[]>([]);

  const fetchDashboard = useCallback(async (silently = false) => {
      try {
        if (!silently) setLoading(true);
        else setRefreshing(true);
        setError(null);

        // 1. Fetch semanas
        try {
          const semanasRes = await api.get('/semanas');
          const semanaCero = semanasRes.data.find((s: any) => s.numero_semana === '0');
          if (semanaCero && semanaCero.habilitada && semanaCero.fecha_inicio && semanaCero.fecha_fin) {
              const ahora = new Date();
              const inicio = new Date(semanaCero.fecha_inicio); inicio.setHours(0, 0, 0, 0);
              const fin = new Date(semanaCero.fecha_fin); fin.setHours(23, 59, 59, 999);
              if (ahora >= inicio && ahora <= fin) {
                  setSemanaActiva(true);
                  const diffMs = fin.getTime() - ahora.getTime();
                  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  const horas = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  setTiempoRestanteTexto(`Semana 0: ${dias}d ${horas}h restantes`);
              } else {
                  setSemanaActiva(false);
                  setTiempoRestanteTexto('Semana 0 Finalizada');
              }
          } else {
              setSemanaActiva(false);
              setTiempoRestanteTexto(semanaCero ? 'Sem. 0 Deshabilitada' : 'Sin Semana 0 Activa');
          }
        } catch { /* ignore */ }

        // 2. Dashboard principal
        const response = await api.get('/docente/dashboard');
        setData(response.data);

        // 3. Funciones reales desde agenda/base
        const userId = (user as any)?.id_usuario || user?.id;
        if (userId) {
          try {
            const agRes = await api.get(`/agenda/base/${userId}`);
            setFunciones(agRes.data.funciones || []);
          } catch { /* ignore */ }
        }

        // 4. Historial si periodo cerrado
        if (!response.data.docente?.periodoActivo) {
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
    // Auto-refresh cada 30 segundos
    const interval = setInterval(() => fetchDashboard(true), 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { docente, metricas, distribucionHoras, avanceSemana8, estadoAgenda } = data;

  const getEstadoColor = (estado: string) => {
    if (estado === 'Revisado' || estado === 'Aprobado') return 'bg-green-500';
    if (estado === 'Pendiente') return 'bg-gray-400';
    if (estado === 'Rechazado') return 'bg-red-500';
    return 'bg-gray-400';
  };

  return (
    <Layout rol="docente" path="Inicio / Dashboard">
        {/* Banner de bienvenida */}
        <div className="bg-[#1a2744] rounded-xl px-6 py-6 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm gap-4">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">
              Bienvenido, {docente.nombre.split(' ')[0]}
            </h1>
            <p className="text-blue-200 text-xs">
              {docente.programa} · {docente.tipoContrato}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {tiempoRestanteTexto && (
              <div className={`px-4 py-2 w-full sm:w-auto rounded-lg font-bold text-sm shrink-0 ${semanaActiva ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                  <div className="flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4" />
                      {tiempoRestanteTexto}
                  </div>
              </div>
            )}
            <button
              onClick={() => fetchDashboard(true)}
              disabled={refreshing}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-medium transition-colors border border-white/20 disabled:opacity-60"
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

        {/* Métricas - Basadas en funciones del Docente (DIAGRAMAER.md) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Tarjeta 1: Horas registradas vs Horas contrato */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-blue-50 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-bold tracking-wider uppercase text-gray-500">Horas registradas</span>
            </div>
            <div className="text-2xl font-black text-gray-800">
              {metricas.totalHorasEjecucion}h <span className="text-sm font-normal text-gray-400">/ {docente.totalHorasContrato}h</span>
            </div>
          </div>

          {/* Tarjeta 2: Avance general */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-green-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-bold tracking-wider uppercase text-gray-500">Avance general</span>
            </div>
            <div className="text-2xl font-black text-gray-800">
              {metricas.avanceGeneral}%
            </div>
          </div>

          {/* Tarjeta 3: Funciones sustantivas */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-purple-50 rounded-lg">
                <Building2 className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-bold tracking-wider uppercase text-gray-500">Funciones</span>
            </div>
            <div className="text-2xl font-black text-gray-800">
              {metricas.funcionesSustantivas} <span className="text-sm font-normal text-gray-400">Sustantivas</span>
            </div>
          </div>

          {/* Tarjeta 4: Evidencias pendientes */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-red-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-sm font-bold tracking-wider uppercase text-gray-500">Evidencias</span>
            </div>
            <div className="text-2xl font-black text-gray-800">
              {metricas.evidenciasPendientes} <span className="text-sm font-normal text-gray-400">Pendientes</span>
            </div>
          </div>
        </div>

        {/* Columnas inferiores - Funciones del Docente según DIAGRAMAER.md */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Columna izquierda: Distribución de horas por función sustantiva */}
          <div className="col-span-1 bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">Distribución de horas</h3>
            
            <div className="space-y-3 mb-6">
              {distribucionHoras.map((item, index) => (
                <div key={item.funcion} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></div>
                    <span className="text-xs font-medium text-gray-700 uppercase">{item.funcion}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{item.horas}h</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Total asignado</span>
                <span className="text-lg font-bold text-gray-900">
                  {metricas.totalHoras}h / {docente.totalHorasContrato}h
                </span>
              </div>
            </div>

            {/* Gráfico de dona */}
            <div className="mt-6 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribucionHoras}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="horas"
                  >
                    {distribucionHoras.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Columna derecha: Avance de actividades (Semana 8 y 16) */}
          <div className="col-span-1 lg:col-span-2 bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Avance de Actividades</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />Semana 8
                </span>
                <span className="text-xs font-medium px-2 py-1 bg-purple-100 text-purple-700 rounded flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />Semana 16
                </span>
              </div>
            </div>

            {avanceSemana8.length > 0 ? (
              <div className="space-y-5 flex-1">
                {avanceSemana8.map((item: any, index: number) => {
                  const meta = item.meta || 0;
                  const ejec8 = item.ejec8 || 0;
                  const ejec16 = item.ejec16 || 0;
                  const pct8 = meta > 0 ? Math.min(Math.round((ejec8 / meta) * 100), 100) : 0;
                  const pct16 = meta > 0 ? Math.min(Math.round((ejec16 / meta) * 100), 100) : 0;
                  const totalPct = meta > 0 ? Math.min(Math.round(((ejec8 + ejec16) / meta) * 100), 100) : 0;
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">{item.actividad}</span>
                        <span className={`text-sm font-bold ${totalPct >= 100 ? 'text-green-600' : totalPct > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{totalPct}%</span>
                      </div>
                      {/* Barra Semana 8 */}
                      <div>
                        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                          <span>Sem 8</span>
                          <span>{ejec8} / {meta} → {pct8}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-700"
                            style={{ width: `${pct8}%` }} />
                        </div>
                      </div>
                      {/* Barra Semana 16 */}
                      <div>
                        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                          <span>Sem 16</span>
                          <span>{ejec16} / {Math.max(0, meta - ejec8)} → {pct16}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full transition-all duration-700"
                            style={{ width: `${pct16}%` }} />
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

        {/* Mis Funciones del Periodo Activo */}
        {funciones.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-500" /> Mis Funciones — Periodo Activo
              </h3>
              <span className="text-xs text-gray-400">{funciones.filter(f => f.estado_agenda === 'Aceptado').length}/{funciones.length} aceptadas</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0 divide-x divide-y divide-gray-100">
              {funciones.map((f: any) => {
                const aceptada = f.estado_agenda === 'Aceptado';
                return (
                  <div key={f.id_funciones} className={`p-4 flex items-start gap-3 ${aceptada ? 'bg-green-50/40' : 'bg-white'}`}>
                    <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${aceptada ? 'bg-green-100' : 'bg-yellow-50'}`}>
                      {aceptada
                        ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                        : <Hourglass className="w-4 h-4 text-yellow-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800 leading-tight truncate">{f.funcion_sustantiva}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{parseFloat(f.horas_funcion).toFixed(0)}h asignadas</p>
                      <span className={`mt-1 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${aceptada ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {f.estado_agenda || 'Pendiente'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Barra de estado inferior - Estado de agenda del Docente */}
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100">
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 w-full sm:w-auto mb-2 sm:mb-0">
                <Calendar className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-semibold text-gray-700">Estado de la agenda</span>
              </div>
              {/* Semana 8 - Primer corte de seguimiento */}
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                <span className={`w-2.5 h-2.5 rounded-full ${getEstadoColor(estadoAgenda.semana8)}`}></span>
                <span className="text-xs font-medium text-gray-600">Corte 1 (Sem 8): {estadoAgenda.semana8}</span>
              </div>
              {/* Semana 16 - Segundo corte de seguimiento */}
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                <span className={`w-2.5 h-2.5 rounded-full ${getEstadoColor(estadoAgenda.semana16)}`}></span>
                <span className="text-xs font-medium text-gray-600">Corte 2 (Sem 16): {estadoAgenda.semana16}</span>
              </div>
              {/* Funciones asignadas */}
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                <span className={`w-2.5 h-2.5 rounded-full ${estadoAgenda.funcionesAsignadas ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                <span className="text-xs font-medium text-gray-600">
                  Funciones {estadoAgenda.funcionesAsignadas ? 'distribuidas' : 'por distribuir'}
                </span>
              </div>
            </div>
            <button 
              disabled={!docente.periodoActivo}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors w-full xl:w-auto justify-end sm:justify-start xl:justify-end mt-2 xl:mt-0 pt-3 border-t xl:border-0 border-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Ver detalles completos
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Historial de Agendas (Solo cuando el periodo está cerrado) */}
        {!docente.periodoActivo && historicalAgendas.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              Historial de Agendas por Periodo
            </h2>
            <div className="space-y-6">
              {historicalAgendas.map((agenda, index) => (
                <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
                    <span className="font-bold text-blue-900">
                      Periodo {agenda.periodo.anio}-{agenda.periodo.semestre}
                    </span>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold uppercase">
                      Cerrado (Solo Lectura)
                    </span>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {agenda.funciones.map((func: any) => (
                        <div key={func.id_funciones} className="p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                          <h4 className="font-bold text-sm text-blue-900 mb-2">{func.funcion_sustantiva}</h4>
                          <div className="flex justify-between text-xs text-blue-700">
                            <span>Horas: {func.horas_funcion}h</span>
                            <span className="font-bold">{func.estado_agenda}</span>
                          </div>
                          
                          <div className="mt-3 pt-3 border-t border-blue-100 space-y-2">
                            {agenda.actividades
                              .filter((act: any) => act.id_funciones === func.id_funciones)
                              .map((act: any) => (
                                <div key={act.id_asignacionact} className="text-[11px]">
                                  <p className="font-semibold text-gray-700">• {act.nombre_espacio || act.rol_seleccionado}</p>
                                  <p className="text-gray-500 ml-3 italic">{act.resultado_esperado}</p>
                                </div>
                              ))
                            }
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
