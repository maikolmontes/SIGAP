import { lazy, Suspense, useEffect, useState } from 'react';
import { getArchivoUrl } from '../../services/api';
import { X, Download, ExternalLink, FileText, Image as ImageIcon, File, Table, FileX, FileArchive } from 'lucide-react';
import { tipoPreview, etiquetaTipo } from './tipoArchivo';
import type { TipoPreview } from './tipoArchivo';

// Word/Excel/ZIP/texto: se carga solo cuando alguien abre uno de esos archivos
const PreviewDocumento = lazy(() => import('./PreviewDocumento'));

export interface EvidenciaVisor {
    id_evidencias: number;
    nombre_archivo: string;
    ruta_archivo: string;
    tipo_archivo: string;
    tamanio_archivo_kb?: number;
    fecha_carga?: string;
    semana?: string | number;
}

const esEnlace = (t: string) => t === 'enlace';

const iconoDe = (tipo: TipoPreview, clase = 'w-5 h-5') => {
    switch (tipo) {
        case 'enlace': return <ExternalLink className={`${clase} text-indigo-300`} />;
        case 'pdf': return <FileText className={`${clase} text-red-300`} />;
        case 'imagen': return <ImageIcon className={`${clase} text-emerald-300`} />;
        case 'hoja': return <Table className={`${clase} text-green-300`} />;
        case 'zip': return <FileArchive className={`${clase} text-amber-300`} />;
        default: return <File className={`${clase} text-blue-300`} />;
    }
};

const tamano = (kb?: number) => {
    if (!kb) return '';
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
};

const fecha = (f?: string) => {
    if (!f) return '';
    return new Date(f).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

const urlDe = (ev: EvidenciaVisor) =>
    esEnlace(ev.tipo_archivo) ? ev.ruta_archivo : getArchivoUrl(ev.ruta_archivo);

/**
 * Visor de una evidencia en modal — mismo comportamiento que la pantalla
 * "Evidencias" del docente: previsualiza PDF e imágenes en línea, y para el
 * resto ofrece descarga. Se usa también en la revisión de cortes, donde el
 * Director consulta las evidencias de cada docente.
 */
export default function VisorEvidenciaModal({
    evidencia,
    onClose,
}: {
    evidencia: EvidenciaVisor;
    onClose: () => void;
}) {
    // El registro de la evidencia puede existir sin que el archivo esté en el
    // servidor (se borró del disco, o viene de datos de demostración). Sin esta
    // comprobación el <iframe> muestra el error crudo de Express.
    const [archivo, setArchivo] = useState<'verificando' | 'ok' | 'ausente'>(
        () => (esEnlace(evidencia.tipo_archivo) ? 'ok' : 'verificando')
    );

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const tipo = evidencia.tipo_archivo || '';
    const vista = tipoPreview(evidencia.nombre_archivo, tipo);
    const etiqueta = etiquetaTipo(evidencia.nombre_archivo, tipo);

    useEffect(() => {
        if (esEnlace(tipo)) return;
        let vigente = true;
        fetch(urlDe(evidencia), { method: 'HEAD' })
            .then(r => { if (vigente) setArchivo(r.ok ? 'ok' : 'ausente'); })
            // Un fallo de red no prueba que el archivo falte: se deja pasar
            // y que el visor lo intente.
            .catch(() => { if (vigente) setArchivo('ok'); });
        return () => { vigente = false; };
    }, [evidencia, tipo]);

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col"
                style={{ maxHeight: '90vh' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Cabecera */}
                <div className="bg-[#1a2744] px-5 py-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-white/10 p-2 rounded-lg shrink-0">{iconoDe(vista)}</div>
                        <div className="min-w-0">
                            <h2 className="text-white font-bold text-sm truncate">{evidencia.nombre_archivo}</h2>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                <span className="text-blue-300 text-xs font-medium">{etiqueta}</span>
                                {!esEnlace(tipo) && !!evidencia.tamanio_archivo_kb && (
                                    <span className="text-blue-200 text-xs">• {tamano(evidencia.tamanio_archivo_kb)}</span>
                                )}
                                {evidencia.fecha_carga && (
                                    <span className="text-blue-200 text-xs">• {fecha(evidencia.fecha_carga)}</span>
                                )}
                                {evidencia.semana != null && (
                                    <span className="text-blue-200 text-xs">• Semana {evidencia.semana}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                        {/* Sin archivo no hay nada que descargar */}
                        {archivo !== 'ausente' && (
                            <a
                                href={urlDe(evidencia)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors"
                            >
                                {esEnlace(tipo) ? <ExternalLink className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                                {esEnlace(tipo) ? 'Abrir' : 'Descargar'}
                            </a>
                        )}
                        <button
                            onClick={onClose}
                            className="text-blue-200 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full p-1.5"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Previsualización */}
                <div className="flex-1 overflow-auto bg-gray-100" style={{ minHeight: '400px' }}>
                    {archivo === 'verificando' ? (
                        <div className="flex items-center justify-center min-h-[400px]">
                            <div className="animate-spin w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full" />
                        </div>
                    ) : archivo === 'ausente' ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
                            <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center mb-6">
                                <FileX className="w-10 h-10 text-amber-500" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">El archivo no está disponible</h3>
                            <p className="text-gray-500 text-sm max-w-md">
                                La evidencia está registrada, pero su archivo no se encuentra en el servidor.
                                Pídele al docente que la vuelva a cargar.
                            </p>
                            <p className="text-gray-400 text-xs mt-4 break-all max-w-md">{evidencia.ruta_archivo}</p>
                        </div>
                    ) : vista === 'pdf' ? (
                        <iframe
                            src={urlDe(evidencia)}
                            className="w-full h-full border-0"
                            style={{ minHeight: '70vh' }}
                            title="Previsualización del PDF"
                        />
                    ) : vista === 'imagen' ? (
                        <div className="flex items-center justify-center p-6 min-h-[400px]">
                            <img
                                src={urlDe(evidencia)}
                                alt={evidencia.nombre_archivo}
                                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                            />
                        </div>
                    ) : vista === 'docx' || vista === 'hoja' || vista === 'zip' || vista === 'texto' ? (
                        <Suspense fallback={
                            <div className="flex items-center justify-center min-h-[400px]">
                                <div className="animate-spin w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full" />
                            </div>
                        }>
                            <PreviewDocumento key={urlDe(evidencia)} url={urlDe(evidencia)} tipo={vista} />
                        </Suspense>
                    ) : esEnlace(tipo) ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
                            <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
                                <ExternalLink className="w-10 h-10 text-indigo-500" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Enlace web</h3>
                            <p className="text-gray-500 text-sm mb-6 max-w-md break-all">{evidencia.ruta_archivo}</p>
                            <a
                                href={evidencia.ruta_archivo}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Abrir en una pestaña nueva
                            </a>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
                            <div className="w-20 h-20 bg-gray-200 rounded-2xl flex items-center justify-center mb-6">
                                {iconoDe(vista, 'w-10 h-10')}
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">{evidencia.nombre_archivo}</h3>
                            <p className="text-gray-500 text-sm mb-2">
                                {etiqueta}{evidencia.tamanio_archivo_kb ? ` • ${tamano(evidencia.tamanio_archivo_kb)}` : ''}
                            </p>
                            <p className="text-gray-400 text-xs mb-6">
                                Este tipo de archivo (por ejemplo .doc, .ppt o .rar) no se puede previsualizar en el navegador. Descárgalo para abrirlo.
                            </p>
                            <a
                                href={urlDe(evidencia)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Descargar archivo
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
