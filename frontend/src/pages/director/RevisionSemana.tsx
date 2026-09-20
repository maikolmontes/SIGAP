import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/common/Layout';
import api, { getArchivoUrl } from '../../services/api';
import {
    ArrowLeft, Eye, ChevronDown, ChevronRight, Clock, Send, Trash2,
    GraduationCap, BookOpen, FlaskConical, Users, Briefcase, Layers,
    Mail, Building2, FileText, MessageSquare
} from 'lucide-react';

function getFuncionMeta(nombre: string) {
    const n = (nombre || '').toLowerCase();
    if (n.includes('directa') && !n.includes('indirecta')) return { icon: GraduationCap, bg: 'bg-blue-50 text-blue-600 border-blue-100' };
    if (n.includes('indirecta')) return { icon: BookOpen, bg: 'bg-indigo-50 text-indigo-600 border-indigo-100' };
    if (n.includes('investiga')) return { icon: FlaskConical, bg: 'bg-purple-50 text-purple-600 border-purple-100' };
    if (n.includes('proyecci') || n.includes('social') || n.includes('extensi')) return { icon: Users, bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    if (n.includes('académico') || n.includes('administra') || n.includes('gesti')) return { icon: Briefcase, bg: 'bg-amber-50 text-amber-600 border-amber-100' };
    return { icon: Layers, bg: 'bg-slate-50 text-slate-600 border-slate-100' };
}

const iniciales = (nombre: string) =>
    `${nombre?.charAt(0) || ''}${nombre?.split(' ')[1]?.charAt(0) || ''}`;

const num = (v: any) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
};

// ─────────────────────────────────────────────────────────────
// Revisión de un corte (semana 8 o 16) para un docente.
//
// Contrasta lo que el docente comprometió en la semana 0 (indicador y
// meta) contra lo que reportó en este corte, y permite dejarle varias
// observaciones por actividad.
// ─────────────────────────────────────────────────────────────
export default function RevisionSemana() {
    const { id, semana: semanaParam } = useParams<{ id: string; semana: string }>();
    const semana = (semanaParam === '16' ? '16' : '8') as '8' | '16';
    const navigate = useNavigate();

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [abierta, setAbierta] = useState<number | null>(null);

    // Borrador y estado de envío por actividad
    const [borrador, setBorrador] = useState<Record<number, string>>({});
    const [enviando, setEnviando] = useState<number | null>(null);
    const [borrando, setBorrando] = useState<number | null>(null);
    const [obsAbierta, setObsAbierta] = useState<Record<number, boolean>>({});
    const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; msg: string } | null>(null);

    const cargar = useCallback(async () => {
        try {
            const res = await api.get(`/director/agendas/${id}`);
            setData(res.data);
        } catch (e) {
            console.error('Error cargando el corte:', e);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { cargar(); }, [cargar]);

    useEffect(() => {
        if (!aviso) return;
        const t = setTimeout(() => setAviso(null), 4000);
        return () => clearTimeout(t);
    }, [aviso]);

    const enviarObservacion = async (idActividad: number) => {
        const texto = (borrador[idActividad] || '').trim();
        if (!texto) return;
        setEnviando(idActividad);
        try {
            await api.post(`/observaciones/${idActividad}`, { semana: Number(semana), texto });
            setBorrador(p => ({ ...p, [idActividad]: '' }));
            setAviso({ tipo: 'exito', msg: 'Observación enviada al docente.' });
            await cargar();
        } catch (err: any) {
            setAviso({ tipo: 'error', msg: err.response?.data?.error || 'No se pudo enviar la observación.' });
        } finally {
            setEnviando(null);
        }
    };

    const borrarObservacion = async (idObs: number) => {
        if (!window.confirm('¿Eliminar esta observación?')) return;
        setBorrando(idObs);
        try {
            await api.delete(`/observaciones/item/${idObs}`);
            setAviso({ tipo: 'exito', msg: 'Observación eliminada.' });
            await cargar();
        } catch (err: any) {
            setAviso({ tipo: 'error', msg: err.response?.data?.error || 'No se pudo eliminar.' });
        } finally {
            setBorrando(null);
        }
    };

    if (loading) {
        return (
            <Layout rol="director" path={`Supervisión / Corte semana ${semana}`}>
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full" />
                </div>
            </Layout>
        );
    }

    if (!data?.docente) {
        return (
            <Layout rol="director" path={`Supervisión / Corte semana ${semana}`}>
                <div className="text-center py-16 text-gray-400">
                    <p>No se pudo cargar el seguimiento.</p>
                    <button onClick={() => navigate('/director/agendas', { state: { tab: semana === '16' ? 'semana16' : 'semana8' } })} className="mt-3 text-blue-600 hover:underline text-sm">Volver</button>
                </div>
            </Layout>
        );
    }

    const { docente } = data;
    const funciones: any[] = data.funciones || [];
    const totalHoras = funciones.reduce((s, f) => s + num(f.horas_funcion), 0);
    const horasContrato = num(docente.horas_contrato);
    const cumplimiento = horasContrato > 0 ? Math.min(100, Math.round((totalHoras / horasContrato) * 100)) : 0;
    const ejecucionDe = (ind: any) => semana === '8' ? num(ind.ejecucion_8) : num(ind.ejecucion_16);

    return (
        <Layout rol="director" path={`Supervisión / Semana ${semana} de ${docente.nombre_completo}`}>
            <div className="flex items-center justify-between gap-4 mb-5">
                <button
                    onClick={() => navigate('/director/agendas', { state: { tab: semana === '16' ? 'semana16' : 'semana8' } })}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Volver a Agendas por Revisar
                </button>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
                    <Clock className="w-3.5 h-3.5" /> Corte semana {semana}
                </span>
            </div>

            {aviso && (
                <div className={`mb-5 px-4 py-3 rounded-xl border text-sm font-medium ${
                    aviso.tipo === 'exito'
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    {aviso.msg}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">

                {/* Ficha del docente */}
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shrink-0">
                                {iniciales(docente.nombre_completo)}
                            </div>
                            <div className="min-w-0">
                                <h2 className="font-extrabold text-gray-900 leading-tight">{docente.nombre_completo}</h2>
                                <p className="text-xs text-gray-500">{docente.nombre_programa}</p>
                            </div>
                        </div>
                        <div className="space-y-2 text-xs text-gray-600">
                            <div className="flex items-center gap-2">
                                <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span className="truncate">{docente.correo}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span>{docente.tipo_contrato}</span>
                            </div>
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

                {/* Funciones */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-gray-900">Funciones Sustantivas</h3>
                        <span className="text-xs font-bold bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{funciones.length}</span>
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
                                            {Math.round(num(f.horas_funcion))} horas asignadas
                                            {' · '}{actividades.length} actividad{actividades.length !== 1 ? 'es' : ''}
                                        </p>
                                    </div>
                                    {estaAbierta
                                        ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                                        : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                                    }
                                </button>

                                {estaAbierta && (
                                    <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4 space-y-3">
                                        {actividades.length === 0 ? (
                                            <p className="text-xs text-gray-400 italic">Sin actividades registradas.</p>
                                        ) : actividades.map((act: any, i: number) => {
                                            const obs = (act.observaciones_director || [])
                                                .filter((o: any) => String(o.semana) === semana);
                                            const descripciones = act.descripciones || [];

                                            // En varias funciones la actividad se llama igual que la función
                                            // (p. ej. "Académico-Administrativo"): repetirlo no aporta nada.
                                            // Cuando pasa, encabeza el compromiso, que sí distingue una de otra.
                                            const nombreActividad = act.nombre_espacio || act.rol_seleccionado || '';
                                            const repiteFuncion = !nombreActividad
                                                || nombreActividad.trim().toLowerCase() === (f.funcion_sustantiva || '').trim().toLowerCase();
                                            const unCompromiso = descripciones.length === 1;
                                            const titulo = repiteFuncion
                                                ? (unCompromiso ? descripciones[0].resultado_esperado : `Actividad ${i + 1}`)
                                                : nombreActividad;
                                            const tituloEsCompromiso = repiteFuncion && unCompromiso;

                                            return (
                                                <div key={act.id_asignacionact} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    {/* Encabezado */}
                                                    <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex items-start justify-between gap-3">
                                                        <div className="flex items-start gap-2.5 min-w-0">
                                                            <span className="w-6 h-6 rounded-md bg-white border border-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                                                {i + 1}
                                                            </span>
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-gray-900 text-sm leading-snug">{titulo}</p>
                                                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                                    {act.nombre_grupo && (
                                                                        <span className="text-[10px] text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded">
                                                                            Grupo {act.nombre_grupo}
                                                                        </span>
                                                                    )}
                                                                    {tituloEsCompromiso && (
                                                                        <span className="text-[10px] font-bold text-gray-600 bg-white border border-gray-200 px-1.5 py-0.5 rounded">
                                                                            Meta {descripciones[0].meta ?? '—'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-white border border-gray-200 px-2 py-1 rounded-lg shrink-0">
                                                            <Clock className="w-3 h-3" />
                                                            {Math.round(num(act.horas_rol))}h / sem
                                                        </span>
                                                    </div>

                                                    <div className="p-4">
                                                        {descripciones.length === 0 ? (
                                                            <p className="text-xs text-gray-400 italic">Sin compromisos registrados en la semana 0.</p>
                                                        ) : descripciones.map((d: any) => (
                                                            <div key={d.id_descripcion} className="mb-3 last:mb-0">
                                                                {/* El compromiso solo se muestra si no encabeza la tarjeta */}
                                                                {!tituloEsCompromiso && (
                                                                    <div className="flex items-start justify-between gap-3 mb-2">
                                                                        <div className="flex items-start gap-1.5 min-w-0">
                                                                            <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                                                                            <span className="text-xs text-gray-600 leading-snug">{d.resultado_esperado}</span>
                                                                        </div>
                                                                        <span className="text-[10px] font-bold text-gray-600 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded shrink-0">
                                                                            Meta {d.meta ?? '—'}
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {(d.indicadores || []).map((ind: any) => {
                                                                    const ejec = ejecucionDe(ind);
                                                                    const metaNum = num(d.meta);
                                                                    const avance = metaNum > 0 ? Math.round((ejec / metaNum) * 100) : 0;
                                                                    const evidencias = (ind.evidencias || [])
                                                                        .filter((ev: any) => String(ev.semana) === semana);

                                                                    return (
                                                                        <div key={ind.id_indicadores} className="mb-3 last:mb-0">
                                                                            {/* Indicador de la semana 0 y su avance, en una línea */}
                                                                            <div className="flex items-baseline justify-between gap-3 mb-1">
                                                                                <span className="text-sm text-gray-800 min-w-0 truncate">{ind.nombre_indicador}</span>
                                                                                <span className="text-sm font-black text-gray-900 shrink-0 tabular-nums">
                                                                                    {ejec}
                                                                                    <span className="text-xs font-bold text-gray-400"> / {metaNum || '—'}</span>
                                                                                </span>
                                                                            </div>

                                                                            <div className="flex items-center gap-2">
                                                                                <div className="flex-1 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                                                                    <div
                                                                                        className={`h-full rounded-full transition-all duration-500 ${
                                                                                            avance >= 100 ? 'bg-green-500' : avance > 0 ? 'bg-amber-500' : 'bg-gray-300'
                                                                                        }`}
                                                                                        style={{ width: `${Math.min(100, avance)}%` }}
                                                                                    />
                                                                                </div>
                                                                                <span className={`text-[11px] font-bold shrink-0 tabular-nums ${
                                                                                    avance >= 100 ? 'text-green-600' : avance > 0 ? 'text-amber-600' : 'text-gray-400'
                                                                                }`}>
                                                                                    {avance}%
                                                                                </span>
                                                                            </div>

                                                                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                                                {ejec === 0 && (
                                                                                    <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">
                                                                                        Sin reportar
                                                                                    </span>
                                                                                )}
                                                                                {evidencias.length === 0 ? (
                                                                                    <span className="text-[10px] text-gray-400 italic">Sin evidencias</span>
                                                                                ) : evidencias.map((ev: any) => (
                                                                                    <a
                                                                                        key={ev.id_evidencias}
                                                                                        href={getArchivoUrl(ev.ruta_archivo)}
                                                                                        target="_blank"
                                                                                        rel="noreferrer"
                                                                                        className="inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 border border-blue-100 hover:bg-blue-100 px-2 py-0.5 rounded transition-colors max-w-full"
                                                                                    >
                                                                                        <Eye className="w-3 h-3 shrink-0" />
                                                                                        <span className="truncate max-w-[180px]">{ev.nombre_archivo}</span>
                                                                                    </a>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Retroalimentación: plegada hasta que se necesita */}
                                                    <div className="border-t border-gray-100">
                                                        <button
                                                            onClick={() => setObsAbierta(p => ({ ...p, [act.id_asignacionact]: !p[act.id_asignacionact] }))}
                                                            className="w-full px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors text-left"
                                                        >
                                                            <span className="flex items-center gap-2 text-xs font-bold text-gray-700">
                                                                <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                                                                Retroalimentación
                                                                {obs.length > 0 ? (
                                                                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                                                        {obs.length}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] font-normal text-gray-400">Sin observaciones</span>
                                                                )}
                                                            </span>
                                                            {obsAbierta[act.id_asignacionact]
                                                                ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                                                : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                                                            }
                                                        </button>

                                                        {obsAbierta[act.id_asignacionact] && (
                                                            <div className="px-4 pb-4 space-y-2">
                                                                {obs.map((o: any) => (
                                                                    <div key={o.id} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start justify-between gap-2">
                                                                        <div className="min-w-0">
                                                                            <p className="text-xs text-amber-900 leading-snug whitespace-pre-wrap">{o.texto}</p>
                                                                            <p className="text-[10px] text-amber-600/80 mt-1">
                                                                                {o.director_nombre}
                                                                                {o.ultima_edicion && ` · ${new Date(o.ultima_edicion).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}`}
                                                                            </p>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => borrarObservacion(o.id)}
                                                                            disabled={borrando === o.id}
                                                                            title="Eliminar esta observación"
                                                                            className="p-1 rounded text-amber-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-40"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                ))}

                                                                <div className="flex gap-2">
                                                                    <input
                                                                        type="text"
                                                                        placeholder={`Observación para la semana ${semana}...`}
                                                                        value={borrador[act.id_asignacionact] || ''}
                                                                        onChange={e => setBorrador(p => ({ ...p, [act.id_asignacionact]: e.target.value }))}
                                                                        onKeyDown={e => { if (e.key === 'Enter') enviarObservacion(act.id_asignacionact); }}
                                                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 transition-colors"
                                                                    />
                                                                    <button
                                                                        onClick={() => enviarObservacion(act.id_asignacionact)}
                                                                        disabled={enviando === act.id_asignacionact || !(borrador[act.id_asignacionact] || '').trim()}
                                                                        className="px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                                                                    >
                                                                        <Send className="w-4 h-4" />
                                                                        {enviando === act.id_asignacionact ? '...' : 'Enviar'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </Layout>
    );
}
