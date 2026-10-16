// ================================================================
// SIGAP — Indicadores descriptivos IND-10 e IND-11
// ----------------------------------------------------------------
//  IND-10  Peso de cada función en la meta y avance sin Docencia Directa
//  IND-11  Revisión de los cortes (aprobadas, visto bueno, devueltas, por revisar, sin reportar)
//
// (La cobertura de agendas, IND-12, se integró a IND-01: el estado de cada docente del período,
// con "Por aprobar" y "Sin carga", vive en utils/estadoDocente.js.)
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
 * agenda (cada función se revisa por separado en cada corte), y SOLO las funciones
 * ya liberadas al docente: una función con la carga 'Por Aprobar' todavía no se puede
 * reportar, así que no es "pendiente de revisión" (se informa aparte en `porLiberar`).
 *
 *   por revisar  = el docente ya reportó y falta la revisión del director (revision_corte 'Pendiente')
 *   sin reportar = función liberada de la que el docente aún no reporta el corte (no hay fila)
 */
const indicadorRevisionCortes = async (db, { periodo, etiqueta, programa, params, filtro }) => {
    const conteo = (await db.query(`
        SELECT COUNT(DISTINCT af.id_funciones)::int                                                  AS total,
               COUNT(DISTINCT af.id_funciones) FILTER (WHERE af.estado_agenda <> 'Por Aprobar')::int AS liberadas
        FROM asignacion_funciones af
        JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
        JOIN usuarios u ON u.id_usuario = ua.id_usuario AND u.activo = TRUE
        WHERE af.id_periodo = $1${filtro}
    `, params)).rows[0] || {};
    const liberadas = num(conteo.liberadas);
    const porLiberar = Math.max(0, num(conteo.total) - liberadas);

    const revisadas = (await db.query(`
        SELECT rc.semana, rc.estado, COUNT(DISTINCT rc.id_funciones)::int AS n
        FROM revision_corte rc
        JOIN asignacion_funciones af ON af.id_funciones = rc.id_funciones AND af.estado_agenda <> 'Por Aprobar'
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
        const porRevisar = cuenta(semana, 'Pendiente');
        return { semana, aprobadas, vistoBueno, devueltas, porRevisar, sinReportar: Math.max(0, liberadas - aprobadas - vistoBueno - devueltas - porRevisar) };
    });

    return catalogo.construirMetrica('IND-11', {
        periodo: etiqueta,
        programa,
        categorias: cortes.map((c) => etiquetaCorte(c.semana, periodo.semestre)),
        series: [
            { nombre: 'Aprobadas', clave: 'aprobadas', unidad: 'funciones', datos: cortes.map((c) => c.aprobadas) },
            { nombre: 'Con visto bueno', clave: 'vistoBueno', unidad: 'funciones', datos: cortes.map((c) => c.vistoBueno) },
            { nombre: 'Devueltas', clave: 'devueltas', unidad: 'funciones', datos: cortes.map((c) => c.devueltas) },
            { nombre: 'Por revisar (el docente ya reportó)', clave: 'porRevisar', unidad: 'funciones', datos: cortes.map((c) => c.porRevisar) },
            { nombre: 'Sin reportar', clave: 'sinReportar', unidad: 'funciones', datos: cortes.map((c) => c.sinReportar) },
        ],
        resumenNumerico: {
            total: liberadas,
            porLiberar,
            porcentajeCorte1: pct(cortes[0].aprobadas, liberadas),
            porcentajeCorte2: pct(cortes[1].aprobadas, liberadas),
        },
    });
};

module.exports = { indicadorPesoMetas, indicadorRevisionCortes };
