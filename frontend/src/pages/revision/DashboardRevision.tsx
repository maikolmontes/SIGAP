import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/common/Layout';
import api from '../../services/api';
import {
    Users, CheckCircle, Clock, AlertTriangle, ClipboardList,
    RefreshCw, Search, Eye, Calendar, PieChart as PieIcon
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORES_ESTADO: Record<string, string> = {
    'Aprobada': '#16a34a',
    'Aceptado': '#2563eb',
    'Parcial': '#8b5cf6',
    'Devuelta': '#f97316',
    'Pendiente': '#ef4444',
    'Sin asignar': '#9ca3af',
};

const badgeEstado = (estado: string) => {
    switch (estado) {
        case 'Aprobada':  return 'bg-green-100 text-green-700';
        case 'Aceptado':  return 'bg-blue-100 text-blue-700';
        case 'Parcial':   return 'bg-violet-100 text-violet-700';
        case 'Devuelta':  return 'bg-orange-100 text-orange-700';
        case 'Pendiente': return 'bg-red-100 text-red-700';
        default:          return 'bg-gray-100 text-gray-600';
    }
};

/** Funciones sustantivas que revisa el rol activo, según lo guardado al entrar. */
const misFunciones = (): string[] => {
    try {
        const stored = localStorage.getItem('sigap_active_role');
        if (stored) return JSON.parse(stored).funciones_revisa || [];
    } catch { /* sin rol guardado */ }
    return [];
};

const nombreRolActivo = (): string => {
    try {
        const stored = localStorage.getItem('sigap_active_role');
        if (stored) return JSON.parse(stored).nombre_rol || 'Revisión';
    } catch { /* sin rol guardado */ }
    return 'Revisión';
};

// ─────────────────────────────────────────────────────────────
// Dashboard del rol revisor de una función sustantiva.
// Muestra los docentes que tienen esa función asignada y en qué
// va su diligenciamiento, sin mezclar las funciones de otros roles.
// ─────────────────────────────────────────────────────────────
export default function DashboardRevision() {
    const [agendas, setAgendas] = useState<any[]>([]);
    const [periodo, setPeriodo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroPrograma, setFiltroPrograma] = useState('');
    const navigate = useNavigate();

    const funciones = useMemo(misFunciones, []);
    const rolLabel = useMemo(nombreRolActivo, []);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/director/agendas');
            setAgendas(res.data.agendas || []);
            setPeriodo(res.data.periodo || null);
        } catch (e) {
            console.error('Error cargando agendas de revisión:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const programas = useMemo(
        () => [...new Set(agendas.map(a => a.nombre_programa).filter(Boolean))].sort(),
        [agendas]
    );

    const filtradas = agendas.filter(a => {
        const coincide = a.nombre_docente?.toLowerCase().includes(busqueda.toLowerCase())
            || a.correo?.toLowerCase().includes(busqueda.toLowerCase());
        const delPrograma = !filtroPrograma || a.nombre_programa === filtroPrograma;
        return coincide && delPrograma;
    });

    // Las métricas se calculan sobre MI parte de la revisión, no sobre la
    // agenda completa: al revisor de Investigación no le sirve saber que
    // al docente le falta que el Director apruebe docencia.
    const conteo = (estado: string) => filtradas.filter(a => a.estado_mi_revision === estado).length;
    const porRevisar = filtradas.filter(a =>
        ['Pendiente', 'Aceptado', 'Devuelta', 'Parcial'].includes(a.estado_mi_revision)
    ).length;

    const datosEstado = ['Aprobada', 'Aceptado', 'Pendiente', 'Devuelta', 'Parcial']
        .map(e => ({ name: e, value: conteo(e) }))
        .filter(d => d.value > 0);

    const datosPrograma = programas.map(p => ({
        name: p.replace('Ingeniería ', 'Ing. '),
        docentes: agendas.filter(a => a.nombre_programa === p).length,
    }));

    const periodoLabel = periodo
        ? `${periodo.anio} - ${periodo.semestre === 1 ? 'Semestre I' : 'Semestre II'}`
        : 'Sin periodo activo';

    if (loading) {
        return (
            <Layout rol="revision" path={`Inicio / Dashboard ${rolLabel}`}>
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full" />
                </div>
            </Layout>
        );
    }

    return (
        <Layout rol="revision" path={`Inicio / Dashboard ${rolLabel}`}>

            {/* BANNER */}
            <div className="bg-gradient-to-br from-[#0f2744] via-[#1a3a6c] to-[#0d3b7a] rounded-2xl px-8 py-7 mb-7 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 blur-2xl pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
                    <div>
                        <h1 className="text-2xl font-extrabold text-white mb-1 tracking-tight flex items-center gap-2">
                            <ClipboardList className="w-6 h-6 text-blue-300" />
                            Panel de {rolLabel}
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${periodo ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                                <span className={`w-2 h-2 rounded-full ${periodo ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                                {periodo ? 'Periodo Activo' : 'Sin Periodo Activo'}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white border border-white/20">
                                <Calendar className="w-3.5 h-3.5" />
                                {periodoLabel}
                            </span>
                            {funciones.map(f => (
                                <span key={f} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-400/20 text-blue-100 border border-blue-300/30">
                                    Revisas: {f}
                                </span>
                            ))}
                        </div>
                    </div>

                    <button onClick={cargar} className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white text-sm font-bold transition-all">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
                    </button>
                </div>
            </div>

            {!periodo ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-amber-900">No hay un periodo académico activo</h3>
                    <p className="text-sm text-amber-700 mt-1">Planeación debe abrir un período para que haya agendas que revisar.</p>
                </div>
            ) : (
                <>
                    {/* MÉTRICAS */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
                        {[
                            { label: 'Docentes a mi cargo', value: filtradas.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                            { label: 'Por revisar', value: porRevisar, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                            { label: 'Ya diligenciadas', value: conteo('Aceptado'), icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-50' },
                            { label: 'Aprobadas por mí', value: conteo('Aprobada'), icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
                        ].map(m => (
                            <div key={m.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all">
                                <div className={`w-10 h-10 ${m.bg} rounded-xl flex items-center justify-center mb-3`}>
                                    <m.icon className={`w-5 h-5 ${m.color}`} />
                                </div>
                                <div className="text-2xl font-black text-gray-800">{m.value}</div>
                                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-0.5">{m.label}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-7">
                        {/* TABLA */}
                        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div>
                                    <h2 className="text-base font-bold text-gray-900">Docentes con {funciones.join(' / ') || 'mi función'}</h2>
                                    <p className="text-xs text-gray-500 mt-0.5">Periodo: {periodoLabel}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Buscar docente..."
                                            value={busqueda}
                                            onChange={e => setBusqueda(e.target.value)}
                                            className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 w-44"
                                        />
                                    </div>
                                    {/* Institucional: el programa filtra la vista, no restringe el acceso */}
                                    <select
                                        value={filtroPrograma}
                                        onChange={e => setFiltroPrograma(e.target.value)}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-400"
                                    >
                                        <option value="">Todos los programas</option>
                                        {programas.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                                        <tr>
                                            <th className="px-5 py-3 text-left font-bold">Docente</th>
                                            <th className="px-5 py-3 text-left font-bold">Programa</th>
                                            {/* El nombre sale del rol activo: con otro revisor dirá "Horas Docencia", etc. */}
                                            <th className="px-5 py-3 text-center font-bold">Horas {funciones.join(' / ') || 'de mi función'}</th>
                                            <th className="px-5 py-3 text-center font-bold">Mi revisión</th>
                                            <th className="px-5 py-3 text-center font-bold"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {filtradas.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-sm">
                                                    {agendas.length === 0
                                                        ? 'Ningún docente tiene asignada tu función en este periodo.'
                                                        : 'No se encontraron docentes con ese filtro.'}
                                                </td>
                                            </tr>
                                        ) : filtradas.map(a => {
                                            const mias = (a.funciones || []).filter((f: any) => f.en_alcance);
                                            const horasMias = mias.reduce((s: number, f: any) => s + (f.horas_funcion || 0), 0);
                                            return (
                                                <tr key={a.id_usuario} className="hover:bg-blue-50/40 transition-colors">
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                                {a.nombre_docente?.charAt(0)}{a.nombre_docente?.split(' ')[1]?.charAt(0) || ''}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{a.nombre_docente}</p>
                                                                <p className="text-xs text-gray-400 truncate">{a.correo}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-sm text-gray-600">{a.nombre_programa}</td>
                                                    <td className="px-5 py-3.5 text-center">
                                                        <span className="text-sm font-bold text-gray-700">{horasMias}h</span>
                                                        <div className="text-[10px] text-gray-400">{mias.length} func.</div>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-center">
                                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${badgeEstado(a.estado_mi_revision)}`}>
                                                            {a.estado_mi_revision}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-center">
                                                        <button
                                                            onClick={() => navigate(`/revision/agendas/${a.id_usuario}`)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" /> Revisar
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* GRÁFICAS */}
                        <div className="flex flex-col gap-5">
                            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                                <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                                    <PieIcon className="w-4 h-4 text-blue-500" /> Estado de mi revisión
                                </h3>
                                <p className="text-xs text-gray-400 mb-3">Solo la función a tu cargo</p>
                                {datosEstado.length > 0 ? (
                                    <>
                                        <div className="h-44">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={datosEstado} cx="50%" cy="50%" innerRadius={42} outerRadius={70}
                                                        paddingAngle={3} dataKey="value" stroke="none">
                                                        {datosEstado.map(d => <Cell key={d.name} fill={COLORES_ESTADO[d.name]} />)}
                                                    </Pie>
                                                    <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="space-y-1.5 mt-2">
                                            {datosEstado.map(d => (
                                                <div key={d.name} className="flex justify-between items-center text-xs">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORES_ESTADO[d.name] }} />
                                                        <span className="text-gray-600">{d.name}</span>
                                                    </div>
                                                    <span className="font-bold text-gray-800">{d.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-xs text-gray-400 text-center py-8">Sin datos para este periodo</p>
                                )}
                            </div>

                            {datosPrograma.length > 0 && (
                                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                                    <h3 className="text-sm font-bold text-gray-800 mb-3">Docentes por programa</h3>
                                    <div className="h-40">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={datosPrograma} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                                                <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)' }} />
                                                <Bar dataKey="docentes" fill="#2563eb" radius={[6, 6, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </Layout>
    );
}
