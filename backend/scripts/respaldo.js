/**
 * SIGAP — Respaldo de la base de datos y de los archivos de evidencias.
 *
 * Uso:   cd backend && npm run respaldo
 *
 * Qué hace:
 *   1. Vuelca la base con pg_dump (formato personalizado, comprimido) a
 *      backend/backups/db/sigap_<fecha>.dump y comprueba que el volcado se
 *      pueda leer con pg_restore --list.
 *   2. Copia a backend/backups/uploads/ los archivos de uploads/ que aún no
 *      están respaldados (incremental: no vuelve a copiar lo ya guardado).
 *   3. Conserva solo los últimos RESPALDOS_CONSERVAR volcados (14 por defecto).
 *
 * pg_dump se busca en: PG_DUMP_PATH, el PATH y las carpetas de instalación
 * habituales de PostgreSQL en Windows/Linux.
 *
 * Restaurar:  pg_restore --clean --if-exists -d <base> backups/db/<archivo>.dump
 *
 * IMPORTANTE: backups/ vive en el mismo equipo que el sistema. Para protegerse de
 * la pérdida del equipo, copia periódicamente esa carpeta a otro disco o a la nube.
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const RAIZ = path.resolve(__dirname, '..');
const DIR_DB = path.join(RAIZ, 'backups', 'db');
const DIR_UPLOADS_RESPALDO = path.join(RAIZ, 'backups', 'uploads');
const DIR_UPLOADS = path.join(RAIZ, 'uploads');
const CONSERVAR = Math.max(1, parseInt(process.env.RESPALDOS_CONSERVAR || '14', 10));

const nombreEjecutable = (base) => (process.platform === 'win32' ? `${base}.exe` : base);

// Devuelve la ruta de una herramienta de PostgreSQL (pg_dump, pg_restore) o null
const buscarHerramienta = (base) => {
    const exe = nombreEjecutable(base);

    if (base === 'pg_dump' && process.env.PG_DUMP_PATH && fs.existsSync(process.env.PG_DUMP_PATH)) {
        return process.env.PG_DUMP_PATH;
    }

    const enPath = spawnSync(exe, ['--version'], { encoding: 'utf8' });
    if (!enPath.error && enPath.status === 0) return exe;

    const candidatas = [];
    for (const raiz of ['C:\\Program Files\\PostgreSQL', 'C:\\Program Files (x86)\\PostgreSQL', '/usr/lib/postgresql']) {
        if (!fs.existsSync(raiz)) continue;
        const versiones = fs.readdirSync(raiz).sort((a, b) => parseInt(b, 10) - parseInt(a, 10)); // la más nueva primero
        for (const v of versiones) candidatas.push(path.join(raiz, v, 'bin', exe));
    }
    return candidatas.find((c) => fs.existsSync(c)) || null;
};

const marcaDeFecha = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const respaldarBase = () => {
    const pgDump = buscarHerramienta('pg_dump');
    if (!pgDump) {
        throw new Error('No se encontró pg_dump. Instala las herramientas de PostgreSQL o define PG_DUMP_PATH en el .env.');
    }

    fs.mkdirSync(DIR_DB, { recursive: true });
    const archivo = path.join(DIR_DB, `sigap_${marcaDeFecha()}.dump`);

    const resultado = spawnSync(pgDump, [
        '--format=custom',
        '--no-owner',
        '--host', process.env.DB_HOST || 'localhost',
        '--port', String(process.env.DB_PORT || 5432),
        '--username', process.env.DB_USER,
        '--file', archivo,
        process.env.DB_NAME,
    ], {
        encoding: 'utf8',
        env: { ...process.env, PGPASSWORD: String(process.env.DB_PASSWORD ?? '') },
    });

    if (resultado.error || resultado.status !== 0) {
        if (fs.existsSync(archivo)) fs.unlinkSync(archivo); // no dejar un volcado a medias
        throw new Error(`pg_dump falló: ${resultado.error ? resultado.error.message : resultado.stderr}`.trim());
    }

    // Comprobar que el volcado se pueda leer (un respaldo que no se puede restaurar no sirve)
    const pgRestore = buscarHerramienta('pg_restore');
    if (pgRestore) {
        const lectura = spawnSync(pgRestore, ['--list', archivo], { encoding: 'utf8' });
        if (lectura.status !== 0) {
            fs.unlinkSync(archivo);
            throw new Error(`El volcado generado no es legible: ${lectura.stderr}`.trim());
        }
    }

    return { archivo, kb: Math.round(fs.statSync(archivo).size / 1024) };
};

// Copia incremental: solo lo que todavía no está en el respaldo
const respaldarArchivos = () => {
    if (!fs.existsSync(DIR_UPLOADS)) return { copiados: 0, total: 0 };
    fs.mkdirSync(DIR_UPLOADS_RESPALDO, { recursive: true });

    let copiados = 0;
    let total = 0;
    const recorrer = (origen, destino) => {
        fs.mkdirSync(destino, { recursive: true });
        for (const entrada of fs.readdirSync(origen, { withFileTypes: true })) {
            const desde = path.join(origen, entrada.name);
            const hasta = path.join(destino, entrada.name);
            if (entrada.isDirectory()) {
                recorrer(desde, hasta);
            } else {
                total++;
                if (!fs.existsSync(hasta)) {
                    fs.copyFileSync(desde, hasta);
                    copiados++;
                }
            }
        }
    };
    recorrer(DIR_UPLOADS, DIR_UPLOADS_RESPALDO);
    return { copiados, total };
};

// Deja solo los últimos N volcados de la base
const limpiarAntiguos = () => {
    const volcados = fs.readdirSync(DIR_DB)
        .filter((f) => f.startsWith('sigap_') && f.endsWith('.dump'))
        .sort(); // el nombre lleva la fecha: el orden alfabético es cronológico
    const sobrantes = volcados.slice(0, Math.max(0, volcados.length - CONSERVAR));
    sobrantes.forEach((f) => fs.unlinkSync(path.join(DIR_DB, f)));
    return sobrantes.length;
};

const ejecutar = () => {
    const base = respaldarBase();
    console.log(`[respaldo] Base de datos: ${path.relative(RAIZ, base.archivo)} (${base.kb} KB)`);

    const archivos = respaldarArchivos();
    console.log(`[respaldo] Evidencias: ${archivos.copiados} archivo(s) nuevo(s) copiados de ${archivos.total}`);

    const eliminados = limpiarAntiguos();
    if (eliminados > 0) console.log(`[respaldo] Se eliminaron ${eliminados} respaldo(s) antiguo(s) (se conservan ${CONSERVAR}).`);

    return { base, archivos, eliminados };
};

if (require.main === module) {
    try {
        ejecutar();
    } catch (error) {
        console.error('[respaldo] ERROR:', error.message);
        process.exitCode = 1;
    }
}

module.exports = { ejecutar, buscarHerramienta };
