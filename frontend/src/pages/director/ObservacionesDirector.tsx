import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/common/Layout';
import api from '../../services/api';
import { MessageSquare, Search, Eye, Filter, ChevronDown, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ObservacionesDirector() {
    const [observaciones, setObservaciones] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroSemana, setFiltroSemana] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const navigate = useNavigate();

    const cargarObservaciones = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/observaciones/todas');
            setObservaciones(res.data.observaciones || []);
        } catch (e) {
            console.error('Error cargando observaciones:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        cargarObservaciones();
    }, [cargarObservaciones]);

    const observacionesFiltradas = observaciones.filter(o => {
        const coincideBusqueda = o.docente_nombre?.toLowerCase().includes(busqueda.toLowerCase()) || 
                                 o.funcion_sustantiva?.toLowerCase().includes(busqueda.toLowerCase()) ||
                                 o.texto?.toLowerCase().includes(busqueda.toLowerCase());
        const coincideSemana = filtroSemana ? o.semana.toString() === filtroSemana : true;
        return coincideBusqueda && coincideSemana;
    });

    return (
        <Layout rol="director" path="Supervisión / Observaciones">
            <div className="mb-6">
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                    <MessageSquare className="w-6 h-6 text-blue-500" />
                    Mis Observaciones
                </h1>
                <p className="text-sm text-gray-500 mt-1">Historial de todas las observaciones realizadas a docentes.</p>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
                <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar docente, función o texto..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        <Filter className="w-4 h-4" />
                        Filtros
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {showFilters && (
                    <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100 flex flex-wrap gap-3">
                        <select
                            value={filtroSemana}
                            onChange={(e) => setFiltroSemana(e.target.value)}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-400"
                        >
                            <option value="">Todas las semanas</option>
                            <option value="8">Semana 8</option>
                            <option value="16">Semana 16</option>
                        </select>
                        {filtroSemana && (
                            <button
                                onClick={() => setFiltroSemana('')}
                                className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Listado */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                </div>
            ) : observacionesFiltradas.length === 0 ? (
                <div className="text-center py-16 text-gray-400 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No se encontraron observaciones</p>
                    <p className="text-sm mt-1">Realiza observaciones desde el detalle de la agenda de cada docente.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {observacionesFiltradas.map((obs) => (
                        <div key={obs.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                            <div className="flex flex-col md:flex-row gap-4 justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
                                            Semana {obs.semana}
                                        </span>
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {new Date(obs.ultima_edicion).toLocaleDateString()} a las {new Date(obs.ultima_edicion).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                    <p className="text-gray-800 text-sm mb-3 font-medium bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        "{obs.texto}"
                                    </p>
                                    <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-2">
                                        <p><strong className="text-gray-700">Docente:</strong> {obs.docente_nombre}</p>
                                        <p><strong className="text-gray-700">Función:</strong> {obs.funcion_sustantiva}</p>
                                        <p><strong className="text-gray-700">Actividad:</strong> {obs.rol_seleccionado} ({parseFloat(obs.horas_rol).toFixed(0)}h)</p>
                                    </div>
                                </div>
                                <div className="flex flex-col justify-center items-end">
                                    <button
                                        onClick={() => navigate(`/director/agendas/${obs.id_usuario}`)}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-100 whitespace-nowrap"
                                    >
                                        <Eye className="w-4 h-4" />
                                        Ver Agenda Completa
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Layout>
    );
}
