const pool = require('../db/connection');

const getDashboard = async (req, res) => {
    const idUsuario = req.user.id;

    try {
        // 1. Datos del docente y período activo
        const docenteQuery = await pool.query(`
            SELECT
                u.nombres,
                u.apellidos,
                pa.nombre_programa AS programa,
                tc.tipo AS tipo_contrato,
                p.semestre AS periodo_semestre,
                p.anio AS periodo_anio,
                p.fecha_fin AS cierre,
                COALESCE(tc.horas_contrato, 40) AS total_horas_contrato
            FROM USUARIOS u
            JOIN TIPO_CONTRATO tc ON tc.id_contrato = u.id_contrato
            JOIN PROGRAMA_ACADEMICO pa ON pa.id_programa = u.id_programa
            LEFT JOIN PROGRAMA_PERIODO pp ON pp.id_programa = pa.id_programa
            LEFT JOIN PERIODO p ON p.id_periodo = pp.id_periodo AND p.activo = true
            WHERE u.id_usuario = $1
            LIMIT 1
        `, [idUsuario]);

        if (docenteQuery.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontró información del docente o no hay período activo.' });
        }

        const docenteRow = docenteQuery.rows[0];

        // 2. Distribución de horas por función sustantiva
        const distribucionQuery = await pool.query(`
            SELECT
                af.funcion_sustantiva AS funcion,
                COALESCE(af.horas_funcion, 0) AS horas_asignadas
            FROM USUARIO_ASIGNACION ua
            JOIN ASIGNACION_FUNCIONES af ON af.id_funciones = ua.id_funciones
            WHERE ua.id_usuario = $1
            ORDER BY af.funcion_sustantiva
        `, [idUsuario]);

        // 3. Avance por actividad en Semana 8
        const avanceQuery = await pool.query(`
            SELECT
                ea.nombre_espacio AS actividad,
                COALESCE(r.porcentaje_avance, 0) AS porcentaje_avance
            FROM ACTIVIDAD_SEMANA ac
            JOIN SEMANA s ON s.id_semana = ac.id_semana AND s.numero_semana = '8'
            JOIN ASIGNACION_ACTIVIDADES aa ON aa.id_asignacionact = ac.id_asignacionact
            JOIN ESPACIO_ACADEMICO ea ON ea.id_espacio_aca = aa.id_espacio_aca
            JOIN USUARIO_ASIGNACION ua ON ua.id_funciones = aa.id_funciones
            LEFT JOIN RESULTADOS r ON r.id_resultados = ac.id_resultados
            WHERE ua.id_usuario = $1
            ORDER BY ea.nombre_espacio
        `, [idUsuario]);

        // 4. Evidencias pendientes (contamos indicadores sin evidencias cargadas)
        const evidenciasQuery = await pool.query(`
            SELECT COUNT(*) AS pendientes
            FROM INDICADORES i
            JOIN DESCRIPCION d ON d.id_descripcion = i.id_descripcion
            JOIN ASIGNACION_ACTIVIDADES aa ON aa.id_asignacionact = d.id_asignacionact
            JOIN USUARIO_ASIGNACION ua ON ua.id_funciones = aa.id_funciones
            LEFT JOIN EVIDENCIAS e ON e.id_indicadores = i.id_indicadores
            WHERE ua.id_usuario = $1 AND e.id_evidencias IS NULL
        `, [idUsuario]);

        // 5. Estado de la agenda (semanas 8 y 16)
        const estadoQuery = await pool.query(`
            SELECT
                s.numero_semana AS semana,
                ac.estado_aprobacion AS estado
            FROM ACTIVIDAD_SEMANA ac
            JOIN SEMANA s ON s.id_semana = ac.id_semana
            JOIN ASIGNACION_ACTIVIDADES aa ON aa.id_asignacionact = ac.id_asignacionact
            JOIN USUARIO_ASIGNACION ua ON ua.id_funciones = aa.id_funciones
            WHERE ua.id_usuario = $1 AND s.numero_semana IN ('8', '16')
            GROUP BY s.numero_semana, ac.estado_aprobacion
        `, [idUsuario]);

        // 6. Total de horas registradas en ejecución (suma de ejecucion de ACTIVIDAD_SEMANA)
        const horasEjecucionQuery = await pool.query(`
            SELECT
                COALESCE(SUM(ac.ejecucion), 0) AS total_ejecucion
            FROM ACTIVIDAD_SEMANA ac
            JOIN ASIGNACION_ACTIVIDADES aa ON aa.id_asignacionact = ac.id_asignacionact
            JOIN USUARIO_ASIGNACION ua ON ua.id_funciones = aa.id_funciones
            WHERE ua.id_usuario = $1
        `, [idUsuario]);

        // 7. Avance general (promedio de todos los porcentajes_avance)
        const avanceGeneralQuery = await pool.query(`
            SELECT
                COALESCE(AVG(r.porcentaje_avance), 0) AS avance_promedio
            FROM RESULTADOS r
            JOIN ACTIVIDAD_SEMANA ac ON ac.id_resultados = r.id_resultados
            JOIN ASIGNACION_ACTIVIDADES aa ON aa.id_asignacionact = ac.id_asignacionact
            JOIN USUARIO_ASIGNACION ua ON ua.id_funciones = aa.id_funciones
            WHERE ua.id_usuario = $1
        `, [idUsuario]);

        // Procesar datos
        const distribucionHoras = distribucionQuery.rows.map(row => ({
            funcion: row.funcion,
            horas: parseFloat(row.horas_asignadas) || 0
        }));

        const totalHoras = distribucionHoras.reduce((sum, item) => sum + item.horas, 0);

        const avanceSemana8 = avanceQuery.rows.map(row => ({
            actividad: row.actividad,
            porcentaje: Math.round(parseFloat(row.porcentaje_avance) || 0)
        }));

        const avancePromedio = avanceSemana8.length > 0
            ? Math.round(avanceSemana8.reduce((sum, item) => sum + item.porcentaje, 0) / avanceSemana8.length)
            : 0;

        const evidenciasPendientes = parseInt(evidenciasQuery.rows[0].pendientes, 10);

        // Horas de ejecución y avance general
        const totalHorasEjecucion = parseFloat(horasEjecucionQuery.rows[0].total_ejecucion) || 0;
        const avanceGeneral = Math.round(parseFloat(avanceGeneralQuery.rows[0].avance_promedio) || 0);

        const estadoAgenda = {
            semana8: 'Pendiente',
            semana16: 'Pendiente',
            funcionesAsignadas: distribucionHoras.length > 0
        };

        estadoQuery.rows.forEach(row => {
            if (row.semana === '8') {
                estadoAgenda.semana8 = row.estado || 'Pendiente';
            } else if (row.semana === '16') {
                estadoAgenda.semana16 = row.estado || 'Pendiente';
            }
        });

        // Formatear período
        const periodoLabel = docenteRow.periodo_semestre
            ? `${docenteRow.periodo_semestre} ${docenteRow.periodo_anio}`
            : 'Sin período';

        res.json({
            docente: {
                nombre: `${docenteRow.nombres} ${docenteRow.apellidos}`,
                programa: docenteRow.programa || 'Sin programa',
                tipoContrato: docenteRow.tipo_contrato || 'Sin contrato',
                periodo: periodoLabel,
                cierre: docenteRow.cierre,
                totalHorasContrato: parseFloat(docenteRow.total_horas_contrato) || 40
            },
            metricas: {
                totalHoras,
                avancePromedioSemana8: avancePromedio,
                funcionesSustantivas: distribucionHoras.length,
                evidenciasPendientes: evidenciasPendientes,
                totalHorasEjecucion,
                avanceGeneral
            },
            distribucionHoras,
            avanceSemana8,
            estadoAgenda
        });

    } catch (error) {
        console.error('Error en docenteController.getDashboard:', error);
        res.status(500).json({ error: 'Ocurrió un error al obtener el dashboard: ' + error.message });
    }
};

module.exports = { getDashboard };
