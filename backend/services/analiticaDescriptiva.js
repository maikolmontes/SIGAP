// ================================================================
// SIGAP — Indicadores descriptivos IND-10, IND-11 e IND-12
// ----------------------------------------------------------------
//  IND-10  Peso de cada función en la meta y avance sin Docencia Directa
//  IND-11  Revisión de los cortes (aprobadas, visto bueno, devueltas, pendientes)
//  IND-12  Cobertura de agendas sobre los docentes asignados al período
//
// Son solo descripción: cuentan lo que ocurrió, no interpretan ni predicen.
// Igual que el resto de la analítica: el backend entrega cifras, nunca colores,
// y todas las consultas son parametrizadas y respetan el ámbito del usuario
// (el `filtro` ya trae el programa/facultad que le toca).
// ================================================================
const catalogo = require('../config/catalogoAnalitica');
const { etiquetaCorte } = require('../utils/periodo');

const num = (v) => Number(v) || 0;
const redondear = (v) => Math.round(v * 10) / 10;
const pct = (parte, total) => (num(total) > 0 ? redondear((num(parte) / num(total)) * 100) : 0);
// Porcentaje que puede no existir (sin meta no hay avance que decir)
const pctONulo = (parte, total) => (num(total) > 0 ? redondear((num(parte) / num(total)) * 100) : null);

const DOCENCIA_DIRECTA = 'Docencia Directa';

/**
 * IND-10 — Cuánto pesa cada función en la meta total y cuánto avanzó.
 * La meta de Docencia Directa es de lejos la más grande (una por clase y por
 * indicador), así que el avance total casi solo habla de ella: aquí se muestra
 * el peso de cada función y el avance sin contarla.
 *
 * @param filas filas de la consulta de metas por función (meta, ejec8, ejec16)
 */
const indicadorPesoMetas = ({ filas, etiqueta, programa }) => {
    const metaTotal = filas.reduce((a, r) => a + num(r.meta), 0);
    const ejecTotal = filas.reduce((a, r) => a + num(r.ejec8) + num(r.ejec16), 0);

    const sinDD = filas.filter((r) => r.funcion_sustantiva !== DOCENCIA_DIRECTA);
    const metaSinDD = sinDD.reduce((a, r) => a + num(r.meta), 0);
    const ejecSinDD = sinDD.reduce((a, r) => a + num(r.ejec8) + num(r.ejec16), 0);
    const metaDD = metaTotal - metaSinDD;

    return catalogo.construirMetrica('IND-10', {
        periodo: etiqueta,
        programa,
        categorias: filas.map((r) => r.funcion_sustantiva || 'Sin clasificar'),
        series: [
            { nombre: 'Meta', clave: 'meta', datos: filas.map((r) => num(r.meta)) },
            { nombre: 'Peso en la meta total', clave: 'peso', unidad: '%', datos: filas.map((r) => pct(r.meta, metaTotal)) },
            { nombre: 'Avance acumulado', clave: 'avance', unidad: '%', datos: filas.map((r) => pct(num(r.ejec8) + num(r.ejec16), r.meta)) },
        ],
        resumenNumerico: {
            total: metaTotal,
            porcentajeGlobal: pct(ejecTotal, metaTotal),
            porcentajeSinDocenciaDirecta: pctONulo(ejecSinDD, metaSinDD),
            pesoDocenciaDirecta: pctONulo(metaDD, metaTotal),
        },
    });
};

/**
 * IND-11 — Cómo va la revisión de cada corte. Se cuenta por función de cada
 * agenda (cada función se revisa por separado en cada corte).
 */
const indicadorRevisionCortes = async (db, { periodo, etiqueta, programa, params, filtro }) => {
    const total = num((await db.query(`
        SELECT COUNT(DISTINCT af.id_funciones)::int AS n
        FROM asignacion_funciones af
        JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
        JOIN usuarios u ON u.id_usuario = ua.id_usuario AND u.activo = TRUE
        WHERE af.id_periodo = $1${filtro}
    `, params)).rows[0]?.n);

    const revisadas = (await db.query(`
        SELECT rc.semana, rc.estado, COUNT(DISTINCT rc.id_funciones)::int AS n
        FROM revision_corte rc
        JOIN asignacion_funciones af ON af.id_funciones = rc.id_funciones
        JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
        JOIN usuarios u ON u.id_usuario = ua.id_usuario AND u.activo = TRUE
        WHERE af.id_periodo = $1${filtro}
        GROUP BY rc.semana, rc.estado
    `, params)).rows;

    const cuenta = (semana, estado) => revisadas
        .filter((r) => Number(r.semana) === semana && r.estado === estado)
        .reduce((a, r) => a + num(r.n), 0);
    const cortes = [8, 16].map((semana) => {
        const aprobadas = cuenta(semana, 'Aprobado');
        const vistoBueno = cuenta(semana, 'Visto bueno');
        const devueltas = cuenta(semana, 'Devuelto');
        return { semana, aprobadas, vistoBueno, devueltas, pendientes: Math.max(0, total - aprobadas - vistoBueno - devueltas) };
    });

    return catalogo.construirMetrica('IND-11', {
        periodo: etiqueta,
        programa,
        categorias: cortes.map((c) => etiquetaCorte(c.semana, periodo.semestre)),
        series: [
            { nombre: 'Aprobadas', clave: 'aprobadas', unidad: 'funciones', datos: cortes.map((c) => c.aprobadas) },
            { nombre: 'Con visto bueno', clave: 'vistoBueno', unidad: 'funciones', datos: cortes.map((c) => c.vistoBueno) },
            { nombre: 'Devueltas', clave: 'devueltas', unidad: 'funciones', datos: cortes.map((c) => c.devueltas) },
            { nombre: 'Pendientes de revisión', clave: 'pendientes', unidad: 'funciones', datos: cortes.map((c) => c.pendientes) },
        ],
        resumenNumerico: {
            total,
            porcentajeCorte1: pct(cortes[0].aprobadas, total),
            porcentajeCorte2: pct(cortes[1].aprobadas, total),
        },
    });
};

/**
 * IND-12 — De los docentes asignados al período, cuántos tienen la agenda enviada,
 * cuántos la están construyendo, cuántos la tienen devuelta y cuántos no tienen agenda.
 * (IND-01 solo mira a quienes ya tienen funciones; este también cuenta a quienes no.)
 */
const CATEGORIAS_COBERTURA = ['Agenda enviada', 'En construcción', 'Devuelta', 'Sin agenda'];

const clasificarCobertura = (d) => {
    if (num(d.funciones) === 0) return 'Sin agenda';
    if (d.alguna_devuelta) return 'Devuelta';
    if (d.todas_diligenciadas) return 'Agenda enviada';
    return 'En construcción';
};

const indicadorCobertura = async (db, { etiqueta, programa, params, filtro }) => {
    const docentes = (await db.query(`
        SELECT u.id_usuario,
               COUNT(af.id_funciones)::int                                       AS funciones,
               BOOL_OR(af.estado_agenda = 'Devuelta')                            AS alguna_devuelta,
               BOOL_AND(af.estado_agenda IN ('Aceptado', 'Aprobada'))            AS todas_diligenciadas
        FROM docente_periodo dp
        JOIN usuarios u ON u.id_usuario = dp.id_usuario AND u.activo = TRUE
        LEFT JOIN usuario_asignacion ua ON ua.id_usuario = u.id_usuario
        LEFT JOIN asignacion_funciones af ON af.id_funciones = ua.id_funciones AND af.id_periodo = $1
        WHERE dp.id_periodo = $1${filtro}
        GROUP BY u.id_usuario
    `, params)).rows;

    const conteo = Object.fromEntries(CATEGORIAS_COBERTURA.map((c) => [c, 0]));
    for (const d of docentes) conteo[clasificarCobertura(d)] += 1;
    const total = docentes.length;

    return catalogo.construirMetrica('IND-12', {
        periodo: etiqueta,
        programa,
        categorias: CATEGORIAS_COBERTURA,
        series: [{ nombre: 'Docentes', clave: 'docentes', unidad: 'docentes', datos: CATEGORIAS_COBERTURA.map((c) => conteo[c]) }],
        resumenNumerico: { total, porcentajeGlobal: pct(conteo['Agenda enviada'], total) },
    });
};

module.exports = { indicadorPesoMetas, indicadorRevisionCortes, indicadorCobertura, clasificarCobertura, CATEGORIAS_COBERTURA };
