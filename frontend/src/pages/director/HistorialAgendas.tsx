import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/common/Layout';
import api from '../../services/api';
import { History, Search, Eye, Filter, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const estadoBadge: Record<string, { bg: string; text: string; dot: string }> = {
    Pendiente: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
    Aceptado: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
    Aprobada: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
    Devuelta: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
};

export default function HistorialAgendas() {
    const [agendas, setAgendas] = useState<any[]>([]);
    const [periodo, setPeriodo] = useState<any>(null);
    const [periodos, setPeriodos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtroEstado, setFiltroEstado] = useState('');
    const [filtroPeriodo, setFiltroPeriodo] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const navigate = useNavigate();

    // Cargar periodos disponibles
    useEffect(() => {
        const cargarPeriodos = async () => {
            try {
                const res = await api.get('/periodos');
                setPeriodos(res.data || []);
            } catch (e) {
                console.error('Error cargando periodos:', e);
            }
        };
        cargarPeriodos();
    }, []);

    const cargarHistorial = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (filtroEstado) params.estado = filtroEstado;
            if (filtroPeriodo) params.periodo = filtroPeriodo;
            const res = await api.get('/director/agendas', { params });
            setAgendas(res.data.agendas || []);
            setPeriodo(res.data.periodo || null);
        } catch (e) {
            console.error('Error cargando historial:', e);
        } finally {
            setLoading(false);
        }
    }, [filtroEstado, filtroPeriodo]);

    useEffect(() => {
        cargarHistorial();
    }, [cargarHistorial]);

    const agendasFiltradas = agendas.filter(a =>
        a.nombre_docente.toLowerCase().includes(busqueda.toLowerCase())
    );

    // Solo mostrar las que tienen fecha_revision (ya fueron revisadas) o las devueltas/aprobadas
    const historialItems = agendasFiltradas.filter(a =>
        a.estado_general === 'Aprobada' || a.estado_general === 'Devuelta' || a.fecha_revision
    );

    const periodoLabel = periodo ? `${periodo.anio}-${periodo.semestre === 1 ? 'I' : 'II'}` : 'Sin periodo';

    return (
        <Layout rol="director" path="Supervisión / Historial de Agendas">
            {/* Encabezado */}
            <div className="mb-6">
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                    <History className="w-6 h-6 text-blue-500" />
                    Historial de Agendas
                </h1>
                <p className="text-sm text-gray-500 mt-1">Registro de agendas revisadas · Periodo: {periodoLabel}</p>
            </div>

            {/* Tabla con filtros */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar docente..."
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
                            value={filtroPeriodo}
                            onChange={(e) => setFiltroPeriodo(e.target.value)}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-400"
                        >
                            <option value="">Periodo activo</option>
                            {periodos.map((p: any) => (
                                <option key={p.id_periodo} value={p.id_periodo}>
                                    {p.anio}-{p.semestre === 1 ? 'I' : 'II'}
                                </option>
                            ))}
                        </select>
                        <select
                            value={filtroEstado}
                            onChange={(e) => setFiltroEstado(e.target.value)}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-400"
                        >
                            <option value="">Todos los estados</option>
                            <option value="Aprobada">Aprobada</option>
                            <option value="Devuelta">Devuelta</option>
                        </select>
                        {(filtroEstado || filtroPeriodo) && (
                            <button
                                onClick={() => { setFiltroEstado(''); setFiltroPeriodo(''); }}
                                className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                )}

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                        </div>
                    ) : historialItems.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No hay agendas revisadas aún</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                                <tr>
                                    <th className="px-5 py-3 text-left font-bold">Docente</th>
                                    <th className="px-5 py-3 text-center font-bold">Periodo</th>
                                    <th className="px-5 py-3 text-center font-bold">Estado</th>
                                    <th className="px-5 py-3 text-center font-bold">Fecha Revisión</th>
                                    <th className="px-5 py-3 text-center font-bold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {historialItems.map((a) => {
                                    const badge = estadoBadge[a.estado_general] || estadoBadge.Pendiente;
                                    return (
                                        <tr key={a.id_usuario} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                        {a.nombre_docente?.charAt(0)}{a.nombre_docente?.split(' ')[1]?.charAt(0) || ''}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900 text-sm">{a.nombre_docente}</p>
                                                        <p className="text-xs text-gray-400">{a.nombre_programa}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-center text-sm text-gray-600">{periodoLabel}</td>
                                            <td className="px-5 py-3.5 text-center">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                                    {a.estado_general}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-center text-sm text-gray-600">
                                                {a.fecha_revision ? new Date(a.fecha_revision).toLocaleDateString('es-CO') : '—'}
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <button
                                                    onClick={() => navigate(`/director/agendas/${a.id_usuario}`)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    Ver detalle
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </Layout>
    );
}
