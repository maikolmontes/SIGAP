// Clasifica una evidencia para decidir cómo previsualizarla. Se mira primero la
// extensión del nombre original (más fiable que el mimetype, que varía según el
// navegador y el sistema operativo) y después el mimetype.
export type TipoPreview = 'pdf' | 'imagen' | 'docx' | 'hoja' | 'zip' | 'texto' | 'enlace' | 'otro';

const EXT_IMAGEN = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
const EXT_HOJA = ['xlsx', 'xls', 'csv'];
const EXT_TEXTO = ['txt', 'md', 'json', 'log'];

export const extensionDe = (nombre = ''): string => {
    const i = nombre.lastIndexOf('.');
    return i >= 0 ? nombre.slice(i + 1).toLowerCase() : '';
};

export const tipoPreview = (nombre: string, mime: string): TipoPreview => {
    if (mime === 'enlace') return 'enlace';

    const ext = extensionDe(nombre);
    const m = (mime || '').toLowerCase();

    if (ext === 'pdf' || m.includes('pdf')) return 'pdf';
    if (EXT_IMAGEN.includes(ext) || m.startsWith('image/')) return 'imagen';
    // .doc (binario antiguo) no se puede leer en el navegador: solo .docx
    if (ext === 'docx') return 'docx';
    if (EXT_HOJA.includes(ext)) return 'hoja';
    if (ext === 'zip' || m.includes('zip')) return 'zip';
    if (EXT_TEXTO.includes(ext) || m.startsWith('text/')) return 'texto';
    return 'otro';
};

export const etiquetaTipo = (nombre: string, mime: string): string => {
    const tipo = tipoPreview(nombre, mime);
    const ext = extensionDe(nombre);
    switch (tipo) {
        case 'enlace': return 'Enlace';
        case 'pdf': return 'PDF';
        case 'imagen': return 'Imagen';
        case 'docx': return 'Documento de Word';
        case 'hoja': return 'Hoja de cálculo';
        case 'zip': return 'Archivo comprimido';
        case 'texto': return 'Texto';
        default:
            if (ext === 'doc') return 'Documento de Word';
            if (ext === 'ppt' || ext === 'pptx') return 'Presentación';
            if (ext === 'rar') return 'Archivo comprimido';
            return 'Archivo';
    }
};
