import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  Clock,
  TrendingUp,
  Building2,
  AlertTriangle,
  Calendar,
  Download,
  Bell,
  ChevronRight,
  User,
  LogOut,
  BookOpen,
  FlaskConical,
  Briefcase,
  GraduationCap,
  FileCheck,
  BarChart3,
  Eye
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface DocenteData {
  nombre: string;
  programa: string;
  tipoContrato: string;
  periodo: string;
  cierre: string;
  totalHorasContrato: number;
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

const COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b'];

export default function DashboardDocente() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get('/docente/dashboard');
        setData(response.data);
      } catch (err: any) {
        console.error('Error fetching dashboard:', err);
        const errorMessage = err.response?.data?.error || err.message || 'Error desconocido';
        console.error('Error details:', errorMessage);

        if (err.response?.status === 404) {
          setError('No hay período activo configurado o no se encontró información del docente.');
        } else if (err.response?.status === 401) {
          setError('Sesión expirada. Por favor inicie sesión nuevamente.');
        } else if (err.code === 'ERR_NETWORK') {
          setError('No se pudo conectar con el servidor. Verifique que el backend esté ejecutándose en http://localhost:3000');
        } else {
          setError(`Error: ${errorMessage}`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

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

  const getIconoFuncion = (funcion: string) => {
    if (funcion.toLowerCase().includes('docencia directa')) return <BookOpen className="w-4 h-4" />;
    if (funcion.toLowerCase().includes('investigación')) return <FlaskConical className="w-4 h-4" />;
    if (funcion.toLowerCase().includes('acad')) return <Briefcase className="w-4 h-4" />;
    return <GraduationCap className="w-4 h-4" />;
  };

  const getEstadoColor = (estado: string) => {
    if (estado === 'Revisado' || estado === 'Aprobado') return 'bg-green-500';
    if (estado === 'Pendiente') return 'bg-gray-400';
    if (estado === 'Rechazado') return 'bg-red-500';
    return 'bg-gray-400';
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-[#1e293b] text-white flex flex-col shadow-2xl z-50">
        {/* Logo */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-6 h-6 text-blue-400" />
            <span className="font-bold text-lg">SIGAP</span>
          </div>
          <div className="text-white/50 text-xs">Período {docente.periodo}</div>
        </div>

        {/* Menú principal - Basado en DIAGRAMAER.md */}
        <nav className="flex-1 px-3 py-4">
          <div className="text-white/30 text-xs uppercase tracking-widest px-2 mb-3">
            Principal
          </div>

          <a
            href="/docente/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/10 text-white border-l-2 border-blue-400 mb-2"
          >
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">Dashboard</span>
          </a>

          {/* Funciones del Docente según DIAGRAMAER.md */}
          <div className="mt-6">
            <div className="text-white/30 text-xs uppercase tracking-widest px-2 mb-3">
              Agenda Académica
            </div>
            <a href="/docente/agenda" className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/60 hover:bg-white/5 hover:text-white text-sm mb-1">
              <BookOpen className="w-4 h-4" />
              Crear/Editar agenda
            </a>
            <a href="/docente/distribucion-horas" className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/60 hover:bg-white/5 hover:text-white text-sm mb-1">
              <Clock className="w-4 h-4" />
              Distribución de horas
            </a>
          </div>

          {/* Registro de actividades y avances */}
          <div className="mt-6">
            <div className="text-white/30 text-xs uppercase tracking-widest px-2 mb-3">
              Registro de Actividades
            </div>
            <a href="/docente/actividades" className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/60 hover:bg-white/5 hover:text-white text-sm mb-1">
              <FileCheck className="w-4 h-4" />
              Registrar actividades
            </a>
            <a href="/docente/avance-semana-8" className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/60 hover:bg-white/5 hover:text-white text-sm mb-1">
              <BarChart3 className="w-4 h-4" />
              Reporte Semana 8
            </a>
            <a href="/docente/avance-semana-16" className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/60 hover:bg-white/5 hover:text-white text-sm mb-1">
              <BarChart3 className="w-4 h-4" />
              Reporte Semana 16
            </a>
          </div>

          {/* Evidencias digitales */}
          <div className="mt-6">
            <div className="text-white/30 text-xs uppercase tracking-widest px-2 mb-3">
              Evidencias
            </div>
            <a href="/docente/evidencias" className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/60 hover:bg-white/5 hover:text-white text-sm mb-1">
              <AlertTriangle className="w-4 h-4" />
              Adjuntar evidencias
            </a>
          </div>

          {/* Consulta de estado */}
          <div className="mt-6">
            <div className="text-white/30 text-xs uppercase tracking-widest px-2 mb-3">
              Consultar
            </div>
            <a href="/docente/estado-agenda" className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/60 hover:bg-white/5 hover:text-white text-sm mb-1">
              <Eye className="w-4 h-4" />
              Estado de agenda
            </a>
            <a href="/docente/historial" className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/60 hover:bg-white/5 hover:text-white text-sm mb-1">
              <Calendar className="w-4 h-4" />
              Historial de avances
            </a>
          </div>
        </nav>

        {/* Usuario y logout */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
              {user?.imagen_perfil ? (
                <img src={user.imagen_perfil} alt={user.nombres} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.nombres || docente.nombre}</div>
              <div className="text-xs text-white/50 truncate">{user?.roles || 'Docente'}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="ml-64">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <nav className="text-sm text-gray-500 mb-1">
                <span className="hover:text-gray-700 cursor-pointer">Inicio</span>
                <span className="mx-2">/</span>
                <span className="text-gray-900 font-medium">Dashboard</span>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-100 rounded-full">
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{user?.nombres || docente.nombre}</span>
                <span className="text-gray-300">|</span>
                <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                  {user?.roles || 'Docente'}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-full">
                <Calendar className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">DV · {docente.periodo}</span>
              </div>
              <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <Bell className="w-5 h-5" />
                {metricas.evidenciasPendientes > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Banner de bienvenida */}
        <div className="bg-[#1e3a5f] px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                Bienvenido, {docente.nombre.split(' ')[0]}
              </h1>
              <p className="text-blue-200 text-sm">
                {docente.programa} · {docente.tipoContrato}
              </p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-medium transition-colors border border-white/20">
              <Download className="w-4 h-4" />
              Descargar Informe Académico
            </button>
          </div>
        </div>

        {/* Métricas - Basadas en funciones del Docente (DIAGRAMAER.md) */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-4 gap-4 mb-6">
            {/* Tarjeta 1: Horas registradas vs Horas contrato */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-blue-50 rounded-lg">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Horas registradas</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {metricas.totalHorasEjecucion}h <span className="text-sm font-normal text-gray-400">/ {docente.totalHorasContrato}h contrato</span>
              </div>
            </div>

            {/* Tarjeta 2: Avance general */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-green-50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Avance general</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {metricas.avanceGeneral}% <span className="text-sm font-normal text-gray-400">/ Ejecución total</span>
              </div>
            </div>

            {/* Tarjeta 3: Funciones sustantivas */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-purple-50 rounded-lg">
                  <Building2 className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Funciones</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {metricas.funcionesSustantivas} <span className="text-sm font-normal text-gray-400">/ Sustantivas</span>
              </div>
            </div>

            {/* Tarjeta 4: Evidencias pendientes */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <span className="text-sm font-medium text-gray-500">Evidencias</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {metricas.evidenciasPendientes} <span className="text-sm font-normal text-gray-400">/ Pendientes</span>
              </div>
            </div>
          </div>

          {/* Columnas inferiores - Funciones del Docente según DIAGRAMAER.md */}
          <div className="grid grid-cols-3 gap-6">
            {/* Columna izquierda: Distribución de horas por función sustantiva */}
            <div className="col-span-1 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución de horas</h3>
              <p className="text-sm text-gray-500 mb-4">Horas asignadas por función sustantiva</p>

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
            <div className="col-span-2 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Avance de Actividades</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded">Semana 8</span>
                  <span className="text-xs font-medium px-2 py-1 bg-purple-100 text-purple-700 rounded">Semana 16</span>
                </div>
              </div>

              {avanceSemana8.length > 0 ? (
                <div className="space-y-4">
                  {avanceSemana8.map((item, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{item.actividad}</span>
                        <span className="text-sm font-bold text-blue-600">{item.porcentaje}%</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                          style={{ width: `${item.porcentaje}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <FileCheck className="w-12 h-12 mb-3" />
                  <p className="text-sm">No hay actividades registradas para Semana 8</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Barra de estado inferior - Estado de agenda del Docente */}
        <div className="px-8 pb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="text-sm font-semibold text-gray-700">Estado de la agenda</span>
                </div>
                {/* Semana 8 - Primer corte de seguimiento */}
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${getEstadoColor(estadoAgenda.semana8)}`}></span>
                  <span className="text-xs font-medium text-gray-600">Corte 1 (Sem 8): {estadoAgenda.semana8}</span>
                </div>
                {/* Semana 16 - Segundo corte de seguimiento */}
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${getEstadoColor(estadoAgenda.semana16)}`}></span>
                  <span className="text-xs font-medium text-gray-600">Corte 2 (Sem 16): {estadoAgenda.semana16}</span>
                </div>
                {/* Evidencias pendientes */}
                {metricas.evidenciasPendientes > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                    <span className="text-xs font-medium text-red-600">
                      {metricas.evidenciasPendientes} evidencia{metricas.evidenciasPendientes > 1 ? 's' : ''} por adjuntar
                    </span>
                  </div>
                )}
                {/* Funciones asignadas */}
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${estadoAgenda.funcionesAsignadas ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                  <span className="text-xs font-medium text-gray-600">
                    Funciones {estadoAgenda.funcionesAsignadas ? 'distribuidas' : 'por distribuir'}
                  </span>
                </div>
              </div>
              <button className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                Ver detalles completos
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
