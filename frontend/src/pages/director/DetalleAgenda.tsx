import { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../../components/common/Layout';
import api, { getArchivoUrl } from '../../services/api';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    ArrowLeft, CheckCircle, XCircle, AlertTriangle, FileText,
    ChevronDown, ChevronRight, Send, Eye, MessageSquare, ExternalLink,
    GraduationCap, BookOpen, FlaskConical, Users, Briefcase, Clock,
    Layers, ShieldCheck, Maximize2, Minimize2, CheckCircle2,
    Building2, Mail, Pencil, Plus
} from 'lucide-react';

// Icono y color temático según función sustantiva
function getFuncionMeta(nombre: string) {
    const normalizado = (nombre || '').toLowerCase();
    if (normalizado.includes('directa') && !normalizado.includes('indirecta')) {
        return {
            icon: GraduationCap,
            color: 'blue',
            bgIcon: 'bg-blue-50 text-blue-600 border-blue-100',
            barColor: 'bg-blue-500',
        };
    }
    if (normalizado.includes('indirecta')) {
        return {
            icon: BookOpen,
            color: 'indigo',
            bgIcon: 'bg-indigo-50 text-indigo-600 border-indigo-100',
            barColor: 'bg-indigo-500',
        };
    }
    if (normalizado.includes('investiga')) {
        return {
            icon: FlaskConical,
            color: 'purple',
            bgIcon: 'bg-purple-50 text-purple-600 border-purple-100',
            barColor: 'bg-purple-500',
        };
    }
    if (normalizado.includes('proyecci') || normalizado.includes('social') || normalizado.includes('extensi')) {
        return {
            icon: Users,
            color: 'emerald',
            bgIcon: 'bg-emerald-50 text-emerald-600 border-emerald-100',
            barColor: 'bg-emerald-500',
        };
    }
    if (normalizado.includes('académico') || normalizado.includes('administra') || normalizado.includes('gesti')) {
        return {
            icon: Briefcase,
            color: 'amber',
            bgIcon: 'bg-amber-50 text-amber-600 border-amber-100',
            barColor: 'bg-amber-500',
        };
    }
    return {
        icon: Layers,
        color: 'slate',
        bgIcon: 'bg-slate-50 text-slate-600 border-slate-100',
        barColor: 'bg-slate-500',
    };
}

// Observación que el director deja sobre una actividad en un corte
interface ObservacionDirector {
    id: number;
    semana: number;
    texto: string;
    ultima_edicion: string;
    director_nombre?: string;
}

// Badge de estado de agenda
function getEstadoBadge(estado: string) {
    switch (estado) {
        case 'Aprobada':
            return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
        case 'Devuelta':
            return { bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' };
        case 'Aceptado':
            return { bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' };
        default:
            return { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
    }
}

export default function DetalleAgenda() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    const rutaVolver = '/director/agendas';
    const etiquetaVolver = 'Volver a Agendas por Revisar';

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [expandedFunciones, setExpandedFunciones] = useState<Record<number, boolean>>({});
    const [observacionGeneral, setObservacionGeneral] = useState('');
    const [showDevolver, setShowDevolver] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionResult, setActionResult] = useState<{ tipo: string; msg: string } | null>(null);

    // Observaciones por actividad. El backend guarda UNA observación por
    // actividad + semana: volver a enviar reemplaza la anterior. Por eso la
    // interfaz trabaja con dos ranuras fijas (semana 8 y semana 16) y las
    // claves de estado son `${id_actividad}-${semana}`.
    const [obsTexto, setObsTexto] = useState<Record<string, string>>({});
    const [obsGuardando, setObsGuardando] = useState<Record<string, boolean>>({});
    const [obsEditando, setObsEditando] = useState<Record<string, boolean>>({});
    const [obsPanelAbierto, setObsPanelAbierto] = useState<Record<number, boolean>>({});

    const cargarDetalle = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/director/agendas/${id}`);
            setData(res.data);
            // Las funciones arrancan plegadas: así el director ve de un vistazo
            // todas las funciones y su estado, y abre solo la que va a revisar.
            if (res.data.funciones?.length > 0) {
                const initialExpanded: Record<number, boolean> = {};
                res.data.funciones.forEach((f: any) => {
                    initialExpanded[f.id_funciones] = false;
                });
                setExpandedFunciones(initialExpanded);
            }
        } catch (e) {
            console.error('Error cargando detalle:', e);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        cargarDetalle();
    }, [cargarDetalle]);

    // Horas calculadas y totales
    const horasCalculadas = useMemo(() => {
        if (!data?.funciones) return { total: 0, directa: 0, indirecta: 0, otras: 0 };
        let directa = parseFloat(data.horas_directas) || 0;
        let indirecta = parseFloat(data.docencia_indirecta) || 0;
        let total = 0;
        let otras = 0;

        data.funciones.forEach((f: any) => {
            const h = parseFloat(f.horas_funcion) || 0;
            total += h;
            const norm = (f.funcion_sustantiva || '').toLowerCase();
            if (!norm.includes('directa') && !norm.includes('indirecta')) {
                otras += h;
            }
        });

        return { total, directa, indirecta, otras };
    }, [data]);

    const toggleFuncion = (idFuncion: number) => {
        setExpandedFunciones(prev => ({
            ...prev,
            [idFuncion]: !prev[idFuncion]
        }));
    };

    const toggleTodas = (expandir: boolean) => {
        if (!data?.funciones) return;
        const nuevo: Record<number, boolean> = {};
        data.funciones.forEach((f: any) => {
            nuevo[f.id_funciones] = expandir;
        });
        setExpandedFunciones(nuevo);
    };

    // Abre una función concreta y la trae a la vista (accesos rápidos)
    const irAFuncion = (idFuncion: number) => {
        setExpandedFunciones(prev => ({ ...prev, [idFuncion]: true }));
        setTimeout(() => {
            document.getElementById(`funcion-${idFuncion}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
    };

    const handleAprobar = async () => {
        if (!confirm('¿Estás seguro de aprobar esta agenda? El docente será notificado.')) return;
        setActionLoading(true);
        try {
            await api.put(`/director/agendas/${id}/aprobar`);
            setActionResult({ tipo: 'success', msg: 'Agenda aprobada exitosamente.' });
            cargarDetalle();
        } catch (e: any) {
            setActionResult({ tipo: 'error', msg: e.response?.data?.error || 'Error al aprobar.' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDevolver = async () => {
        if (!observacionGeneral.trim()) {
            setActionResult({ tipo: 'error', msg: 'La observación general es obligatoria al devolver.' });
            return;
        }
        setActionLoading(true);
        try {
            await api.put(`/director/agendas/${id}/devolver`, { observacion_general: observacionGeneral });
            setActionResult({ tipo: 'success', msg: 'Agenda devuelta con observaciones.' });
            setShowDevolver(false);
            setObservacionGeneral('');
            cargarDetalle();
        } catch (e: any) {
            setActionResult({ tipo: 'error', msg: e.response?.data?.error || 'Error al devolver.' });
        } finally {
            setActionLoading(false);
        }
    };

    // Clave única de cada ranura de observación (actividad + corte)
    const obsKey = (actId: number, semana: number) => `${actId}-${semana}`;

    // Abre el editor de una ranura, precargando el texto que ya existía
    const abrirEditorObservacion = (actId: number, semana: number, textoActual: string) => {
        const key = obsKey(actId, semana);
        setObsTexto(prev => ({ ...prev, [key]: textoActual || '' }));
        setObsEditando(prev => ({ ...prev, [key]: true }));
    };

    const cerrarEditorObservacion = (actId: number, semana: number) => {
        const key = obsKey(actId, semana);
        setObsEditando(prev => ({ ...prev, [key]: false }));
        setObsTexto(prev => ({ ...prev, [key]: '' }));
    };

    const guardarObservacionActividad = async (actId: number, semana: number) => {
        const key = obsKey(actId, semana);
        const texto = obsTexto[key];
        if (!texto?.trim()) return;

        setObsGuardando(prev => ({ ...prev, [key]: true }));
        try {
            await api.put(`/observaciones/${actId}`, { semana, texto });
            setObsEditando(prev => ({ ...prev, [key]: false }));
            setObsTexto(prev => ({ ...prev, [key]: '' }));
            cargarDetalle();
        } catch (e) {
            console.error('Error guardando observación:', e);
        } finally {
            setObsGuardando(prev => ({ ...prev, [key]: false }));
        }
    };

    if (loading) {
        return (
            <Layout rol="director" path="Supervisión / Detalle de Agenda">
                <div className="flex flex-col justify-center items-center h-80 space-y-4">
                    <div className="animate-spin w-12 h-12 border-4 border-[#063759] border-t-transparent rounded-full shadow-md" />
                    <p className="text-sm font-medium text-slate-500 animate-pulse">Cargando agenda académica...</p>
                </div>
            </Layout>
        );
    }

    if (!data) {
        return (
            <Layout rol="director" path="Supervisión / Detalle de Agenda">
                <div className="max-w-md mx-auto my-16 p-8 text-center bg-white rounded-2xl shadow-sm border border-slate-200">
                    <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">No se pudo cargar la agenda</h3>
                    <p className="text-sm text-slate-500 mt-1">Es posible que la agenda no exista o haya ocurrido un error temporal.</p>
                    <button
                        onClick={() => navigate(rutaVolver)}
                        className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4" /> {etiquetaVolver}
                    </button>
                </div>
            </Layout>
        );
    }

    const { docente, funciones, perfil_docente } = data;
    const esInconsistencia = perfil_docente === 'INCONSISTENCIAS EN AGENDA AC 30';
    const todasAprobadas = funciones && funciones.length > 0 && funciones.every((f: any) => f.estado_agenda === 'Aprobada');
    const algunaDevuelta = funciones && funciones.some((f: any) => f.estado_agenda === 'Devuelta');
    const todasExpandidas = funciones && funciones.length > 0 && funciones.every((f: any) => expandedFunciones[f.id_funciones]);

    // Horas estimadas por contrato
    const horasEsperadas = docente.tipo_contrato?.toLowerCase().includes('completo')
        ? 40
        : docente.tipo_contrato?.toLowerCase().includes('medio')
            ? 20
            : Math.round(horasCalculadas.total);

    const porcentajeCumplimiento = horasEsperadas > 0
        ? Math.min(100, Math.round((horasCalculadas.total / horasEsperadas) * 100))
        : 100;

    return (
        <Layout rol="director" path={`Supervisión / Agenda de ${docente.nombre_completo}`}>
            <div className="max-w-7xl mx-auto pb-16 space-y-6">
                
                {/* Barra de navegación superior con botón Volver y Breadcrumbs visuales */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <button
                        onClick={() => navigate(rutaVolver)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 text-slate-700 text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs group cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:-translate-x-0.5 group-hover:text-slate-700 transition-transform" />
                        <span>{etiquetaVolver}</span>
                    </button>

                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold border border-blue-100">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            Supervisión de Agenda
                        </span>
                        <span className="text-xs text-slate-400 font-medium">Período Activo 2026-I</span>
                    </div>
                </div>

                {/* Banner de mensajes o notificaciones de acción */}
                {actionResult && (
                    <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-xs animate-fadeIn ${
                        actionResult.tipo === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}>
                        <div className="flex items-center gap-3">
                            {actionResult.tipo === 'success' ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                            ) : (
                                <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                            )}
                            <span className="font-semibold text-sm">{actionResult.msg}</span>
                        </div>
                        <button
                            onClick={() => setActionResult(null)}
                            className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded hover:bg-black/5 transition-colors cursor-pointer"
                        >
                            Cerrar
                        </button>
                    </div>
                )}

                {/* ====== Columna lateral fija: identidad, carga y decisión ====== */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    <aside className="lg:col-span-4 xl:col-span-3 space-y-4 lg:sticky lg:top-0 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pb-2">

                        {/* Ficha compacta del docente */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#063759] to-[#0d598e] flex items-center justify-center text-white font-extrabold text-lg shadow-sm shrink-0">
                                    {docente.nombres?.charAt(0)}{docente.apellidos?.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h1 className="text-base font-black text-slate-900 leading-tight truncate" title={docente.nombre_completo}>
                                        {docente.nombre_completo}
                                    </h1>
                                    <p className="text-xs text-slate-500 truncate" title={docente.nombre_programa}>
                                        {docente.nombre_programa || 'Programa Académico'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-1.5 text-xs text-slate-500">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="truncate" title={docente.correo}>{docente.correo}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="font-semibold text-slate-700">{docente.tipo_contrato}</span>
                                </div>
                            </div>

                            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold ${
                                todasAprobadas
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : algunaDevuelta
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                                {todasAprobadas ? <CheckCircle2 className="w-4 h-4" /> : algunaDevuelta ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                {todasAprobadas ? 'Agenda aprobada' : algunaDevuelta ? 'Agenda devuelta' : 'En revisión'}
                            </div>

                            <div className={`flex items-center gap-2 text-xs font-semibold ${esInconsistencia ? 'text-rose-700' : 'text-emerald-700'}`}>
                                {esInconsistencia ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <ShieldCheck className="w-3.5 h-3.5 shrink-0" />}
                                {esInconsistencia ? 'Inconsistencias AC 30' : 'Agenda correcta AC 30'}
                            </div>
                        </div>

                        {/* Carga académica resumida */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Carga académica</span>
                                <span className="text-xs font-extrabold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                    {Math.round(horasCalculadas.total)} / {horasEsperadas}h
                                </span>
                            </div>

                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 rounded-full ${
                                        porcentajeCumplimiento >= 100
                                            ? 'bg-emerald-500'
                                            : porcentajeCumplimiento >= 80
                                                ? 'bg-blue-500'
                                                : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${Math.min(100, porcentajeCumplimiento)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-slate-500">
                                <span>Cumplimiento contractual</span>
                                <span className="font-bold text-slate-700">{porcentajeCumplimiento}%</span>
                            </div>

                            <div className="pt-1 space-y-1.5">
                                {[
                                    { icono: GraduationCap, etiqueta: 'Docencia directa', valor: horasCalculadas.directa, color: 'text-blue-600 bg-blue-50 border-blue-100' },
                                    { icono: BookOpen, etiqueta: 'Docencia indirecta', valor: horasCalculadas.indirecta, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
                                    { icono: Layers, etiqueta: 'Otras áreas', valor: horasCalculadas.otras, color: 'text-purple-600 bg-purple-50 border-purple-100' }
                                ].map(({ icono: Icono, etiqueta, valor, color }) => (
                                    <div key={etiqueta} className="flex items-center justify-between gap-2">
                                        <span className="flex items-center gap-2 text-xs text-slate-600 min-w-0">
                                            <span className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${color}`}>
                                                <Icono className="w-3.5 h-3.5" />
                                            </span>
                                            <span className="truncate">{etiqueta}</span>
                                        </span>
                                        <span className="text-sm font-extrabold text-slate-900 shrink-0">{Math.round(valor)}h</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Alerta de inconsistencia horaria */}
                        {esInconsistencia && (
                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-2.5 text-xs text-rose-800">
                                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                <span>
                                    <strong>Acuerdo 030/2024:</strong> la distribución horaria no coincide con las políticas de dedicación. Verifique las horas de docencia directa e indirecta.
                                </span>
                            </div>
                        )}

                {/* Acciones de Revisión (Aprobar o Devolver) si aún no está aprobada */}
                {!todasAprobadas && (
                    <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 space-y-3">
                        <div>
                            <h3 className="font-extrabold text-slate-900 text-sm">Decisión de Revisión</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Acciones vinculantes sobre la agenda</p>
                        </div>

                        {showDevolver ? (
                            <div className="space-y-3 bg-rose-50/50 p-4 rounded-xl border border-rose-200">
                                <label className="block text-xs font-bold uppercase tracking-wider text-rose-800">
                                    Observación General de Devolución <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    value={observacionGeneral}
                                    onChange={(e) => setObservacionGeneral(e.target.value)}
                                    placeholder="Indica con claridad al docente qué ajustes debe realizar en su carga o actividades..."
                                    rows={4}
                                    className="w-full px-4 py-3 border border-rose-300 rounded-xl text-sm bg-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 resize-none text-slate-800"
                                />
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={handleDevolver}
                                        disabled={actionLoading || !observacionGeneral.trim()}
                                        className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        {actionLoading ? 'Procesando...' : 'Confirmar Devolución'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowDevolver(false);
                                            setObservacionGeneral('');
                                        }}
                                        className="px-4 py-2.5 text-slate-600 hover:text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={handleAprobar}
                                    disabled={actionLoading}
                                    className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    {actionLoading ? 'Procesando...' : 'Aprobar Agenda'}
                                </button>
                                <button
                                    onClick={() => setShowDevolver(true)}
                                    disabled={actionLoading}
                                    className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-bold rounded-xl transition-colors border border-rose-200 disabled:opacity-50 cursor-pointer"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Devolver para Ajustes
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Si ya fue aprobada */}
                {todasAprobadas && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-3">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-extrabold text-emerald-950 text-sm">Agenda aprobada</h4>
                            <p className="text-xs text-emerald-700 mt-0.5">
                                La revisión oficial fue completada para el período activo. Puedes seguir agregando observaciones de seguimiento en los cortes de semana 8 y 16.
                            </p>
                        </div>
                    </div>
                )}

                    </aside>

                    {/* ====== Columna principal: funciones sustantivas ====== */}
                    <section className="lg:col-span-8 xl:col-span-9 space-y-4 min-w-0">

                {/* Barra de control de acordeones + accesos rápidos a cada función */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs px-4 py-3 space-y-3 lg:sticky lg:top-0 lg:z-20">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-slate-900">Funciones Sustantivas</h2>
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                                {funciones.length}
                            </span>
                        </div>

                        <button
                            onClick={() => toggleTodas(!todasExpandidas)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer shrink-0"
                        >
                            {todasExpandidas ? (
                                <>
                                    <Minimize2 className="w-3.5 h-3.5" />
                                    Colapsar todas
                                </>
                            ) : (
                                <>
                                    <Maximize2 className="w-3.5 h-3.5" />
                                    Expandir todas
                                </>
                            )}
                        </button>
                    </div>

                    {/* Atajos: abren la función y la traen a la vista sin buscarla desplazándose */}
                    <div className="flex flex-wrap gap-1.5">
                        {funciones.map((func: any) => {
                            const meta = getFuncionMeta(func.funcion_sustantiva);
                            const badge = getEstadoBadge(func.estado_agenda);
                            const FuncIcon = meta.icon;
                            return (
                                <button
                                    key={`chip-${func.id_funciones}`}
                                    onClick={() => irAFuncion(func.id_funciones)}
                                    title={`${func.funcion_sustantiva} — ${func.estado_agenda}`}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 text-xs font-semibold text-slate-700 transition-colors cursor-pointer max-w-full"
                                >
                                    <FuncIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    <span className="truncate">{func.funcion_sustantiva}</span>
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${badge.dot}`} />
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Acordeones de Funciones Sustantivas */}
                <div className="space-y-4">
                    {funciones.map((func: any) => {
                        const isExpanded = !!expandedFunciones[func.id_funciones];
                        const meta = getFuncionMeta(func.funcion_sustantiva);
                        const badge = getEstadoBadge(func.estado_agenda);
                        const FuncIcon = meta.icon;
                        const numActividades = func.actividades?.length || 0;

                        return (
                            <div
                                key={func.id_funciones}
                                id={`funcion-${func.id_funciones}`}
                                className={`bg-white rounded-2xl border transition-all shadow-xs overflow-hidden scroll-mt-24 ${
                                    isExpanded ? 'border-slate-300 ring-1 ring-slate-100' : 'border-slate-200/90 hover:border-slate-300'
                                }`}
                            >
                                {/* Cabecera de la función */}
                                <button
                                    onClick={() => toggleFuncion(func.id_funciones)}
                                    className={`w-full px-5 sm:px-6 py-4 flex items-center justify-between text-left transition-colors cursor-pointer ${
                                        isExpanded ? 'bg-slate-50/70 border-b border-slate-200/80' : 'hover:bg-slate-50/40'
                                    }`}
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${meta.bgIcon}`}>
                                            <FuncIcon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-extrabold text-slate-900 text-base truncate">
                                                    {func.funcion_sustantiva}
                                                </h3>
                                            </div>
                                            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 flex items-center gap-2">
                                                <span className="font-bold text-slate-700">
                                                    {parseFloat(func.horas_funcion).toFixed(0)} horas asignadas
                                                </span>
                                                <span className="text-slate-300">•</span>
                                                <span>{numActividades} {numActividades === 1 ? 'actividad' : 'actividades'}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.bg}`}>
                                            <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                                            {func.estado_agenda}
                                        </span>
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors">
                                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                        </div>
                                    </div>
                                </button>

                                {/* Contenido expandido de la función */}
                                {isExpanded && (
                                    <div className="p-5 sm:p-6 bg-slate-50/30 space-y-6">
                                        {numActividades === 0 ? (
                                            <div className="py-10 text-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400">
                                                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                                <p className="font-medium text-sm">Sin actividades registradas en esta función</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                {func.actividades.map((act: any, actIndex: number) => (
                                                    <div
                                                        key={act.id_asignacionact}
                                                        className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden"
                                                    >
                                                        {/* Header de la Actividad */}
                                                        <div className="px-5 py-4 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-extrabold flex items-center justify-center">
                                                                        {actIndex + 1}
                                                                    </span>
                                                                    <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                                                                        {act.rol_seleccionado || 'Actividad Asignada'}
                                                                    </h4>
                                                                </div>

                                                                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                                                                    {act.nombre_espacio && (
                                                                        <span className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-slate-600 font-medium">
                                                                            <strong>Espacio:</strong> {act.nombre_espacio}
                                                                        </span>
                                                                    )}
                                                                    <span className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-slate-600 font-medium">
                                                                        <strong>Grupo:</strong> {act.nombre_grupo || 'Único / General'}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="shrink-0">
                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-extrabold">
                                                                    <Clock className="w-3.5 h-3.5" />
                                                                    {parseFloat(act.horas_rol).toFixed(0)} horas semanales
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Cuerpo: Descripciones, Metas, Indicadores y Evidencias */}
                                                        <div className="p-5 space-y-5">
                                                            {act.descripciones?.length > 0 ? (
                                                                <div className="space-y-4">
                                                                    {act.descripciones.map((desc: any) => (
                                                                        <div
                                                                            key={desc.id_descripcion}
                                                                            className="border border-slate-200/90 rounded-xl overflow-hidden bg-slate-50/20"
                                                                        >
                                                                            {/* Resultado esperado */}
                                                                            <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                                                <div className="flex items-start gap-2.5">
                                                                                    <FileText className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                                                                    <span className="text-xs sm:text-sm font-semibold text-slate-800">
                                                                                        {desc.resultado_esperado}
                                                                                    </span>
                                                                                </div>
                                                                                <span className="bg-white border border-slate-200 text-slate-700 text-xs font-extrabold px-2.5 py-1 rounded-md shrink-0 shadow-2xs">
                                                                                    Meta: {desc.meta}
                                                                                </span>
                                                                            </div>

                                                                            {/* Indicadores de desempeño */}
                                                                            <div className="p-4 space-y-4">
                                                                                {desc.indicadores?.length > 0 ? (
                                                                                    desc.indicadores.map((ind: any) => {
                                                                                        const meta = parseFloat(desc.meta) || 1;
                                                                                        const ej8 = parseFloat(ind.ejecucion_8) || 0;
                                                                                        const ej16 = parseFloat(ind.ejecucion_16) || 0;
                                                                                        const avanceParcial = meta > 0 ? (ej8 / meta) * 100 : 0;
                                                                                        const avanceFinal = meta > 0 ? ((ej8 + ej16) / meta) * 100 : 0;
                                                                                        const isCompletado = avanceFinal >= 100;

                                                                                        return (
                                                                                            <div
                                                                                                key={ind.id_indicadores}
                                                                                                className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3"
                                                                                            >
                                                                                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                                                                                    <div className="font-semibold text-slate-800 text-xs sm:text-sm">
                                                                                                        {ind.nombre_indicador}
                                                                                                    </div>
                                                                                                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                                                                                        isCompletado
                                                                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                                                                                    }`}>
                                                                                                        {isCompletado && <CheckCircle className="w-3 h-3 text-emerald-600" />}
                                                                                                        Avance: {Math.round(avanceFinal)}%
                                                                                                    </span>
                                                                                                </div>

                                                                                                {/* Ejecución Semana 8 y 16 */}
                                                                                                <div className="grid grid-cols-2 gap-3">
                                                                                                    <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200/80">
                                                                                                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                                                                            Corte Semana 8
                                                                                                        </div>
                                                                                                        <div className="text-base font-extrabold text-slate-800 mt-0.5">
                                                                                                            {ej8}{' '}
                                                                                                            <span className="text-xs font-normal text-slate-500">
                                                                                                                ({Math.round(avanceParcial)}%)
                                                                                                            </span>
                                                                                                        </div>
                                                                                                    </div>

                                                                                                    <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200/80">
                                                                                                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                                                                            Corte Semana 16
                                                                                                        </div>
                                                                                                        <div className="text-base font-extrabold text-slate-800 mt-0.5">
                                                                                                            {ej16}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>

                                                                                                {/* Evidencias adjuntas */}
                                                                                                <div className="pt-1">
                                                                                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                                                                        Evidencias Adjuntas
                                                                                                    </div>
                                                                                                    {ind.evidencias?.length > 0 ? (
                                                                                                        <div className="flex flex-wrap gap-2">
                                                                                                            {ind.evidencias.map((ev: any) => (
                                                                                                                <a
                                                                                                                    key={ev.id_evidencias}
                                                                                                                    href={ev.tipo_archivo === 'enlace' ? ev.ruta_archivo : getArchivoUrl(ev.ruta_archivo)}
                                                                                                                    target="_blank"
                                                                                                                    rel="noopener noreferrer"
                                                                                                                    className="inline-flex items-center gap-1.5 text-xs bg-white text-blue-600 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors shadow-2xs font-medium max-w-[220px]"
                                                                                                                    title={ev.nombre_archivo}
                                                                                                                >
                                                                                                                    {ev.tipo_archivo === 'enlace' ? (
                                                                                                                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                                                                                                    ) : (
                                                                                                                        <Eye className="w-3.5 h-3.5 shrink-0" />
                                                                                                                    )}
                                                                                                                    <span className="truncate">{ev.nombre_archivo}</span>
                                                                                                                </a>
                                                                                                            ))}
                                                                                                        </div>
                                                                                                    ) : (
                                                                                                        <span className="text-xs text-slate-400 italic">
                                                                                                            Sin evidencias cargadas
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })
                                                                                ) : (
                                                                                    <div className="text-xs text-slate-400 italic">
                                                                                        Sin indicadores asociados
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-slate-400 italic">
                                                                    Sin especificaciones registradas para esta actividad
                                                                </div>
                                                            )}

                                                            {/* ===== Retroalimentación del director =====
                                                                El backend guarda una observación por actividad y corte,
                                                                así que se muestran dos ranuras fijas (semana 8 y 16)
                                                                en lugar de un listado que se acumula. */}
                                                            {(() => {
                                                                const obsPorSemana: Record<number, ObservacionDirector> = {};
                                                                (act.observaciones_director as ObservacionDirector[] || []).forEach((o) => {
                                                                    obsPorSemana[Number(o.semana)] = o;
                                                                });
                                                                const cortesConObs = Object.keys(obsPorSemana).length;
                                                                const abierto = obsPanelAbierto[act.id_asignacionact] ?? cortesConObs > 0;

                                                                return (
                                                                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                                                        <button
                                                                            onClick={() =>
                                                                                setObsPanelAbierto((prev) => ({
                                                                                    ...prev,
                                                                                    [act.id_asignacionact]: !abierto,
                                                                                }))
                                                                            }
                                                                            className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                                                                        >
                                                                            <span className="flex items-center gap-2 min-w-0">
                                                                                <MessageSquare className={`w-4 h-4 shrink-0 ${cortesConObs > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
                                                                                <span className="text-xs sm:text-sm font-bold text-slate-800">
                                                                                    Retroalimentación al docente
                                                                                </span>
                                                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                                                                    cortesConObs > 0
                                                                                        ? 'bg-amber-100 text-amber-800'
                                                                                        : 'bg-slate-100 text-slate-500'
                                                                                }`}>
                                                                                    {cortesConObs > 0 ? `${cortesConObs} de 2 cortes` : 'Sin observaciones'}
                                                                                </span>
                                                                            </span>
                                                                            <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${abierto ? '' : '-rotate-90'}`} />
                                                                        </button>

                                                                        {abierto && (
                                                                            <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                                {[
                                                                                    { semana: 8, etiqueta: 'Corte parcial' },
                                                                                    { semana: 16, etiqueta: 'Corte final' },
                                                                                ].map(({ semana, etiqueta }) => {
                                                                                    const obs = obsPorSemana[semana];
                                                                                    const key = obsKey(act.id_asignacionact, semana);
                                                                                    const editando = !!obsEditando[key];
                                                                                    const guardando = !!obsGuardando[key];

                                                                                    return (
                                                                                        <div
                                                                                            key={semana}
                                                                                            className={`rounded-xl border p-3.5 space-y-2.5 transition-colors ${
                                                                                                obs
                                                                                                    ? 'border-amber-200 bg-amber-50/50'
                                                                                                    : 'border-dashed border-slate-300 bg-slate-50/60'
                                                                                            }`}
                                                                                        >
                                                                                            <div className="flex items-center justify-between gap-2">
                                                                                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                                                                                                    Semana {semana}
                                                                                                    <span className="font-semibold text-slate-400 normal-case tracking-normal"> · {etiqueta}</span>
                                                                                                </span>
                                                                                                {obs && !editando && (
                                                                                                    <button
                                                                                                        onClick={() => abrirEditorObservacion(act.id_asignacionact, semana, obs.texto)}
                                                                                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:bg-amber-100 px-2 py-1 rounded-md transition-colors cursor-pointer shrink-0"
                                                                                                    >
                                                                                                        <Pencil className="w-3 h-3" />
                                                                                                        Editar
                                                                                                    </button>
                                                                                                )}
                                                                                            </div>

                                                                                            {editando ? (
                                                                                                <div className="space-y-2">
                                                                                                    <textarea
                                                                                                        autoFocus
                                                                                                        rows={4}
                                                                                                        value={obsTexto[key] || ''}
                                                                                                        onChange={(e) =>
                                                                                                            setObsTexto((prev) => ({ ...prev, [key]: e.target.value }))
                                                                                                        }
                                                                                                        placeholder="Escribe la retroalimentación que verá el docente sobre esta actividad..."
                                                                                                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-xs sm:text-sm bg-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors text-slate-800 resize-y leading-relaxed"
                                                                                                    />
                                                                                                    <div className="flex items-center gap-2">
                                                                                                        <button
                                                                                                            onClick={() => guardarObservacionActividad(act.id_asignacionact, semana)}
                                                                                                            disabled={guardando || !obsTexto[key]?.trim()}
                                                                                                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                                                                                                        >
                                                                                                            <Send className="w-3.5 h-3.5" />
                                                                                                            {guardando ? 'Guardando...' : obs ? 'Actualizar' : 'Guardar'}
                                                                                                        </button>
                                                                                                        <button
                                                                                                            onClick={() => cerrarEditorObservacion(act.id_asignacionact, semana)}
                                                                                                            className="px-3 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                                                                                        >
                                                                                                            Cancelar
                                                                                                        </button>
                                                                                                    </div>
                                                                                                    {obs && (
                                                                                                        <p className="text-[11px] text-slate-500">
                                                                                                            Al guardar se reemplaza la observación registrada en este corte.
                                                                                                        </p>
                                                                                                    )}
                                                                                                </div>
                                                                                            ) : obs ? (
                                                                                                <div className="space-y-2">
                                                                                                    <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                                                                                                        {obs.texto}
                                                                                                    </p>
                                                                                                    <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                                                                                        <Clock className="w-3 h-3 text-slate-400" />
                                                                                                        Actualizada el{' '}
                                                                                                        {new Date(obs.ultima_edicion).toLocaleString('es-CO', {
                                                                                                            dateStyle: 'medium',
                                                                                                            timeStyle: 'short',
                                                                                                        })}
                                                                                                        {obs.director_nombre && (
                                                                                                            <>
                                                                                                                <span className="text-slate-300">·</span>
                                                                                                                <span className="font-semibold text-slate-600">{obs.director_nombre}</span>
                                                                                                            </>
                                                                                                        )}
                                                                                                    </p>
                                                                                                </div>
                                                                                            ) : (
                                                                                                <button
                                                                                                    onClick={() => abrirEditorObservacion(act.id_asignacionact, semana, '')}
                                                                                                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                                                                                >
                                                                                                    <Plus className="w-3.5 h-3.5" />
                                                                                                    Escribir observación
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                    </section>
                </div>

            </div>
        </Layout>
    );
}
