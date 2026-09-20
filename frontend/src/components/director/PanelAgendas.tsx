import { useState, useEffect, useCallback, useMemo } from 'react';

import api from '../../services/api';
import {
    Search, RefreshCw, Info, Clock, X, ChevronDown, ChevronRight,
    GraduationCap, BookOpen, FlaskConical, Users, Briefcase, Layers,
    Mail, Building2, Target, ClipboardList, CheckCircle2
} from 'lucide-react';

// Icono y color por función sustantiva (mismo criterio que el detalle de revisión)
function getFuncionMeta(nombre: string) {
    const n = (nombre || '').toLowerCase();
    if (n.includes('directa') && !n.includes('indirecta')) return { icon: GraduationCap, bg: 'bg-blue-50 text-blue-600 border-blue-100' };
    if (n.includes('indirecta')) return { icon: BookOpen, bg: 'bg-indigo-50 text-indigo-600 border-indigo-100' };
    if (n.includes('investiga')) return { icon: FlaskConical, bg: 'bg-purple-50 text-purple-600 border-purple-100' };
    if (n.includes('proyecci') || n.includes('social') || n.includes('extensi')) return { icon: Users, bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    if (n.includes('académico') || n.includes('administra') || n.includes('gesti')) return { icon: Briefcase, bg: 'bg-amber-50 text-amber-600 border-amber-100' };
    return { icon: Layers, bg: 'bg-slate-50 text-slate-600 border-slate-100' };
}

const badgeEstado = (estado: string) => {
    switch (estado) {
        case 'Aprobada':  return 'bg-green-100 text-green-700 border-green-200';
        case 'Aceptado':  return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'Parcial':   return 'bg-violet-100 text-violet-700 border-violet-200';
        case 'Devuelta':  return 'bg-orange-100 text-orange-700 border-orange-200';
        default:          return 'bg-gray-100 text-gray-600 border-gray-200';
    }
};

const iniciales = (nombre: string) =>
    `${nombre?.charAt(0) || ''}${nombre?.split(' ')[1]?.charAt(0) || ''}`;

// ─────────────────────────────────────────────────────────────
// Modal de consulta: la agenda que el docente ya diligenció.
// Es solo lectura — aprobar y devolver pertenecen a los cortes.
// ─────────────────────────────────────────────────────────────
function ModalAgenda({ idUsuario, onClose }: { idUsuario: number; onClose: () => void }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    // Acordeón: abrir una función cierra la anterior, así el modal no crece de más
    const [abierta, setAbierta] = useState<number | null>(null);

    useEffect(() => {
        let vivo = true;
        api.get(`/director/agendas/${idUsuario}`)
            .then(res => { if (vivo) setData(res.data); })
            .catch(e => console.error('Error cargando agenda:', e))
            .finally(() => { if (vivo) setLoading(false); });
        return () => { vivo = false; };
    }, [idUsuario]);

    // Cerrar con Escape, como cualquier modal
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const docente = data?.docente;
    const funciones: any[] = data?.funciones || [];
    const totalHoras = funciones.reduce((s, f) => s + (parseFloat(f.horas_funcion) || 0), 0);
    const horasContrato = parseFloat(docente?.horas_contrato) || 0;
    const cumplimiento = horasContrato > 0 ? Math.min(100, Math.round((totalHoras / horasContrato) * 100)) : 0;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Cabecera */}
                <div className="bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0">
                            {iniciales(docente?.nombre_completo || '')}
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-extrabold text-gray-900 truncate">
                                {loading ? 'Cargando agenda...' : docente?.nombre_completo}
                            </h3>
                            <p className="text-xs text-gray-500 truncate">{docente?.nombre_programa}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors shrink-0"
                        title="Cerrar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-24">
                        <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full" />
                    </div>
                ) : !docente ? (
                    <div className="py-24 text-center text-gray-400">No se pudo cargar la agenda.</div>
                ) : (
                    <div className="overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">

                        {/* Columna izquierda: ficha del docente */}
                        <div className="space-y-4">
                            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2.5">
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <span className="truncate">{docente.correo}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <span>{docente.tipo_contrato}</span>
                                </div>
                                <div className="pt-2 flex items-center gap-2 text-sm font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    Agenda diligenciada
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Carga académica</span>
                                    <span className="text-xs font-extrabold text-gray-800 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                                        {Math.round(totalHoras)} / {horasContrato}h
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${cumplimiento >= 100 ? 'bg-green-500' : 'bg-amber-500'}`}
                                        style={{ width: `${cumplimiento}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>Cumplimiento contractual</span>
                                    <span className="font-bold text-gray-700">{cumplimiento}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Columna derecha: funciones desplegables */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-base font-bold text-gray-900">Funciones Sustantivas</h4>
                                <span className="text-xs font-bold bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                                    {funciones.length}
                                </span>
                            </div>

                            {funciones.length === 0 && (
                                <p className="text-sm text-gray-400 italic py-8 text-center">Sin funciones registradas.</p>
                            )}

                            {funciones.map((f: any) => {
                                const meta = getFuncionMeta(f.funcion_sustantiva);
                                const Icono = meta.icon;
                                const estaAbierta = abierta === f.id_funciones;
                                const actividades = f.actividades || [];

                                return (
                                    <div key={f.id_funciones} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                                        <button
                                            onClick={() => setAbierta(prev => prev === f.id_funciones ? null : f.id_funciones)}
                                            className="w-full px-5 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                                        >
                                            <span className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${meta.bg}`}>
                                                <Icono className="w-5 h-5" />
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-gray-900 text-sm">{f.funcion_sustantiva}</p>
                                                <p className="text-xs text-gray-500">
                                                    {Math.round(parseFloat(f.horas_funcion) || 0)} horas asignadas
                                                    {' · '}{actividades.length} actividad{actividades.length !== 1 ? 'es' : ''}
                                                </p>
                                            </div>
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${badgeEstado(f.estado_agenda)}`}>
                                                {f.estado_agenda}
                                            </span>
                                            {estaAbierta
                                                ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                                                : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                                            }
                                        </button>

                                        {estaAbierta && (
                                            <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4 space-y-3">
                                                {actividades.length === 0 ? (
                                                    <p className="text-xs text-gray-400 italic">Sin actividades registradas.</p>
                                                ) : actividades.map((act: any) => (
                                                    <div key={act.id_asignacionact} className="bg-white rounded-xl border border-gray-200 p-4">
                                                        {/* Actividad */}
                                                        <div className="flex items-start justify-between gap-3 mb-3">
                                                            <div className="min-w-0">
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-0.5">
                                                                    Actividad
                                                                </p>
                                                                <p className="font-semibold text-gray-900 text-sm">
                                                                    {act.nombre_espacio || act.rol_seleccionado || 'Actividad sin nombre'}
                                                                </p>
                                                            </div>
                                                            <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded shrink-0">
                                                                {Math.round(parseFloat(act.horas_rol) || 0)}h
                                                            </span>
                                                        </div>

                                                        {/* Descripciones con su meta e indicadores */}
                                                        {(act.descripciones || []).length === 0 ? (
                                                            <p className="text-xs text-gray-400 italic">
                                                                Sin descripción registrada para esta actividad.
                                                            </p>
                                                        ) : (act.descripciones || []).map((d: any) => (
                                                            <div key={d.id_descripcion} className="border-t border-gray-100 pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                                                                    Descripción / Resultado esperado
                                                                </p>
                                                                <p className="text-sm text-gray-700 leading-snug">{d.resultado_esperado}</p>

                                                                {d.meta != null && d.meta !== '' && (
                                                                    <div className="flex items-center gap-1.5 mt-2">
                                                                        <Target className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                                        <span className="text-xs text-gray-600">
                                                                            Meta: <strong className="text-gray-900">{d.meta}</strong>
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {(d.indicadores || []).length > 0 && (
                                                                    <div className="mt-2.5">
                                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                                                                            Indicador{d.indicadores.length !== 1 ? 'es' : ''}
                                                                        </p>
                                                                        <ul className="space-y-1">
                                                                            {d.indicadores.map((ind: any) => (
                                                                                <li key={ind.id_indicadores} className="flex items-start gap-2 text-xs text-gray-700 bg-amber-50/60 border border-amber-100 rounded-lg px-2.5 py-1.5">
                                                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                                                                                    <span>{ind.nombre_indicador}</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Agendas — tarjetas de los docentes que ya completaron su agenda.
// Se usa como pestaña dentro de "Agendas por Revisar".
// Es una vista de consulta: la revisión ocurre en los cortes.
// ─────────────────────────────────────────────────────────────
export default function PanelAgendas() {
    const [agendas, setAgendas] = useState<any[]>([]);
    const [periodo, setPeriodo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroPrograma, setFiltroPrograma] = useState('');
    const [abierta, setAbierta] = useState<number | null>(null);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/director/agendas');
            setAgendas(res.data.agendas || []);
            setPeriodo(res.data.periodo || null);
        } catch (e) {
            console.error('Error cargando agendas completadas:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    // Solo las que el docente ya terminó de diligenciar. Quedan fuera
    // las que siguen en Pendiente (aprobadas pero vacías) o Por Aprobar.
    const completadas = useMemo(
        () => agendas.filter(a => ['Aceptado', 'Aprobada', 'Parcial'].includes(a.estado_general)),
        [agendas]
    );

    const programas = useMemo(
        () => [...new Set(completadas.map(a => a.nombre_programa).filter(Boolean))].sort(),
        [completadas]
    );

    const filtradas = completadas.filter(a => {
        const coincide = a.nombre_docente?.toLowerCase().includes(busqueda.toLowerCase())
            || a.correo?.toLowerCase().includes(busqueda.toLowerCase());
        const delPrograma = !filtroPrograma || a.nombre_programa === filtroPrograma;
        return coincide && delPrograma;
    });

    const periodoLabel = periodo
        ? `${periodo.anio}-${periodo.semestre === 1 ? 'I' : 'II'}`
        : 'Sin periodo';

    return (
        <div>

            <div className="mb-5 flex items-start gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-700 leading-relaxed">
                    Docentes de tus programas que ya aceptaron <strong>todas</strong> sus funciones.
                    Haz clic en una tarjeta para ver su agenda completa. Es una vista de consulta.
                </p>
            </div>

            {/* Búsqueda */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-5">
                <div className="relative flex-1 max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar docente..."
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

            {/* Tarjetas */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                </div>
            ) : filtradas.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">
                        {completadas.length === 0
                            ? 'Ningún docente ha completado su agenda todavía'
                            : 'No hay agendas con esos filtros'}
                    </p>
                    {completadas.length === 0 && (
                        <p className="text-sm mt-1">
                            Aparecerán aquí cuando acepten todas sus funciones.
                        </p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filtradas.map(a => {
                        const cuadra = Math.round(a.total_horas) === Math.round(a.horas_contrato);
                        return (
                            <button
                                key={a.id_usuario}
                                onClick={() => setAbierta(a.id_usuario)}
                                className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 transition-all text-left overflow-hidden group"
                            >
                                <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                            {iniciales(a.nombre_docente)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-900 text-sm leading-tight truncate group-hover:text-blue-700 transition-colors">
                                                {a.nombre_docente}
                                            </p>
                                            <p className="text-xs text-gray-400 truncate">{a.nombre_programa}</p>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badgeEstado(a.estado_general)}`}>
                                        {a.estado_general}
                                    </span>
                                </div>

                                <div className="px-5 py-4">
                                    <ul className="space-y-1.5">
                                        {(a.funciones || []).map((f: any) => (
                                            <li key={f.id_funciones} className="flex items-center justify-between gap-2 text-sm">
                                                <span className="flex items-center gap-2 min-w-0">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                                    <span className="text-gray-700 truncate">{f.funcion_sustantiva}</span>
                                                </span>
                                                <span className="font-bold text-gray-800 shrink-0">
                                                    {Math.round(f.horas_funcion)}h
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="px-5 py-3 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between">
                                    <span className="text-xs text-gray-500 flex items-center gap-1.5">
                                        <ClipboardList className="w-3.5 h-3.5" />
                                        {a.tipo_contrato}
                                    </span>
                                    <span className={`text-sm font-black ${cuadra ? 'text-green-600' : 'text-amber-600'}`}>
                                        {Math.round(a.total_horas)}
                                        <span className="text-xs text-gray-400 font-bold">/{a.horas_contrato}h</span>
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {abierta !== null && (
                <ModalAgenda idUsuario={abierta} onClose={() => setAbierta(null)} />
            )}
        </div>
    );
}
