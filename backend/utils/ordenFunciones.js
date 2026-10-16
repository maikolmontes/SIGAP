// Orden en que se presentan las funciones sustantivas: Docencia Directa, luego Docencia Indirecta y después
// las demás en el orden en que llegan (el sort es estable). Es el mismo orden de la agenda del docente
// (frontend/src/utils/ordenFunciones.ts).
const PRIORIDAD_FUNCION = { 'Docencia Directa': 0, 'Docencia Indirecta': 1 };

const ordenarPorFuncion = (lista, nombreDe) =>
    [...lista].sort((a, b) => (PRIORIDAD_FUNCION[nombreDe(a)] ?? 2) - (PRIORIDAD_FUNCION[nombreDe(b)] ?? 2));

module.exports = { ordenarPorFuncion };
