// ================================================================
// SIGAP — Balance de gestión de un programa en un período (los datos)
// ----------------------------------------------------------------
// Reúne, en un solo objeto, todo lo que pasó en el período para un programa:
// agendas, horas, avance por corte, evidencias y observaciones del director.
// No guarda nada: se arma al momento con los datos vigentes.
//
// Las definiciones son las mismas de la analítica (analiticaController):
//   · estado de la agenda de un docente: una función devuelta marca toda la
//     agenda; "Aprobada" solo si todas lo están; "En revisión" si todas están
//     diligenciadas (Aceptado/Aprobada); si no, "Pendiente".
//   · avance: ejecución de los indicadores (ejecucion_8 / ejecucion_16) frente
//     a la meta de la descripción.
//   · solo cuentan funciones con docente asignado (se excluye el catálogo).
// Los docentes del balance son los asignados al período (docente_periodo).
// El texto del documento lo redacta balanceDocumento.js a partir de este objeto.
// ================================================================
const { etiquetaPeriodo, etiquetaCorte } = require('../utils/periodo');

const num = (v) => Number(v) || 0;
const redondear = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const porcentaje = (parte, total) => (num(total) > 0 ? redondear((num(parte) * 100) / num(total)) : null);

const estadoAgenda = (d) => {
    if (num(d.funciones) === 0) return 'Sin agenda';
    if (d.alguna_devuelta) return 'Devuelta';
    if (d.todas_aprobadas) return 'Aprobada';
    if (d.todas_diligenciadas) return 'En revisión';
    return 'Pendiente';
};

const ESTADOS_AGENDA = ['Aprobada', 'En revisión', 'Pendiente', 'Devuelta', 'Sin agenda'];

class BalanceError extends Error {
    constructor(mensaje, estado = 400) {
        super(mensaje);
        this.estado = estado;
    }
}

const construirBalance = async (db, { idPrograma, idPeriodo }) => {
    const programa = (await db.query(
        `SELECT pa.id_programa, pa.nombre_programa, f.nombre_facultad
         FROM programa_academico pa LEFT JOIN facultad f ON f.id_facultad = pa.id_facultad
         WHERE pa.id_programa = $1`, [idPrograma])).rows[0];
    if (!programa) throw new BalanceError('El programa no existe.', 404);

    const periodo = (await db.query(
        'SELECT id_periodo, anio, semestre, fecha_inicio, fecha_fin, activo FROM periodo WHERE id_periodo = $1', [idPeriodo])).rows[0];
    if (!periodo) throw new BalanceError('El período no existe.', 404);

    const directores = (await db.query(
        `SELECT TRIM(u.nombres || ' ' || u.apellidos) AS nombre
         FROM director_programa dpr JOIN usuarios u ON u.id_usuario = dpr.id_usuario
         WHERE dpr.id_programa = $1 AND u.activo = TRUE ORDER BY u.nombres, u.apellidos`, [idPrograma])).rows.map((r) => r.nombre);

    // ---- Docentes del programa asignados al período ----
    const filasDocentes = (await db.query(`
        SELECT u.id_usuario,
               TRIM(u.nombres || ' ' || u.apellidos)  AS docente,
               COALESCE(tc.tipo, 'Sin definir')       AS tipo_contrato,
               COALESCE(tc.horas_contrato, 0)::numeric AS horas_contrato,
               COALESCE(ag.horas, 0)::numeric         AS horas_asignadas,
               COALESCE(ag.funciones, 0)::int         AS funciones,
               COALESCE(ag.alguna_devuelta, FALSE)    AS alguna_devuelta,
               COALESCE(ag.todas_aprobadas, FALSE)    AS todas_aprobadas,
               COALESCE(ag.todas_diligenciadas, FALSE) AS todas_diligenciadas,
               COALESCE(av.meta, 0)::numeric          AS meta,
               COALESCE(av.ejec8, 0)::numeric         AS ejec8,
               COALESCE(av.ejec16, 0)::numeric        AS ejec16,
               COALESCE(av.indicadores, 0)::int       AS indicadores,
               COALESCE(av.sin_soporte, 0)::int       AS sin_soporte,
               COALESCE(av.evidencias, 0)::int        AS evidencias
        FROM docente_periodo dp
        JOIN usuarios u ON u.id_usuario = dp.id_usuario AND u.activo = TRUE
        LEFT JOIN tipo_contrato tc ON tc.id_contrato = u.id_contrato
        LEFT JOIN LATERAL (
            SELECT SUM(COALESCE(af.horas_funcion, 0)) AS horas,
                   COUNT(*)                           AS funciones,
                   BOOL_OR(af.estado_agenda = 'Devuelta')                    AS alguna_devuelta,
                   BOOL_AND(af.estado_agenda = 'Aprobada')                   AS todas_aprobadas,
                   BOOL_AND(af.estado_agenda IN ('Aceptado', 'Aprobada'))    AS todas_diligenciadas
            FROM usuario_asignacion ua
            JOIN asignacion_funciones af ON af.id_funciones = ua.id_funciones AND af.id_periodo = $1
            WHERE ua.id_usuario = u.id_usuario
        ) ag ON TRUE
        LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(d.meta), 0)               AS meta,
                   COALESCE(SUM(i.ejecucion_8), 0)        AS ejec8,
                   COALESCE(SUM(i.ejecucion_16), 0)       AS ejec16,
                   COUNT(i.id_indicadores)                AS indicadores,
                   COUNT(i.id_indicadores) FILTER (
                       WHERE COALESCE(i.ejecucion_8, 0) + COALESCE(i.ejecucion_16, 0) > 0 AND ev.n = 0) AS sin_soporte,
                   COALESCE(SUM(ev.n), 0)                 AS evidencias
            FROM usuario_asignacion ua
            JOIN asignacion_funciones af ON af.id_funciones = ua.id_funciones AND af.id_periodo = $1
            JOIN asignacion_actividades aa ON aa.id_funciones = af.id_funciones AND aa.activo IS NOT FALSE
            JOIN descripcion d ON d.id_asignacionact = aa.id_asignacionact AND d.activo IS NOT FALSE
            JOIN indicadores i ON i.id_descripcion = d.id_descripcion AND i.activo IS NOT FALSE
            LEFT JOIN LATERAL (SELECT COUNT(*) AS n FROM evidencias e WHERE e.id_indicadores = i.id_indicadores) ev ON TRUE
            WHERE ua.id_usuario = u.id_usuario
        ) av ON TRUE
        WHERE dp.id_periodo = $1 AND u.id_programa = $2
        ORDER BY docente
    `, [idPeriodo, idPrograma])).rows;

    const docentes = filasDocentes.map((d) => {
        const horasContrato = num(d.horas_contrato);
        const horasAsignadas = num(d.horas_asignadas);
        return {
            docente: d.docente,
            tipoContrato: d.tipo_contrato,
            horasContrato,
            horasAsignadas,
            ocupacion: porcentaje(horasAsignadas, horasContrato),
            funciones: d.funciones,
            estado: estadoAgenda(d),
            meta: num(d.meta),
            ejecucionCorte1: num(d.ejec8),
            ejecucionCorte2: num(d.ejec16),
            avanceCorte1: porcentaje(d.ejec8, d.meta),
            avanceFinal: porcentaje(num(d.ejec8) + num(d.ejec16), d.meta),
            indicadores: d.indicadores,
            indicadoresSinSoporte: d.sin_soporte,
            evidencias: d.evidencias,
        };
    });

    // ---- Por función sustantiva ----
    const horasPorFuncion = (await db.query(`
        SELECT af.funcion_sustantiva AS funcion,
               SUM(COALESCE(af.horas_funcion, 0))::numeric AS horas,
               COUNT(DISTINCT u.id_usuario)::int           AS docentes
        FROM asignacion_funciones af
        JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
        JOIN usuarios u ON u.id_usuario = ua.id_usuario AND u.activo = TRUE AND u.id_programa = $2
        WHERE af.id_periodo = $1
        GROUP BY af.funcion_sustantiva
        ORDER BY af.funcion_sustantiva
    `, [idPeriodo, idPrograma])).rows;

    // ---- Actividades: lo que se planeó y se ejecutó, agrupado igual que en la agenda ----
    const filasActividades = (await db.query(`
        SELECT af.funcion_sustantiva                       AS funcion,
               COALESCE(NULLIF(TRIM(aa.rol_seleccionado), ''), 'Sin actividad') AS actividad,
               COALESCE(ea.nombre_espacio, '')             AS asignatura,
               COALESCE(d.resultado_esperado, '')          AS descripcion,
               COALESCE(i.nombre_indicador, '')            AS indicador,
               COUNT(DISTINCT u.id_usuario)::int           AS docentes,
               ARRAY_AGG(DISTINCT u.id_usuario)            AS ids_docentes,
               COALESCE(SUM(d.meta), 0)::numeric           AS meta,
               COALESCE(SUM(i.ejecucion_8), 0)::numeric    AS ejec8,
               COALESCE(SUM(i.ejecucion_16), 0)::numeric   AS ejec16,
               COALESCE(SUM(ev.n), 0)::int                 AS evidencias
        FROM asignacion_funciones af
        JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
        JOIN usuarios u ON u.id_usuario = ua.id_usuario AND u.activo = TRUE AND u.id_programa = $2
        JOIN asignacion_actividades aa ON aa.id_funciones = af.id_funciones AND aa.activo IS NOT FALSE
        LEFT JOIN espacio_academico ea ON ea.id_espacio_aca = aa.id_espacio_aca
        LEFT JOIN descripcion d ON d.id_asignacionact = aa.id_asignacionact AND d.activo IS NOT FALSE
        LEFT JOIN indicadores i ON i.id_descripcion = d.id_descripcion AND i.activo IS NOT FALSE
        LEFT JOIN LATERAL (SELECT COUNT(*) AS n FROM evidencias e WHERE e.id_indicadores = i.id_indicadores) ev ON TRUE
        WHERE af.id_periodo = $1
        GROUP BY af.funcion_sustantiva, aa.rol_seleccionado, ea.nombre_espacio, d.resultado_esperado, i.nombre_indicador
        ORDER BY af.funcion_sustantiva, actividad, asignatura, descripcion, indicador
    `, [idPeriodo, idPrograma])).rows;

    // ---- Evidencias: cada archivo o enlace que cargaron los docentes ----
    const filasEvidencias = (await db.query(`
        SELECT af.funcion_sustantiva                       AS funcion,
               COALESCE(NULLIF(TRIM(aa.rol_seleccionado), ''), 'Sin actividad') AS actividad,
               COALESCE(ea.nombre_espacio, '')             AS asignatura,
               COALESCE(d.resultado_esperado, '')          AS descripcion,
               COALESCE(i.nombre_indicador, '')            AS indicador,
               e.nombre_archivo, e.tipo_archivo, e.semana, e.fecha_carga,
               TRIM(u.nombres || ' ' || u.apellidos)       AS docente
        FROM evidencias e
        JOIN indicadores i ON i.id_indicadores = e.id_indicadores AND i.activo IS NOT FALSE
        JOIN descripcion d ON d.id_descripcion = i.id_descripcion AND d.activo IS NOT FALSE
        JOIN asignacion_actividades aa ON aa.id_asignacionact = d.id_asignacionact AND aa.activo IS NOT FALSE
        JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones AND af.id_periodo = $1
        JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
        JOIN usuarios u ON u.id_usuario = ua.id_usuario AND u.activo = TRUE AND u.id_programa = $2
        LEFT JOIN espacio_academico ea ON ea.id_espacio_aca = aa.id_espacio_aca
        ORDER BY af.funcion_sustantiva, aa.rol_seleccionado, d.resultado_esperado, i.nombre_indicador, e.fecha_carga
    `, [idPeriodo, idPrograma])).rows;

    const evidencias = filasEvidencias.map((e) => ({
        funcion: e.funcion || 'Sin clasificar',
        actividad: e.actividad,
        asignatura: e.asignatura,
        descripcion: e.descripcion,
        indicador: e.indicador,
        nombre: String(e.nombre_archivo || '').trim(),
        tipo: e.tipo_archivo === 'enlace' ? 'Enlace' : 'Archivo',
        corte: etiquetaCorte(Number(e.semana) === 16 ? 16 : 8, periodo.semestre),
        docente: e.docente,
        fecha: e.fecha_carga,
    }));

    const actividades = filasActividades.map((a) => ({
        funcion: a.funcion || 'Sin clasificar',
        actividad: a.actividad,
        asignatura: a.asignatura,
        descripcion: a.descripcion,
        indicador: a.indicador,
        docentes: a.docentes,
        meta: num(a.meta),
        ejecucionCorte1: num(a.ejec8),
        ejecucionCorte2: num(a.ejec16),
        avanceFinal: porcentaje(num(a.ejec8) + num(a.ejec16), a.meta),
        evidencias: a.evidencias,
        idsDocentes: a.ids_docentes || [],
    }));

    const funciones = horasPorFuncion.map((h) => {
        const nombre = h.funcion || 'Sin clasificar';
        const delaFuncion = actividades.filter((a) => a.funcion === nombre);
        const meta = delaFuncion.reduce((s, a) => s + a.meta, 0);
        const ejec8 = delaFuncion.reduce((s, a) => s + a.ejecucionCorte1, 0);
        const ejec16 = delaFuncion.reduce((s, a) => s + a.ejecucionCorte2, 0);
        return {
            funcion: nombre,
            horas: num(h.horas),
            docentes: h.docentes,
            actividades: new Set(delaFuncion.map((a) => a.actividad + '|' + a.asignatura)).size,
            meta,
            ejecucionCorte1: ejec8,
            ejecucionCorte2: ejec16,
            avanceCorte1: porcentaje(ejec8, meta),
            avanceFinal: porcentaje(ejec8 + ejec16, meta),
            evidencias: delaFuncion.reduce((s, a) => s + a.evidencias, 0),
        };
    });

    // ---- Detalle por actividad: su descripción, indicadores y evidencias ----
    // Solo entran las actividades con descripción, indicador o evidencias (las clases sin
    // indicadores se ven en la tabla de actividades).
    // En Docencia Directa cada clase repite las mismas descripciones (microcurrículo, calificaciones…):
    // se agrupan por descripción para no repetir el mismo bloque por cada asignatura.
    const esDocenciaDirecta = (x) => x.funcion === 'Docencia Directa';
    const claveActividad = (x) => (esDocenciaDirecta(x) ? [x.funcion, 'Docencia Directa', '', x.descripcion] : [x.funcion, x.actividad, x.asignatura, x.descripcion]).join('||');
    const grupos = new Map();
    for (const a of actividades) {
        if (!a.descripcion && !a.indicador && a.evidencias === 0) continue;
        const k = claveActividad(a);
        if (!grupos.has(k)) grupos.set(k, { funcion: a.funcion, actividad: esDocenciaDirecta(a) ? 'Docencia Directa' : a.actividad, asignatura: esDocenciaDirecta(a) ? '' : a.asignatura, descripcion: a.descripcion, filas: [], docentes: new Set() });
        const g = grupos.get(k);
        g.filas.push(a);
        a.idsDocentes.forEach((id) => g.docentes.add(id));
    }
    // Suma las filas que tienen el mismo indicador (p. ej. la misma descripción en varias clases)
    const unirIndicadores = (filas) => {
        const porNombre = new Map();
        for (const a of filas) {
            if (!a.indicador) continue;
            const t = porNombre.get(a.indicador) || { indicador: a.indicador, meta: 0, ejecucionCorte1: 0, ejecucionCorte2: 0, evidencias: 0 };
            t.meta += a.meta; t.ejecucionCorte1 += a.ejecucionCorte1; t.ejecucionCorte2 += a.ejecucionCorte2; t.evidencias += a.evidencias;
            porNombre.set(a.indicador, t);
        }
        return [...porNombre.values()].map((t) => ({ ...t, cumplimiento: porcentaje(t.ejecucionCorte1 + t.ejecucionCorte2, t.meta) }));
    };
    const actividadesDetalle = [...grupos.values()].map((g) => {
        const meta = g.filas.reduce((t, a) => t + a.meta, 0);
        const ejec1 = g.filas.reduce((t, a) => t + a.ejecucionCorte1, 0);
        const ejec2 = g.filas.reduce((t, a) => t + a.ejecucionCorte2, 0);
        const evid = evidencias.filter((e) => claveActividad(e) === claveActividad(g));
        const nDocentes = g.docentes.size;
        const cumplimiento = porcentaje(ejec1 + ejec2, meta);
        const titulo = g.descripcion || (g.asignatura && g.asignatura !== g.actividad ? `${g.actividad} (${g.asignatura})` : g.actividad);
        return {
            funcion: g.funcion,
            actividad: g.actividad,
            asignatura: g.asignatura,
            titulo,
            docentes: nDocentes,
            meta,
            ejecucionCorte1: ejec1,
            ejecucionCorte2: ejec2,
            cumplimiento,
            indicadores: unirIndicadores(g.filas),
            evidencias: evid,
        };
    });

    // ---- Revisión de los cortes (por función de cada docente) ----
    const totalFunciones = docentes.reduce((s, d) => s + d.funciones, 0);
    const revisadas = (await db.query(`
        SELECT rc.semana, rc.estado, COUNT(*)::int AS n
        FROM revision_corte rc
        JOIN asignacion_funciones af ON af.id_funciones = rc.id_funciones AND af.id_periodo = $1
        WHERE EXISTS (
            SELECT 1 FROM usuario_asignacion ua JOIN usuarios u ON u.id_usuario = ua.id_usuario
            WHERE ua.id_funciones = af.id_funciones AND u.id_programa = $2 AND u.activo = TRUE)
        GROUP BY rc.semana, rc.estado
    `, [idPeriodo, idPrograma])).rows;
    const corte = (semana) => {
        const filas = revisadas.filter((r) => Number(r.semana) === semana);
        const cuenta = (e) => filas.filter((r) => r.estado === e).reduce((s, r) => s + r.n, 0);
        const aprobadas = cuenta('Aprobado'), vistoBueno = cuenta('Visto bueno'), devueltas = cuenta('Devuelto');
        return {
            nombre: etiquetaCorte(semana, periodo.semestre),
            aprobadas, vistoBueno, devueltas,
            pendientes: Math.max(0, totalFunciones - aprobadas - vistoBueno - devueltas),
        };
    };
    const cortes = { corte1: corte(8), corte2: corte(16) };

    // ---- Observaciones del director ----
    const observaciones = (await db.query(`
        SELECT od.semana, od.texto, od.fecha,
               TRIM(u.nombres || ' ' || u.apellidos) AS docente,
               af.funcion_sustantiva                 AS funcion,
               COALESCE(NULLIF(TRIM(aa.rol_seleccionado), ''), '') AS actividad
        FROM observaciones_director od
        JOIN asignacion_actividades aa ON aa.id_asignacionact = od.id_asignacionact
        JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones AND af.id_periodo = $1
        JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
        JOIN usuarios u ON u.id_usuario = ua.id_usuario AND u.activo = TRUE AND u.id_programa = $2
        ORDER BY od.fecha, docente
    `, [idPeriodo, idPrograma])).rows.map((o) => ({
        corte: etiquetaCorte(Number(o.semana) === 16 ? 16 : 8, periodo.semestre),
        docente: o.docente,
        funcion: o.funcion || '',
        actividad: o.actividad,
        texto: String(o.texto || '').trim(),
        fecha: o.fecha,
    }));

    // ---- Resumen (se deriva de lo anterior, así siempre cuadra) ----
    const porEstado = Object.fromEntries(ESTADOS_AGENDA.map((e) => [e, docentes.filter((d) => d.estado === e).length]));
    const horasContratadas = docentes.reduce((s, d) => s + d.horasContrato, 0);
    const horasAsignadas = docentes.reduce((s, d) => s + d.horasAsignadas, 0);
    const meta = funciones.reduce((s, f) => s + f.meta, 0);
    const ejec8 = funciones.reduce((s, f) => s + f.ejecucionCorte1, 0);
    const ejec16 = funciones.reduce((s, f) => s + f.ejecucionCorte2, 0);

    return {
        generadoEn: new Date().toISOString(),
        programa: { id: programa.id_programa, nombre: programa.nombre_programa, facultad: programa.nombre_facultad || '' },
        periodo: {
            id: periodo.id_periodo,
            etiqueta: etiquetaPeriodo(periodo),
            semestre: periodo.semestre,
            fechaInicio: periodo.fecha_inicio,
            fechaFin: periodo.fecha_fin,
            activo: !!periodo.activo,
        },
        directores,
        nombresCortes: { corte1: etiquetaCorte(8, periodo.semestre), corte2: etiquetaCorte(16, periodo.semestre) },
        resumen: {
            docentes: docentes.length,
            docentesConAgenda: docentes.length - porEstado['Sin agenda'],
            estados: porEstado,
            porcentajeAprobadas: porcentaje(porEstado['Aprobada'], docentes.length),
            horasContratadas,
            horasAsignadas,
            ocupacion: porcentaje(horasAsignadas, horasContratadas),
            meta,
            ejecucionCorte1: ejec8,
            ejecucionCorte2: ejec16,
            avanceCorte1: porcentaje(ejec8, meta),
            avanceFinal: porcentaje(ejec8 + ejec16, meta),
            evidencias: docentes.reduce((s, d) => s + d.evidencias, 0),
            indicadoresSinSoporte: docentes.reduce((s, d) => s + d.indicadoresSinSoporte, 0),
            observaciones: observaciones.length,
        },
        funciones,
        actividades: actividades.map(({ idsDocentes, ...resto }) => resto), // eslint-disable-line no-unused-vars
        cortes,
        docentes,
        observaciones,
        evidencias,
        actividadesDetalle,
    };
};

module.exports = { construirBalance, BalanceError, estadoAgenda, porcentaje };
