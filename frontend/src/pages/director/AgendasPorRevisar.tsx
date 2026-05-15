import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/common/Layout';
import api from '../../services/api';
import { Search, Filter, Eye, AlertTriangle, CheckCircle2, XCircle, Clock, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const estadoBadge: Record<string, { bg: string; text: string; dot: string }> = {
    Pendiente: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
    Aceptado: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
    Aprobada: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
    Devuelta: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
};

export default function AgendasPorRevisar() {
    const [agendas, setAgendas] = useState<any[]>([]);
    const [periodo, setPeriodo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [filtroEstado, setFiltroEstado] = useState('');
    const [filtroPrograma, setFiltroPrograma] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const navigate = useNavigate();

    const cargarAgendas = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (filtroEstado) params.estado = filtroEstado;
            if (filtroPrograma) params.programa = filtroPrograma;
            const res = await api.get('/director/agendas', { params });
            setAgendas(res.data.agendas || []);
            setPeriodo(res.data.periodo || null);
        } catch (e) {
            console.error('Error cargando agendas:', e);
        } finally {
            setLoading(false);
        }
    }, [filtroEstado, filtroPrograma]);

    useEffect(() => {
        cargarAgendas();
    }, [cargarAgendas]);

    const agendasFiltradas = agendas.filter(a =>
        a.nombre_docente.toLowerCase().includes(busqueda.toLowerCase()) ||
        a.nombre_programa?.toLowerCase().includes(busqueda.toLowerCase())
    );

    const programas = [...new Set(agendas.map(a => a.nombre_programa).filter(Boolean))];
    const periodoLabel = periodo ? `${periodo.anio}-${periodo.semestre === 1 ? 'I' : 'II'}` : 'Sin periodo';

    // Contadores
    const totalPendientes = agendas.filter(a => a.estado_general === 'Pendiente' || a.estado_general === 'Aceptado').length;
    const totalAprobadas = agendas.filter(a => a.estado_general === 'Aprobada').length;
    const totalDevueltas = agendas.filter(a => a.estado_general === 'Devuelta').length;

    return (
        <Layout rol="director" path="Supervisión / Agendas por Revisar">
            {/* Encabezado */}
            <div className="mb-6">
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Agendas por Revisar</h1>
                <p className="text-sm text-gray-500 mt-1">Periodo: {periodoLabel} · {agendas.length} docentes con agenda</p>
            </div>

            {/* Tarjetas resumen */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total', value: agendas.length, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                    { label: 'Pendientes', value: totalPendientes, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100' },
                    { label: 'Aprobadas', value: totalAprobadas, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
                    { label: 'Devueltas', value: totalDevueltas, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
                ].map(m => (
                    <div key={m.label} className={`bg-white rounded-2xl p-4 shadow-sm border ${m.border} hover:shadow-md transition-all`}>
                        <div className={`w-9 h-9 ${m.bg} rounded-xl flex items-center justify-center mb-2`}>
                            <m.icon className={`w-4.5 h-4.5 ${m.color}`} />
                        </div>
                        <div className="text-2xl font-black text-gray-800">{m.value}</div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{m.label}</div>
                    </div>
                ))}
            </div>

            {/* Barra de búsqueda y filtros */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
                <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar docente o programa..."
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
                            value={filtroEstado}
                            onChange={(e) => setFiltroEstado(e.target.value)}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-400"
                        >
                            <option value="">Todos los estados</option>
                            <option value="Pendiente">Pendiente</option>
                            <option value="Aceptado">Aceptado</option>
                            <option value="Aprobada">Aprobada</option>
                            <option value="Devuelta">Devuelta</option>
                        </select>
                        <select
                            value={filtroPrograma}
                            onChange={(e) => setFiltroPrograma(e.target.value)}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-400"
                        >
                            <option value="">Todos los programas</option>
                            {programas.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        {(filtroEstado || filtroPrograma) && (
                            <button
                                onClick={() => { setFiltroEstado(''); setFiltroPrograma(''); }}
                                className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                )}

                {/* Tabla */}
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                        </div>
                    ) : agendasFiltradas.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No se encontraron agendas</p>
                            <p className="text-sm mt-1">Ajusta los filtros o espera a que los docentes envíen sus agendas</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                                <tr>
                                    <th className="px-5 py-3 text-left font-bold">Docente</th>
                                    <th className="px-5 py-3 text-left font-bold">Programa</th>
                                    <th className="px-5 py-3 text-center font-bold">Periodo</th>
                                    <th className="px-5 py-3 text-center font-bold">Perfil Docente</th>
                                    <th className="px-5 py-3 text-center font-bold">Estado</th>
                                    <th className="px-5 py-3 text-center font-bold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {agendasFiltradas.map((a) => {
                                    const badge = estadoBadge[a.estado_general] || estadoBadge.Pendiente;
                                    const esInconsistencia = a.perfil_docente === 'INCONSISTENCIAS EN AGENDA AC 30';
                                    return (
                                        <tr key={a.id_usuario} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                        {a.nombre_docente?.charAt(0)}{a.nombre_docente?.split(' ')[1]?.charAt(0) || ''}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900 text-sm">{a.nombre_docente}</p>
                                                        <p className="text-xs text-gray-400">{a.tipo_contrato} · {Math.round(a.total_horas)}h</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-sm text-gray-600">{a.nombre_programa}</td>
                                            <td className="px-5 py-3.5 text-center text-sm text-gray-600">{periodoLabel}</td>
                                            <td className="px-5 py-3.5 text-center">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase ${esInconsistencia ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                                                    {esInconsistencia && <AlertTriangle className="w-3 h-3" />}
                                                    {a.perfil_docente}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                                    {a.estado_general}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <button
                                                    onClick={() => navigate(`/director/agendas/${a.id_usuario}`)}
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    Revisar
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
