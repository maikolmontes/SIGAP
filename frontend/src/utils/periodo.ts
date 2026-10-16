// Cómo se nombra un período académico (misma regla que backend/utils/periodo.js).
//   semestre 1 = I · 2 = II · 3 = Intersemestral I · 4 = Intersemestral II
// Los intersemestrales tienen los mismos dos cortes de avance que un semestre: Semana 8 y Semana 16.

export interface PeriodoBasico {
    anio?: number | string
    semestre?: number | string | null
}

export const SEMESTRES: { valor: number; romano: string; nombre: string }[] = [
    { valor: 1, romano: 'I', nombre: 'Primer semestre' },
    { valor: 2, romano: 'II', nombre: 'Segundo semestre' },
    { valor: 3, romano: 'Intersemestral I', nombre: 'Intersemestral I' },
    { valor: 4, romano: 'Intersemestral II', nombre: 'Intersemestral II' },
]

export const esIntersemestral = (semestre?: number | string | null): boolean => Number(semestre) >= 3

/** "I", "II", "Intersemestral I" o "Intersemestral II". */
export const etiquetaSemestre = (semestre?: number | string | null): string =>
    SEMESTRES.find(s => s.valor === Number(semestre))?.romano ?? String(semestre ?? '')

/** Variante de los tableros de Planeación: "IP", "IIP", "Intersemestral I", "Intersemestral II". */
export const etiquetaSemestreP = (semestre?: number | string | null): string =>
    esIntersemestral(semestre) ? etiquetaSemestre(semestre) : `${etiquetaSemestre(semestre)}P`

/** "2026-I", "2026-Intersemestral II"… */
export const etiquetaPeriodo = (p?: PeriodoBasico | null): string =>
    p ? `${p.anio}-${etiquetaSemestre(p.semestre)}` : ''

/** "Semana 8" / "Semana 16", también en un intersemestral. El semestre se recibe por compatibilidad. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const etiquetaCorte = (corte: number | string, _semestre?: number | string | null): string => `Semana ${corte}`

/** "Semestre I", "Semestre II", "Intersemestral I", "Intersemestral II". */
export const etiquetaSemestreLarga = (semestre?: number | string | null): string =>
    esIntersemestral(semestre)
        ? (SEMESTRES.find(s => s.valor === Number(semestre))?.nombre ?? '')
        : `Semestre ${etiquetaSemestre(semestre)}`

/** Antes cambiaba "Semana 8/16" por "Semana X" en los intersemestrales; ya no: los cortes se llaman igual en todos los períodos. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const rotularCortes = (texto: string, _semestre?: number | string | null): string => texto
