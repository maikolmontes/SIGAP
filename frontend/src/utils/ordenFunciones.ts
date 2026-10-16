// Orden en que se presentan las funciones sustantivas del docente (pestañas de la agenda, del avance semanal, etc.):
// Docencia Directa, luego Docencia Indirecta y después las demás en el orden en que llegan de la base
// (el sort es estable: no mueve las que empatan).
const PRIORIDAD_FUNCION: Record<string, number> = { 'Docencia Directa': 0, 'Docencia Indirecta': 1 }

export const ordenarPorFuncion = <T>(lista: T[], nombreDe: (item: T) => string): T[] =>
  [...lista].sort((a, b) => (PRIORIDAD_FUNCION[nombreDe(a)] ?? 2) - (PRIORIDAD_FUNCION[nombreDe(b)] ?? 2))
