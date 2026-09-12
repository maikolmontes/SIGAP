import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/common/Layout';
import api from '../../services/api';
import { Search, Filter, Eye, AlertTriangle, CheckCircle2, XCircle, Clock, ChevronDown, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const estadoBadge: Record<string, { bg: string; text: string; dot: string }> = {
    Pendiente: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
    Aceptado:  { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
    Aprobada:  { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
    Devuelta:  { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
};

export default function AgendasDecano() {
    const { user } = useAuth();
    const [agendas, setAgendas]       = useState<any[]>([]);
    const [periodo, setPeriodo]       = useState<any>(null);
    const [facultad, setFacultad]     = useState<string>('');
    const [loading, setLoading]       = useState(true);
    const [filtroEstado, setFiltroEstado]     = useState('');
    const [filtroPrograma, setFiltroPrograma] = useState('');
    const [busqueda, setBusqueda]     = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const navigate = useNavigate();

    const cargarAgendas = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (filtroEstado)   params.estado   = filtroEstado;
            if (filtroPrograma) params.programa = filtroPrograma;
            const res = await api.get('/director/agendas', { params });
            setAgendas(res.data.agendas || []);
            setPeriodo(res.data.periodo || null);
            if (res.data.facultad) setFacultad(res.data.facultad);
        } catch (e) {
            console.error('Error cargando agendas:', e);
        } finally {
            setLoading(false);
        }
    }, [filtroEstado, filtroPrograma]);

    useEffect(() => { cargarAgendas(); }, [cargarAgendas]);

    const agendasFiltradas = agendas.filter(a =>
        a.nombre_docente.toLowerCase().includes(busqueda.toLowerCase()) ||
        a.nombre_programa?.toLowerCase().includes(busqueda.toLowerCase())
    );

    const programas = [...new Set(agendas.map(a => a.nombre_programa).filter(Boolean))];
    const periodoLabel = periodo ? `${periodo.anio}-${periodo.semestre === 1 ? 'I' : 'II'}` : 'Sin periodo';
    const facultadNombre = facultad || user?.facultad || 'Facultad Asignada';

    return (
        <Layout rol="decano" path={`Supervisión / Agendas · ${facultadNombre}`}>
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                        <Eye className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Agendas Docentes</h1>
                        <p className="text-sm text-gray-500 flex items-center gap-2 flex-wrap">
                            <span>Periodo: <span className="font-semibold text-emerald-600">{periodoLabel}</span></span>
                            <span>·</span>
                            <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {facultadNombre}
                            </span>
                            <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                                {agendas.length} docentes adscritos
                            </span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Resumen de estados */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {Object.entries(estadoBadge).map(([estado, estilo]) => {
                    const count = agendas.filter(a => a.estado === estado).length;
                    const Icon = estado === 'Aprobada' ? CheckCircle2 : estado === 'Devuelta' ? XCircle : estado === 'Pendiente' ? AlertTriangle : Clock;
                    return (
                        <div key={estado} className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer ${filtroEstado === estado ? 'ring-2 ring-emerald-400' : ''}`}
                            onClick={() => setFiltroEstado(filtroEstado === estado ? '' : estado)}>
                            <div className={`w-9 h-9 ${estilo.bg} rounded-xl flex items-center justify-center mb-2`}>
                                <Icon className={`w-4 h-4 ${estilo.text}`} />
                            </div>
                            <div className="text-2xl font-black text-gray-800">{count}</div>
                            <div className={`text-xs font-semibold uppercase tracking-wider ${estilo.text}`}>{estado}</div>
                        </div>
                    );
                })}
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-5">
                <div className="px-5 py-3 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar docente o programa..."
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-400"
                        />
                    </div>
                    <button onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors">
                        <Filter className="w-4 h-4" />
                        Filtros
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>
                {showFilters && (
                    <div className="px-5 py-3 bg-gray-50/50 flex flex-wrap gap-3">
                        <select value={filtroPrograma} onChange={e => setFiltroPrograma(e.target.value)}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-400">
                            <option value="">Todos los programas</option>
                            {programas.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-400">
                            <option value="">Todos los estados</option>
                            {Object.keys(estadoBadge).map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                        {(filtroEstado || filtroPrograma) && (
                            <button onClick={() => { setFiltroEstado(''); setFiltroPrograma(''); }}
                                className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg">
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Listado */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
                </div>
            ) : agendasFiltradas.length === 0 ? (
                <div className="text-center py-16 text-gray-400 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <Eye className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No se encontraron agendas</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Docente</th>
                                <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">Programa</th>
                                <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                                <th className="text-right px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {agendasFiltradas.map(a => {
                                const badge = estadoBadge[a.estado] || estadoBadge.Pendiente;
                                return (
                                    <tr key={a.id_usuario} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-3">
                                            <p className="font-semibold text-gray-800 text-sm">{a.nombre_docente}</p>
                                            <p className="text-xs text-gray-400">{a.correo}</p>
                                        </td>
                                        <td className="px-5 py-3 hidden md:table-cell">
                                            <p className="text-sm text-gray-600">{a.nombre_programa || '—'}</p>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                                {a.estado}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <button
                                                onClick={() => navigate(`/decano/agendas/${a.id_usuario}`)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100 ml-auto"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                Ver Agenda
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </Layout>
    );
}
