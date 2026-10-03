// ================================================================
// SIGAP — Respaldo previo al borrado de agendas
// ----------------------------------------------------------------
// Antes de eliminar funciones/actividades/indicadores/evidencias se guarda
// una copia completa en backend/backups/agendas/*.json. Si el respaldo falla
// la eliminación se cancela: nunca se borra sin tener copia.
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

/**
 * Guarda en disco todo lo que se va a borrar para las funciones indicadas.
 * Debe llamarse DENTRO de la transacción y ANTES de los DELETE.
 *
 * @returns {Promise<{archivo: string, conteos: object}>}
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

    fs.mkdirSync(CARPETA, { recursive: true });
    const marca = new Date().toISOString().replace(/[:.]/g, '-');
    const archivo = `${marca}_${sinCaracteresRaros(motivo)}.json`;

    fs.writeFileSync(
        path.join(CARPETA, archivo),
        JSON.stringify({
            generado_en: new Date().toISOString(),
            motivo,
            periodo,
            conteos,
            asignacion_funciones: funciones,
            usuario_asignacion: usuarioAsignacion,
            asignacion_actividades: actividades,
            descripcion: descripciones,
            indicadores,
            evidencias,
            actividad_semana: actividadSemana,
        }, null, 2),
        'utf8'
    );

    return { archivo, conteos };
};

module.exports = { respaldarAgendas };
