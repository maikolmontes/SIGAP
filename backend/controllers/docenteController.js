const pool = require('../db/connection');

const getDashboard = async (req, res) => {
    const idUsuario = req.user.id;

    try {
        // 1. Datos del docente
        const docenteQuery = await pool.query(`
            SELECT
                u.nombres,
                u.apellidos,
                pa.nombre_programa AS programa,
                tc.tipo AS tipo_contrato,
                COALESCE(tc.horas_contrato, 40) AS total_horas_contrato
            FROM USUARIOS u
            JOIN TIPO_CONTRATO tc ON tc.id_contrato = u.id_contrato
            JOIN PROGRAMA_ACADEMICO pa ON pa.id_programa = u.id_programa
            WHERE u.id_usuario = $1
            LIMIT 1
        `, [idUsuario]);

        if (docenteQuery.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontró información del docente.' });
        }

        const docenteRow = docenteQuery.rows[0];

        // 2. Buscar el periodo activo desde asignacion_funciones del docente
        //    (el director importa y asigna id_periodo directamente)
        //    Fallback: periodo activo global
        const periodoRes = await pool.query(`
            SELECT DISTINCT
                p.id_periodo,
                p.anio,
                p.semestre,
                p.fecha_fin,
                p.activo
            FROM USUARIO_ASIGNACION ua
            JOIN ASIGNACION_FUNCIONES af ON af.id_funciones = ua.id_funciones
            JOIN PERIODO p ON p.id_periodo = af.id_periodo
            WHERE ua.id_usuario = $1 AND p.activo = true
            LIMIT 1
        `, [idUsuario]);

        // Si no tiene funciones en el periodo activo, buscar el periodo activo global
        let periodoRow = periodoRes.rows[0];
        if (!periodoRow) {
            const globalPeriodo = await pool.query(
                'SELECT id_periodo, anio, semestre, fecha_fin, activo FROM PERIODO WHERE activo = true LIMIT 1'
            );
            periodoRow = globalPeriodo.rows[0] || null;
        }

        const idPeriodoActivo = periodoRow?.id_periodo || null;

        // 3. Distribución de horas por función sustantiva
        const distribucionQuery = await pool.query(`
            SELECT
                af.funcion_sustantiva AS funcion,
                COALESCE(af.horas_funcion, 0) AS horas_asignadas
            FROM USUARIO_ASIGNACION ua
            JOIN ASIGNACION_FUNCIONES af ON af.id_funciones = ua.id_funciones
            WHERE ua.id_usuario = $1 AND af.id_periodo = $2
            ORDER BY af.funcion_sustantiva
        `, [idUsuario, idPeriodoActivo]);


        // 3. Avance por función sustantiva basado en indicadores (ejecucion_8 + ejecucion_16 vs meta)
        const avanceQuery = await pool.query(`
            SELECT
                af.funcion_sustantiva AS actividad,
                COALESCE(SUM(d.meta), 0) AS meta_total,
                COALESCE(SUM(i.ejecucion_8), 0) AS ejec_8,
                COALESCE(SUM(i.ejecucion_16), 0) AS ejec_16
            FROM USUARIO_ASIGNACION ua
            JOIN ASIGNACION_FUNCIONES af ON af.id_funciones = ua.id_funciones
            JOIN ASIGNACION_ACTIVIDADES aa ON aa.id_funciones = af.id_funciones
            JOIN DESCRIPCION d ON d.id_asignacionact = aa.id_asignacionact
            JOIN INDICADORES i ON i.id_descripcion = d.id_descripcion
            WHERE ua.id_usuario = $1 AND af.id_periodo = $2
            GROUP BY af.funcion_sustantiva
            ORDER BY af.funcion_sustantiva
        `, [idUsuario, docenteRow.id_periodo_activo || null]);

        // 4. Evidencias pendientes
        const evidenciasQuery = await pool.query(`
            SELECT COUNT(*) AS pendientes
            FROM INDICADORES i
            JOIN DESCRIPCION d ON d.id_descripcion = i.id_descripcion
            JOIN ASIGNACION_ACTIVIDADES aa ON aa.id_asignacionact = d.id_asignacionact
            JOIN USUARIO_ASIGNACION ua ON ua.id_funciones = aa.id_funciones
            JOIN ASIGNACION_FUNCIONES af ON af.id_funciones = ua.id_funciones
            LEFT JOIN EVIDENCIAS e ON e.id_indicadores = i.id_indicadores
            WHERE ua.id_usuario = $1 AND af.id_periodo = $2 AND e.id_evidencias IS NULL
        `, [idUsuario, docenteRow.id_periodo_activo || null]);

        // 5. Estado de la agenda (funciones aceptadas)
        const estadoFuncionesQuery = await pool.query(`
            SELECT
                af.estado_agenda,
                COUNT(*) AS cantidad
            FROM USUARIO_ASIGNACION ua
            JOIN ASIGNACION_FUNCIONES af ON af.id_funciones = ua.id_funciones
            WHERE ua.id_usuario = $1 AND af.id_periodo = $2
            GROUP BY af.estado_agenda
        `, [idUsuario, docenteRow.id_periodo_activo || null]);

        // 6. Total horas de ejecucion (suma ejecucion_8 + ejecucion_16)
        const horasEjecucionQuery = await pool.query(`
            SELECT
                COALESCE(SUM(i.ejecucion_8), 0) + COALESCE(SUM(i.ejecucion_16), 0) AS total_ejecucion
            FROM INDICADORES i
            JOIN DESCRIPCION d ON d.id_descripcion = i.id_descripcion
            JOIN ASIGNACION_ACTIVIDADES aa ON aa.id_asignacionact = d.id_asignacionact
            JOIN USUARIO_ASIGNACION ua ON ua.id_funciones = aa.id_funciones
            JOIN ASIGNACION_FUNCIONES af ON af.id_funciones = ua.id_funciones
            WHERE ua.id_usuario = $1 AND af.id_periodo = $2
        `, [idUsuario, docenteRow.id_periodo_activo || null]);


        // Procesar datos - distribución de horas
        let horasDirectas = 0;
        let horasInvestigacion = 0;

        const distribucionHoras = distribucionQuery.rows.map(row => {
            const horas = parseFloat(row.horas_asignadas) || 0;
            if (row.funcion === 'Docencia Directa') horasDirectas = horas;
            if (row.funcion === 'Investigación') horasInvestigacion = horas;
            return {
                funcion: row.funcion,
                horas: horas
            };
        });

        // 1. Docencia Indirecta (automática)
        const docenciaIndirecta = Math.round(horasDirectas * 0.3);
        const indexIndirecta = distribucionHoras.findIndex(d => d.funcion === 'Docencia Indirecta');
        if (indexIndirecta !== -1) {
            distribucionHoras[indexIndirecta].horas = docenciaIndirecta;
        } else if (horasDirectas > 0) {
            distribucionHoras.push({ funcion: 'Docencia Indirecta', horas: docenciaIndirecta });
        }

        const totalHoras = distribucionHoras.reduce((sum, item) => sum + item.horas, 0);

        // 2. Validación de consistencia
        const tipoContrato = (docenteRow.tipo_contrato || '').toUpperCase();
        let perfilDocente = "INCONSISTENCIAS EN AGENDA AC 30";

        if (tipoContrato === "TIEMPO COMPLETO" && horasInvestigacion >= 14 && horasInvestigacion <= 20) {
            perfilDocente = "DOCENTE INVESTIGADOR";
        } else if (tipoContrato === "TIEMPO COMPLETO" && horasDirectas >= 21 && horasDirectas <= 30) {
            perfilDocente = "TC CON DEDICACIÓN A LA DOCENCIA";
        } else if (tipoContrato === "MEDIO TIEMPO" && horasDirectas <= 15) {
            perfilDocente = "MT CON DEDICACIÓN A LA DOCENCIA";
        } else if (tipoContrato === "HORA CATEDRA" && horasDirectas <= 6) {
            perfilDocente = "DOCENTE HORA CATEDRA";
        }

        // Avance por función sustantiva basado en indicadores reales
        const avanceSemana8 = avanceQuery.rows.map(row => {
            const meta = parseFloat(row.meta_total) || 0;
            const ejec = parseFloat(row.ejec_8) || 0;
            const porcentaje = meta > 0 ? Math.min(Math.round((ejec / meta) * 100), 100) : 0;
            return { actividad: row.actividad, porcentaje, ejec8: ejec, ejec16: parseFloat(row.ejec_16) || 0, meta };
        });

        const avancePromedio = avanceSemana8.length > 0
            ? Math.round(avanceSemana8.reduce((sum, item) => sum + item.porcentaje, 0) / avanceSemana8.length)
            : 0;

        let evidenciasPendientes = 0;
        try { evidenciasPendientes = parseInt(evidenciasQuery.rows[0]?.pendientes, 10) || 0; } catch {}

        const totalHorasEjecucion = parseFloat(horasEjecucionQuery.rows[0]?.total_ejecucion) || 0;

        // Avance general: promedio de (ejec_8 + ejec_16) / meta por cada función
        const avanceGeneral = avanceSemana8.length > 0
            ? Math.round(avanceSemana8.reduce((sum, item) => {
                const meta = item.meta || 0;
                const total = (item.ejec8 || 0) + (item.ejec16 || 0);
                return sum + (meta > 0 ? Math.min((total / meta) * 100, 100) : 0);
              }, 0) / avanceSemana8.length)
            : 0;

        // Estado de la agenda basado en funciones aceptadas
        const funcionesAceptadas = estadoFuncionesQuery.rows.find(r => r.estado_agenda === 'Aceptado');
        const totalFunciones = estadoFuncionesQuery.rows.reduce((sum, r) => sum + parseInt(r.cantidad), 0);
        const estadoAgenda = {
            semana8: 'Pendiente',
            semana16: 'Pendiente',
            funcionesAsignadas: totalFunciones > 0,
            totalFunciones,
            funcionesAceptadas: funcionesAceptadas ? parseInt(funcionesAceptadas.cantidad) : 0
        };

        // Formatear período usando periodoRow
        const periodoLabel = periodoRow
            ? `${periodoRow.semestre === 1 ? 'I' : 'II'} - ${periodoRow.anio}`
            : 'Sin período activo';

        res.json({
            docente: {
                nombre: `${docenteRow.nombres} ${docenteRow.apellidos}`,
                programa: docenteRow.programa || 'Sin programa',
                tipoContrato: docenteRow.tipo_contrato || 'Sin contrato',
                periodo: periodoLabel,
                cierre: periodoRow?.fecha_fin || null,
                periodoActivo: !!periodoRow?.activo,
                totalHorasContrato: parseFloat(docenteRow.total_horas_contrato) || 40,
                perfilDocente: perfilDocente
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

// ================================================================
// getAgendasPorPeriodo:
// Devuelve las funciones y actividades del docente agrupadas por
// período académico, para visualización histórica (solo lectura).
// ================================================================
const getAgendasPorPeriodo = async (req, res) => {
    const idUsuario = req.user.id;

    try {
        // Obtener todos los períodos con funciones asignadas al docente
        const periodosQuery = await pool.query(`
            SELECT DISTINCT
                p.id_periodo,
                p.anio,
                p.semestre,
                p.fecha_inicio,
                p.fecha_fin,
                p.activo
            FROM periodo p
            JOIN asignacion_funciones af ON af.id_periodo = p.id_periodo
            JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
            WHERE ua.id_usuario = $1
            ORDER BY p.anio DESC, p.semestre DESC
        `, [idUsuario]);

        if (periodosQuery.rows.length === 0) {
            return res.json([]);
        }

        const agendas = [];

        for (const periodo of periodosQuery.rows) {
            // Funciones del docente
            const funcionesQuery = await pool.query(`
                SELECT
                    af.id_funciones,
                    af.funcion_sustantiva,
                    af.horas_funcion,
                    af.estado_agenda
                FROM usuario_asignacion ua
                JOIN asignacion_funciones af ON ua.id_funciones = af.id_funciones
                WHERE ua.id_usuario = $1 AND af.id_periodo = $2
                ORDER BY af.id_funciones
            `, [idUsuario, periodo.id_periodo]);

            // Actividades con descripción e indicadores
            const actividadesQuery = await pool.query(`
                SELECT
                    aa.id_asignacionact,
                    aa.id_funciones,
                    aa.rol_seleccionado,
                    aa.horas_rol,
                    ea.nombre_espacio,
                    d.resultado_esperado,
                    d.meta,
                    STRING_AGG(i.nombre_indicador, ' | ') AS indicadores
                FROM usuario_asignacion ua
                JOIN asignacion_funciones af    ON ua.id_funciones     = af.id_funciones
                JOIN asignacion_actividades aa  ON af.id_funciones     = aa.id_funciones
                LEFT JOIN espacio_academico ea  ON aa.id_espacio_aca   = ea.id_espacio_aca
                LEFT JOIN descripcion d         ON aa.id_asignacionact = d.id_asignacionact
                LEFT JOIN indicadores i         ON i.id_descripcion    = d.id_descripcion
                WHERE ua.id_usuario = $1 AND af.id_periodo = $2
                GROUP BY aa.id_asignacionact, aa.id_funciones, aa.rol_seleccionado,
                         aa.horas_rol, ea.nombre_espacio, d.resultado_esperado, d.meta
                ORDER BY aa.id_funciones, aa.id_asignacionact
            `, [idUsuario, periodo.id_periodo]);

            agendas.push({
                periodo: {
                    id_periodo: periodo.id_periodo,
                    anio: periodo.anio,
                    semestre: periodo.semestre,
                    fecha_inicio: periodo.fecha_inicio,
                    fecha_fin: periodo.fecha_fin,
                    activo: periodo.activo
                },
                funciones: funcionesQuery.rows,
                actividades: actividadesQuery.rows
            });
        }

        res.json(agendas);
    } catch (error) {
        console.error('Error en getAgendasPorPeriodo:', error);
        res.status(500).json({ error: 'Error al obtener las agendas por período: ' + error.message });
    }
};

module.exports = { getDashboard, getAgendasPorPeriodo };
