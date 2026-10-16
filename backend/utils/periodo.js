// ================================================================
// SIGAP — Cómo se nombra un período académico
// ----------------------------------------------------------------
// periodo.semestre es un número:
//   1 = I (primer semestre)            2 = II (segundo semestre)
//   3 = Intersemestral I               4 = Intersemestral II
// Los intersemestrales trabajan igual que un semestre: sus dos cortes de avance
// también son la Semana 8 y la Semana 16 (así se guardan y se muestran).
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

/** Cómo se llama un corte en pantalla: "Semana 8" / "Semana 16", también en los intersemestrales. El semestre se recibe por compatibilidad. */
// eslint-disable-next-line no-unused-vars
const etiquetaCorte = (corte, semestre) => `Semana ${corte}`;

module.exports = { SEMESTRES, semestreValido, esIntersemestral, etiquetaSemestre, etiquetaPeriodo, etiquetaCorte };
