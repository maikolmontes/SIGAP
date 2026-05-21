import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/common/Layout';
import api from '../../services/api';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, CheckCircle, XCircle, AlertTriangle, FileText,
    ChevronDown, ChevronRight, Eye, MessageSquare, ExternalLink
} from 'lucide-react';

export default function DetalleAgendaConsultor() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [expandedFuncion, setExpandedFuncion] = useState<number | null>(null);

    const cargarDetalle = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/director/agendas/${id}`);
            setData(res.data);
            // Expandir primera función por defecto
            if (res.data.funciones?.length > 0) {
                setExpandedFuncion(res.data.funciones[0].id_funciones);
            }
        } catch (e) {
            console.error('Error cargando detalle consultor:', e);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        cargarDetalle();
    }, [cargarDetalle]);

    if (loading) {
        return (
            <Layout rol="consultor" path="Auditoría / Detalle de Agenda">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full" />
                </div>
            </Layout>
        );
    }

    if (!data) {
        return (
            <Layout rol="consultor" path="Auditoría / Detalle de Agenda">
                <div className="text-center py-16 text-gray-400">
                    <p>No se pudo cargar la agenda.</p>
                    <button onClick={() => navigate('/consultor/dashboard')} className="mt-3 text-teal-600 hover:underline text-sm font-semibold">Volver</button>
                </div>
            </Layout>
        );
    }

    const { docente, funciones, perfil_docente, horas_directas, docencia_indirecta } = data;
    const esInconsistencia = perfil_docente === 'INCONSISTENCIAS EN AGENDA AC 30';
    const todasAprobadas = funciones.every((f: any) => f.estado_agenda === 'Aprobada');

    return (
        <Layout rol="consultor" path={`Auditoría / Agenda de ${docente.nombre_completo}`}>
            {/* Botón volver */}
            <button
                onClick={() => navigate('/consultor/dashboard')}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors font-medium"
            >
                <ArrowLeft className="w-4 h-4" /> Volver a Dashboard
            </button>

            {/* Cabecera docente */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-sm">
                            {docente.nombres?.charAt(0)}{docente.apellidos?.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-gray-900">{docente.nombre_completo}</h2>
                            <p className="text-sm text-gray-500 mt-0.5">{docente.correo}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <span className="text-xs bg-teal-50 text-teal-700 px-2.5 py-1 rounded-lg font-medium border border-teal-100">
                                    {docente.tipo_contrato}
                                </span>
                                <span className="text-xs bg-gray-50 text-gray-700 px-2.5 py-1 rounded-lg font-medium border border-gray-200">
                                    {docente.nombre_programa}
                                </span>
                                <span className="text-xs bg-purple-50 text-purple-700 px-2.5 py-1 rounded-lg font-medium border border-purple-100">
                                    {Math.round(horas_directas)}h directas · {docencia_indirecta}h indirectas
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg uppercase ${esInconsistencia ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-teal-50 text-teal-700 border border-teal-100'}`}>
                            {esInconsistencia && <AlertTriangle className="w-3.5 h-3.5" />}
                            {perfil_docente}
                        </span>
                    </div>
                </div>
                {esInconsistencia && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                        <span><strong>Alerta:</strong> Esta agenda presenta inconsistencias según el Acuerdo 030/2024. Revisa las horas asignadas.</span>
                    </div>
                )}
            </div>

            {/* Funciones (bloques) */}
            <div className="space-y-6 mb-8">
                {funciones.map((func: any) => {
                    const isExpanded = expandedFuncion === func.id_funciones;
                    const estadoBg = func.estado_agenda === 'Aprobada' ? 'bg-green-100 text-green-800 border-green-200' :
                                     func.estado_agenda === 'Devuelta' ? 'bg-red-100 text-red-800 border-red-200' :
                                     func.estado_agenda === 'Aceptado' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                     'bg-yellow-100 text-yellow-800 border-yellow-200';

                    return (
                        <div key={func.id_funciones} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {/* Header de función */}
                            <button
                                onClick={() => setExpandedFuncion(isExpanded ? null : func.id_funciones)}
                                className={`w-full px-6 py-4 flex items-center justify-between transition-colors ${isExpanded ? 'bg-gray-50 border-b border-gray-200' : 'hover:bg-gray-50'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${isExpanded ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-500'}`}>
                                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-lg font-bold text-gray-900">{func.funcion_sustantiva}</h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            <span className="font-semibold text-gray-700">{parseFloat(func.horas_funcion).toFixed(0)} horas</span> asignadas · {func.actividades?.length || 0} actividades
                                        </p>
                                    </div>
                                </div>
                                <span className={`text-sm font-bold px-3 py-1.5 rounded-lg border ${estadoBg}`}>
                                    {func.estado_agenda}
                                </span>
                            </button>

                            {/* Actividades expandidas */}
                            {isExpanded && (
                                <div className="p-6 bg-gray-50/50">
                                    {func.actividades?.length === 0 ? (
                                        <div className="py-8 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                                            Sin actividades registradas
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {func.actividades.map((act: any) => (
                                                <div key={act.id_asignacionact} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                                    {/* Header de Actividad */}
                                                    <div className="bg-slate-50 px-5 py-4 border-b border-gray-200">
                                                        <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                                            {act.rol_seleccionado || 'Actividad sin nombre'}
                                                        </h4>
                                                        <div className="flex flex-wrap gap-3 mt-2 text-sm">
                                                            {act.nombre_espacio && (
                                                                <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-md text-slate-600">
                                                                    <strong>Espacio:</strong> {act.nombre_espacio}
                                                                </span>
                                                            )}
                                                            <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-md text-slate-600">
                                                                    <strong>Grupo:</strong> {act.nombre_grupo || 'N/A'}
                                                            </span>
                                                            <span className="bg-teal-50 border border-teal-100 text-teal-700 px-2.5 py-1 rounded-md font-semibold">
                                                                {parseFloat(act.horas_rol).toFixed(0)} horas
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="p-5">
                                                        {/* Descripciones con indicadores */}
                                                        {act.descripciones?.length > 0 ? (
                                                            <div className="space-y-5">
                                                                {act.descripciones.map((desc: any) => (
                                                                    <div key={desc.id_descripcion} className="border border-teal-100 rounded-lg overflow-hidden">
                                                                        {/* Descripción Header */}
                                                                        <div className="bg-teal-50/20 px-4 py-3 border-b border-teal-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                                            <p className="text-sm font-semibold text-teal-900 flex items-start gap-2">
                                                                                <FileText className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                                                                                <span>{desc.resultado_esperado}</span>
                                                                            </p>
                                                                            <span className="bg-white border border-teal-200 text-teal-700 text-xs font-bold px-2 py-1 rounded-md shrink-0">
                                                                                Meta: {desc.meta}
                                                                            </span>
                                                                        </div>

                                                                        {/* Indicadores */}
                                                                        <div className="p-4 bg-white space-y-4">
                                                                            {desc.indicadores?.length > 0 ? desc.indicadores.map((ind: any) => {
                                                                                const meta = parseFloat(desc.meta) || 1;
                                                                                const ej8 = parseFloat(ind.ejecucion_8) || 0;
                                                                                const ej16 = parseFloat(ind.ejecucion_16) || 0;
                                                                                const avanceParcial = meta > 0 ? (ej8 / meta) * 100 : 0;
                                                                                const avanceFinal = meta > 0 ? ((ej8 + ej16) / meta) * 100 : 0;
                                                                                const colorBadge = avanceFinal >= 100 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200';

                                                                                return (
                                                                                    <div key={ind.id_indicadores} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                                                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                                                                                            <span className="text-sm font-semibold text-slate-700 flex-1">{ind.nombre_indicador}</span>
                                                                                            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${colorBadge}`}>
                                                                                                Avance: {Math.round(avanceFinal)}%
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                                                                            <div className="bg-white p-3 rounded-md border border-slate-200 text-sm">
                                                                                                <div className="text-slate-500 mb-1">Ejecución Semana 8</div>
                                                                                                <div className="font-bold text-slate-800 text-lg">
                                                                                                    {ej8} <span className="text-xs font-normal text-slate-500 ml-1">({Math.round(avanceParcial)}%)</span>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="bg-white p-3 rounded-md border border-slate-200 text-sm">
                                                                                                <div className="text-slate-500 mb-1">Ejecución Semana 16</div>
                                                                                                <div className="font-bold text-slate-800 text-lg">{ej16}</div>
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* Evidencias */}
                                                                                        <div>
                                                                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Evidencias Adjuntas</p>
                                                                                            {ind.evidencias?.length > 0 ? (
                                                                                                <div className="flex flex-wrap gap-2">
                                                                                                    {ind.evidencias.map((ev: any) => (
                                                                                                        <a
                                                                                                            key={ev.id_evidencias}
                                                                                                            href={ev.tipo_archivo === 'enlace' ? ev.ruta_archivo : `http://localhost:3000${ev.ruta_archivo.startsWith('/') ? ev.ruta_archivo : '/' + ev.ruta_archivo}`}
                                                                                                            target="_blank"
                                                                                                            rel="noopener noreferrer"
                                                                                                            className="inline-flex items-center gap-1.5 text-xs bg-white text-teal-600 px-3 py-1.5 rounded-md border border-teal-200 hover:bg-teal-50 transition-colors shadow-sm font-medium"
                                                                                                            title={ev.nombre_archivo}
                                                                                                        >
                                                                                                            {ev.tipo_archivo === 'enlace' ? <ExternalLink className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                                                                            <span className="truncate max-w-[150px]">{ev.nombre_archivo}</span>
                                                                                                        </a>
                                                                                                    ))}
                                                                                                </div>
                                                                                            ) : (
                                                                                                <span className="text-xs text-slate-400 italic">Sin evidencias cargadas</span>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            }) : (
                                                                                <div className="text-sm text-slate-400 italic">Sin indicadores</div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-sm text-slate-400 italic mb-4">Sin descripciones de actividades registradas</div>
                                                        )}

                                                        <hr className="my-5 border-gray-200" />

                                                        {/* Sección Observaciones del Director */}
                                                        <div className="bg-amber-50/20 rounded-xl border border-amber-100 p-5">
                                                            <h5 className="font-bold text-amber-900 text-sm flex items-center gap-2 mb-3">
                                                                <MessageSquare className="w-4 h-4 text-amber-600" /> 
                                                                Observaciones del Director para esta Actividad
                                                            </h5>
                                                            
                                                            {/* Lista de observaciones existentes */}
                                                            {act.observaciones_director?.length > 0 ? (
                                                                <div className="space-y-3">
                                                                    {act.observaciones_director.map((obs: any) => (
                                                                        <div key={obs.id} className="bg-white p-3 border border-amber-200 rounded-lg shadow-sm">
                                                                            <div className="flex justify-between items-center mb-2">
                                                                                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded">Semana {obs.semana}</span>
                                                                                <span className="text-xs text-amber-600/70">{new Date(obs.ultima_edicion).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                                            </div>
                                                                            <p className="text-sm text-amber-900 font-medium">{obs.texto}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-amber-700/60 italic">No se reportan observaciones registradas para esta actividad.</p>
                                                            )}
                                                        </div>
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

            {/* Banner de Estado de Agenda */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-3">
                {todasAprobadas ? (
                    <>
                        <CheckCircle className="w-8 h-8 text-green-500" />
                        <div>
                            <p className="font-bold text-green-900">Esta agenda está Aprobada</p>
                            <p className="text-sm text-green-700 mt-0.5">
                                Verificada y avalada por la dirección del programa correspondiente.
                            </p>
                        </div>
                    </>
                ) : (
                    <>
                        <XCircle className="w-8 h-8 text-yellow-500" />
                        <div>
                            <p className="font-bold text-yellow-900">Agenda en Seguimiento</p>
                            <p className="text-sm text-yellow-700 mt-0.5">
                                La agenda se encuentra en estado de desarrollo o pendiente de aprobación final.
                            </p>
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
}
