const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// Simula exactamente lo que hace saveAgenda con el id_usuario=2 y datos mínimos
async function testSave() {
    const id_usuario = 2;
    const funciones = [
        {
            funcionSustantiva: 'Docencia Directa',
            horasFuncion: 10,
            actividades: [
                {
                    idEspacioAcademico: null,
                    actividadLibre: null,
                    horasActividad: 10,
                    resultadoEsperado: 'Impartir el 100% de la formación presencial',
                    meta: 100,
                    indicadores: [{ nombre_indicador: 'Planilla de notas' }]
                }
            ]
        }
    ];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const funcionesResult = await client.query(
            'SELECT id_funciones FROM usuario_asignacion WHERE id_usuario = $1',
            [id_usuario]
        );
        const funcIds = funcionesResult.rows.map(r => r.id_funciones);
        console.log('Funciones previas del usuario:', funcIds);

        if (funcIds.length > 0) {
            await client.query(`DELETE FROM indicadores WHERE id_descripcion IN (SELECT id_descripcion FROM descripcion WHERE id_asignacionact IN (SELECT id_asignacionact FROM asignacion_actividades WHERE id_funciones = ANY($1::int[])))`, [funcIds]);
            await client.query(`DELETE FROM descripcion WHERE id_asignacionact IN (SELECT id_asignacionact FROM asignacion_actividades WHERE id_funciones = ANY($1::int[]))`, [funcIds]);
            await client.query(`DELETE FROM asignacion_actividades WHERE id_funciones = ANY($1::int[])`, [funcIds]);
            await client.query(`DELETE FROM asignacion_funciones WHERE id_funciones = ANY($1::int[])`, [funcIds]);
            await client.query(`DELETE FROM usuario_asignacion WHERE id_usuario = $1`, [id_usuario]);
            console.log('Limpieza completada');
        }

        for (const func of funciones) {
            const resFunc = await client.query(
                `INSERT INTO asignacion_funciones (funcion_sustantiva, horas_funcion, estado_agenda, creado_en) VALUES ($1, $2, 'Borrador', NOW()) RETURNING id_funciones`,
                [func.funcionSustantiva, func.horasFuncion]
            );
            const newFuncId = resFunc.rows[0].id_funciones;
            console.log('Función insertada con id:', newFuncId);

            await client.query(
                `INSERT INTO usuario_asignacion (id_usuario, id_funciones) VALUES ($1, $2)`,
                [id_usuario, newFuncId]
            );

            for (let i = 0; i < func.actividades.length; i++) {
                const act = func.actividades[i];
                let idEspacio = act.idEspacioAcademico ? parseInt(act.idEspacioAcademico) : null;
                if (isNaN(idEspacio)) idEspacio = null;

                const resAct = await client.query(
                    `INSERT INTO asignacion_actividades (id_funciones, id_espacio_aca, rol_seleccionado, horas_rol, orden, creado_en) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id_asignacionact`,
                    [newFuncId, idEspacio, act.actividadLibre || null, act.horasActividad, i + 1]
                );
                const newActId = resAct.rows[0].id_asignacionact;
                console.log('Actividad insertada con id:', newActId);

                const resDesc = await client.query(
                    `INSERT INTO descripcion (id_asignacionact, resultado_esperado, meta, activo) VALUES ($1, $2, $3, true) RETURNING id_descripcion`,
                    [newActId, act.resultadoEsperado, act.meta]
                );
                const newDescId = resDesc.rows[0].id_descripcion;
                console.log('Descripcion insertada con id:', newDescId);

                for (const ind of act.indicadores) {
                    await client.query(
                        `INSERT INTO indicadores (id_descripcion, nombre_indicador, activo) VALUES ($1, $2, true)`,
                        [newDescId, ind.nombre_indicador]
                    );
                    console.log('Indicador insertado:', ind.nombre_indicador);
                }
            }
        }

        await client.query('COMMIT');
        console.log('\n✅ TEST EXITOSO - Agenda guardada correctamente en la BD');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('\n❌ ERROR al guardar agenda:', e.message);
        console.error('Detalle:', e);
    } finally {
        client.release();
        pool.end();
    }
}

testSave();
