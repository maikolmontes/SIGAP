// ================================================================
// Perfil de la agenda según el Acuerdo 030/2024
// ----------------------------------------------------------------
// Una sola regla para todos los tableros (docente, director, consultor):
//   - el total de horas debe coincidir con las horas del contrato;
//   - la docencia indirecta se muestra tal como fue asignada y se
//     compara con el 30 % de la directa, sin reemplazarla.
// Hora Cátedra y "Por Definir" tienen 0 horas de contrato: no hay total
// contra qué comparar (antes se asumían 40 h y siempre salían inconsistentes).
// ================================================================
const { indirectaEsperada } = require('./listadoAgenda');

const PERFIL_CORRECTO = 'AGENDA CORRECTA';
const PERFIL_INCONSISTENTE = 'INCONSISTENCIAS EN AGENDA AC 30';
const PERFIL_SIN_CONTRATO = 'SIN HORAS DE CONTRATO';

const perfilAgenda = (totalHoras, horasContrato) => {
    const contrato = parseFloat(horasContrato) || 0;
    if (contrato <= 0) return PERFIL_SIN_CONTRATO;
    const total = parseFloat(totalHoras) || 0;
    return Math.abs(total - contrato) < 0.01 ? PERFIL_CORRECTO : PERFIL_INCONSISTENTE;
};

/** Docencia indirecta asignada frente a la que exige el 30 % de la directa. */
const revisarIndirecta = (horasDirectas, horasIndirectas) => {
    const esperada = indirectaEsperada(horasDirectas);
    const asignada = parseFloat(horasIndirectas) || 0;
    return { asignada, esperada, cumple: asignada === esperada };
};

module.exports = { perfilAgenda, revisarIndirecta, PERFIL_CORRECTO, PERFIL_INCONSISTENTE, PERFIL_SIN_CONTRATO };
