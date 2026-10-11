const pool = require('../db/connection');
const { perfilAgenda, revisarIndirecta } = require('../utils/perfilAgenda');
const { etiquetaSemestre } = require('../utils/periodo');
const { calcularAvanceGeneral } = require('../utils/avanceDocente');
const { construirReporteDocente, ReporteDocenteError } = require('../services/reporteDocente');

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
                COALESCE(tc.horas_contrato, 0) AS total_horas_contrato
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
              AND COALESCE(d.activo, TRUE) = TRUE
              AND COALESCE(i.activo, TRUE) = TRUE
            GROUP BY af.funcion_sustantiva
            ORDER BY af.funcion_sustantiva
        `, [idUsuario, idPeriodoActivo]);

        // 3b. Indicadores del docente en el período activo y cuántos ya tienen avance reportado
        const indicadoresQuery = await pool.query(`
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE COALESCE(i.ejecucion_8, 0) + COALESCE(i.ejecucion_16, 0) > 0)::int AS con_avance
            FROM INDICADORES i
            JOIN DESCRIPCION d ON d.id_descripcion = i.id_descripcion
            JOIN ASIGNACION_ACTIVIDADES aa ON aa.id_asignacionact = d.id_asignacionact
            JOIN USUARIO_ASIGNACION ua ON ua.id_funciones = aa.id_funciones
            JOIN ASIGNACION_FUNCIONES af ON af.id_funciones = ua.id_funciones
            WHERE ua.id_usuario = $1 AND af.id_periodo = $2
              AND COALESCE(i.activo, TRUE) = TRUE
              AND COALESCE(d.activo, TRUE) = TRUE
        `, [idUsuario, idPeriodoActivo]);

        // 4b. Evidencias pendientes por período (total de pendientes)
        const evidenciasPorPeriodoQuery = await pool.query(`
            SELECT
                p.id_periodo,
                p.anio,
                p.semestre,
                COUNT(*) AS pendientes
            FROM INDICADORES i
            JOIN DESCRIPCION d ON d.id_descripcion = i.id_descripcion
            JOIN ASIGNACION_ACTIVIDADES aa ON aa.id_asignacionact = d.id_asignacionact
            JOIN USUARIO_ASIGNACION ua ON ua.id_funciones = aa.id_funciones
            JOIN ASIGNACION_FUNCIONES af ON af.id_funciones = ua.id_funciones
            JOIN PERIODO p ON p.id_periodo = af.id_periodo
            LEFT JOIN EVIDENCIAS e ON e.id_indicadores = i.id_indicadores
            WHERE ua.id_usuario = $1
              AND e.id_evidencias IS NULL
              AND COALESCE(i.activo, TRUE) = TRUE
              AND COALESCE(d.activo, TRUE) = TRUE
            GROUP BY p.id_periodo, p.anio, p.semestre
            ORDER BY p.anio DESC, p.semestre DESC
        `, [idUsuario]);

        // 4c. Evidencias subidas (presentes) por período
        const evidenciasSubidasPorPeriodoQuery = await pool.query(`
            SELECT
                p.id_periodo,
                p.anio,
                p.semestre,
                COUNT(*) AS subidas
            FROM EVIDENCIAS e
            JOIN INDICADORES i ON i.id_indicadores = e.id_indicadores
            JOIN DESCRIPCION d ON d.id_descripcion = i.id_descripcion
            JOIN ASIGNACION_ACTIVIDADES aa ON aa.id_asignacionact = d.id_asignacionact
            JOIN USUARIO_ASIGNACION ua ON ua.id_funciones = aa.id_funciones
            JOIN ASIGNACION_FUNCIONES af ON af.id_funciones = ua.id_funciones
            JOIN PERIODO p ON p.id_periodo = af.id_periodo
            WHERE ua.id_usuario = $1
              AND COALESCE(i.activo, TRUE) = TRUE
              AND COALESCE(d.activo, TRUE) = TRUE
            GROUP BY p.id_periodo, p.anio, p.semestre
            ORDER BY p.anio DESC, p.semestre DESC
        `, [idUsuario]);



        // 5. Estado de la agenda (funciones aceptadas)
        const estadoFuncionesQuery = await pool.query(`
            SELECT
                af.estado_agenda,
                COUNT(*) AS cantidad
            FROM USUARIO_ASIGNACION ua
            JOIN ASIGNACION_FUNCIONES af ON af.id_funciones = ua.id_funciones
            WHERE ua.id_usuario = $1 AND af.id_periodo = $2
            GROUP BY af.estado_agenda
        `, [idUsuario, idPeriodoActivo]);

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
              AND COALESCE(i.activo, TRUE) = TRUE
              AND COALESCE(d.activo, TRUE) = TRUE
        `, [idUsuario, idPeriodoActivo]);


        // Procesar datos - distribución de horas
        let horasDirectas = 0;
        let horasIndirectas = 0;

        const distribucionHoras = distribucionQuery.rows.map(row => {
            const horas = parseFloat(row.horas_asignadas) || 0;
            if (row.funcion === 'Docencia Directa') horasDirectas += horas;
            if (row.funcion === 'Docencia Indirecta') horasIndirectas += horas;
            return {
                funcion: row.funcion,
                horas: horas
            };
        });

        // 1. Docencia Indirecta: se muestra la asignada y se compara con el 30 %
        //    (antes se reemplazaba por el 30 % y el tablero no cuadraba con la agenda)
        const indirecta = revisarIndirecta(horasDirectas, horasIndirectas);

        const totalHoras = distribucionHoras.reduce((sum, item) => sum + item.horas, 0);

        // 2. Validación de consistencia: total de horas frente al contrato
        const perfilDocente = perfilAgenda(totalHoras, docenteRow.total_horas_contrato);

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
        const activePeriodPendingRow = evidenciasPorPeriodoQuery.rows.find(row => row.id_periodo === idPeriodoActivo);
        if (activePeriodPendingRow) {
            evidenciasPendientes = parseInt(activePeriodPendingRow.pendientes, 10) || 0;
        }

        // Evidencias que el docente SUBIÓ en el período activo (no los indicadores que aún no tienen)
        const subidasPeriodoActivo = evidenciasSubidasPorPeriodoQuery.rows.find(row => row.id_periodo === idPeriodoActivo);
        const evidenciasSubidas = subidasPeriodoActivo ? parseInt(subidasPeriodoActivo.subidas, 10) || 0 : 0;

        const totalHorasEjecucion = parseFloat(horasEjecucionQuery.rows[0]?.total_ejecucion) || 0;

        // Avance general = Σ ejecución / Σ meta (llega a 100 solo cuando todo está completo)
        const { metaTotal, ejecucionCumplida, avanceGeneral } = calcularAvanceGeneral(avanceSemana8);
        const indicadoresTotal = indicadoresQuery.rows[0]?.total || 0;
        const indicadoresConAvance = indicadoresQuery.rows[0]?.con_avance || 0;

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
            ? `${etiquetaSemestre(periodoRow.semestre)} - ${periodoRow.anio}`
            : 'Sin período activo';

        // Preparar evidencias por período para UI
        const evidenciasPorPeriodo = evidenciasPorPeriodoQuery.rows.map(row => ({
            idPeriodo: row.id_periodo,
            label: `${etiquetaSemestre(row.semestre)} - ${row.anio}`,
            pendientes: parseInt(row.pendientes, 10) || 0
        }));

        // Preparar evidencias subidas por período para UI
        const evidenciasSubidasPorPeriodo = evidenciasSubidasPorPeriodoQuery.rows.map(row => ({
            idPeriodo: row.id_periodo,
            label: `${etiquetaSemestre(row.semestre)} - ${row.anio}`,
            subidas: parseInt(row.subidas, 10) || 0
        }));


        res.json({
            docente: {
                nombre: `${docenteRow.nombres} ${docenteRow.apellidos}`,
                programa: docenteRow.programa || 'Sin programa',
                tipoContrato: docenteRow.tipo_contrato || 'Sin contrato',
                periodo: periodoLabel,
                cierre: periodoRow?.fecha_fin || null,
                periodoActivo: !!periodoRow?.activo,
                totalHorasContrato: parseFloat(docenteRow.total_horas_contrato) || 0,
                perfilDocente: perfilDocente,
                docenciaIndirecta: indirecta.asignada,
                docenciaIndirectaEsperada: indirecta.esperada,
                indirectaCumpleAc030: indirecta.cumple
            },
            metricas: {
                totalHoras,
                avancePromedioSemana8: avancePromedio,
                funcionesSustantivas: distribucionHoras.length,
                evidenciasPendientes: evidenciasPendientes,
                evidenciasSubidas,
                totalHorasEjecucion,
                avanceGeneral,
                metaTotal,
                ejecucionCumplida,
                indicadoresTotal,
                indicadoresConAvance,
                evidenciasPorPeriodo,
                evidenciasSubidasPorPeriodo
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

// ================================================================
// GET /api/docente/reporte-evidencias?periodo=
// Informe del propio docente (avance + evidencias) en un período; por omisión, el activo.
// Devuelve el documento ya redactado: el frontend lo muestra y lo convierte en Word o PDF.
// ================================================================
const getReporteEvidencias = async (req, res) => {
    try {
        const idUsuario = Number(req.user?.id ?? req.user?.id_usuario);
        if (!Number.isInteger(idUsuario) || idUsuario <= 0) return res.status(401).json({ error: 'Sesión inválida.' });

        let idPeriodo = Number(req.query.periodo);
        if (!Number.isInteger(idPeriodo) || idPeriodo <= 0) {
            const activo = (await pool.query('SELECT id_periodo FROM periodo WHERE activo = TRUE LIMIT 1')).rows[0];
            if (!activo) return res.status(404).json({ error: 'No hay un período activo.' });
            idPeriodo = activo.id_periodo;
        }
        res.json(await construirReporteDocente(pool, { idUsuario, idPeriodo }));
    } catch (error) {
        if (error instanceof ReporteDocenteError) return res.status(error.estado).json({ error: error.message });
        console.error('Error en getReporteEvidencias:', error);
        res.status(500).json({ error: 'No se pudo generar el informe.' });
    }
};

module.exports = { getDashboard, getAgendasPorPeriodo, getReporteEvidencias };
