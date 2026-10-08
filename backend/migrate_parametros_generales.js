/**
 * Prepara la pantalla "Parámetros generales" (Planeación):
 *   1. Agrega asignacion_actividades.activo (permite ocultar actividades).
 *   2. Lleva Docencia Directa y Docencia Indirecta al catálogo. Sus textos
 *      estaban escritos dentro del código de la agenda y por eso no se podían
 *      cambiar. Si una ya existe, no la toca.
 *        - Docencia Directa: las 4 actividades institucionales, con su meta.
 *        - Docencia Indirecta: el texto del formato institucional (hoja
 *          "DOCENCIA INDIRECTA"), solo hasta la descripción: el indicador lo
 *          registra el docente. La agenda muestra la descripción como valor
 *          inicial; su meta siempre es 1.
 *   3. Registra la página "Parámetros Generales" en el catálogo de permisos y
 *      se la da a Planeación (los demás roles no cambian).
 *
 * Es idempotente. Uso: cd backend && node migrate_parametros_generales.js
 */
require('dotenv').config();
const pool = require('./db/connection');
const { asegurarEsquemaCatalogo } = require('./utils/catalogo');

const MODULO = 'Planeación Institucional';
const PAGINA = 'Parámetros Generales';
const DESCRIPCION = 'Administración del catálogo de funciones, actividades, descripciones e indicadores de la agenda';
const ACCIONES = ['Ver', 'Crear', 'Editar', 'Eliminar'];

// Funciones con contenido propio. La actividad lleva el mismo nombre que la función:
// así la agenda la reconoce y rellena la descripción y el indicador sola.
const FUNCIONES = [
    {
        nombre: 'Docencia Directa',
        nota: 'Actividades institucionales de la docencia directa',
        descripciones: [
            { texto: 'Microcurrículo y ficha temática actualizados', meta: 2, indicador: 'Microcurrículo y ficha aprobados y cargados en el sistema institucional' },
            { texto: 'Desarrollo de espacio académico', meta: 16, indicador: 'Registros de seguimiento semana a semana en el sistema académico institucional' },
            { texto: 'Registro de calificaciones', meta: 3, indicador: 'Registros de calificaciones en el sistema académico institucional' },
            { texto: 'Entrega física de notas finales firmadas por el docente', meta: 1, indicador: 'Evidencia de entrega de notas finales' },
        ],
    },
    {
        nombre: 'Docencia Indirecta',
        nota: 'Docencia indirecta: 30 % de la directa (Acuerdo 030 de 2024, cap. 2, art. 7)',
        descripciones: [
            {
                texto: 'Preparación de clases, atención a estudiantes y calificación de pruebas académicas',
                meta: null, // la meta de la docencia indirecta la fija la agenda (siempre 1)
                indicador: null, // el formato llega hasta la descripción: el indicador lo registra el docente
            },
        ],
    },
];

(async () => {
    const client = await pool.connect();
    try {
        await asegurarEsquemaCatalogo();
        console.log('Columna asignacion_actividades.activo: lista.');

        await client.query('BEGIN');

        for (const f of FUNCIONES) {
            const existe = await client.query(`
                SELECT af.id_funciones FROM asignacion_funciones af
                WHERE af.funcion_sustantiva = $1 AND af.estado_agenda IN ('Activo', 'Inactivo')
                  AND NOT EXISTS (SELECT 1 FROM usuario_asignacion ua WHERE ua.id_funciones = af.id_funciones)
            `, [f.nombre]);
            if (existe.rows.length > 0) {
                console.log(`${f.nombre} ya está en el catálogo; no se cambió.`);
                continue;
            }
            const fila = await client.query(`
                INSERT INTO asignacion_funciones (funcion_sustantiva, horas_funcion, estado_agenda, observaciones_generales)
                VALUES ($1, 0, 'Activo', $2) RETURNING id_funciones
            `, [f.nombre, f.nota]);
            const act = await client.query(`
                INSERT INTO asignacion_actividades (id_funciones, rol_seleccionado, horas_rol, orden, activo)
                VALUES ($1, $2, 0, 1, TRUE) RETURNING id_asignacionact
            `, [fila.rows[0].id_funciones, f.nombre]);
            for (const d of f.descripciones) {
                const desc = await client.query(`
                    INSERT INTO descripcion (id_asignacionact, resultado_esperado, meta, activo)
                    VALUES ($1, $2, $3, TRUE) RETURNING id_descripcion
                `, [act.rows[0].id_asignacionact, d.texto, d.meta]);
                if (d.indicador) {
                    await client.query('INSERT INTO indicadores (id_descripcion, nombre_indicador, activo) VALUES ($1, $2, TRUE)',
                        [desc.rows[0].id_descripcion, d.indicador]);
                }
            }
            console.log(`${f.nombre} agregada al catálogo (${f.descripciones.length} descripción/es).`);
        }

        // La descripción de Docencia Indirecta se cargó antes con la redacción del Excel
        // ("Preparación clases, atención estudiantes…"): se deja con la ortografía correcta
        const corregida = await client.query(`
            UPDATE descripcion d SET resultado_esperado = $1
            FROM asignacion_actividades aa
            JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones
            WHERE d.id_asignacionact = aa.id_asignacionact
              AND af.funcion_sustantiva = 'Docencia Indirecta' AND af.estado_agenda IN ('Activo', 'Inactivo')
              AND NOT EXISTS (SELECT 1 FROM usuario_asignacion ua WHERE ua.id_funciones = af.id_funciones)
              AND d.resultado_esperado <> $1
              AND d.resultado_esperado ILIKE 'Preparaci%clases%'
        `, [FUNCIONES[1].descripciones[0].texto]);
        if (corregida.rowCount > 0) console.log('Descripción de Docencia Indirecta: ortografía corregida.');

        // Permisos de la página nueva
        for (const accion of ACCIONES) {
            await client.query(`
                INSERT INTO permisos (modulo, pagina, accion, detalle_permiso)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (modulo, pagina, accion) DO NOTHING
            `, [MODULO, PAGINA, accion, `${accion} en ${PAGINA} (${MODULO}): ${DESCRIPCION}`]);
        }
        const nuevos = await client.query('SELECT id_permisos FROM permisos WHERE modulo = $1 AND pagina = $2', [MODULO, PAGINA]);
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
        console.log(`Página "${PAGINA}": ${nuevos.rows.length} permisos para ${planeacion.rows.length} rol(es) de Planeación.`);

        await client.query('COMMIT');
        console.log('Migración completada.');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error en la migración:', error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
})();
