// ================================================================
// Catálogo maestro de funciones sustantivas
// ----------------------------------------------------------------
// Las plantillas del catálogo son funciones con estado 'Activo' y sin
// docente asignado. Filtrar SOLO por "sin docente" dejaba entrar restos
// de agendas a las que se les quitó el docente (por ejemplo, las del
// seed de demostración): la agenda tomaba de ahí las actividades de
// Docencia Directa ("Diseño de guías de práctica", meta 16) en lugar
// de las cuatro actividades institucionales.
// ================================================================

/** Condición SQL que identifica una función del catálogo maestro. */
const condicionCatalogo = (alias = 'af') => `${alias}.estado_agenda = 'Activo'
    AND NOT EXISTS (SELECT 1 FROM usuario_asignacion ua_cat WHERE ua_cat.id_funciones = ${alias}.id_funciones)`;

module.exports = { condicionCatalogo };
