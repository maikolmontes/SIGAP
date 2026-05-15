import React, { useState, useRef } from 'react';
import { X, UploadCloud, Link as LinkIcon, File, CheckCircle2, AlertTriangle, FileText, FileImage, FileArchive } from 'lucide-react';
import api from '../../services/api';

interface SubirEvidenciaModalProps {
    isOpen: boolean;
    onClose: () => void;
    idIndicador: number;
    nombreIndicador: string;
    onUploadSuccess: () => void;
}

const SubirEvidenciaModal: React.FC<SubirEvidenciaModalProps> = ({ isOpen, onClose, idIndicador, nombreIndicador, onUploadSuccess }) => {
    const [tipoCarga, setTipoCarga] = useState<'archivo' | 'link'>('archivo');
    const [archivo, setArchivo] = useState<File | null>(null);
    const [linkTexto, setLinkTexto] = useState('');
    const [cargando, setCargando] = useState(false);
    const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error', texto: string } | null>(null);
    const [dragActive, setDragActive] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    if (!isOpen) return null;

    const resetState = () => {
        setArchivo(null);
        setLinkTexto('');
        setMensaje(null);
        setTipoCarga('archivo');
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const validarArchivo = (file: File) => {
        if (file.size > MAX_FILE_SIZE) {
            setMensaje({ tipo: 'error', texto: 'El archivo supera el límite de 10MB permitidos.' });
            return false;
        }
        setMensaje(null);
        setArchivo(file);
        return true;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            validarArchivo(e.target.files[0]);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validarArchivo(e.dataTransfer.files[0]);
        }
    };

    const getFileIcon = (type: string) => {
        if (type.includes('pdf') || type.includes('word') || type.includes('document')) return <FileText className="w-8 h-8 text-blue-500" />;
        if (type.includes('image')) return <FileImage className="w-8 h-8 text-green-500" />;
        if (type.includes('zip') || type.includes('rar') || type.includes('compressed')) return <FileArchive className="w-8 h-8 text-amber-500" />;
        return <File className="w-8 h-8 text-gray-500" />;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleSubmit = async () => {
        if (tipoCarga === 'archivo' && !archivo) {
            setMensaje({ tipo: 'error', texto: 'Por favor, selecciona un archivo para subir.' });
            return;
        }

        if (tipoCarga === 'link' && !linkTexto.trim()) {
            setMensaje({ tipo: 'error', texto: 'Por favor, introduce un enlace válido.' });
            return;
        }

        setCargando(true);
        setMensaje(null);

        try {
            const formData = new FormData();
            formData.append('id_indicador', String(idIndicador));
            formData.append('tipo_evidencia', tipoCarga);

            if (tipoCarga === 'archivo' && archivo) {
                formData.append('archivo', archivo);
            } else if (tipoCarga === 'link') {
                formData.append('enlace_texto', linkTexto.trim());
            }

            // Es importante usar axios/api configurado para multipart si enviamos FormData
            await api.post('/evidencias/subir', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setMensaje({ tipo: 'exito', texto: 'Evidencia guardada exitosamente.' });
            setTimeout(() => {
                onUploadSuccess();
                handleClose();
            }, 1500);

        } catch (error: any) {
            console.error("Error al subir evidencia:", error);
            setMensaje({ tipo: 'error', texto: error.response?.data?.error || 'Ocurrió un error al subir la evidencia.' });
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-[#1a2744] p-5 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <UploadCloud className="w-5 h-5 text-blue-400" />
                            Subir Evidencia
                        </h2>
                        <p className="text-blue-200 text-xs mt-1 font-medium truncate max-w-[350px]">
                            {nombreIndicador}
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={cargando}
                        className="text-blue-200 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full p-1.5"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                    {/* Tabs */}
                    <div className="flex p-1 bg-gray-100 rounded-lg mb-6">
                        <button
                            onClick={() => setTipoCarga('archivo')}
                            className={`flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all ${tipoCarga === 'archivo' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <UploadCloud className="w-4 h-4" />
                            Archivo (PDF, Docs...)
                        </button>
                        <button
                            onClick={() => setTipoCarga('link')}
                            className={`flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all ${tipoCarga === 'link' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <LinkIcon className="w-4 h-4" />
                            Enlace Web
                        </button>
                    </div>

                    {mensaje && (
                        <div className={`p-3 mb-4 rounded-lg flex items-start gap-2.5 text-sm font-medium ${mensaje.tipo === 'exito' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                            {mensaje.tipo === 'exito' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                            {mensaje.texto}
                        </div>
                    )}

                    {tipoCarga === 'archivo' && (
                        <div className="space-y-4 animate-in slide-in-from-right-4">
                            {!archivo ? (
                                <div
                                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                                        }`}
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        onChange={handleFileChange}
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,image/*"
                                    />
                                    <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                        <UploadCloud className={`w-8 h-8 ${dragActive ? 'text-blue-600' : 'text-gray-400'}`} />
                                    </div>
                                    <h3 className="font-bold text-gray-800 text-lg mb-1">Haz clic o arrastra un archivo aquí</h3>
                                    <p className="text-gray-500 text-sm">Soporta PDF, Word, Excel, BD, Imágenes, ZIP.</p>
                                    <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-200">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        Tamaño máximo 10 MB
                                    </div>
                                </div>
                            ) : (
                                <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4 overflow-hidden">
                                        <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-100 shrink-0">
                                            {getFileIcon(archivo.type)}
                                        </div>
                                        <div className="truncate">
                                            <p className="font-bold text-gray-800 truncate text-sm">{archivo.name}</p>
                                            <p className="text-xs text-gray-500 font-medium">{formatFileSize(archivo.size)}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setArchivo(null)}
                                        className="ml-3 shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                        title="Eliminar archivo"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {tipoCarga === 'link' && (
                        <div className="space-y-4 animate-in slide-in-from-left-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Enlace de Evidencia</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <LinkIcon className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        type="url"
                                        value={linkTexto}
                                        onChange={(e) => setLinkTexto(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 bg-gray-50 focus:bg-white transition-colors"
                                        placeholder="https://drive.google.com/file/d/..."
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                    Asegúrate de que el enlace sea público o tenga permisos para el Director.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={cargando}
                        className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={cargando || (tipoCarga === 'archivo' && !archivo) || (tipoCarga === 'link' && !linkTexto)}
                        className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20"
                    >
                        {cargando ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <UploadCloud className="w-4 h-4" />
                                Guardar Evidencia
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubirEvidenciaModal;
