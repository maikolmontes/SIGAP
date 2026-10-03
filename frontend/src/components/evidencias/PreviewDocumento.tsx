import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileArchive, Folder } from 'lucide-react';

type Tipo = 'docx' | 'hoja' | 'zip' | 'texto';

interface Hoja { nombre: string; filas: string[][]; truncada: boolean }
interface EntradaZip { nombre: string; carpeta: boolean }

const MAX_FILAS = 200;
const MAX_COLUMNAS = 30;
const MAX_TEXTO = 200_000;

/**
 * Previsualiza en el navegador los archivos que el <iframe> no sabe mostrar:
 * Word (.docx), Excel/CSV, texto y el contenido de un ZIP. Las librerías se
 * cargan bajo demanda para no engordar el resto de la aplicación.
 *
 * Las hojas de cálculo se pintan como tabla de React (nunca como HTML crudo),
 * así que el contenido de una celda no puede inyectar código en la página.
 */
export default function PreviewDocumento({ url, tipo }: { url: string; tipo: Tipo }) {
    const contenedorDocx = useRef<HTMLDivElement>(null);
    const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
    const [hojas, setHojas] = useState<Hoja[]>([]);
    const [hojaActiva, setHojaActiva] = useState(0);
    const [texto, setTexto] = useState('');
    const [entradas, setEntradas] = useState<EntradaZip[]>([]);

    useEffect(() => {
        let vigente = true;

        const cargar = async () => {
            try {
                const respuesta = await fetch(url);
                if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
                const buffer = await respuesta.arrayBuffer();
                if (!vigente) return;

                if (tipo === 'docx') {
                    const { renderAsync } = await import('docx-preview');
                    if (!vigente || !contenedorDocx.current) return;
                    contenedorDocx.current.innerHTML = '';
                    await renderAsync(buffer, contenedorDocx.current, undefined, {
                        inWrapper: true,
                        ignoreLastRenderedPageBreak: true,
                    });
                } else if (tipo === 'hoja') {
                    const XLSX = await import('xlsx');
                    const libro = XLSX.read(buffer, { type: 'array' });
                    const resultado: Hoja[] = libro.SheetNames.map((nombre) => {
                        const filas = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[nombre], {
                            header: 1, blankrows: false, defval: '',
                        });
                        return {
                            nombre,
                            truncada: filas.length > MAX_FILAS,
                            filas: filas.slice(0, MAX_FILAS).map((f) =>
                                f.slice(0, MAX_COLUMNAS).map((c) => String(c ?? ''))),
                        };
                    });
                    if (!vigente) return;
                    setHojas(resultado);
                } else if (tipo === 'zip') {
                    const JSZip = (await import('jszip')).default;
                    const zip = await JSZip.loadAsync(buffer);
                    if (!vigente) return;
                    setEntradas(Object.values(zip.files).map((f) => ({ nombre: f.name, carpeta: f.dir })));
                } else {
                    const bytes = new Uint8Array(buffer).slice(0, MAX_TEXTO);
                    if (!vigente) return;
                    setTexto(new TextDecoder('utf-8').decode(bytes));
                }

                if (vigente) setEstado('listo');
            } catch (error) {
                console.error('No se pudo previsualizar el archivo:', error);
                if (vigente) setEstado('error');
            }
        };

        cargar();
        return () => { vigente = false; };
    }, [url, tipo]);

    return (
        <div className="relative min-h-[400px]">
            {estado === 'cargando' && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full" />
                </div>
            )}

            {estado === 'error' && (
                <div className="flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
                    <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
                        <AlertTriangle className="w-8 h-8 text-amber-500" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">No se pudo generar la vista previa</h3>
                    <p className="text-gray-500 text-sm max-w-md">
                        El archivo puede estar dañado o protegido. Descárgalo con el botón de arriba para abrirlo
                        en tu equipo.
                    </p>
                </div>
            )}

            {/* Word: docx-preview pinta las páginas dentro de este contenedor */}
            {tipo === 'docx' && (
                <div
                    ref={contenedorDocx}
                    className={`docx-contenedor overflow-auto p-4 ${estado === 'listo' ? '' : 'invisible'}`}
                />
            )}

            {tipo === 'hoja' && estado === 'listo' && (
                <div className="p-4">
                    {hojas.length > 1 && (
                        <div className="flex gap-1 mb-3 flex-wrap">
                            {hojas.map((h, i) => (
                                <button
                                    key={h.nombre}
                                    onClick={() => setHojaActiva(i)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                                        i === hojaActiva
                                            ? 'bg-green-600 text-white border-green-600'
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    {h.nombre}
                                </button>
                            ))}
                        </div>
                    )}
                    {hojas[hojaActiva] && (
                        <>
                            <div className="overflow-auto bg-white rounded-lg border border-gray-200 max-h-[65vh]">
                                <table className="text-xs border-collapse w-full">
                                    <tbody>
                                        {hojas[hojaActiva].filas.map((fila, r) => (
                                            <tr key={r} className={r === 0 ? 'bg-gray-50 font-semibold' : ''}>
                                                {fila.map((celda, c) => (
                                                    <td key={c} className="border border-gray-100 px-2 py-1 whitespace-pre-wrap align-top">
                                                        {celda}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {hojas[hojaActiva].truncada && (
                                <p className="text-xs text-gray-500 mt-2">
                                    Se muestran las primeras {MAX_FILAS} filas. Descarga el archivo para ver todo.
                                </p>
                            )}
                        </>
                    )}
                    {hojas.length === 0 && <p className="text-sm text-gray-500">El archivo no tiene hojas con datos.</p>}
                </div>
            )}

            {tipo === 'texto' && estado === 'listo' && (
                <pre className="p-4 text-xs text-gray-800 whitespace-pre-wrap break-words font-mono">{texto}</pre>
            )}

            {tipo === 'zip' && estado === 'listo' && (
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700">
                        <FileArchive className="w-4 h-4" />
                        Contenido del archivo comprimido ({entradas.filter((e) => !e.carpeta).length} archivos)
                    </div>
                    <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-[60vh] overflow-auto">
                        {entradas.map((e) => (
                            <li key={e.nombre} className="px-3 py-1.5 text-xs text-gray-700 flex items-center gap-2 break-all">
                                {e.carpeta && <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                                {e.nombre}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
