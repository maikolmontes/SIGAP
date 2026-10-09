// Cómo se nombra un período académico (misma regla que backend/utils/periodo.js).
//   semestre 1 = I · 2 = II · 3 = Intersemestral I · 4 = Intersemestral II
// Los intersemestrales aún no tienen definidas las semanas de sus dos cortes de
// avance: internamente siguen siendo el corte 8 y el 16, pero se muestran "Semana X".

export interface PeriodoBasico {
    anio?: number | string
    semestre?: number | string | null
}

export const SEMESTRES: { valor: number; romano: string; nombre: string }[] = [
    { valor: 1, romano: 'I', nombre: 'Primer semestre' },
    { valor: 2, romano: 'II', nombre: 'Segundo semestre' },
    { valor: 3, romano: 'Inter I', nombre: 'Intersemestral I' },
    { valor: 4, romano: 'Inter II', nombre: 'Intersemestral II' },
]

export const esIntersemestral = (semestre?: number | string | null): boolean => Number(semestre) >= 3

/** "I", "II", "Inter I" o "Inter II". */
export const etiquetaSemestre = (semestre?: number | string | null): string =>
    SEMESTRES.find(s => s.valor === Number(semestre))?.romano ?? String(semestre ?? '')

/** Variante de los tableros de Planeación: "IP", "IIP", "Inter I", "Inter II". */
export const etiquetaSemestreP = (semestre?: number | string | null): string =>
    esIntersemestral(semestre) ? etiquetaSemestre(semestre) : `${etiquetaSemestre(semestre)}P`

/** "2026-I", "2026-Inter II"… */
export const etiquetaPeriodo = (p?: PeriodoBasico | null): string =>
    p ? `${p.anio}-${etiquetaSemestre(p.semestre)}` : ''

/** "Semana 8" / "Semana 16"; en un intersemestral "Semana X" / "Semana X (final)". */
export const etiquetaCorte = (corte: number | string, semestre?: number | string | null): string => {
    if (!esIntersemestral(semestre)) return `Semana ${corte}`
    return Number(corte) === 16 ? 'Semana X (final)' : 'Semana X'
}

/** "Semestre I", "Semestre II", "Intersemestral I", "Intersemestral II". */
export const etiquetaSemestreLarga = (semestre?: number | string | null): string =>
    esIntersemestral(semestre)
        ? (SEMESTRES.find(s => s.valor === Number(semestre))?.nombre ?? '')
        : `Semestre ${etiquetaSemestre(semestre)}`

/** Cambia "Semana 8" / "Semana 16" (o "Sem 8" / "Sem 16") de un texto por "X" / "X (final)" si el período es intersemestral. */
export const rotularCortes = (texto: string, semestre?: number | string | null): string =>
    esIntersemestral(semestre)
        ? texto.replace(/\b(Semana|Sem|semana) 16\b/g, '$1 X (final)').replace(/\b(Semana|Sem|semana) 8\b/g, '$1 X')
        : texto
