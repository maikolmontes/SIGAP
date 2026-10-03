import { useState, useEffect, useMemo } from 'react';
import Layout from '../../components/common/Layout';
import { 
  Calendar, 
  Save, 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle,
  Search,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X
} from 'lucide-react';
import api from '../../services/api';

interface Semana {
  id_semana: number;
  numero_semana: string;
  etiqueta: string;
  habilitada: boolean;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export default function Semanas() {
  const [semanas, setSemanas] = useState<Semana[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error', texto: string } | null>(null);

  // Filtros y búsqueda
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'habilitadas' | 'cerradas'>('todos');
  const [mostrarFiltros, setMostrarFiltros] = useState(true);

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(10);

  useEffect(() => {
    cargarSemanas();
  }, []);

  const cargarSemanas = async () => {
    try {
      setLoading(true);
      const res = await api.get('/semanas');
      setSemanas(res.data);
    } catch (error) {
      console.error('Error al cargar semanas:', error);
      setMensaje({ tipo: 'error', texto: 'Error al cargar las semanas desde la base de datos.' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (id: number) => {
    setSemanas(prev => prev.map(s => s.id_semana === id ? { ...s, habilitada: !s.habilitada } : s));
  };

  const handleDateChange = (id: number, field: 'fecha_inicio' | 'fecha_fin', value: string) => {
    setSemanas(prev => prev.map(s => s.id_semana === id ? { ...s, [field]: value } : s));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/semanas', { semanas });
      setMensaje({ tipo: 'exito', texto: 'Configuración de semanas guardada correctamente.' });
      setTimeout(() => setMensaje(null), 3000);
    } catch (error) {
      console.error('Error al guardar semanas:', error);
      setMensaje({ tipo: 'error', texto: 'Error al guardar los cambios en la base de datos.' });
    } finally {
      setSaving(false);
    }
  };

  // Filtrado de semanas
  const semanasFiltradas = useMemo(() => {
    return semanas.filter(s => {
      const cumpleTexto = !busqueda.trim() || 
        s.numero_semana.toString().toLowerCase().includes(busqueda.toLowerCase()) ||
        (s.etiqueta && s.etiqueta.toLowerCase().includes(busqueda.toLowerCase()));
      
      const cumpleEstado = 
        filtroEstado === 'todos' ||
        (filtroEstado === 'habilitadas' && s.habilitada) ||
        (filtroEstado === 'cerradas' && !s.habilitada);

      return cumpleTexto && cumpleEstado;
    });
  }, [semanas, busqueda, filtroEstado]);

  // Reset a página 1 cuando cambian filtros
  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, filtroEstado, registrosPorPagina]);

  // Paginación
  const totalPaginas = Math.ceil(semanasFiltradas.length / registrosPorPagina) || 1;
  const indiceInicio = (paginaActual - 1) * registrosPorPagina;
  const indiceFin = Math.min(indiceInicio + registrosPorPagina, semanasFiltradas.length);
  const semanasPaginadas = useMemo(() => {
    return semanasFiltradas.slice(indiceInicio, indiceFin);
  }, [semanasFiltradas, indiceInicio, indiceFin]);

  const filtrosActivos = (busqueda ? 1 : 0) + (filtroEstado !== 'todos' ? 1 : 0);

  if (loading) {
    return (
      <Layout rol="planeacion" path="Gestión Institucional / Semanas">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 font-medium flex items-center gap-2">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Cargando semanas...
          </div>
        </div>
      </Layout>
    );
  }

  if (!loading && semanas.length === 0 && !mensaje) {
    return (
      <Layout rol="planeacion" path="Gestión Institucional / Semanas">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md mx-auto text-center mt-10">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Sin Período Activo</h2>
          <p className="text-gray-600 mb-4">
            No se encontró un período académico activo. Para gestionar las semanas, primero debes crear o habilitar un período desde la ventana de Períodos.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout rol="planeacion" path="Gestión Institucional / Semanas">
      <div className="bg-[#1a2744] rounded-xl px-6 py-6 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-400" />
              Gestión de Semanas de Planeación
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              Habilita o deshabilita semanas para permitir a los docentes enviar sus evidencias en esos cortes.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-bold shadow-md transition-colors"
          >
            {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      {mensaje && (
        <div className={`p-4 mb-6 rounded-xl flex items-start gap-3 border ${mensaje.tipo === 'exito' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {mensaje.tipo === 'exito' ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
          <p className="font-medium text-sm">{mensaje.texto}</p>
        </div>
      )}

      {/* ── SECCIÓN DE FILTROS COLAPSABLE ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden transition-all">
        <div 
          onClick={() => setMostrarFiltros(!mostrarFiltros)}
          className="flex items-center justify-between px-5 py-3.5 bg-gray-50/70 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors select-none"
        >
          <div className="flex items-center gap-2.5">
            <Filter className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-bold text-gray-700">Filtros de Búsqueda</span>
            {filtrosActivos > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded-full">
                {filtrosActivos} activo{filtrosActivos > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">
              {mostrarFiltros ? 'Ocultar filtros' : 'Mostrar filtros'}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${mostrarFiltros ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {mostrarFiltros && (
          <div className="p-4 sm:p-5 border-t border-gray-100 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Buscar semana
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar por número o etiqueta de semana..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  {busqueda && (
                    <button 
                      onClick={() => setBusqueda('')} 
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Estado de corte
                </label>
                <div className="flex gap-1.5 p-1 bg-gray-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFiltroEstado('todos')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                      filtroEstado === 'todos' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    Todas ({semanas.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroEstado('habilitadas')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                      filtroEstado === 'habilitadas' ? 'bg-white text-green-700 shadow-xs' : 'text-gray-500 hover:text-green-700'
                    }`}
                  >
                    Habilitadas
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroEstado('cerradas')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                      filtroEstado === 'cerradas' ? 'bg-white text-gray-700 shadow-xs' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Cerradas
                  </button>
                </div>
              </div>
            </div>

            {filtrosActivos > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  Mostrando <strong>{semanasFiltradas.length}</strong> de {semanas.length} semanas
                </span>
                <button
                  type="button"
                  onClick={() => { setBusqueda(''); setFiltroEstado('todos'); }}
                  className="text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Restablecer filtros
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── TABLA CON SCROLL VERTICAL Y STICKY HEADER ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-xs border-b border-gray-200 shadow-2xs">
              <tr>
                <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Número de Semana</th>
                <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Fechas del Corte</th>
                <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Estado de Habilitación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {semanasPaginadas.map((semana) => (
                <tr key={semana.id_semana} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-bold text-gray-900">Semana {semana.numero_semana}</span>
                    <div className="text-xs text-gray-500 mt-1">{semana.etiqueta || `Corte de evaluación ${semana.numero_semana}`}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                      <div className="flex flex-col gap-1 w-full sm:w-auto">
                         <label className="text-[10px] uppercase font-bold text-gray-400">Inicio</label>
                         <input 
                           type="date" 
                           className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                           value={semana.fecha_inicio ? semana.fecha_inicio.substring(0, 10) : ''}
                           onChange={(e) => handleDateChange(semana.id_semana, 'fecha_inicio', e.target.value)}
                         />
                      </div>
                      <span className="text-gray-300 hidden sm:block">-</span>
                      <div className="flex flex-col gap-1 w-full sm:w-auto">
                         <label className="text-[10px] uppercase font-bold text-gray-400">Cierre</label>
                         <input 
                           type="date" 
                           className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                           value={semana.fecha_fin ? semana.fecha_fin.substring(0, 10) : ''}
                           onChange={(e) => handleDateChange(semana.id_semana, 'fecha_fin', e.target.value)}
                         />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={semana.habilitada}
                        onChange={() => handleToggle(semana.id_semana)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                      <span className={`ml-3 text-sm font-bold ${semana.habilitada ? 'text-green-600' : 'text-gray-400'}`}>
                        {semana.habilitada ? 'Habilitada' : 'Cerrada'}
                      </span>
                    </label>
                  </td>
                </tr>
              ))}
              {semanasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium text-gray-600">No se encontraron semanas con los filtros aplicados</p>
                    <p className="text-xs text-gray-400 mt-1">Pruebe a cambiar o restablecer los términos de búsqueda.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── FOOTER DE PAGINACIÓN ── */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span>Mostrar</span>
            <select
              value={registrosPorPagina}
              onChange={(e) => setRegistrosPorPagina(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 font-semibold text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
              <option value={25}>25</option>
            </select>
            <span>registros por página</span>
          </div>

          <div className="flex items-center gap-4">
            <span>
              Mostrando {semanasFiltradas.length === 0 ? 0 : indiceInicio + 1} - {indiceFin} de {semanasFiltradas.length}
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPaginaActual(1)}
                disabled={paginaActual === 1 || semanasFiltradas.length === 0}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 transition-colors"
                title="Primera página"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))}
                disabled={paginaActual === 1 || semanasFiltradas.length === 0}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 transition-colors"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 font-bold text-gray-800">
                {paginaActual} / {totalPaginas}
              </span>

              <button
                onClick={() => setPaginaActual(prev => Math.min(prev + 1, totalPaginas))}
                disabled={paginaActual === totalPaginas || semanasFiltradas.length === 0}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 transition-colors"
                title="Página siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPaginaActual(totalPaginas)}
                disabled={paginaActual === totalPaginas || semanasFiltradas.length === 0}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 transition-colors"
                title="Última página"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
