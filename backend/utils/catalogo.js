// ================================================================
// Catálogo maestro de funciones sustantivas
// ----------------------------------------------------------------
// Las plantillas del catálogo son funciones con estado 'Activo' y sin
// docente asignado. Filtrar SOLO por "sin docente" dejaba entrar restos
// de agendas a las que se les quitó el docente (por ejemplo, las del
// seed de demostración): la agenda tomaba de ahí las actividades de
// Docencia Directa ("Diseño de guías de práctica", meta 16) en lugar
// de las cuatro actividades institucionales.
//
// Planeación administra el catálogo desde "Parámetros generales"
// (controllers/parametrosController.js). Nada se borra: un elemento
// oculto deja de ofrecerse en las agendas nuevas, pero las agendas ya
// creadas conservan su propia copia del texto.
//   - función oculta:   estado_agenda = 'Inactivo'
//   - actividad oculta: asignacion_actividades.activo = FALSE
//   - descripción / indicador ocultos: descripcion.activo / indicadores.activo = FALSE
// ================================================================

/** Condición SQL que identifica una función del catálogo maestro VISIBLE. */
const condicionCatalogo = (alias = 'af') => `${alias}.estado_agenda = 'Activo'
    AND NOT EXISTS (SELECT 1 FROM usuario_asignacion ua_cat WHERE ua_cat.id_funciones = ${alias}.id_funciones)`;

/** Igual, pero incluye las funciones ocultas (para la pantalla de administración). */
const condicionCatalogoAdmin = (alias = 'af') => `${alias}.estado_agenda IN ('Activo', 'Inactivo')
    AND NOT EXISTS (SELECT 1 FROM usuario_asignacion ua_cat WHERE ua_cat.id_funciones = ${alias}.id_funciones)`;

// asignacion_actividades no tenía columna para ocultar. Se agrega una sola vez
// por proceso y solo si falta: el ALTER pide un bloqueo exclusivo de la tabla
// y no conviene hacerlo en cada arranque.
let esquemaListo = null;

const asegurarEsquemaCatalogo = (db) => {
    if (!esquemaListo) {
        const conexion = db || require('../db/connection');
        esquemaListo = (async () => {
            const existe = await conexion.query(`
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'asignacion_actividades' AND column_name = 'activo'
            `);
            if (existe.rows.length === 0) {
                await conexion.query('ALTER TABLE asignacion_actividades ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE');
            }
        })().catch((err) => { esquemaListo = null; throw err; });
    }
    return esquemaListo;
};

// Las actividades se muestran de la A a la Z (sin distinguir tildes ni mayúsculas) y
// "Otro/Cuál" siempre al final: es la salida cuando algo no está en la lista.
const comparador = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

const ordenarActividades = (actividades, nombreDe) =>
    actividades.sort((a, b) => {
        const otroA = /^otro/i.test(String(nombreDe(a)).trim());
        const otroB = /^otro/i.test(String(nombreDe(b)).trim());
        if (otroA !== otroB) return otroA ? 1 : -1;
        return comparador.compare(String(nombreDe(a)), String(nombreDe(b)));
    });

module.exports = { condicionCatalogo, condicionCatalogoAdmin, asegurarEsquemaCatalogo, ordenarActividades };
