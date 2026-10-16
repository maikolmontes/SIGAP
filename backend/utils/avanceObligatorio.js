// Avance semanal obligatorio: para guardar el avance de un corte (semana 8 o 16) el docente debe registrar un valor
// MAYOR QUE 0 en todos sus indicadores (basta 0,1). Solo hay una excepción: en la semana 8, el indicador
// "Evidencia de entrega de notas finales" de Docencia Directa puede quedar en 0 (las notas finales se entregan al cierre).
//
// Función pura: la usa agendaController al guardar y se prueba sin base de datos. El frontend aplica la misma regla
// (frontend/src/utils/avanceSemana.ts) para avisar antes de enviar; el servidor es quien manda.

const INDICADOR_EXENTO_SEMANA_8 = 'evidencia de entrega de notas finales';

const normalizar = (texto) => String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const aNumero = (valor) => {
    const n = parseFloat(valor);
    return Number.isNaN(n) || n < 0 ? 0 : n;
};

/** ¿Este indicador puede quedar en 0 en este corte? */
const puedeQuedarEnCero = (nombreIndicador, corte) =>
    Number(corte) === 8 && normalizar(nombreIndicador) === INDICADOR_EXENTO_SEMANA_8;

/**
 * Indicadores a los que todavía les falta el avance del corte.
 * Cada indicador trae: { nombre_indicador, meta, ejecucion_8, ejecucion_16 } con los valores que quedarían guardados.
 *  - Sin meta no hay nada que completar.
 *  - En la semana 16, si en la 8 ya se cumplió la meta no queda nada por registrar (el tope de la 16 es la meta menos lo de la 8).
 */
const indicadoresSinAvance = (indicadores, corte) =>
    (indicadores || []).filter((i) => {
        const meta = aNumero(i.meta);
        if (meta <= 0) return false;
        if (puedeQuedarEnCero(i.nombre_indicador, corte)) return false;
        if (Number(corte) === 8) return aNumero(i.ejecucion_8) <= 0;
        if (meta - aNumero(i.ejecucion_8) <= 0) return false;
        return aNumero(i.ejecucion_16) <= 0;
    });

// ---------------------------------------------------------------------------------------------
// Fragmentos SQL para la revisión del director
// ---------------------------------------------------------------------------------------------

/**
 * ¿La función quedó COMPLETA en la semana 8? (tiene indicadores con meta y todos ya la cumplieron).
 * Si es así, en la semana 16 el docente no tiene nada más que registrar, pero el director sí debe poder revisarla:
 * por eso cuenta como "reportable" en el corte 16 aunque su ejecución de la 16 sea 0.
 * idFuncionesSql: expresión SQL con el id de la función (por ejemplo 'af.id_funciones' o '$1').
 */
const sqlFuncionCompletaEnSemana8 = (idFuncionesSql) => `(
    EXISTS (
        SELECT 1 FROM asignacion_actividades aa2
        JOIN descripcion d2 ON d2.id_asignacionact = aa2.id_asignacionact AND d2.activo IS NOT FALSE
        JOIN indicadores i2 ON i2.id_descripcion = d2.id_descripcion AND i2.activo IS NOT FALSE
        WHERE aa2.id_funciones = ${idFuncionesSql} AND COALESCE(d2.meta, 0) > 0)
    AND NOT EXISTS (
        SELECT 1 FROM asignacion_actividades aa3
        JOIN descripcion d3 ON d3.id_asignacionact = aa3.id_asignacionact AND d3.activo IS NOT FALSE
        JOIN indicadores i3 ON i3.id_descripcion = d3.id_descripcion AND i3.activo IS NOT FALSE
        WHERE aa3.id_funciones = ${idFuncionesSql} AND COALESCE(d3.meta, 0) > 0 AND COALESCE(i3.ejecucion_8, 0) < d3.meta)
)`;

/** Condición SQL: este indicador es el que puede quedar en 0 en la semana 8 (alias del indicador en "alias"). */
const sqlIndicadorExento = (alias = 'i') => `LOWER(BTRIM(${alias}.nombre_indicador)) = '${INDICADOR_EXENTO_SEMANA_8}'`;

module.exports = { indicadoresSinAvance, puedeQuedarEnCero, INDICADOR_EXENTO_SEMANA_8, sqlFuncionCompletaEnSemana8, sqlIndicadorExento };
