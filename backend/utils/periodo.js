// ================================================================
// SIGAP — Cómo se nombra un período académico
// ----------------------------------------------------------------
// periodo.semestre es un número:
//   1 = I (primer semestre)            2 = II (segundo semestre)
//   3 = Intersemestral I               4 = Intersemestral II
// Los intersemestrales trabajan igual que un semestre, pero no se sabe aún en
// qué semanas caen los dos cortes de avance (la 8 y la 16 de un semestre
// normal). Internamente siguen siendo "corte 8" y "corte 16" (así se guardan
// las revisiones y evidencias); solo cambia cómo se muestran: "Semana X".
// ================================================================

const SEMESTRES = {
    1: { romano: 'I', nombre: 'Primer semestre' },
    2: { romano: 'II', nombre: 'Segundo semestre' },
    3: { romano: 'Intersemestral I', nombre: 'Intersemestral I' },
    4: { romano: 'Intersemestral II', nombre: 'Intersemestral II' },
};

const semestreValido = (semestre) => Object.prototype.hasOwnProperty.call(SEMESTRES, Number(semestre));

const esIntersemestral = (semestre) => Number(semestre) >= 3;

/** "I", "II", "Intersemestral I" o "Intersemestral II". */
const etiquetaSemestre = (semestre) => (SEMESTRES[Number(semestre)] ? SEMESTRES[Number(semestre)].romano : String(semestre ?? ''));

/** "2026-I", "2026-Intersemestral II"… (null si no hay período). */
const etiquetaPeriodo = (periodo) => (periodo ? `${periodo.anio}-${etiquetaSemestre(periodo.semestre)}` : null);

/** Cómo se llama un corte en pantalla: "Semana 8" / "Semana 16", o "Semana X" en los intersemestrales. */
const etiquetaCorte = (corte, semestre) => {
    if (!esIntersemestral(semestre)) return `Semana ${corte}`;
    return Number(corte) === 16 ? 'Semana X (final)' : 'Semana X';
};

module.exports = { SEMESTRES, semestreValido, esIntersemestral, etiquetaSemestre, etiquetaPeriodo, etiquetaCorte };
