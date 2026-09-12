import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/common/Layout';
import api from '../../services/api';
import {
  Users, CheckCircle, Clock, TrendingUp, AlertCircle,
  BookOpen, Calendar, FileBarChart2, RefreshCw, Eye,
  Building2, Crown
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];

const getEstadoDocente = (d: any) => {
  const total = parseInt(d.total_funciones);
  const aceptadas = parseInt(d.funciones_aceptadas);
  if (total === 0) return { label: 'Sin asignar', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
  if (aceptadas >= total) return { label: 'Completa', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' };
  if (aceptadas > 0) return { label: 'En progreso', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' };
  return { label: 'Pendiente', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' };
};

export default function DashboardDecano() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const cargarDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/director/dashboard');
      setData(res.data);
    } catch (e) {
      console.error('Error cargando dashboard decano:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDashboard();
    const interval = setInterval(cargarDashboard, 45000);
    return () => clearInterval(interval);
  }, [cargarDashboard]);

  const periodoActivo = data?.periodo;
  const docentes: any[] = data?.docentes || [];
  const metricas = data?.metricas || { total: 0, aceptadas: 0, pendientes: 0, total_horas: 0 };
  const distribucion: any[] = data?.distribucion || [];
  const facultadNombre = data?.facultad || user?.facultad || 'Facultad Asignada';
  const programasFacultad: any[] = data?.programas_facultad || [];

  const docentesFiltrados = docentes.filter(d =>
    d.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.correo?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const periodoLabel = periodoActivo
    ? `${periodoActivo.anio} - ${periodoActivo.semestre === 1 ? 'Semestre I' : 'Semestre II'}`
    : 'Sin periodo activo';

  if (loading) {
    return (
      <Layout rol="decano" path="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout rol="decano" path={`Principal / Decanatura · ${facultadNombre}`}>

      {/* Banner Decano con Facultad y Programas */}
      <div className="mb-5 p-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-700 text-white shadow-lg shadow-emerald-900/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-inner flex-shrink-0">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-black text-xl tracking-tight">Decanatura</h1>
                <span className="bg-white/20 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-sm border border-white/20 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {facultadNombre}
                </span>
              </div>
              <p className="text-emerald-100 text-xs font-medium mt-0.5">
                Supervisión de docentes y cumplimiento · Periodo: <span className="text-white font-bold">{periodoLabel}</span>
              </p>
            </div>
          </div>
          <button
            onClick={cargarDashboard}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all border border-white/10"
            title="Actualizar datos"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar</span>
          </button>
        </div>

        {/* Programas adscritos a la facultad */}
        {programasFacultad.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-white/15 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-emerald-200 font-semibold flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" /> Programas adscritos ({programasFacultad.length}):
            </span>
            {programasFacultad.map((p: any) => (
              <span key={p.id_programa} className="bg-black/20 text-white px-2.5 py-0.5 rounded-lg border border-white/10 text-[11px] font-medium">
                {p.nombre_programa}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tarjetas métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Docentes', value: metricas.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Agendas completas', value: metricas.aceptadas, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
          { label: 'Pendientes', value: metricas.pendientes, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          { label: 'Total horas', value: Math.round(metricas.total_horas || 0), icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
        ].map(m => (
          <div key={m.label} className={`bg-white rounded-2xl p-4 shadow-sm border ${m.border} hover:shadow-md transition-all`}>
            <div className={`w-9 h-9 ${m.bg} rounded-xl flex items-center justify-center mb-2`}>
              <m.icon className={`w-4 h-4 ${m.color}`} />
            </div>
            <div className="text-2xl font-black text-gray-800">{m.value}</div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      {distribucion.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-gray-700 text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Distribución por Función Sustantiva
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={distribucion} dataKey="total" nameKey="funcion" cx="50%" cy="50%" outerRadius={75} label={({ funcion, percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {distribucion.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any, n: any) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-gray-700 text-sm mb-4 flex items-center gap-2">
              <FileBarChart2 className="w-4 h-4 text-blue-500" />
              Horas por Función
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={distribucion} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="funcion" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="total_horas" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Listado de docentes */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-500" />
              Docentes del Período
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">{docentes.length} docente{docentes.length !== 1 ? 's' : ''} registrados</p>
          </div>
          <input
            type="text"
            placeholder="Buscar docente..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-400 w-full sm:w-64"
          />
        </div>

        {docentesFiltrados.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-medium text-sm">No se encontraron docentes</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {docentesFiltrados.map((d: any) => {
              const estado = getEstadoDocente(d);
              return (
                <div key={d.id_usuario} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-700 font-black text-sm">
                      {d.nombre?.charAt(0) || 'D'}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{d.nombre}</p>
                      <p className="text-xs text-gray-400">{d.correo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${estado.color}`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${estado.dot} mr-1.5`} />
                      {estado.label}
                    </span>
                    <button
                      onClick={() => navigate(`/decano/agendas/${d.id_usuario}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Ver Agenda
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
