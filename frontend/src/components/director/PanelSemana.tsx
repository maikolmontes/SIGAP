import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { agendaDiligenciada } from './agendaDiligenciada';
import { Search, RefreshCw, Eye, Clock, Lock, Unlock } from 'lucide-react';

const badgeRevision = (estado: string) => {
    switch (estado) {
        case 'Revisado':              return 'bg-green-100 text-green-700';
        case 'Revisado parcial':      return 'bg-blue-100 text-blue-700';
        case 'Pendiente por revisar': return 'bg-amber-100 text-amber-700';
        default:                      return 'bg-gray-100 text-gray-500';
    }
};

const badgeCorte = (estado: string) => {
    switch (estado) {
        case 'Completado':      return 'bg-green-100 text-green-700';
        case 'En progreso':     return 'bg-yellow-100 text-yellow-700';
        case 'Pendiente':       return 'bg-red-100 text-red-700';
        default:                return 'bg-gray-100 text-gray-600';
    }
};

const iniciales = (nombre: string) =>
    `${nombre?.charAt(0) || ''}${nombre?.split(' ')[1]?.charAt(0) || ''}`;

const num = (v: any) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
};

// ─────────────────────────────────────────────────────────────
// Panel de un corte (semana 8 o 16): qué reportó cada docente.
// ─────────────────────────────────────────────────────────────
export default function PanelSemana({ semana, modulo = 'director' }: { semana: '8' | '16'; modulo?: 'director' | 'revision' }) {
    const [agendas, setAgendas] = useState<any[]>([]);
    const [periodo, setPeriodo] = useState<any>(null);
    const [semanaInfo, setSemanaInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroPrograma, setFiltroPrograma] = useState('');
    const [paginaActual, setPaginaActual] = useState(1);
    const [regPorPag, setRegPorPag] = useState(10);
    const navigate = useNavigate();

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            // El corte lo abre y lo cierra Planeación: mientras esté cerrado el
            // docente no puede guardar su avance, así que el estado de la semana
            // condiciona cómo hay que leer esta tabla.
            const [res, sem] = await Promise.all([
                api.get('/director/agendas'),
                api.get('/semanas').catch(() => ({ data: [] })),
            ]);
            setAgendas(res.data.agendas || []);
            setPeriodo(res.data.periodo || null);
            setSemanaInfo((sem.data || []).find((s: any) => String(s.numero_semana) === semana) || null);
        } catch (e) {
            console.error('Error cargando el corte:', e);
        } finally {
            setLoading(false);
        }
    }, [semana]);

    useEffect(() => { cargar(); }, [cargar]);

    const corteDe = (a: any) => (semana === '8' ? a.corte_8 : a.corte_16) || { estado: 'Sin indicadores', reportados: 0, total: 0 };

    // El corte solo aplica a docentes que ya aceptaron su agenda: es el mismo
    // criterio de la semana 0, para que las tres pestañas listen a los mismos
    // docentes. Además hacen falta indicadores, o no hay nada que reportar.
    //
    // Al revisor de una función además solo le interesan los que YA subieron
    // algo en este corte: lo que no se ha reportado no es suyo por revisar.
    const conAgenda = useMemo(
        () => agendas.filter(a => {
            if (!agendaDiligenciada(a)) return false;
            if ((a.total_indicadores || 0) === 0) return false;
            if (modulo !== 'revision') return true;
            const c = semana === '8' ? a.corte_8 : a.corte_16;
            return (c?.reportados || 0) > 0;
        }),
        [agendas, modulo, semana]
    );

    const programas = useMemo(
        () => [...new Set(conAgenda.map(a => a.nombre_programa).filter(Boolean))].sort(),
        [conAgenda]
    );

    const filtradas = useMemo(() => conAgenda.filter(a => {
        const coincide = a.nombre_docente?.toLowerCase().includes(busqueda.toLowerCase())
            || a.nombre_programa?.toLowerCase().includes(busqueda.toLowerCase());
        const delPrograma = !filtroPrograma || a.nombre_programa === filtroPrograma;
        return coincide && delPrograma;
    }), [conAgenda, busqueda, filtroPrograma]);

    const totalPaginas = Math.max(1, Math.ceil(filtradas.length / regPorPag));
    const paginaSegura = Math.min(paginaActual, totalPaginas);
    const filtPagina = filtradas.slice((paginaSegura - 1) * regPorPag, paginaSegura * regPorPag);

    const periodoLabel = periodo ? `${periodo.anio}-${periodo.semestre === 1 ? 'I' : 'II'}` : 'Sin periodo';

    // 'habilitada' es el interruptor de Planeación. Mientras esté apagado el
    // docente no puede guardar su avance; si ya hay reportes, es que el corte
    // se cerró después de recogerlos.
    const abierto = !!semanaInfo?.habilitada;
    const hayReportes = conAgenda.some(a => corteDe(a).reportados > 0);
    const estadoCorte = abierto ? 'abierto' : (hayReportes ? 'cerrado' : 'sin_abrir');
    const completados = conAgenda.filter(a => corteDe(a).estado === 'Completado').length;
    const pendientes = conAgenda.filter(a => corteDe(a).estado === 'Pendiente').length;

    return (
        <div>
            {/* Estado del corte: quien lo abre y lo cierra es Planeación */}
            <div className={`mb-5 flex items-start gap-2.5 rounded-xl px-4 py-3 border ${
                estadoCorte === 'abierto'
                    ? 'bg-green-50 border-green-200'
                    : estadoCorte === 'cerrado'
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-amber-50 border-amber-200'
            }`}>
                {estadoCorte === 'abierto'
                    ? <Unlock className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    : <Lock className={`w-4 h-4 shrink-0 mt-0.5 ${estadoCorte === 'cerrado' ? 'text-slate-500' : 'text-amber-600'}`} />
                }
                <p className={`text-xs leading-relaxed ${
                    estadoCorte === 'abierto' ? 'text-green-800'
                        : estadoCorte === 'cerrado' ? 'text-slate-700' : 'text-amber-800'
                }`}>
                    {estadoCorte === 'abierto' && (
                        <>
                            <strong>Corte abierto.</strong> Los docentes pueden guardar su avance y las cifras
                            se irán actualizando hasta que Planeación cierre la semana {semana}.
                        </>
                    )}
                    {estadoCorte === 'cerrado' && (
                        <>
                            <strong>Corte cerrado.</strong> Planeación cerró la semana {semana}: estas cifras
                            ya no cambian. Puedes seguir dejando observaciones.
                        </>
                    )}
                    {estadoCorte === 'sin_abrir' && (
                        <>
                            <strong>Corte no habilitado.</strong> Planeación todavía no abre la semana {semana},
                            así que los docentes aún no pueden reportar. Que figuren como pendientes es lo esperado.
                        </>
                    )}
                </p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Docentes con agenda', value: conAgenda.length, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                    { label: modulo === 'revision' ? 'Reportaron completo' : `Reportaron semana ${semana}`,
                      value: completados, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
                    // Con el corte cerrado un pendiente es un incumplimiento;
                    // con el corte sin abrir, simplemente todavía no les toca.
                    { label: estadoCorte === 'sin_abrir' ? 'Aún no reportan' : 'Sin reportar', value: pendientes,
                      color: estadoCorte === 'sin_abrir' ? 'text-gray-500' : 'text-red-600',
                      bg: 'bg-red-50', border: estadoCorte === 'sin_abrir' ? 'border-gray-100' : 'border-red-100' },
                ].map(m => (
                    <div key={m.label} className={`bg-white rounded-2xl p-4 shadow-sm border ${m.border}`}>
                        <div className={`text-2xl font-black ${m.color}`}>{m.value}</div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-0.5">{m.label}</div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div className="relative flex-1 max-w-md w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar docente o programa..."
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                    <select
                        value={filtroPrograma}
                        onChange={e => setFiltroPrograma(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-400"
                    >
                        <option value="">Todos los programas</option>
                        {programas.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button
                        onClick={cargar}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
                    </button>
                    </div>
                </div>

                <div className="overflow-x-auto overflow-y-auto max-h-[460px]">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                        </div>
                    ) : filtradas.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">
                                {conAgenda.length === 0
                                    ? (modulo === 'revision'
                                        ? `Ningún docente ha subido su avance de la semana ${semana} todavía`
                                        : 'Ningún docente ha diligenciado su agenda todavía')
                                    : 'No se encontraron docentes'}
                            </p>
                            {conAgenda.length === 0 && (
                                <p className="text-sm mt-1">
                                    {modulo === 'revision'
                                        ? 'Aparecerán aquí en cuanto guarden su avance semanal.'
                                        : 'El corte se puede revisar cuando definan sus indicadores.'}
                                </p>
                            )}
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                                <tr>
                                    <th className="px-5 py-3 text-left font-bold">Docente</th>
                                    <th className="px-5 py-3 text-left font-bold">Programa</th>
                                    <th className="px-5 py-3 text-center font-bold">Periodo</th>
                                    <th className="px-5 py-3 text-center font-bold">Reporte S{semana}</th>
                                    <th className="px-5 py-3 text-center font-bold">Revisión</th>
                                    <th className="px-5 py-3 text-center font-bold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtPagina.map(a => {
                                    const corte = corteDe(a);
                                    return (
                                        <tr key={a.id_usuario} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                        {iniciales(a.nombre_docente)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-900 text-sm">{a.nombre_docente}</p>
                                                        <p className="text-xs text-gray-400">
                                                            {a.tipo_contrato} · {Math.round(num(a.total_horas))}h
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-sm text-gray-600">{a.nombre_programa}</td>
                                            <td className="px-5 py-3.5 text-center text-sm text-gray-600">{periodoLabel}</td>
                                            <td className="px-5 py-3.5 text-center">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                    corte.estado === 'Pendiente' && estadoCorte === 'sin_abrir'
                                                        ? 'bg-gray-100 text-gray-500'
                                                        : badgeCorte(corte.estado)
                                                }`}>
                                                    {corte.estado === 'Pendiente' && estadoCorte === 'sin_abrir' ? 'Sin abrir' : corte.estado}
                                                </span>
                                                <div className="text-[10px] text-gray-400 mt-0.5">
                                                    {corte.reportados}/{corte.total} indicadores
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${badgeRevision(corte.revision || 'Sin reportar')}`}>
                                                    {corte.revision || 'Sin reportar'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <button
                                                    onClick={() => navigate(modulo === 'revision' ? `/revision/semanas/${semana}/docente/${a.id_usuario}` : `/director/agendas/${a.id_usuario}/semana/${semana}`)}
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                                                >
                                                    <Eye className="w-3.5 h-3.5" /> Revisar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Paginación */}
                {filtradas.length > 0 && (
                    <div className="px-5 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>Mostrar</span>
                            <select value={regPorPag} onChange={e => { setRegPorPag(Number(e.target.value)); setPaginaActual(1); }}
                                className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-400">
                                {[5, 10, 15, 20, 25].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <span>registros · {filtradas.length} total</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setPaginaActual(p => Math.max(1, p - 1))} disabled={paginaSegura === 1}
                                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">‹</button>
                            {Array.from({ length: totalPaginas }, (_, i) => i + 1).filter(p => p === 1 || p === totalPaginas || Math.abs(p - paginaSegura) <= 1).map((p, idx, arr) => (
                                <span key={p}>
                                    {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-gray-400">…</span>}
                                    <button onClick={() => setPaginaActual(p)}
                                        className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${p === paginaSegura ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}>{p}</button>
                                </span>
                            ))}
                            <button onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))} disabled={paginaSegura === totalPaginas}
                                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">›</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
