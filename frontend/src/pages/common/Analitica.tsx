import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/common/Layout';
import api from '../../services/api';
import { getPeriodoActivo } from '../../services/periodosService';
import { 
  BarChart2, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Calendar, 
  Users, 
  ArrowUpRight,
  RefreshCw,
  Briefcase
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  AreaChart, 
  Area, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell 
} from 'recharts';

interface AnaliticaProps {
  rol: 'planeacion' | 'director';
}

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];

const getEstadoDocente = (d: any) => {
  const total = parseInt(d.total_funciones) || 0;
  const aceptadas = parseInt(d.funciones_aceptadas) || 0;
  if (total === 0) return { label: 'Sin Asignación', color: 'bg-gray-105 text-gray-500 border border-gray-200', dot: 'bg-gray-400' };
  if (aceptadas >= total) return { label: 'Completa', color: 'bg-green-50 text-green-700 border border-green-200', dot: 'bg-green-500' };
  if (aceptadas > 0) return { label: 'En Progreso', color: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500' };
  return { label: 'Pendiente', color: 'bg-red-50 text-red-700 border border-red-200', dot: 'bg-red-500' };
};

export default function Analitica({ rol }: AnaliticaProps) {
  const [periodoActivo, setPeriodoActivo] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [resumenData, setResumenData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pathLabel = 'Reportes / Analítica';

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Obtener período activo
      const activePeriodRes = await getPeriodoActivo();
      const pActivo = activePeriodRes.data;
      setPeriodoActivo(pActivo);

      if (pActivo) {
        // 2. Cargar Dashboard Director (también accesible por Planeación)
        const dashRes = await api.get('/director/dashboard');
        setDashboardData(dashRes.data);

        // 3. Cargar Resumen de Reportes (también accesible por Planeación)
        const resumenRes = await api.get('/director/reportes/resumen');
        setResumenData(resumenRes.data);
      } else {
        setDashboardData(null);
        setResumenData(null);
      }
    } catch (err: any) {
      console.error('Error cargando analítica:', err);
      setError('Ocurrió un error al consultar las métricas reales en la base de datos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const periodoLabel = periodoActivo
    ? `${periodoActivo.anio} - ${periodoActivo.semestre === 1 ? 'I' : 'II'}`
    : 'Sin período activo';

  // Datos para los componentes visuales extraídos del backend
  const totalDocentes = dashboardData?.metricas?.total || 0;
  const aprobadas = dashboardData?.metricas?.aceptadas || 0;
  const pendientes = dashboardData?.metricas?.pendientes || 0;
  const totalHoras = dashboardData?.metricas?.total_horas || 0;

  // Si no hay resumen o totales en resumenData, usamos totales calculados del dashboard
  const devueltas = resumenData?.totales?.docentes_devueltos || 0;
  
  // Cumplimiento Global
  const cumplimientoGlobal = totalDocentes > 0 ? Math.round((aprobadas / totalDocentes) * 100) : 0;

  // Evidencias cargadas (suma de indicadores ejecutados en sem 8 y sem 16)
  const totalEvidencias = resumenData?.avance_por_bloque?.reduce(
    (acc: number, curr: any) => acc + (parseFloat(curr.avance_sem8) || 0) + (parseFloat(curr.avance_sem16) || 0),
    0
  ) || 0;

  // Estado de Agendas Docentes (Torta)
  const datosEstadoAgendas = [
    { name: 'Aprobadas', value: aprobadas, color: '#10B981' },
    { name: 'En revisión / Pendientes', value: Math.max(0, pendientes - devueltas), color: '#3B82F6' },
    { name: 'Devueltas / Corrección', value: devueltas, color: '#EF4444' }
  ].filter(item => item.value > 0 || (aprobadas === 0 && pendientes === 0 && devueltas === 0 && item.name === 'En revisión / Pendientes'));

  // Gráfico de Avance por Bloque (Área)
  const datosAvanceBloques = resumenData?.avance_por_bloque?.map((item: any) => ({
    name: item.bloque || 'General',
    'Logro Corte I (%)': Math.round((parseFloat(item.logro_parcial) || 0) * 100),
    'Logro Corte II (%)': Math.round((parseFloat(item.logro_final) || 0) * 100)
  })) || [];

  // Distribución de Horas por Función Sustantiva (Barras)
  const datosDistribucionHoras = dashboardData?.distribucion?.map((item: any) => ({
    name: item.funcion_sustantiva || 'Asignada',
    'Horas': Math.round(parseFloat(item.horas) || 0)
  })) || [];

  const docentesList: any[] = dashboardData?.docentes || [];

  if (loading) {
    return (
      <Layout rol={rol} path={pathLabel}>
        <div className="flex flex-col items-center justify-center py-40 gap-3">
          <div className="w-10 h-10 border-4 border-indigo-650 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 font-semibold text-sm">Cargando métricas de Analítica en tiempo real...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout rol={rol} path={pathLabel}>
      {/* Banner Principal */}
      <div className="bg-gradient-to-r from-[#1a2744] to-[#0d162a] rounded-xl px-6 py-6 mb-6 shadow-md border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart2 className="w-7 h-7 text-indigo-400 animate-pulse" />
              Módulo de Analítica y Rendimiento Académico
            </h1>
            <p className="text-indigo-100/80 text-sm mt-1 max-w-2xl font-medium">
              Consumo de datos dinámicos 100% verdaderos vinculados al período académico activo y restringido al programa de <strong>Ingeniería de Sistemas</strong>.
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto shrink-0">
            <button 
              onClick={cargarDatos}
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white px-3 py-2 rounded-lg text-sm font-semibold border border-white/10 transition-colors backdrop-blur-sm"
              title="Sincronizar con Base de Datos"
            >
              <RefreshCw className="w-4 h-4 text-indigo-300" />
              Actualizar
            </button>
            <div className="flex items-center gap-2 bg-white/10 text-white border border-white/10 px-3.5 py-2 rounded-lg text-sm font-semibold backdrop-blur-sm">
              <Calendar className="w-4 h-4 text-indigo-300" />
              Período: {periodoLabel}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl mb-6 flex gap-3 items-start text-sm font-semibold">
          <AlertCircle className="w-5 h-5 text-red-650 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Error de sincronización</p>
            <p className="text-xs text-red-600/90 font-medium mt-1">{error}</p>
          </div>
        </div>
      )}

      {!periodoActivo && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-8 text-center mb-6">
          <AlertCircle className="w-12 h-12 text-amber-550 mx-auto mb-3" />
          <h3 className="text-lg font-bold">No hay un período académico activo configurado</h3>
          <p className="text-sm text-amber-700/90 mt-1 max-w-lg mx-auto">
            Para visualizar las métricas y gráficos del panel de analítica, es indispensable que el administrador de Planeación habilite un período académico activo en la base de datos.
          </p>
        </div>
      )}

      {periodoActivo && (
        <>
          {/* Fila de Indicadores Clave (KPIs) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* KPI 1 */}
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <ArrowUpRight className="w-3 h-3" /> Real
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-800">{cumplimientoGlobal}%</div>
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-1">Cumplimiento Global</div>
            </div>

            {/* KPI 2 */}
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-indigo-650 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                  Corte Activo
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-800">{totalEvidencias}</div>
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-1">Indicadores Logrados</div>
            </div>

            {/* KPI 3 */}
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                  <Clock className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                  Revisión
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-800">{pendientes}</div>
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-1">Agendas por Revisar</div>
            </div>

            {/* KPI 4 */}
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-purple-650 bg-purple-50 px-1.5 py-0.5 rounded-full">
                  Sistemas
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-800">{totalDocentes}</div>
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                Docentes Asignados
              </div>
            </div>
          </div>

          {/* Grid de Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            
            {/* Gráfico 1: Avance de Evidencias Semanal (2/3 de ancho) */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm lg:col-span-2 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-800">Porcentaje de Logro por Funciones Sustantivas</h3>
                  <p className="text-xs text-gray-400">Comparativa del avance de metas e indicadores en Corte I (Semana 8) vs Corte II (Semana 16).</p>
                </div>
              </div>
              
              <div className="w-full h-80">
                {datosAvanceBloques.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400 font-medium text-xs">
                    Sin registros de indicadores cargados en este período.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={datosAvanceBloques} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCorte1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorCorte2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                      <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} tickLine={false} />
                      <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} unit="%" />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Area type="monotone" dataKey="Logro Corte I (%)" stroke="#4F46E5" strokeWidth={2} fillOpacity={1} fill="url(#colorCorte1)" name="Corte I (Semana 8)" />
                      <Area type="monotone" dataKey="Logro Corte II (%)" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorCorte2)" name="Corte II (Semana 16)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Gráfico 2: Distribución de Agendas (1/3 de ancho) */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex flex-col">
              <div className="mb-4">
                <h3 className="text-base font-bold text-gray-800">Estado de Agendas Docentes</h3>
                <p className="text-xs text-gray-400">Distribución de las agendas del programa académico en el período activo.</p>
              </div>
              
              <div className="w-full h-64 relative flex-1 flex items-center justify-center">
                {totalDocentes === 0 ? (
                  <div className="text-gray-400 font-medium text-xs">Sin agendas registradas en este período.</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={datosEstadoAgendas}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {datosEstadoAgendas.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                    
                    <div className="absolute text-center">
                      <div className="text-3xl font-black text-gray-800">{cumplimientoGlobal}%</div>
                      <div className="text-[10px] text-gray-400 uppercase font-extrabold tracking-wider">Aprobado</div>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2 mt-4">
                {datosEstadoAgendas.map((item, idx) => {
                  const percent = totalDocentes > 0 ? Math.round((item.value / totalDocentes) * 100) : 0;
                  return (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2 text-gray-600 font-semibold">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span>{item.name}</span>
                      </div>
                      <span className="font-bold text-gray-900">{item.value} ({percent}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gráfico 3: Distribución Horas por Función (Toma todo el ancho) */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm lg:col-span-3 flex flex-col">
              <div className="mb-4">
                <h3 className="text-base font-bold text-gray-800">Distribución de Horas por Función Sustantiva</h3>
                <p className="text-xs text-gray-400">Total acumulado de horas asignadas en los diferentes bloques de trabajo de Ingeniería de Sistemas.</p>
              </div>

              <div className="w-full h-80">
                {datosDistribucionHoras.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400 font-medium text-xs">
                    Sin horas asignadas en este período.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={datosDistribucionHoras} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                      <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} tickLine={false} />
                      <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} unit="h" />
                      <Tooltip formatter={(value) => `${value} horas`} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Bar dataKey="Horas" fill="#4F46E5" radius={[4, 4, 0, 0]} maxBarSize={45}>
                        {datosDistribucionHoras.map((_entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Fila de Resumen de Personal y Control */}
            <div className="bg-white border border-gray-150 rounded-xl p-5 shadow-sm lg:col-span-3 flex flex-col">
              <div className="mb-3">
                <h3 className="text-base font-bold text-gray-800">Métricas y Cumplimiento del Programa</h3>
                <p className="text-xs text-gray-400">Estado de control de cumplimiento académico de los docentes adscritos a Ingeniería de Sistemas.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 mb-4 border-b border-gray-100">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
                  <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Carga Horaria Total</span>
                  <span className="text-2xl font-black text-indigo-700 mt-1">{Math.round(totalHoras)} Horas</span>
                  <span className="text-[10px] text-gray-500 font-semibold mt-1">Horas registradas para el programa</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
                  <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Docentes con Agenda Completa</span>
                  <span className="text-2xl font-black text-emerald-650 mt-1">{aprobadas} Docentes</span>
                  <span className="text-[10px] text-emerald-600 font-semibold mt-1">{cumplimientoGlobal}% de cumplimiento</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
                  <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Agendas con Devoluciones</span>
                  <span className="text-2xl font-black text-red-650 mt-1">{devueltas} Agendas</span>
                  <span className="text-[10px] text-red-500 font-semibold mt-1">Requieren atención y correcciones</span>
                </div>
              </div>

              {/* Tabla Resumen de Docentes y su estado */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-150 text-xs font-bold text-gray-450 uppercase tracking-wider">
                      <th className="px-4 py-3">Docente</th>
                      <th className="px-4 py-3">Contrato</th>
                      <th className="px-4 py-3 text-center">Horas Asignadas</th>
                      <th className="px-4 py-3 text-center">Perfil de Agenda</th>
                      <th className="px-4 py-3 text-center">Estado Agenda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {docentesList.map((doc, idx) => {
                      const est = getEstadoDocente(doc);
                      return (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-gray-900">{doc.nombre}</div>
                            <div className="text-[11px] text-gray-400 font-semibold mt-0.5">{doc.correo}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-gray-650 font-semibold flex items-center gap-1.5">
                              <Briefcase className="w-3.5 h-3.5 text-gray-450 shrink-0" />
                              {doc.tipo_contrato || 'Hora Cátedra'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-gray-800">
                            {Math.round(parseFloat(doc.horas_asignadas) || 0)}h
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-wider border border-gray-200">
                              {doc.perfil_docente || 'INCONSISTENCIAS'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${est.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${est.dot}`} />
                              {est.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {docentesList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400 font-bold">
                          No se encontraron docentes asignados a Ingeniería de Sistemas para este período activo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>

          </div>
        </>
      )}
    </Layout>
  );
}

