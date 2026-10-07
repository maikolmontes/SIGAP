// ================================================================
// SIGAP — Respaldo previo al borrado de agendas
// ----------------------------------------------------------------
// Antes de eliminar funciones/actividades/indicadores/evidencias se guarda
// una copia completa en la tabla respaldos_agendas, dentro de la misma
// transacción del borrado. Si el respaldo falla la eliminación se cancela:
// nunca se borra sin tener copia.
//
// Antes la copia era solo un archivo en backend/backups/agendas. En Vercel
// el disco es de solo lectura: escribir el archivo fallaba y por eso en
// producción no se podía eliminar ninguna agenda. Fuera de Vercel se sigue
// dejando también el archivo JSON, como copia adicional.
//
// Los archivos físicos de las evidencias NO se borran al eliminar agendas,
// así que el respaldo conserva la referencia a cada archivo.
// ================================================================
const fs = require('fs');
const path = require('path');

const CARPETA = path.join(__dirname, '..', 'backups', 'agendas');

const sinCaracteresRaros = (texto) =>
    String(texto || 'agendas')
        .normalize('NFD')
        .split('')
        .filter((c) => /[a-zA-Z0-9]/.test(c))
        .join('')
        .slice(0, 40) || 'agendas';

const asegurarTabla = (client) => client.query(`
    CREATE TABLE IF NOT EXISTS respaldos_agendas (
        id_respaldo SERIAL PRIMARY KEY,
        creado_en   TIMESTAMP NOT NULL DEFAULT NOW(),
        motivo      VARCHAR(200),
        id_periodo  INTEGER,
        conteos     JSONB NOT NULL,
        datos       JSONB NOT NULL
    )
`);

// Copia adicional en disco, solo donde el disco se puede escribir
const guardarArchivo = (nombre, contenido) => {
    if (process.env.VERCEL) return null;
    try {
        fs.mkdirSync(CARPETA, { recursive: true });
        fs.writeFileSync(path.join(CARPETA, nombre), JSON.stringify(contenido, null, 2), 'utf8');
        return nombre;
    } catch (err) {
        console.warn('[respaldo] No se pudo escribir la copia en disco (queda la de la base de datos):', err.message);
        return null;
    }
};

/**
 * Guarda todo lo que se va a borrar para las funciones indicadas.
 * Debe llamarse DENTRO de la transacción y ANTES de los DELETE.
 *
 * @returns {Promise<{id_respaldo: number, archivo: string, conteos: object}>}
 *          `archivo` es el nombre del JSON en disco o, si no se escribió, "respaldo #id".
 */
const respaldarAgendas = async (client, idsFunciones, { motivo, periodo = null } = {}) => {
    const q = async (sql, params) => (await client.query(sql, params)).rows;

    const funciones = await q('SELECT * FROM asignacion_funciones WHERE id_funciones = ANY($1)', [idsFunciones]);
    const usuarioAsignacion = await q('SELECT * FROM usuario_asignacion WHERE id_funciones = ANY($1)', [idsFunciones]);
    const actividades = await q('SELECT * FROM asignacion_actividades WHERE id_funciones = ANY($1)', [idsFunciones]);
    const idsActividades = actividades.map((a) => a.id_asignacionact);

    const descripciones = await q('SELECT * FROM descripcion WHERE id_asignacionact = ANY($1)', [idsActividades]);
    const indicadores = await q(
        `SELECT i.* FROM indicadores i
         JOIN descripcion d ON d.id_descripcion = i.id_descripcion
         WHERE d.id_asignacionact = ANY($1)`, [idsActividades]);
    const evidencias = await q(
        `SELECT e.* FROM evidencias e
         JOIN indicadores i ON i.id_indicadores = e.id_indicadores
         JOIN descripcion d ON d.id_descripcion = i.id_descripcion
         WHERE d.id_asignacionact = ANY($1)`, [idsActividades]);
    const actividadSemana = await q('SELECT * FROM actividad_semana WHERE id_asignacionact = ANY($1)', [idsActividades]);

    const conteos = {
        funciones: funciones.length,
        actividades: actividades.length,
        descripciones: descripciones.length,
        indicadores: indicadores.length,
        evidencias: evidencias.length,
        actividad_semana: actividadSemana.length,
    };
    const datos = {
        asignacion_funciones: funciones,
        usuario_asignacion: usuarioAsignacion,
        asignacion_actividades: actividades,
        descripcion: descripciones,
        indicadores,
        evidencias,
        actividad_semana: actividadSemana,
    };

    await asegurarTabla(client);
    const fila = await q(
        `INSERT INTO respaldos_agendas (motivo, id_periodo, conteos, datos)
         VALUES ($1, $2, $3, $4) RETURNING id_respaldo`,
        [String(motivo || '').slice(0, 200), periodo, JSON.stringify(conteos), JSON.stringify(datos)]
    );
    const idRespaldo = fila[0].id_respaldo;

    const marca = new Date().toISOString().replace(/[:.]/g, '-');
    const archivo = guardarArchivo(`${marca}_${sinCaracteresRaros(motivo)}.json`, {
        generado_en: new Date().toISOString(),
        id_respaldo: idRespaldo,
        motivo,
        periodo,
        conteos,
        ...datos,
    });

    return { id_respaldo: idRespaldo, archivo: archivo || `respaldo #${idRespaldo}`, conteos };
};

module.exports = { respaldarAgendas };
