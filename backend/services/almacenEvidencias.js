// ================================================================
// SIGAP — Dónde se guardan los archivos de las evidencias
// ----------------------------------------------------------------
//  · Con un almacén de Vercel Blob conectado (producción): Vercel Blob, en un almacén
//    PRIVADO. Nadie llega al archivo por su URL: se lee desde el servidor, después
//    de comprobar el token y el permiso (servirArchivo). Basta con BLOB_STORE_ID
//    (la librería se autentica sola con OIDC dentro de Vercel) o con
//    BLOB_READ_WRITE_TOKEN.
//  · Sin almacén y fuera de Vercel (desarrollo local): carpeta backend/uploads/evidencias.
//  · Sin almacén dentro de Vercel: se avisa con claridad. El disco de una función de
//    Vercel es de solo lectura (y se borra), así que guardar ahí no sirve.
//
// En la base solo se guarda la ruta pública /uploads/evidencias/<nombre>, igual en los
// tres casos, de modo que el frontend y los permisos no cambian.
// ================================================================
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const vercelBlob = require('@vercel/blob');

const CARPETA_POR_DEFECTO = path.join(__dirname, '..', 'uploads', 'evidencias');
let carpeta = CARPETA_POR_DEFECTO;
let blob = vercelBlob; // sustituible en las pruebas

class AlmacenNoConfigurado extends Error {
    constructor() {
        super('El almacenamiento de archivos no está configurado en el servidor.');
        this.name = 'AlmacenNoConfigurado';
    }
}

const usaBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const enVercel = () => Boolean(process.env.VERCEL);
const clave = (nombre) => `evidencias/${path.basename(nombre)}`;
const rutaEnDisco = (nombre) => path.join(carpeta, path.basename(nombre));

/** Dónde se guardaría un archivo nuevo ahora mismo: 'blob', 'disco' o 'no_configurado'. */
const modo = () => (usaBlob() ? 'blob' : enVercel() ? 'no_configurado' : 'disco');

/** Guarda el contenido de un archivo con el nombre indicado. Lanza AlmacenNoConfigurado si no hay dónde. */
const guardar = async ({ buffer, nombre, tipo }) => {
    const donde = modo();
    if (donde === 'no_configurado') throw new AlmacenNoConfigurado();

    if (donde === 'blob') {
        try {
            await blob.put(clave(nombre), buffer, {
                access: 'private',
                contentType: tipo || 'application/octet-stream',
                addRandomSuffix: false,
                allowOverwrite: false,
            });
        } catch (error) {
            // Sin credenciales utilizables el problema es de configuración, no del archivo
            if (/No blob credentials|store.*not found|access denied/i.test(error?.message || '')) throw new AlmacenNoConfigurado();
            throw error;
        }
        return;
    }
    await fs.promises.mkdir(carpeta, { recursive: true });
    await fs.promises.writeFile(rutaEnDisco(nombre), buffer, { flag: 'wx' });
};

/**
 * Abre un archivo guardado para enviarlo. Devuelve { stream, tipo, tamano } o null si no existe.
 * Con Blob configurado busca primero allí; si no está, prueba el disco (archivos anteriores).
 */
const abrir = async (nombre) => {
    if (usaBlob()) {
        try {
            const r = await blob.get(clave(nombre), { access: 'private' });
            if (r && r.statusCode === 200 && r.stream) {
                return { stream: Readable.fromWeb(r.stream), tipo: r.blob?.contentType || null, tamano: r.blob?.size ?? null };
            }
        } catch (error) {
            if (error?.name !== 'BlobNotFoundError') throw error;
        }
    }
    const archivo = rutaEnDisco(nombre);
    if (fs.existsSync(archivo)) {
        return { stream: fs.createReadStream(archivo), tipo: null, tamano: fs.statSync(archivo).size };
    }
    return null;
};

/** Borra un archivo guardado. Nunca lanza: si ya no estaba, no pasa nada. */
const eliminar = async (nombre) => {
    try {
        if (usaBlob()) await blob.del(clave(nombre));
    } catch (error) {
        if (error?.name !== 'BlobNotFoundError') console.warn('[evidencias] No se pudo borrar el archivo del almacén:', error.message);
    }
    try {
        const archivo = rutaEnDisco(nombre);
        if (fs.existsSync(archivo)) fs.unlinkSync(archivo);
    } catch { /* sin acción */ }
};

module.exports = {
    guardar,
    abrir,
    eliminar,
    modo,
    AlmacenNoConfigurado,
    CARPETA_EVIDENCIAS: CARPETA_POR_DEFECTO,
    // Solo para pruebas
    _pruebas: {
        fijarBlob: (b) => { blob = b || vercelBlob; },
        fijarCarpeta: (c) => { carpeta = c || CARPETA_POR_DEFECTO; },
    },
};
