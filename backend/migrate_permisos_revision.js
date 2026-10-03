/**
 * Agrega al catálogo de permisos el módulo "Revisión por Función" y deja
 * configurado el rol Investigación (y cualquier revisor de función).
 *
 * Es idempotente y NO toca los permisos de los demás roles, salvo dar a
 * Planeación las páginas nuevas (Planeación tiene el catálogo completo).
 * No usa runSeed a propósito: volvería a asignar permisos que Planeación
 * haya quitado a otros roles desde Gestión de Perfiles.
 *
 * Uso: cd backend && node migrate_permisos_revision.js
 */
require('dotenv').config();
const pool = require('./db/connection');

const MODULO = 'Revisión por Función';
const PAGINA = 'Avances por Revisar';
const DESCRIPCION = 'Revisión de los cortes de Semana 8 y 16 de la función sustantiva que el rol revisa';
const ACCIONES = ['Ver', 'Crear', 'Editar', 'Eliminar'];

(async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Páginas nuevas en el catálogo
        for (const accion of ACCIONES) {
            await client.query(`
                INSERT INTO permisos (modulo, pagina, accion, detalle_permiso)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (modulo, pagina, accion) DO NOTHING
            `, [MODULO, PAGINA, accion, `${accion} en ${PAGINA} (${MODULO}): ${DESCRIPCION}`]);
        }

        const nuevos = await client.query(
            'SELECT id_permisos, accion FROM permisos WHERE modulo = $1 AND pagina = $2', [MODULO, PAGINA]);

        // 2. Planeación recibe el catálogo completo, incluidas las páginas nuevas
        const planeacion = await client.query(
            "SELECT id_rol FROM roles WHERE LOWER(nombre_rol) IN ('planeacion', 'planeación', 'admin')");
        for (const r of planeacion.rows) {
            for (const p of nuevos.rows) {
                await client.query(`
                    INSERT INTO rol_permiso (id_rol, id_permisos, fecha_ingreso) VALUES ($1, $2, NOW())
                    ON CONFLICT (id_rol, id_permisos) DO NOTHING
                `, [r.id_rol, p.id_permisos]);
            }
        }

        // 3. Revisores de función = roles con filas en rol_funcion que NO son comodín
        //    (el Director es comodín y conserva su propia matriz). Solo se configuran
        //    si todavía no tienen ningún permiso, para no pisar lo que Planeación ajustó.
        const revisores = await client.query(`
            SELECT DISTINCT r.id_rol, r.nombre_rol
            FROM roles r
            JOIN rol_funcion rf ON rf.id_rol = r.id_rol
            WHERE COALESCE(r.es_comodin, false) = false
              AND NOT EXISTS (SELECT 1 FROM rol_permiso rp WHERE rp.id_rol = r.id_rol)
        `);

        const defaults = await client.query(`
            SELECT id_permisos FROM permisos
            WHERE (modulo = $1 AND accion IN ('Ver', 'Editar'))
               OR (pagina = 'Perfil de Usuario' AND accion IN ('Ver', 'Editar'))
        `, [MODULO]);

        for (const r of revisores.rows) {
            for (const p of defaults.rows) {
                await client.query(`
                    INSERT INTO rol_permiso (id_rol, id_permisos, fecha_ingreso) VALUES ($1, $2, NOW())
                    ON CONFLICT (id_rol, id_permisos) DO NOTHING
                `, [r.id_rol, p.id_permisos]);
            }
            console.log(`Rol "${r.nombre_rol}": ${defaults.rows.length} permisos iniciales asignados.`);
        }

        await client.query('COMMIT');
        console.log('Migración completada.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en la migración:', error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
})();
