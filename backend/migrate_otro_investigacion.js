/**
 * Agrega la actividad "Otro/Cuál" a la función Investigación del catálogo
 * maestro, como ya la tienen Académico-Administrativo y Vicerrectoría.
 *
 * Con ella el docente puede registrar una actividad de investigación que no
 * está en la lista (escribe la descripción y el indicador), y el importador
 * del listado la usa cuando una fila no tiene equivalente ("INVESTIGACIONES").
 *
 * Es idempotente: si la actividad ya existe, no hace nada.
 * Uso: cd backend && node migrate_otro_investigacion.js
 */
require('dotenv').config();
const pool = require('./db/connection');
const { condicionCatalogo } = require('./utils/catalogo');

const FUNCION = 'Investigación';
const ROL = 'Otro/Cuál';
const DESCRIPCION = 'Otra actividad de investigación';
const INDICADOR = 'Informe de gestión de actividades';

(async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const funcion = await client.query(`
            SELECT af.id_funciones FROM asignacion_funciones af
            WHERE af.funcion_sustantiva = $1 AND ${condicionCatalogo('af')}
            ORDER BY af.id_funciones LIMIT 1
        `, [FUNCION]);
        if (funcion.rows.length === 0) throw new Error(`No existe la función "${FUNCION}" en el catálogo maestro.`);
        const idFunciones = funcion.rows[0].id_funciones;

        const existe = await client.query(
            "SELECT 1 FROM asignacion_actividades WHERE id_funciones = $1 AND rol_seleccionado ILIKE 'otro%'", [idFunciones]);
        if (existe.rows.length > 0) {
            await client.query('ROLLBACK');
            console.log(`"${ROL}" ya existe en ${FUNCION}; no se hizo ningún cambio.`);
            return;
        }

        const orden = (await client.query(
            'SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM asignacion_actividades WHERE id_funciones = $1', [idFunciones])).rows[0].n;
        const act = await client.query(`
            INSERT INTO asignacion_actividades (id_funciones, rol_seleccionado, horas_rol, orden)
            VALUES ($1, $2, 0, $3) RETURNING id_asignacionact
        `, [idFunciones, ROL, orden]);
        const desc = await client.query(`
            INSERT INTO descripcion (id_asignacionact, resultado_esperado, meta)
            VALUES ($1, $2, 1) RETURNING id_descripcion
        `, [act.rows[0].id_asignacionact, DESCRIPCION]);
        await client.query(
            'INSERT INTO indicadores (id_descripcion, nombre_indicador) VALUES ($1, $2)', [desc.rows[0].id_descripcion, INDICADOR]);

        await client.query('COMMIT');
        console.log(`Agregada la actividad "${ROL}" a ${FUNCION} (función ${idFunciones}).`);
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error:', err.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
})();
