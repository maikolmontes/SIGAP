// ================================================================
// SIGAP — Contrato del docente POR PERÍODO
// ----------------------------------------------------------------
// Un docente puede ser Medio Tiempo en un semestre y Tiempo Completo en el siguiente, así que el
// contrato que cuenta para las horas, las agendas y los reportes es el de CADA período:
//   docente_periodo.id_contrato / docente_periodo.horas_contrato
// El contrato de usuarios.id_contrato es el "por defecto": se copia al vincular al docente a un período
// (trigger de la base) y es el respaldo si el período no tiene uno propio (COALESCE).
//
// Reglas de las horas contratadas:
//   · Tiempo Completo y Medio Tiempo: las de tipo_contrato (40 y 20).
//   · Hora Cátedra: las fija el Director, de 0 a 40 en pasos de 0,5 (0 = sin parámetro contractual).
//   · Por Definir: 0 (sin parámetro contractual).
// Con 0 horas no se compara contra la carga (toda división usa NULLIF); con más de 0 las horas
// asignadas deben coincidir exactas para aprobar las asignaciones.
// ================================================================
const pool = require('../db/connection');

const HORAS_MAXIMAS_CATEDRA = 40;
const PASO_HORAS = 0.5;

const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** ¿El Director fija las horas de este tipo de contrato? (solo Hora Cátedra) */
const horasLibres = (nombreTipo) => normalizar(nombreTipo) === 'hora catedra';

/**
 * Horas contratadas que quedan para un tipo de contrato.
 * @param tipo       { tipo, horas_contrato } de tipo_contrato
 * @param horasPedidas lo que envió el cliente (solo cuenta para Hora Cátedra)
 * @returns { ok: true, horas } | { ok: false, error }
 */
const resolverHorasContrato = (tipo, horasPedidas) => {
    if (!horasLibres(tipo?.tipo)) return { ok: true, horas: Number(tipo?.horas_contrato) || 0 };

    if (horasPedidas === undefined || horasPedidas === null || horasPedidas === '') {
        return { ok: false, error: 'Indica las horas contratadas de Hora Cátedra (de 0 a 40).' };
    }
    const horas = Number(String(horasPedidas).replace(',', '.'));
    if (!Number.isFinite(horas)) return { ok: false, error: 'Las horas contratadas deben ser un número.' };
    if (horas < 0 || horas > HORAS_MAXIMAS_CATEDRA) return { ok: false, error: `Las horas de Hora Cátedra van de 0 a ${HORAS_MAXIMAS_CATEDRA}.` };
    if (Math.abs(horas / PASO_HORAS - Math.round(horas / PASO_HORAS)) > 1e-9) return { ok: false, error: 'Las horas se registran de media en media hora (por ejemplo 12 o 12,5).' };
    return { ok: true, horas };
};

// ---------------------------------------------------------------- SQL compartido
/**
 * Une el contrato del PERÍODO de cada docente. `periodo` es la expresión SQL con el id del período
 * (por ejemplo '$1' o 'per.id_periodo'). Deja disponibles los alias `dp` (docente_periodo) y `tc`
 * (tipo_contrato) y usa el contrato propio del período o, si no tiene, el del perfil.
 */
const joinContratoPeriodo = ({ periodo, u = 'u', dp = 'dpc', tc = 'tc', tipoJoin = 'JOIN' }) =>
    `LEFT JOIN docente_periodo ${dp} ON ${dp}.id_usuario = ${u}.id_usuario AND ${dp}.id_periodo = ${periodo}
            ${tipoJoin} tipo_contrato ${tc} ON ${tc}.id_contrato = COALESCE(${dp}.id_contrato, ${u}.id_contrato)`;

/** Horas contratadas del período (las propias del período o, si no tiene, las del tipo de contrato). */
const horasContratoSql = (dp = 'dpc', tc = 'tc') => `COALESCE(${dp}.horas_contrato, ${tc}.horas_contrato)`;

// ---------------------------------------------------------------- Esquema (idempotente)
// El mismo cambio está en database/docente_periodo_contrato.sql. Se aplica solo la primera vez que arranca el servidor.
let lista = null;

const crearEsquema = async (db) => {
    await db.query('ALTER TABLE docente_periodo ADD COLUMN IF NOT EXISTS id_contrato INTEGER REFERENCES tipo_contrato(id_contrato)');
    await db.query('ALTER TABLE docente_periodo ADD COLUMN IF NOT EXISTS horas_contrato NUMERIC(5,1)');

    await db.query(`
        CREATE TABLE IF NOT EXISTS contrato_periodo_log (
            id_log            SERIAL PRIMARY KEY,
            id_periodo        INTEGER NOT NULL REFERENCES periodo(id_periodo),
            id_usuario        INTEGER NOT NULL REFERENCES usuarios(id_usuario),
            id_contrato_antes INTEGER REFERENCES tipo_contrato(id_contrato),
            horas_antes       NUMERIC(5,1),
            id_contrato_nuevo INTEGER REFERENCES tipo_contrato(id_contrato),
            horas_nuevas      NUMERIC(5,1),
            cambiado_por      INTEGER REFERENCES usuarios(id_usuario),
            cambiado_en       TIMESTAMP NOT NULL DEFAULT NOW()
        )`);

    // Cada vínculo nuevo copia el contrato del perfil (sirve para todos los puntos donde se vincula un docente)
    await db.query(`
        CREATE OR REPLACE FUNCTION docente_periodo_copiar_contrato() RETURNS trigger AS $f$
        BEGIN
            IF NEW.id_contrato IS NULL THEN
                SELECT u.id_contrato, tc.horas_contrato INTO NEW.id_contrato, NEW.horas_contrato
                FROM usuarios u LEFT JOIN tipo_contrato tc ON tc.id_contrato = u.id_contrato
                WHERE u.id_usuario = NEW.id_usuario;
            END IF;
            RETURN NEW;
        END;
        $f$ LANGUAGE plpgsql`);
    await db.query(`
        DO $d$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_docente_periodo_contrato' AND tgrelid = 'docente_periodo'::regclass) THEN
                CREATE TRIGGER trg_docente_periodo_contrato BEFORE INSERT ON docente_periodo
                FOR EACH ROW EXECUTE FUNCTION docente_periodo_copiar_contrato();
            END IF;
        END $d$`);

    // Períodos que ya existían: conservan el contrato actual de cada docente
    await db.query(`
        UPDATE docente_periodo dp
        SET id_contrato = u.id_contrato, horas_contrato = tc.horas_contrato
        FROM usuarios u
        LEFT JOIN tipo_contrato tc ON tc.id_contrato = u.id_contrato
        WHERE dp.id_usuario = u.id_usuario AND dp.id_contrato IS NULL`);
};

// ¿Ya está todo? (consulta barata: es lo que corre en cada arranque una vez creado el esquema)
const esquemaCompleto = async (db) => {
    const r = await db.query(`
        SELECT
            (SELECT COUNT(*) FROM information_schema.columns
              WHERE table_name = 'docente_periodo' AND column_name IN ('id_contrato', 'horas_contrato')) = 2 AS columnas,
            to_regclass('contrato_periodo_log') IS NOT NULL AS bitacora,
            EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_docente_periodo_contrato' AND tgrelid = 'docente_periodo'::regclass) AS disparador`);
    const f = r.rows[0];
    if (!(f.columnas && f.bitacora && f.disparador)) return false;
    // Con todo creado, solo falta que ningún vínculo se haya quedado sin contrato (la columna ya existe, así que se puede mirar)
    const sinContrato = await db.query('SELECT 1 FROM docente_periodo WHERE id_contrato IS NULL LIMIT 1');
    return sinContrato.rows.length === 0;
};

// Varias instancias pueden arrancar a la vez (Vercel): un candado en la base hace que solo una cree el esquema
const CANDADO_ESQUEMA = 727001;

const aplicarEsquema = async (db) => {
    if (await esquemaCompleto(db)) return;
    const cliente = typeof db.connect === 'function' ? await db.connect() : db;
    try {
        await cliente.query('SELECT pg_advisory_lock($1)', [CANDADO_ESQUEMA]);
        try {
            if (!(await esquemaCompleto(cliente))) await crearEsquema(cliente);
        } finally {
            await cliente.query('SELECT pg_advisory_unlock($1)', [CANDADO_ESQUEMA]);
        }
    } finally {
        if (cliente !== db) cliente.release();
    }
};

/** Asegura el esquema una sola vez por proceso; si falla, lo reintenta en la siguiente petición. */
const asegurarContratoPeriodo = (db = pool) => {
    if (!lista) {
        lista = aplicarEsquema(db).catch((error) => {
            lista = null;
            throw error;
        });
    }
    return lista;
};

/** Middleware: las rutas de la API esperan a que el esquema esté listo (solo cuesta la primera vez). */
const esperarEsquemaContrato = async (req, res, next) => {
    try {
        await asegurarContratoPeriodo();
        next();
    } catch (error) {
        console.error('[contrato por período] no se pudo preparar el esquema:', error.message);
        res.status(500).json({ error: 'No se pudo preparar la base de datos. Intenta de nuevo en un momento.' });
    }
};

module.exports = {
    HORAS_MAXIMAS_CATEDRA, PASO_HORAS,
    horasLibres, resolverHorasContrato,
    joinContratoPeriodo, horasContratoSql,
    asegurarContratoPeriodo, esperarEsquemaContrato,
};
