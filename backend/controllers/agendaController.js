const pool = require('../db/connection');

const getAgenda = async (req, res) => {
    const { id_usuario } = req.params;

    try {
        const docente = await pool.query(`
            SELECT
                u.nombres || ' ' || u.apellidos AS nombre_completo,
                u.numero_documento,
                u.correo,
                tc.tipo             AS tipo_contrato,
                tc.horas_contrato,
                pa.nombre_programa,
                na.nivel            AS nivel_academico,
                per.anio || '-' || per.semestre AS periodo
            FROM usuarios u
            JOIN tipo_contrato tc       ON u.id_contrato  = tc.id_contrato
            JOIN programa_academico pa  ON u.id_programa  = pa.id_programa
            JOIN usuario_nivel un       ON u.id_usuario   = un.id_usuario
            JOIN nivel_academico na     ON un.id_nivelaca = na.id_nivelaca
            JOIN programa_periodo pp    ON pa.id_programa = pp.id_programa
            JOIN periodo per            ON pp.id_periodo  = per.id_periodo
            WHERE u.id_usuario = $1
            AND per.activo = TRUE
        `, [id_usuario]);

        if (docente.rows.length === 0) {
            return res.status(404).json({ error: 'Docente no encontrado' });
        }

        const funciones = await pool.query(`
            SELECT
                af.id_funciones,
                af.funcion_sustantiva,
                af.horas_funcion,
                af.estado_agenda,
                af.observaciones_generales
            FROM usuario_asignacion ua
            JOIN asignacion_funciones af ON ua.id_funciones = af.id_funciones
            JOIN periodo p ON p.id_periodo = af.id_periodo
            WHERE ua.id_usuario = $1 AND p.activo = true
            ORDER BY af.id_funciones
        `, [id_usuario]);

        const actividades = await pool.query(`
            WITH descripciones AS (
                SELECT
                    aa.id_asignacionact,
                    aa.id_funciones,
                    aa.rol_seleccionado,
                    aa.horas_rol,
                    ea.codigo_espacio,
                    ea.nombre_espacio,
                    d.id_descripcion,
                    d.resultado_esperado,
                    d.meta,
                    i.nombre_indicador,
                    ROW_NUMBER() OVER(
                        PARTITION BY aa.id_asignacionact
                        ORDER BY d.id_descripcion
                    ) AS fila
                FROM usuario_asignacion ua
                JOIN asignacion_funciones af    ON ua.id_funciones     = af.id_funciones
                JOIN asignacion_actividades aa  ON af.id_funciones     = aa.id_funciones
                LEFT JOIN espacio_academico ea  ON aa.id_espacio_aca   = ea.id_espacio_aca
                JOIN descripcion d              ON aa.id_asignacionact = d.id_asignacionact
                JOIN indicadores i              ON i.id_descripcion    = d.id_descripcion
                JOIN periodo p                  ON p.id_periodo        = af.id_periodo
                WHERE ua.id_usuario = $1 AND p.activo = true
            ),
            ejecuciones_s8 AS (
                SELECT
                    acs.id_asignacionact,
                    acs.ejecucion         AS ejecucion_s8,
                    acs.estado_aprobacion AS estado_s8,
                    acs.observaciones     AS obs_s8,
                    r.porcentaje_avance   AS avance_s8,
                    ROW_NUMBER() OVER(
                        PARTITION BY acs.id_asignacionact
                        ORDER BY acs.id_actsemana
                    ) AS fila
                FROM actividad_semana acs
                JOIN semana s     ON acs.id_semana     = s.id_semana
                JOIN resultados r ON acs.id_resultados = r.id_resultados
                WHERE s.numero_semana = '8'
            ),
            ejecuciones_s16 AS (
                SELECT
                    acs.id_asignacionact,
                    acs.ejecucion         AS ejecucion_s16,
                    acs.estado_aprobacion AS estado_s16,
                    acs.observaciones     AS obs_s16,
                    r.porcentaje_avance   AS avance_s16,
                    ROW_NUMBER() OVER(
                        PARTITION BY acs.id_asignacionact
                        ORDER BY acs.id_actsemana
                    ) AS fila
                FROM actividad_semana acs
                JOIN semana s     ON acs.id_semana     = s.id_semana
                JOIN resultados r ON acs.id_resultados = r.id_resultados
                WHERE s.numero_semana = '16'
            )
            SELECT
                d.id_asignacionact,
                d.id_funciones,
                d.rol_seleccionado,
                d.horas_rol,
                d.codigo_espacio,
                d.nombre_espacio,
                d.id_descripcion,
                d.resultado_esperado,
                d.meta,
                d.nombre_indicador,
                e8.ejecucion_s8,
                e8.estado_s8,
                e8.obs_s8,
                e8.avance_s8,
                e16.ejecucion_s16,
                e16.estado_s16,
                e16.obs_s16,
                e16.avance_s16
            FROM descripciones d
            JOIN ejecuciones_s8  e8  ON d.id_asignacionact = e8.id_asignacionact
                                    AND d.fila = e8.fila
            JOIN ejecuciones_s16 e16 ON d.id_asignacionact = e16.id_asignacionact
                                    AND d.fila = e16.fila
            ORDER BY d.id_funciones, d.nombre_espacio, d.id_descripcion
        `, [id_usuario]);

        const horas = await pool.query(`
            SELECT
                tc.horas_contrato,
                SUM(af.horas_funcion)                         AS total_asignado,
                tc.horas_contrato - SUM(af.horas_funcion)     AS diferencia,
                CASE
                    WHEN SUM(af.horas_funcion) = tc.horas_contrato THEN 'Completo'
                    WHEN SUM(af.horas_funcion) > tc.horas_contrato THEN 'Excede contrato'
                    ELSE 'Faltan horas'
                END AS estado_carga
            FROM usuario_asignacion ua
            JOIN asignacion_funciones af ON ua.id_funciones = af.id_funciones
            JOIN usuarios u              ON ua.id_usuario   = u.id_usuario
            JOIN tipo_contrato tc        ON u.id_contrato   = tc.id_contrato
            WHERE ua.id_usuario = $1
            GROUP BY tc.horas_contrato
        `, [id_usuario]);

        res.json({
            docente: docente.rows[0],
            funciones: funciones.rows,
            actividades: actividades.rows,
            horas: horas.rows[0] || {}
        });

    } catch (error) {
        console.error('Error en getAgenda:', error.message);
        res.status(500).json({ error: 'Error al obtener la agenda' });
    }
};

const getAgendaBase = async (req, res) => {
    const { id_usuario } = req.params;

    try {
        const funciones = await pool.query(`
            SELECT
                af.id_funciones,
                af.funcion_sustantiva,
                af.horas_funcion,
                af.estado_agenda
            FROM usuario_asignacion ua
            JOIN asignacion_funciones af ON ua.id_funciones = af.id_funciones
            JOIN periodo p ON p.id_periodo = af.id_periodo
            WHERE ua.id_usuario = $1 AND p.activo = true
            ORDER BY af.id_funciones
        `, [id_usuario]);

        const actividades = await pool.query(`
            SELECT
                aa.id_asignacionact,
                aa.id_funciones,
                aa.rol_seleccionado,
                aa.horas_rol,
                ea.codigo_espacio,
                COALESCE(ea.nombre_espacio, aa.rol_seleccionado) AS nombre_espacio,
                ea.id_espacio_aca,
                s.nombre_sem AS semestre_nombre,
                COALESCE(g.nombre_grupo, '') AS grupo_nombre,

                d.id_descripcion,
                d.resultado_esperado,
                d.meta,
                
                i.id_indicadores as id_indicador,
                i.nombre_indicador,
                i.ejecucion_8,
                i.ejecucion_16,
                i.observaciones
                
            FROM usuario_asignacion ua
            JOIN asignacion_funciones af    ON ua.id_funciones     = af.id_funciones
            JOIN asignacion_actividades aa  ON af.id_funciones     = aa.id_funciones
            LEFT JOIN espacio_academico ea  ON aa.id_espacio_aca   = ea.id_espacio_aca
            LEFT JOIN semestres s           ON ea.id_semestre      = s.id_semestre
            LEFT JOIN grupos g              ON g.id_grupos         = aa.id_grupos
            LEFT JOIN descripcion d         ON aa.id_asignacionact = d.id_asignacionact
            LEFT JOIN indicadores i         ON i.id_descripcion    = d.id_descripcion
            JOIN periodo p                  ON p.id_periodo        = af.id_periodo
            WHERE ua.id_usuario = $1 AND p.activo = true
            ORDER BY af.id_funciones, aa.id_asignacionact, d.id_descripcion, i.id_indicadores
        `, [id_usuario]);

        res.json({
            funciones: funciones.rows,
            actividades: actividades.rows
        });

    } catch (error) {
        console.error('Error en getAgendaBase:', error.message);
        res.status(500).json({ error: 'Error al obtener la agenda base' });
    }
};

// ================================================================
// guardarFuncionDocente:
// Recibe el id_funciones y la lista de actividades con sus detalles
// (rol_seleccionado, resultado_esperado, meta, indicadores).
// Actualiza las actividades existentes y crea descripción/indicadores.
// Marca la función como "Aceptado".
// ================================================================
const guardarFuncionDocente = async (req, res) => {
    const { id_funciones, actividades } = req.body;

    if (!id_funciones || !actividades || !Array.isArray(actividades)) {
        return res.status(400).json({ error: 'Se requiere id_funciones y un arreglo de actividades.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        for (const act of actividades) {
            const idAct = act.id_asignacionact;
            const rol = act.actividadLibre || '';
            const resultadoEsperado = act.resultadoEsperado || '';
            const meta = act.meta || '';
            const indicadores = act.indicadores || [];

            // Actualizar el rol_seleccionado de la actividad si cambió
            if (idAct && rol) {
                await client.query(
                    'UPDATE asignacion_actividades SET rol_seleccionado = $1 WHERE id_asignacionact = $2',
                    [rol, idAct]
                );
            }

            // Si hay resultado esperado o descripciones fijas, gestionar descripción e indicadores
            if (idAct && (resultadoEsperado || (act.descripciones && act.descripciones.length > 0))) {
                // Borrar indicadores y descripciones anteriores de esta actividad
                await client.query(`
                    DELETE FROM indicadores WHERE id_descripcion IN (
                        SELECT id_descripcion FROM descripcion WHERE id_asignacionact = $1
                    )
                `, [idAct]);
                await client.query('DELETE FROM descripcion WHERE id_asignacionact = $1', [idAct]);

                const descsToInsert = act.descripciones && act.descripciones.length > 0
                    ? act.descripciones
                    : [{ resultadoEsperado, meta, indicadores }];

                for (const descData of descsToInsert) {
                    // Insertar nueva descripción
                    const descRes = await client.query(`
                        INSERT INTO descripcion (id_asignacionact, resultado_esperado, meta)
                        VALUES ($1, $2, $3) RETURNING id_descripcion
                    `, [idAct, descData.resultadoEsperado, descData.meta || null]);

                    const idDescripcion = descRes.rows[0].id_descripcion;

                    // Insertar indicadores
                    for (const ind of descData.indicadores) {
                        if (ind.nombre_indicador) {
                            await client.query(`
                                INSERT INTO indicadores (id_descripcion, nombre_indicador)
                                VALUES ($1, $2)
                            `, [idDescripcion, ind.nombre_indicador]);
                        }
                    }
                }
            }
        }

        // Marcar la función como "Aceptado"
        await client.query(
            "UPDATE asignacion_funciones SET estado_agenda = 'Aceptado' WHERE id_funciones = $1",
            [id_funciones]
        );

        await client.query('COMMIT');

        res.json({ mensaje: 'Función guardada y aceptada correctamente.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en guardarFuncionDocente:', error.message);
        res.status(500).json({ error: 'Error al guardar la función del docente.', detalles: error.message });
    } finally {
        client.release();
    }
};

const guardarAvanceDocente = async (req, res) => {
    const { indicadores } = req.body;

    if (!indicadores || !Array.isArray(indicadores)) {
        return res.status(400).json({ error: 'Se requiere un arreglo de indicadores con su ejecución.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        for (const ind of indicadores) {
            await client.query(`
                UPDATE indicadores 
                SET ejecucion_8 = $1, 
                    ejecucion_16 = $2, 
                    observaciones = $3
                WHERE id_indicadores = $4
            `, [
                ind.ejecucion_8 || 0, 
                ind.ejecucion_16 || 0, 
                ind.observaciones || '',
                ind.id_indicador
            ]);
        }

        await client.query('COMMIT');
        res.json({ mensaje: 'Avance guardado correctamente.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en guardarAvanceDocente:', error.message);
        res.status(500).json({ error: 'Error al guardar el avance.', detalles: error.message });
    } finally {
        client.release();
    }
};

module.exports = { getAgenda, getAgendaBase, guardarFuncionDocente, guardarAvanceDocente };