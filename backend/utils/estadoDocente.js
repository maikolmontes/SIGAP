// ================================================================
// SIGAP — Estado consolidado de la agenda de un docente
// ----------------------------------------------------------------
// Una sola definición para la analítica: cada docente del período cae en UNA categoría.
// Precedencia: una función devuelta marca toda la agenda; "Aprobada" solo si todas lo están;
// "En revisión" si todas están diligenciadas (Aceptado/Aprobada); "Por aprobar" si alguna función
// sigue con la carga sin liberar al docente (estado 'Por Aprobar'); si no, "Pendiente".
// Sin funciones en el período = "Sin carga".
//
// Entrada (de un GROUP BY por docente): { funciones, alguna_devuelta, todas_aprobadas,
// todas_diligenciadas, alguna_por_aprobar }.
// ================================================================
const ESTADOS_DOCENTE = Object.freeze(['Aprobada', 'En revisión', 'Pendiente', 'Por aprobar', 'Devuelta', 'Sin carga']);

const estadoConsolidado = (d) => {
    if ((Number(d.funciones) || 0) === 0) return 'Sin carga';
    if (d.alguna_devuelta) return 'Devuelta';
    if (d.todas_aprobadas) return 'Aprobada';
    if (d.todas_diligenciadas) return 'En revisión';
    if (d.alguna_por_aprobar) return 'Por aprobar';
    return 'Pendiente';
};

/** Cuántos docentes hay en cada estado, en el orden de ESTADOS_DOCENTE. */
const contarEstados = (filas) => {
    const conteo = Object.fromEntries(ESTADOS_DOCENTE.map((e) => [e, 0]));
    for (const f of filas) conteo[estadoConsolidado(f)] += 1;
    return conteo;
};

module.exports = { ESTADOS_DOCENTE, estadoConsolidado, contarEstados };
