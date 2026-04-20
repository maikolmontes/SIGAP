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
            WHERE ua.id_usuario = $1
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
                WHERE ua.id_usuario = $1
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

module.exports = { getAgenda };