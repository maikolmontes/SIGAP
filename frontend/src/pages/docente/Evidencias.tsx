import React, { useState, useEffect } from 'react';
import Layout from '../../components/common/Layout';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { FileText, FileImage, FileArchive, Link as LinkIcon, Download, Trash2, File as FileIcon, ExternalLink, AlertCircle, Calendar, Target, X, Eye, FileSpreadsheet } from 'lucide-react';

interface Evidencia {
    id_evidencias: number;
    nombre_archivo: string;
    ruta_archivo: string;
    tipo_archivo: string;
    tamanio_archivo_kb: number;
    fecha_carga: string;
}

interface Indicador {
    id_indicadores: number;
    nombre_indicador: string;
    evidencias: Evidencia[];
}

interface Actividad {
    id_asignacionact: number;
    rol_seleccionado: string;
    nombre_grupo: string;
    indicadores: Indicador[];
}

interface Funcion {
    funcionSustantiva: string;
    actividades: Actividad[];
}

const Evidencias: React.FC = () => {
    const { user } = useAuth();
    const [data, setData] = useState<Funcion[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFunction, setSelectedFunction] = useState<string>('Docencia Directa');
    const [mensaje, setMensaje] = useState<{ tipo: string, texto: string } | null>(null);
    const [eliminandoId, setEliminandoId] = useState<number | null>(null);
    const [preview, setPreview] = useState<Evidencia | null>(null);

    useEffect(() => {
        if (user) {
            cargarEvidencias();
        }
    }, [user]);

    const cargarEvidencias = async () => {
        try {
            setLoading(true);
            const userId = (user as any)?.id_usuario || user?.id;
            if (!userId) return;

            const response = await api.get(`/evidencias/${userId}`);
            setData(response.data);
            
            // Si la función "Docencia Directa" no existe en la data, seleccionar la primera disponible
            if (response.data.length > 0 && !response.data.find((f: any) => f.funcionSustantiva === 'Docencia Directa')) {
                setSelectedFunction(response.data[0].funcionSustantiva);
            }
        } catch (error) {
            console.error("Error al cargar evidencias:", error);
            setMensaje({ tipo: 'error', texto: 'No se pudieron cargar las evidencias.' });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id_evidencia: number) => {
        if (!window.confirm("¿Estás seguro de eliminar esta evidencia? Esta acción no se puede deshacer.")) {
            return;
        }

        try {
            setEliminandoId(id_evidencia);
            await api.delete(`/evidencias/${id_evidencia}`);
            
            if (preview?.id_evidencias === id_evidencia) setPreview(null);

            await cargarEvidencias();
            setMensaje({ tipo: 'exito', texto: 'Evidencia eliminada correctamente.' });
            
            setTimeout(() => setMensaje(null), 3000);
        } catch (error) {
            console.error("Error eliminando:", error);
            setMensaje({ tipo: 'error', texto: 'No se pudo eliminar la evidencia.' });
        } finally {
            setEliminandoId(null);
        }
    };

    const getFileUrl = (ev: Evidencia) => {
        if (ev.tipo_archivo === 'enlace') return ev.ruta_archivo;
        return `http://localhost:3000${ev.ruta_archivo}`;
    };

    const isImage = (type: string) => type && type.startsWith('image/');
    const isPdf = (type: string) => type && type.includes('pdf');
    const isLink = (type: string) => type === 'enlace';

    const getFileIcon = (type: string, size: string = 'w-5 h-5') => {
        if (!type) return <FileIcon className={`${size} text-gray-500`} />;
        if (type === 'enlace') return <LinkIcon className={`${size} text-indigo-500`} />;
        if (type.includes('pdf')) return <FileText className={`${size} text-red-500`} />;
        if (type.includes('word') || type.includes('document')) return <FileText className={`${size} text-blue-500`} />;
        if (type.startsWith('image/')) return <FileImage className={`${size} text-green-500`} />;
        if (type.includes('sheet') || type.includes('excel')) return <FileSpreadsheet className={`${size} text-emerald-600`} />;
        if (type.includes('zip') || type.includes('rar') || type.includes('compressed')) return <FileArchive className={`${size} text-amber-500`} />;
        return <FileIcon className={`${size} text-gray-500`} />;
    };

    const getFileLabel = (type: string) => {
        if (!type) return 'Archivo';
        if (type === 'enlace') return 'Enlace Web';
        if (type.includes('pdf')) return 'PDF';
        if (type.includes('word') || type.includes('document')) return 'Word';
        if (type.startsWith('image/')) return 'Imagen';
        if (type.includes('sheet') || type.includes('excel')) return 'Excel';
        if (type.includes('zip') || type.includes('rar')) return 'Comprimido';
        return 'Archivo';
    };

    const formatFileSize = (kb: number) => {
        if (!kb || kb === 0) return '';
        if (kb > 1024) return (kb / 1024).toFixed(2) + ' MB';
        return kb + ' KB';
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const options: Intl.DateTimeFormatOptions = { 
            year: 'numeric', month: 'short', day: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        };
        return new Date(dateString).toLocaleDateString('es-ES', options);
    };

    const activeFunctionData = data.find(f => f.funcionSustantiva === selectedFunction);

    if (loading) {
        return (
            <Layout rol="docente" path="Registro de Actividades / Evidencias">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                </div>
            </Layout>
        );
    }

    return (
        <Layout rol="docente" path="Registro de Actividades / Evidencias">
            <div className="bg-[#1a2744] rounded-xl px-6 py-6 mb-8 shadow-sm">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <FileText className="w-6 h-6 text-blue-400" />
                    Repositorio de Evidencias
                </h1>
                <p className="text-blue-100 text-sm mt-1">
                    Consulta y administra las evidencias (archivos y enlaces) cargadas durante el periodo académico.
                </p>
            </div>

            {mensaje && (
                <div className={`p-4 mb-6 rounded-xl flex items-start gap-3 border ${
                    mensaje.tipo === 'exito' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="font-medium text-sm">{mensaje.texto}</p>
                </div>
            )}

            {data.length === 0 ? (
                <div className="bg-white p-8 rounded-xl shadow-sm text-center border-2 border-dashed border-gray-200 mt-4">
                    <FileIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-gray-800">No hay evidencias</h3>
                    <p className="text-gray-500 text-sm mt-1">Aún no has subido ninguna evidencia. Ve a los Reportes de Semana 8 o 16 para subir tus archivos o enlaces.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Tabs de Funciones */}
                    <div className="flex flex-wrap gap-2 mb-4 bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                        {data.map((f, idx) => (
                            <button
                                key={idx}
                                onClick={() => setSelectedFunction(f.funcionSustantiva)}
                                className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                                    selectedFunction === f.funcionSustantiva 
                                    ? 'bg-[#1a2744] text-white shadow-md' 
                                    : 'bg-transparent text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                                }`}
                            >
                                {f.funcionSustantiva}
                            </button>
                        ))}
                    </div>

                    {/* Contenido de la Función Seleccionada */}
                    {activeFunctionData ? (
                        <div className="space-y-6">
                            {activeFunctionData.actividades.map((act) => (
                                <div key={act.id_asignacionact} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                    {/* Header de la Actividad */}
                                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between">
                                        <div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Materia / Actividad</div>
                                            <h3 className="text-lg font-bold text-gray-800">{act.rol_seleccionado}</h3>
                                        </div>
                                        {act.nombre_grupo && (
                                            <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200">
                                                Grupo: {act.nombre_grupo}
                                            </div>
                                        )}
                                    </div>

                                    {/* Lista de Indicadores */}
                                    <div className="divide-y divide-gray-100">
                                        {act.indicadores.map((ind) => {
                                            const tieneEvidencias = ind.evidencias && ind.evidencias.length > 0;
                                            
                                            return (
                                                <div key={ind.id_indicadores} className="px-6 py-5">
                                                    <div className="flex items-start gap-3 mb-4">
                                                        <div className="mt-1 bg-orange-100 p-1.5 rounded-md">
                                                            <Target className="w-4 h-4 text-orange-600" />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-bold text-gray-800">{ind.nombre_indicador}</h4>
                                                            {!tieneEvidencias && (
                                                                <p className="text-xs text-gray-400 mt-1 italic">Sin evidencias cargadas</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Grilla de Evidencias con mini-preview */}
                                                    {tieneEvidencias && (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-11">
                                                            {ind.evidencias.map((ev) => (
                                                                <div 
                                                                    key={ev.id_evidencias} 
                                                                    className="border border-gray-200 rounded-xl overflow-hidden hover:border-blue-300 hover:shadow-lg transition-all bg-white group cursor-pointer"
                                                                    onClick={() => setPreview(ev)}
                                                                >
                                                                    {/* Mini Preview */}
                                                                    <div className="h-28 bg-gray-50 border-b border-gray-100 flex items-center justify-center relative overflow-hidden">
                                                                        {isImage(ev.tipo_archivo) ? (
                                                                            <img 
                                                                                src={getFileUrl(ev)} 
                                                                                alt={ev.nombre_archivo}
                                                                                className="w-full h-full object-cover"
                                                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                                            />
                                                                        ) : isPdf(ev.tipo_archivo) ? (
                                                                            <div className="flex flex-col items-center gap-1.5">
                                                                                <FileText className="w-10 h-10 text-red-400" />
                                                                                <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">PDF</span>
                                                                            </div>
                                                                        ) : isLink(ev.tipo_archivo) ? (
                                                                            <div className="flex flex-col items-center gap-1.5">
                                                                                <ExternalLink className="w-10 h-10 text-indigo-400" />
                                                                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">ENLACE</span>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex flex-col items-center gap-1.5">
                                                                                {getFileIcon(ev.tipo_archivo, 'w-10 h-10')}
                                                                                <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{getFileLabel(ev.tipo_archivo)}</span>
                                                                            </div>
                                                                        )}
                                                                        {/* Hover overlay */}
                                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                                            <div className="bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg">
                                                                                <Eye className="w-5 h-5 text-gray-700" />
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Info */}
                                                                    <div className="p-3">
                                                                        <p className="text-sm font-bold text-gray-800 truncate" title={ev.nombre_archivo}>
                                                                            {ev.nombre_archivo}
                                                                        </p>
                                                                        <div className="flex items-center justify-between mt-1.5">
                                                                            <div className="flex items-center gap-2">
                                                                                {ev.tipo_archivo !== 'enlace' && ev.tamanio_archivo_kb > 0 && (
                                                                                    <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                                                        {formatFileSize(ev.tamanio_archivo_kb)}
                                                                                    </span>
                                                                                )}
                                                                                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                                                    <Calendar className="w-3 h-3" />
                                                                                    {formatDate(ev.fecha_carga)}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                                                                <a 
                                                                                    href={getFileUrl(ev)} 
                                                                                    target="_blank" 
                                                                                    rel="noopener noreferrer"
                                                                                    className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                                                                    title={isLink(ev.tipo_archivo) ? "Abrir Enlace" : "Descargar"}
                                                                                >
                                                                                    {isLink(ev.tipo_archivo) ? <ExternalLink className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                                                                                </a>
                                                                                <button 
                                                                                    onClick={() => handleDelete(ev.id_evidencias)}
                                                                                    disabled={eliminandoId === ev.id_evidencias}
                                                                                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                                    title="Eliminar"
                                                                                >
                                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
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
                        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                            <p className="text-gray-500">No hay actividades registradas en esta función.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ===== MODAL DE PREVISUALIZACIÓN ===== */}
            {preview && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    onClick={() => setPreview(null)}
                >
                    <div 
                        className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col"
                        style={{ maxHeight: '90vh' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header del modal */}
                        <div className="bg-[#1a2744] px-5 py-4 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="bg-white/10 p-2 rounded-lg shrink-0">
                                    {getFileIcon(preview.tipo_archivo, 'w-5 h-5')}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-white font-bold text-sm truncate">{preview.nombre_archivo}</h2>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <span className="text-blue-300 text-xs font-medium">{getFileLabel(preview.tipo_archivo)}</span>
                                        {preview.tipo_archivo !== 'enlace' && preview.tamanio_archivo_kb > 0 && (
                                            <span className="text-blue-200 text-xs">• {formatFileSize(preview.tamanio_archivo_kb)}</span>
                                        )}
                                        <span className="text-blue-200 text-xs">• {formatDate(preview.fecha_carga)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-4">
                                <a
                                    href={getFileUrl(preview)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors"
                                >
                                    {isLink(preview.tipo_archivo) ? <ExternalLink className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                                    {isLink(preview.tipo_archivo) ? 'Abrir' : 'Descargar'}
                                </a>
                                <button 
                                    onClick={() => setPreview(null)}
                                    className="text-blue-200 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full p-1.5"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Cuerpo de previsualización */}
                        <div className="flex-1 overflow-auto bg-gray-100" style={{ minHeight: '400px' }}>
                            {isPdf(preview.tipo_archivo) ? (
                                <iframe 
                                    src={getFileUrl(preview)}
                                    className="w-full h-full border-0"
                                    style={{ minHeight: '70vh' }}
                                    title="Previsualización PDF"
                                />
                            ) : isImage(preview.tipo_archivo) ? (
                                <div className="flex items-center justify-center p-6 min-h-[400px]">
                                    <img 
                                        src={getFileUrl(preview)} 
                                        alt={preview.nombre_archivo}
                                        className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                                    />
                                </div>
                            ) : isLink(preview.tipo_archivo) ? (
                                <div className="flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
                                    <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
                                        <ExternalLink className="w-10 h-10 text-indigo-500" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800 mb-2">Enlace Web</h3>
                                    <p className="text-gray-500 text-sm mb-6 max-w-md break-all">{preview.ruta_archivo}</p>
                                    <a
                                        href={preview.ruta_archivo}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-indigo-500/20"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        Abrir enlace en nueva pestaña
                                    </a>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
                                    <div className="w-20 h-20 bg-gray-200 rounded-2xl flex items-center justify-center mb-6">
                                        {getFileIcon(preview.tipo_archivo, 'w-10 h-10')}
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800 mb-2">{preview.nombre_archivo}</h3>
                                    <p className="text-gray-500 text-sm mb-2">{getFileLabel(preview.tipo_archivo)} • {formatFileSize(preview.tamanio_archivo_kb)}</p>
                                    <p className="text-gray-400 text-xs mb-6">Este tipo de archivo no soporta previsualización directa en el navegador.</p>
                                    <a
                                        href={getFileUrl(preview)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-blue-500/20"
                                    >
                                        <Download className="w-4 h-4" />
                                        Descargar archivo
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default Evidencias;
