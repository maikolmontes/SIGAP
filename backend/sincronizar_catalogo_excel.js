/**
 * Deja el catálogo de la agenda IGUAL al formato institucional (Excel).
 *
 *   cd backend
 *   node sincronizar_catalogo_excel.js "<ruta del Excel>"             ← solo muestra qué cambiaría
 *   node sincronizar_catalogo_excel.js "<ruta del Excel>" --aplicar   ← aplica los cambios
 *
 * Qué hace, para Investigación, Académico-Administrativo, Vicerrectoría y Aseguramiento de Calidad:
 *   - lo que falta en la base se crea; lo que tiene el mismo sentido pero otro texto se
 *     renombra con el texto del Excel (los textos se copian tal cual);
 *   - lo que sobra se elimina si ninguna agenda lo usa, y si alguna lo usa se oculta;
 *   - las actividades se muestran de la A a la Z (lo resuelve el servidor al leer el catálogo);
 *   - "Otro/Cuál" no se toca, ni tampoco Docencia Directa / Indirecta.
 * Todo ocurre en una transacción: si algo falla, no se cambia nada.
 *
 * Para producción: la base sale de las variables DB_* del entorno (ver backend/.env).
 */
require('dotenv').config();
const xlsx = require('xlsx');
const pool = require('./db/connection');
const { asegurarEsquemaCatalogo, condicionCatalogoAdmin } = require('./utils/catalogo');
const { leerCatalogoExcel, planificarFuncion } = require('./utils/catalogoExcel');

const ruta = process.argv.slice(2).find((a) => !a.startsWith('--'));
const aplicar = process.argv.includes('--aplicar');
if (!ruta) {
    console.error('Falta la ruta del Excel.\n  node sincronizar_catalogo_excel.js "<ruta>" [--aplicar]');
    process.exit(1);
}

const AGENDA_CON_DOCENTE = 'EXISTS (SELECT 1 FROM usuario_asignacion ua WHERE ua.id_funciones = af.id_funciones)';

(async () => {
    const libro = xlsx.readFile(ruta);
    const objetivo = leerCatalogoExcel((hoja) => {
        if (!libro.Sheets[hoja]) throw new Error(`El Excel no tiene la pestaña "${hoja}".`);
        return xlsx.utils.sheet_to_json(libro.Sheets[hoja], { header: 1, defval: '' });
    });

    await asegurarEsquemaCatalogo();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const resumen = [];

        for (const [funcion, roles] of Object.entries(objetivo)) {
            const idf = (await client.query(
                `SELECT af.id_funciones FROM asignacion_funciones af WHERE af.funcion_sustantiva = $1 AND ${condicionCatalogoAdmin('af')} ORDER BY af.id_funciones LIMIT 1`,
                [funcion])).rows[0]?.id_funciones;
            if (!idf) throw new Error(`No existe la función "${funcion}" en el catálogo.`);

            // Catálogo actual de esa función
            const filas = (await client.query(`
                SELECT aa.id_asignacionact ida, aa.rol_seleccionado rol, aa.orden, COALESCE(aa.activo, TRUE) aa_activo,
                       d.id_descripcion idd, d.resultado_esperado texto, COALESCE(d.activo, TRUE) d_activo,
                       i.id_indicadores idi, i.nombre_indicador ind, COALESCE(i.activo, TRUE) i_activo
                FROM asignacion_actividades aa
                LEFT JOIN descripcion d ON d.id_asignacionact = aa.id_asignacionact
                LEFT JOIN indicadores i ON i.id_descripcion = d.id_descripcion
                WHERE aa.id_funciones = $1
                ORDER BY aa.id_asignacionact, d.id_descripcion, i.id_indicadores`, [idf])).rows;
            const actual = [];
            const porA = new Map(), porD = new Map();
            for (const r of filas) {
                if (!porA.has(r.ida)) {
                    const a = { id: r.ida, nombre: r.rol, orden: r.orden, activo: r.aa_activo, descripciones: [] };
                    porA.set(r.ida, a);
                    actual.push(a);
                }
                if (!r.idd) continue;
                if (!porD.has(r.idd)) {
                    const d = { id: r.idd, texto: r.texto, activo: r.d_activo, indicadores: [] };
                    porD.set(r.idd, d);
                    porA.get(r.ida).descripciones.push(d);
                }
                if (r.idi) porD.get(r.idd).indicadores.push({ id: r.idi, nombre: r.ind, activo: r.i_activo });
            }

            const ops = planificarFuncion(roles, actual);
            console.log(`\n===== ${funcion}: ${roles.length} actividades en el Excel · ${actual.length} en la base · ${ops.length} cambio(s) =====`);

            // ¿Alguna agenda de docentes usa este texto? (las agendas guardan su propia copia)
            const usos = {
                actividades: async (t) => Number((await client.query(`SELECT COUNT(*) n FROM asignacion_actividades aa JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones WHERE af.funcion_sustantiva = $1 AND aa.rol_seleccionado = $2 AND ${AGENDA_CON_DOCENTE}`, [funcion, t])).rows[0].n),
                descripciones: async (t) => Number((await client.query(`SELECT COUNT(*) n FROM descripcion d JOIN asignacion_actividades aa ON aa.id_asignacionact = d.id_asignacionact JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones WHERE af.funcion_sustantiva = $1 AND d.resultado_esperado = $2 AND ${AGENDA_CON_DOCENTE}`, [funcion, t])).rows[0].n),
                indicadores: async (t) => Number((await client.query(`SELECT COUNT(*) n FROM indicadores i JOIN descripcion d ON d.id_descripcion = i.id_descripcion JOIN asignacion_actividades aa ON aa.id_asignacionact = d.id_asignacionact JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones WHERE af.funcion_sustantiva = $1 AND i.nombre_indicador = $2 AND ${AGENDA_CON_DOCENTE}`, [funcion, t])).rows[0].n),
            };
            const contar = { renombrar: 0, crear: 0, eliminar: 0, ocultar: 0, mostrar: 0, enUsoRenombrado: 0 };
            const insertarIndicadores = async (idd, lista) => {
                for (const n of lista) await client.query('INSERT INTO indicadores (id_descripcion, nombre_indicador, activo) VALUES ($1, $2, TRUE)', [idd, n]);
            };

            for (const o of ops) {
                switch (o.op) {
                    case 'renombrar_actividad': {
                        const uso = await usos.actividades(o.de);
                        if (uso) contar.enUsoRenombrado++;
                        console.log(`  ✎ actividad: "${o.de}" → "${o.a}"` + (uso ? `   (en ${uso} agenda/s)` : ''));
                        await client.query('UPDATE asignacion_actividades SET rol_seleccionado = $1 WHERE id_asignacionact = $2', [o.a, o.id]);
                        contar.renombrar++; break;
                    }
                    case 'renombrar_descripcion': {
                        const uso = await usos.descripciones(o.de);
                        if (uso) contar.enUsoRenombrado++;
                        console.log(`  ✎ descripción: "${o.de.slice(0, 60)}" → "${o.a.slice(0, 60)}"` + (uso ? `   (en ${uso} agenda/s)` : ''));
                        await client.query('UPDATE descripcion SET resultado_esperado = $1 WHERE id_descripcion = $2', [o.a, o.id]);
                        contar.renombrar++; break;
                    }
                    case 'renombrar_indicador': {
                        const uso = await usos.indicadores(o.de);
                        if (uso) contar.enUsoRenombrado++;
                        console.log(`  ✎ indicador: "${o.de.slice(0, 60)}" → "${o.a.slice(0, 60)}"` + (uso ? `   (en ${uso} agenda/s)` : ''));
                        await client.query('UPDATE indicadores SET nombre_indicador = $1 WHERE id_indicadores = $2', [o.a, o.id]);
                        contar.renombrar++; break;
                    }
                    case 'crear_actividad': {
                        console.log(`  ➕ actividad "${o.nombre}" (${o.descripciones.length} descripción/es, ${o.descripciones.reduce((n, d) => n + d.indicadores.length, 0)} indicador/es)`);
                        const a = await client.query('INSERT INTO asignacion_actividades (id_funciones, rol_seleccionado, horas_rol, orden, activo) VALUES ($1, $2, 0, $3, TRUE) RETURNING id_asignacionact', [idf, o.nombre, o.orden]);
                        for (const d of o.descripciones) {
                            const nd = await client.query('INSERT INTO descripcion (id_asignacionact, resultado_esperado, meta, activo) VALUES ($1, $2, NULL, TRUE) RETURNING id_descripcion', [a.rows[0].id_asignacionact, d.texto]);
                            await insertarIndicadores(nd.rows[0].id_descripcion, d.indicadores);
                        }
                        contar.crear++; break;
                    }
                    case 'crear_descripcion': {
                        console.log(`  ➕ descripción en "${o.actividad}": "${o.texto.slice(0, 70)}" (${o.indicadores.length} indicador/es)`);
                        const nd = await client.query('INSERT INTO descripcion (id_asignacionact, resultado_esperado, meta, activo) VALUES ($1, $2, NULL, TRUE) RETURNING id_descripcion', [o.idActividad, o.texto]);
                        await insertarIndicadores(nd.rows[0].id_descripcion, o.indicadores);
                        contar.crear++; break;
                    }
                    case 'crear_indicador': {
                        console.log(`  ➕ indicador en "${o.descripcion.slice(0, 50)}": "${o.nombre.slice(0, 70)}"`);
                        await insertarIndicadores(o.idDescripcion, [o.nombre]);
                        contar.crear++; break;
                    }
                    case 'quitar_indicador': {
                        const uso = await usos.indicadores(o.nombre);
                        console.log(`  ✖ indicador que no está en el Excel: "${o.nombre.slice(0, 70)}" → ${uso ? `se oculta (en ${uso} agenda/s)` : 'se elimina'}`);
                        if (uso) { await client.query('UPDATE indicadores SET activo = FALSE WHERE id_indicadores = $1', [o.id]); contar.ocultar++; }
                        else { await client.query('DELETE FROM indicadores WHERE id_indicadores = $1', [o.id]); contar.eliminar++; }
                        break;
                    }
                    case 'quitar_descripcion': {
                        const uso = await usos.descripciones(o.texto);
                        console.log(`  ✖ descripción que no está en el Excel (en "${o.actividad}"): "${o.texto.slice(0, 70)}" → ${uso ? `se oculta (en ${uso} agenda/s)` : 'se elimina'}`);
                        if (uso) { await client.query('UPDATE descripcion SET activo = FALSE WHERE id_descripcion = $1', [o.id]); contar.ocultar++; }
                        else {
                            await client.query('DELETE FROM indicadores WHERE id_descripcion = $1', [o.id]);
                            await client.query('DELETE FROM descripcion WHERE id_descripcion = $1', [o.id]);
                            contar.eliminar++;
                        }
                        break;
                    }
                    case 'quitar_actividad': {
                        const uso = await usos.actividades(o.nombre);
                        console.log(`  ✖ actividad que no está en el Excel: "${o.nombre}" → ${uso ? `se oculta (en ${uso} agenda/s)` : 'se elimina con su contenido'}`);
                        if (uso) { await client.query('UPDATE asignacion_actividades SET activo = FALSE WHERE id_asignacionact = $1', [o.id]); contar.ocultar++; }
                        else {
                            await client.query('DELETE FROM indicadores WHERE id_descripcion IN (SELECT id_descripcion FROM descripcion WHERE id_asignacionact = $1)', [o.id]);
                            await client.query('DELETE FROM descripcion WHERE id_asignacionact = $1', [o.id]);
                            await client.query('DELETE FROM actividad_semana WHERE id_asignacionact = $1', [o.id]);
                            await client.query('DELETE FROM asignacion_actividades WHERE id_asignacionact = $1', [o.id]);
                            contar.eliminar++;
                        }
                        break;
                    }
                    case 'mostrar': {
                        console.log(`  👁 vuelve a mostrarse (${o.tipo}): "${o.nombre.slice(0, 70)}"`);
                        const tabla = { actividades: ['asignacion_actividades', 'id_asignacionact'], descripciones: ['descripcion', 'id_descripcion'], indicadores: ['indicadores', 'id_indicadores'] }[o.tipo];
                        await client.query(`UPDATE ${tabla[0]} SET activo = TRUE WHERE ${tabla[1]} = $1`, [o.id]);
                        contar.mostrar++; break;
                    }
                    default: throw new Error('Operación desconocida: ' + o.op);
                }
            }
            resumen.push({ funcion, ...contar });
        }

        console.log('\n===== RESUMEN =====');
        console.table(resumen);
        if (aplicar) {
            await client.query('COMMIT');
            console.log('APLICADO: el catálogo quedó igual al Excel.');
        } else {
            await client.query('ROLLBACK');
            console.log('ENSAYO: no se guardó nada. Para aplicar, agrega --aplicar.');
        }
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error (no se cambió nada):', error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
})();
