// ================================================================
// SIGAP — Catálogo de Analítica
// ----------------------------------------------------------------
// Diccionario de control de la capa analítica: qué indicadores
// existen, qué miden, con qué unidad y quién puede consultarlos.
//
// Es la única fuente de verdad sobre los metadatos de los
// indicadores. El controlador consulta este catálogo y jamás define
// títulos o descripciones por su cuenta.
//
// REGLA: aquí no se definen colores ni estilos. La presentación es
// responsabilidad exclusiva del frontend.
// ================================================================

// ----------------------------------------------------------------
// Estados canónicos de una agenda docente.
// Nota de auditoría (Fase 0): en la base existe además el valor
// 'Activo', pero NO es un estado de agenda: marca las plantillas del
// catálogo maestro (funciones sin docente asignado). La analítica las
// excluye filtrando por usuario_asignacion, no por estado.
// ----------------------------------------------------------------
const ESTADOS_AGENDA = Object.freeze({
    PENDIENTE: 'Pendiente',
    ACEPTADO: 'Aceptado',
    APROBADA: 'Aprobada',
    DEVUELTA: 'Devuelta'
});

// Estado consolidado que se le calcula a un docente a partir de
// todas sus funciones. La precedencia importa: una sola función
// devuelta marca toda la agenda como devuelta.
const ESTADOS_CONSOLIDADOS = Object.freeze([
    'Devuelta',
    'Aprobada',
    'En revisión',
    'Pendiente'
]);

const ROLES = Object.freeze({
    PLANEACION: 'Planeacion',
    ADMIN: 'Admin',
    DIRECTOR: 'Director',
    CONSULTOR: 'Consultor'
});

const TODOS_SUPERVISORES = Object.freeze([ROLES.PLANEACION, ROLES.ADMIN, ROLES.DIRECTOR, ROLES.CONSULTOR]);
const SOLO_GESTION = Object.freeze([ROLES.PLANEACION, ROLES.ADMIN, ROLES.DIRECTOR]);

// ----------------------------------------------------------------
// Indicadores disponibles
// ----------------------------------------------------------------
const INDICADORES = Object.freeze({
    'IND-01': {
        id: 'IND-01',
        nombre: 'Tasa de Cumplimiento de Agendas',
        descripcion: 'Proporción de docentes que completaron el ciclo de formulación y aprobación de su agenda en el período.',
        tipoGrafico: 'donut',
        unidad: 'docentes',
        dimensiones: ['periodo', 'programa'],
        rolesAutorizados: TODOS_SUPERVISORES
    },
    'IND-02': {
        id: 'IND-02',
        nombre: 'Índice de Devolución de Agendas',
        descripcion: 'Porcentaje de docentes cuya agenda fue devuelta por la dirección para ajuste.',
        tipoGrafico: 'kpi_card',
        unidad: '%',
        dimensiones: ['periodo', 'programa'],
        rolesAutorizados: SOLO_GESTION
    },
    'IND-03': {
        id: 'IND-03',
        nombre: 'Distribución de Carga por Función Sustantiva',
        descripcion: 'Horas semanales agregadas por función sustantiva declarada en las agendas del período.',
        tipoGrafico: 'bar',
        unidad: 'h',
        dimensiones: ['funcion_sustantiva', 'periodo', 'programa'],
        rolesAutorizados: TODOS_SUPERVISORES
    },
    'IND-04': {
        id: 'IND-04',
        nombre: 'Balance Contractual Docente',
        descripcion: 'Comparación entre las horas asignadas en la agenda y las horas estipuladas en el contrato de cada docente.',
        tipoGrafico: 'table',
        unidad: 'h',
        dimensiones: ['docente', 'tipo_contrato'],
        rolesAutorizados: SOLO_GESTION,
        // Auditoría Fase 0: 'Hora Cátedra' y 'Por Definir' tienen
        // horas_contrato = 0. Toda división debe protegerse con NULLIF.
        notaTecnica: 'Los contratos con horas_contrato = 0 no admiten cálculo de porcentaje; se reportan como "Sin parámetro contractual".'
    },
    'IND-05': {
        id: 'IND-05',
        nombre: 'Avance de Metas — Corte I (Semana 8)',
        descripcion: 'Porcentaje de ejecución de las metas reportado por los docentes en el primer corte.',
        tipoGrafico: 'bar',
        unidad: '%',
        dimensiones: ['funcion_sustantiva', 'periodo', 'programa'],
        rolesAutorizados: TODOS_SUPERVISORES
    },
    'IND-06': {
        id: 'IND-06',
        nombre: 'Avance de Metas — Corte II (Semana 16)',
        descripcion: 'Cumplimiento acumulado al cierre del período, sumando lo ejecutado en ambos cortes.',
        tipoGrafico: 'area',
        unidad: '%',
        dimensiones: ['funcion_sustantiva', 'periodo', 'programa'],
        rolesAutorizados: TODOS_SUPERVISORES,
        // Auditoría Fase 0: actividad_semana está vacía (0 filas), por lo
        // que la fuente canónica es indicadores.ejecucion_8/16, con
        // semántica INCREMENTAL (el controlador topa ejec8+ejec16 <= meta).
        notaTecnica: 'Ejecución acumulada = ejecucion_8 + ejecucion_16 sobre la meta declarada.'
    },
    'IND-07': {
        id: 'IND-07',
        nombre: 'Respaldo Documental de Actividades',
        descripcion: 'Evidencias digitales cargadas por los docentes como soporte de los indicadores ejecutados.',
        tipoGrafico: 'kpi_card',
        unidad: 'evidencias',
        dimensiones: ['funcion_sustantiva', 'periodo', 'programa'],
        rolesAutorizados: TODOS_SUPERVISORES
    },
    'IND-08': {
        id: 'IND-08',
        nombre: 'Brecha de Respaldo Documental',
        descripcion: 'Indicadores con ejecución reportada que no tienen ningún archivo de evidencia que la sustente.',
        tipoGrafico: 'table',
        unidad: 'evidencias',
        dimensiones: ['docente', 'funcion_sustantiva', 'programa'],
        rolesAutorizados: SOLO_GESTION,
        notaTecnica: 'Un avance sin soporte documental no es verificable ante procesos de autoevaluación y acreditación.'
    },
    'IND-09': {
        id: 'IND-09',
        nombre: 'Consolidado por Programa Académico',
        descripcion: 'Comparación lado a lado del estado de las agendas, la carga horaria y el avance de metas de cada programa.',
        tipoGrafico: 'table',
        unidad: 'docentes',
        dimensiones: ['programa', 'facultad', 'periodo'],
        rolesAutorizados: TODOS_SUPERVISORES
    }
});

// ----------------------------------------------------------------
// Utilidades de consulta del catálogo
// ----------------------------------------------------------------

const obtenerIndicador = (id) => INDICADORES[id] || null;

const listarIndicadores = () => Object.values(INDICADORES);

const normalizarRol = (valor) =>
    String(valor || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * ¿Alguno de los roles del usuario está autorizado para este indicador?
 * @param {string} indicadorId
 * @param {string[]} rolesUsuario roles ya normalizados o no
 */
const puedeVer = (indicadorId, rolesUsuario = []) => {
    const ind = INDICADORES[indicadorId];
    if (!ind) return false;
    const permitidos = ind.rolesAutorizados.map(normalizarRol);
    return rolesUsuario.map(normalizarRol).some((r) => permitidos.includes(r));
};

/**
 * Envuelve un resultado en el contrato canónico MetricaAnaliticaResponse.
 * El backend entrega datos y semántica; nunca colores ni estilos.
 */
const construirMetrica = (indicadorId, { periodo, programa, categorias, series, resumenNumerico, filasTabla }) => {
    const ind = INDICADORES[indicadorId];
    if (!ind) throw new Error(`Indicador desconocido en el catálogo: ${indicadorId}`);

    return {
        indicadorId: ind.id,
        titulo: ind.nombre,
        descripcion: ind.descripcion,
        tipoGrafico: ind.tipoGrafico,
        periodo: periodo || null,
        programa: programa || null,
        categorias: categorias || [],
        series: series || [],
        resumenNumerico: resumenNumerico || {},
        ...(filasTabla ? { filasTabla } : {}),
        ...(ind.notaTecnica ? { notaTecnica: ind.notaTecnica } : {})
    };
};

module.exports = {
    ESTADOS_AGENDA,
    ESTADOS_CONSOLIDADOS,
    ROLES,
    INDICADORES,
    obtenerIndicador,
    listarIndicadores,
    puedeVer,
    construirMetrica
};
