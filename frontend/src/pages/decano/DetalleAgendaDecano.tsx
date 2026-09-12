import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/common/Layout';
import api, { getArchivoUrl } from '../../services/api';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, FileText, ChevronDown, ChevronRight,
    Eye, MessageSquare, ExternalLink, Send, Crown,
    CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';

export default function DetalleAgendaDecano() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [expandedFuncion, setExpandedFuncion] = useState<number | null>(null);
    const [actionResult, setActionResult] = useState<{ tipo: string; msg: string } | null>(null);

    // Estado para observaciones por actividad
    const [obsTexto, setObsTexto] = useState<Record<string, string>>({});
    const [obsSemana, setObsSemana] = useState<Record<string, number>>({});
    const [obsGuardando, setObsGuardando] = useState<Record<string, boolean>>({});

    const cargarDetalle = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/director/agendas/${id}`);
            setData(res.data);
            if (res.data.funciones?.length > 0 && expandedFuncion === null) {
                setExpandedFuncion(res.data.funciones[0].id_funciones);
            }
        } catch (e: any) {
            console.error('Error cargando detalle de agenda para decano:', e);
        } finally {
            setLoading(false);
        }
    }, [id, expandedFuncion]);

    useEffect(() => {
        cargarDetalle();
    }, [cargarDetalle]);

    const guardarObservacionActividad = async (actId: number) => {
        const key = String(actId);
        const texto = obsTexto[key]?.trim();
        const semana = obsSemana[key] || 8;
        if (!texto) {
            setActionResult({ tipo: 'error', msg: 'El texto de la observación no puede estar vacío.' });
            return;
        }

        setObsGuardando(prev => ({ ...prev, [key]: true }));
        try {
            await api.put(`/observaciones/${actId}`, { semana, texto });
            setObsTexto(prev => ({ ...prev, [key]: '' }));
            setActionResult({ tipo: 'success', msg: `Observación de Semana ${semana} guardada exitosamente.` });
            cargarDetalle();
            setTimeout(() => setActionResult(null), 4000);
        } catch (e: any) {
            console.error('Error guardando observación:', e);
            setActionResult({ tipo: 'error', msg: e.response?.data?.error || 'Error al guardar la observación.' });
        } finally {
            setObsGuardando(prev => ({ ...prev, [key]: false }));
        }
    };

    if (loading) {
        return (
            <Layout rol="decano" path="Supervisión / Detalle Agenda">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full" />
                </div>
            </Layout>
        );
    }

    if (!data || !data.docente) {
        return (
            <Layout rol="decano" path="Supervisión / Detalle Agenda">
                <div className="text-center py-16 text-gray-400 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    <p className="font-bold text-gray-700 mb-2">No se encontró la información del docente o su agenda.</p>
                    <button onClick={() => navigate('/decano/agendas')} className="text-amber-600 hover:underline text-sm font-semibold">
                        Volver a Agendas
                    </button>
                </div>
            </Layout>
        );
    }

    const { docente, funciones, perfil_docente, horas_directas, docencia_indirecta } = data;
    const esInconsistencia = perfil_docente === 'INCONSISTENCIAS EN AGENDA AC 30';

    return (
        <Layout rol="decano" path={`Supervisión / Agenda — ${docente.nombre_completo || docente.nombres}`}>
            {/* Cabecera y Navegación */}
            <div className="mb-5">
                <button 
                    onClick={() => navigate('/decano/agendas')}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-amber-600 mb-3 transition-colors group"
                >
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                    Volver a Agendas
                </button>
                
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
                                {docente.nombres?.charAt(0)}{docente.apellidos?.charAt(0)}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-xl font-extrabold text-gray-900">{docente.nombre_completo}</h1>
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                        <Crown className="w-3 h-3" />
                                        Vista Decanatura
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500 mt-0.5">{docente.correo}</p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <span className="text-xs bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg font-medium border border-amber-200">
                                        {docente.tipo_contrato} ({docente.horas_contrato || 40}h)
                                    </span>
                                    <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg font-medium border border-gray-200">
                                        {docente.nombre_programa}
                                    </span>
                                    {horas_directas !== undefined && (
                                        <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-medium border border-blue-100">
                                            {Math.round(horas_directas)}h directas · {docencia_indirecta || 0}h indirectas
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg uppercase ${
                                esInconsistencia ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                                {esInconsistencia && <AlertTriangle className="w-3.5 h-3.5" />}
                                {perfil_docente || 'AGENDA DOCENTE'}
                            </span>
                            <span className="text-xs text-gray-400">Supervisión facultativa activa</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Banner de Feedback de acción */}
            {actionResult && (
                <div className={`mb-5 p-4 rounded-xl border flex items-center gap-3 animate-fadeIn ${
                    actionResult.tipo === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    {actionResult.tipo === 'success' ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                    <span className="font-medium text-sm">{actionResult.msg}</span>
                    <button onClick={() => setActionResult(null)} className="ml-auto text-xs hover:underline">✕</button>
                </div>
            )}

            {/* Listado de Funciones Sustantivas */}
            <div className="space-y-4 mb-8">
                {funciones.map((funcion: any) => {
                    const isExpanded = expandedFuncion === funcion.id_funciones;
                    const actCount = funcion.actividades?.length || 0;
                    return (
                        <div key={funcion.id_funciones} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            {/* Cabecera de la función */}
                            <button
                                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/80 transition-colors text-left border-b border-transparent"
                                onClick={() => setExpandedFuncion(isExpanded ? null : funcion.id_funciones)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 text-sm">{funcion.funcion_sustantiva}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {actCount} actividad{actCount !== 1 ? 'es' : ''} · {funcion.horas_funcion} horas asignadas
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                                        funcion.estado_agenda === 'Aprobada'
                                            ? 'bg-green-50 text-green-700 border-green-200'
                                            : funcion.estado_agenda === 'Devuelta'
                                                ? 'bg-red-50 text-red-700 border-red-200'
                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}>
                                        {funcion.estado_agenda || 'Pendiente'}
                                    </span>
                                    {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                                </div>
                            </button>

                            {/* Contenido expandible de Actividades */}
                            {isExpanded && (
                                <div className="border-t border-gray-100 bg-gray-50/30 p-6 space-y-6">
                                    {funcion.actividades?.map((act: any) => {
                                        const key = String(act.id_asignacionact);
                                        return (
                                            <div key={act.id_asignacionact} className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                                                {/* Encabezado Actividad */}
                                                <div className="p-4 bg-gray-50/80 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                                    <div>
                                                        <h4 className="font-bold text-gray-900 text-sm">
                                                            {act.rol_seleccionado || act.nombre_espacio || 'Actividad Asignada'}
                                                        </h4>
                                                        {(act.nombre_espacio || act.nombre_grupo) && (
                                                            <p className="text-xs text-gray-500 mt-0.5">
                                                                {act.nombre_espacio} {act.nombre_grupo ? `· Grupo ${act.nombre_grupo}` : ''}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span className="text-xs font-bold bg-amber-100 text-amber-900 px-2.5 py-1 rounded-md">
                                                        {act.horas_rol} Horas
                                                    </span>
                                                </div>

                                                <div className="p-5 space-y-5">
                                                    {/* Descripciones e Indicadores */}
                                                    {act.descripciones?.length > 0 ? (
                                                        <div className="space-y-4">
                                                            {act.descripciones.map((desc: any) => (
                                                                <div key={desc.id_descripcion} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                                                    <div className="bg-slate-50 px-4 py-2.5 border-b border-gray-200 flex justify-between items-center text-xs">
                                                                        <span className="font-bold text-slate-800">{desc.resultado_esperado}</span>
                                                                        <span className="text-gray-500 font-semibold">Meta: {desc.meta}</span>
                                                                    </div>
                                                                    
                                                                    <div className="p-4 space-y-3">
                                                                        {desc.indicadores?.map((ind: any) => {
                                                                            const meta = parseFloat(desc.meta) || 1;
                                                                            const ej8 = parseFloat(ind.ejecucion_8) || 0;
                                                                            const ej16 = parseFloat(ind.ejecucion_16) || 0;
                                                                            const avanceFinal = meta > 0 ? ((ej8 + ej16) / meta) * 100 : 0;
                                                                            return (
                                                                                <div key={ind.id_indicadores} className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs">
                                                                                    <div className="flex justify-between items-center mb-2">
                                                                                        <span className="font-semibold text-gray-800">{ind.nombre_indicador}</span>
                                                                                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                                                            Avance: {Math.round(avanceFinal)}%
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="grid grid-cols-2 gap-2 mb-2 text-[11px] text-gray-600">
                                                                                        <div className="bg-white p-2 rounded border border-gray-200">
                                                                                            Sem 8: <strong>{ej8}</strong>
                                                                                        </div>
                                                                                        <div className="bg-white p-2 rounded border border-gray-200">
                                                                                            Sem 16: <strong>{ej16}</strong>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Evidencias */}
                                                                                    {ind.evidencias?.length > 0 && (
                                                                                        <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-200">
                                                                                            {ind.evidencias.map((ev: any) => (
                                                                                                <a
                                                                                                    key={ev.id_evidencias}
                                                                                                    href={ev.tipo_archivo === 'enlace' ? ev.ruta_archivo : getArchivoUrl(ev.ruta_archivo)}
                                                                                                    target="_blank"
                                                                                                    rel="noopener noreferrer"
                                                                                                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-100"
                                                                                                >
                                                                                                    <ExternalLink className="w-3 h-3" />
                                                                                                    {ev.nombre_archivo || 'Ver Evidencia'}
                                                                                                </a>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-gray-400 italic">Sin descripciones de actividades registradas.</p>
                                                    )}

                                                    <hr className="border-gray-100 my-3" />

                                                    {/* Sección de Observaciones para el Decano */}
                                                    <div className="bg-amber-50/40 rounded-xl border border-amber-200 p-4">
                                                        <h5 className="font-bold text-amber-900 text-xs flex items-center gap-1.5 mb-3">
                                                            <MessageSquare className="w-4 h-4 text-amber-600" />
                                                            Observaciones de Supervisión (Decanatura / Dirección)
                                                        </h5>

                                                        {/* Lista de Observaciones ya existentes */}
                                                        {act.observaciones_director?.length > 0 ? (
                                                            <div className="space-y-2 mb-3">
                                                                {act.observaciones_director.map((obs: any) => (
                                                                    <div key={obs.id} className="bg-white p-3 border border-amber-200 rounded-lg text-xs shadow-xs">
                                                                        <div className="flex justify-between items-center mb-1">
                                                                            <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px]">
                                                                                Semana {obs.semana}
                                                                            </span>
                                                                            <span className="text-gray-400 text-[10px]">
                                                                                {obs.director_nombre ? `${obs.director_nombre} · ` : ''}
                                                                                {new Date(obs.ultima_edicion || obs.fecha).toLocaleDateString()}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-gray-800 italic">"{obs.texto}"</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-amber-700/60 italic mb-3">No hay observaciones registradas para esta actividad.</p>
                                                        )}

                                                        {/* Formulario de Nueva Observación */}
                                                        <div className="bg-white p-3 rounded-lg border border-amber-200 shadow-xs">
                                                            <p className="text-[11px] font-bold text-gray-700 mb-2">Agregar o actualizar observación como Decano</p>
                                                            <div className="flex flex-col sm:flex-row gap-2">
                                                                <select
                                                                    value={obsSemana[key] || 8}
                                                                    onChange={(e) => setObsSemana(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                                                                    className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold bg-gray-50 focus:outline-none focus:border-amber-500"
                                                                >
                                                                    <option value={8}>Semana 8</option>
                                                                    <option value={16}>Semana 16</option>
                                                                </select>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Escribe tu observación facultativa..."
                                                                    value={obsTexto[key] || ''}
                                                                    onChange={(e) => setObsTexto(prev => ({ ...prev, [key]: e.target.value }))}
                                                                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                                                                />
                                                                <button
                                                                    onClick={() => guardarObservacionActividad(act.id_asignacionact)}
                                                                    disabled={obsGuardando[key] || !obsTexto[key]?.trim()}
                                                                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                                                                >
                                                                    <Send className="w-3.5 h-3.5" />
                                                                    {obsGuardando[key] ? 'Guardando...' : 'Guardar'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}

                {funciones.length === 0 && (
                    <div className="text-center py-12 text-gray-400 bg-white rounded-2xl shadow-sm border border-gray-100">
                        <Eye className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="font-medium text-sm">Esta agenda no tiene funciones registradas</p>
                    </div>
                )}
            </div>
        </Layout>
    );
}
