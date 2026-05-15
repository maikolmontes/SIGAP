/**
 * Controller para revisión de agendas — Módulo Director
 * Endpoints de supervisión: listar agendas, aprobar, devolver, observaciones, reportes
 */
const pool = require('../db/connection');

// ================================================================
// Helper: Calcular perfil docente según Acuerdo 030/2024
// ================================================================
const calcularPerfilDocente = (tipoContrato, horasDirectas, horasInvestigacion) => {
    const tc = (tipoContrato || '').toUpperCase();
    const hd = parseFloat(horasDirectas) || 0;
    const hi = parseFloat(horasInvestigacion) || 0;

    if (tc === 'TIEMPO COMPLETO' && hi >= 14 && hi <= 20) return 'DOCENTE INVESTIGADOR';
    if (tc === 'TIEMPO COMPLETO' && hd >= 21 && hd <= 30) return 'TC CON DEDICACIÓN A LA DOCENCIA';
    if (tc === 'MEDIO TIEMPO' && hd <= 15) return 'MT CON DEDICACIÓN A LA DOCENCIA';
    if (tc === 'HORA CATEDRA' && hd <= 6) return 'DOCENTE HORA CATEDRA';
    return 'INCONSISTENCIAS EN AGENDA AC 30';
};

// ================================================================
// GET /api/director/agendas
// Lista las agendas (agrupadas por docente) del periodo activo
// Query params: ?estado=Pendiente&programa=X&periodo=X
// ================================================================
const getAgendas = async (req, res) => {
    try {
        const { estado, programa, periodo } = req.query;

        // Determinar periodo a consultar
        let idPeriodo;
        if (periodo) {
            idPeriodo = parseInt(periodo);
        } else {
            const periodoRes = await pool.query('SELECT id_periodo FROM periodo WHERE activo = true LIMIT 1');
            if (periodoRes.rows.length === 0) {
                return res.json({ agendas: [], periodo: null });
            }
            idPeriodo = periodoRes.rows[0].id_periodo;
        }

        const periodoInfo = await pool.query('SELECT * FROM periodo WHERE id_periodo = $1', [idPeriodo]);

        // Traer docentes con sus funciones agrupadas
        let query = `
            SELECT
                u.id_usuario,
                u.nombres || ' ' || u.apellidos AS nombre_docente,
                u.correo,
                pa.nombre_programa,
                tc.tipo AS tipo_contrato,
                tc.horas_contrato,
                af.id_funciones,
                af.funcion_sustantiva,
                af.horas_funcion,
                af.estado_agenda,
                af.observaciones_generales,
                af.revisado_por,
                af.fecha_revision,
                COALESCE(rev.nombres || ' ' || rev.apellidos, NULL) AS revisado_por_nombre
            FROM usuarios u
            JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
            JOIN roles r ON r.id_rol = ur.id_rol AND LOWER(r.nombre_rol) = 'docente'
            JOIN tipo_contrato tc ON tc.id_contrato = u.id_contrato
            JOIN programa_academico pa ON pa.id_programa = u.id_programa
            JOIN usuario_asignacion ua ON ua.id_usuario = u.id_usuario
            JOIN asignacion_funciones af ON af.id_funciones = ua.id_funciones AND af.id_periodo = $1
            LEFT JOIN usuarios rev ON rev.id_usuario = af.revisado_por
            WHERE u.activo = TRUE
        `;
        const params = [idPeriodo];
        let paramIdx = 2;

        if (estado) {
            query += ` AND af.estado_agenda = $${paramIdx}`;
            params.push(estado);
            paramIdx++;
        }
        if (programa) {
            query += ` AND pa.nombre_programa ILIKE $${paramIdx}`;
            params.push(`%${programa}%`);
            paramIdx++;
        }

        query += ` ORDER BY u.apellidos, u.nombres, af.funcion_sustantiva`;

        const result = await pool.query(query, params);

        // Agrupar por docente
        const docentesMap = new Map();
        for (const row of result.rows) {
            const key = row.id_usuario;
            if (!docentesMap.has(key)) {
                docentesMap.set(key, {
                    id_usuario: row.id_usuario,
                    nombre_docente: row.nombre_docente,
                    correo: row.correo,
                    nombre_programa: row.nombre_programa,
                    tipo_contrato: row.tipo_contrato,
                    horas_contrato: row.horas_contrato,
                    funciones: [],
                    horas_directas: 0,
                    horas_investigacion: 0,
                    total_horas: 0,
                    estado_general: 'Pendiente',
                    fecha_revision: null,
                    revisado_por_nombre: null
                });
            }
            const docente = docentesMap.get(key);
            docente.funciones.push({
                id_funciones: row.id_funciones,
                funcion_sustantiva: row.funcion_sustantiva,
                horas_funcion: parseFloat(row.horas_funcion) || 0,
                estado_agenda: row.estado_agenda,
                observaciones_generales: row.observaciones_generales
            });
            docente.total_horas += parseFloat(row.horas_funcion) || 0;
            if (row.funcion_sustantiva === 'Docencia Directa') {
                docente.horas_directas += parseFloat(row.horas_funcion) || 0;
            }
            if (row.funcion_sustantiva && row.funcion_sustantiva.toLowerCase().includes('investigación')) {
                docente.horas_investigacion += parseFloat(row.horas_funcion) || 0;
            }
            if (row.fecha_revision) docente.fecha_revision = row.fecha_revision;
            if (row.revisado_por_nombre) docente.revisado_por_nombre = row.revisado_por_nombre;
        }

        // Calcular perfil y estado general por docente
        const agendas = Array.from(docentesMap.values()).map(d => {
            d.perfil_docente = calcularPerfilDocente(d.tipo_contrato, d.horas_directas, d.horas_investigacion);

            // Estado general: si alguna función fue devuelta → Devuelta,
            // si todas aprobadas → Aprobada, si alguna aceptada → Aceptado, sino Pendiente
            const estados = d.funciones.map(f => f.estado_agenda);
            if (estados.includes('Devuelta')) d.estado_general = 'Devuelta';
            else if (estados.every(e => e === 'Aprobada')) d.estado_general = 'Aprobada';
            else if (estados.every(e => e === 'Aceptado' || e === 'Aprobada')) d.estado_general = 'Aceptado';
            else d.estado_general = 'Pendiente';

            return d;
        });

        res.json({
            agendas,
            periodo: periodoInfo.rows[0] || null
        });

    } catch (error) {
        console.error('Error en getAgendas (director):', error);
        res.status(500).json({ error: 'Error al obtener agendas.', detalles: error.message });
    }
};

// ================================================================
// GET /api/director/agendas/:id
// Detalle completo de la agenda de un docente (todas sus funciones
// con actividades, descripciones, indicadores y evidencias)
// ================================================================
const getAgendaDetalle = async (req, res) => {
    try {
        const idUsuario = parseInt(req.params.id);

        // Obtener periodo activo
        const periodoRes = await pool.query('SELECT id_periodo FROM periodo WHERE activo = true LIMIT 1');
        const idPeriodo = periodoRes.rows.length > 0 ? periodoRes.rows[0].id_periodo : null;
        if (!idPeriodo) {
            return res.status(404).json({ error: 'No hay periodo activo.' });
        }

        // Info del docente
        const docenteRes = await pool.query(`
            SELECT
                u.id_usuario, u.nombres, u.apellidos,
                u.nombres || ' ' || u.apellidos AS nombre_completo,
                u.correo,
                pa.nombre_programa,
                tc.tipo AS tipo_contrato,
                tc.horas_contrato
            FROM usuarios u
            JOIN tipo_contrato tc ON tc.id_contrato = u.id_contrato
            JOIN programa_academico pa ON pa.id_programa = u.id_programa
            WHERE u.id_usuario = $1
        `, [idUsuario]);

        if (docenteRes.rows.length === 0) {
            return res.status(404).json({ error: 'Docente no encontrado.' });
        }
        const docente = docenteRes.rows[0];

        // Funciones del docente en el periodo activo
        const funcionesRes = await pool.query(`
            SELECT af.*
            FROM asignacion_funciones af
            JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
            WHERE ua.id_usuario = $1 AND af.id_periodo = $2
            ORDER BY af.funcion_sustantiva
        `, [idUsuario, idPeriodo]);

        let horasDirectas = 0;
        let horasInvestigacion = 0;

        // Para cada función, traer actividades con descripciones, indicadores, evidencias
        const funciones = [];
        for (const func of funcionesRes.rows) {
            const hf = parseFloat(func.horas_funcion) || 0;
            if (func.funcion_sustantiva === 'Docencia Directa') horasDirectas += hf;
            if (func.funcion_sustantiva && func.funcion_sustantiva.toLowerCase().includes('investigación')) horasInvestigacion += hf;

            // Actividades de esta función
            const actRes = await pool.query(`
                SELECT aa.*, ea.nombre_espacio, g.nombre_grupo
                FROM asignacion_actividades aa
                LEFT JOIN espacio_academico ea ON ea.id_espacio_aca = aa.id_espacio_aca
                LEFT JOIN grupos g ON g.id_grupos = aa.id_grupos
                WHERE aa.id_funciones = $1
                ORDER BY aa.orden
            `, [func.id_funciones]);

            const actividades = [];
            for (const act of actRes.rows) {
                // Descripciones
                const descRes = await pool.query(`
                    SELECT * FROM descripcion
                    WHERE id_asignacionact = $1 AND activo = TRUE
                    ORDER BY id_descripcion
                `, [act.id_asignacionact]);

                const descripciones = [];
                for (const desc of descRes.rows) {
                    // Indicadores
                    const indRes = await pool.query(`
                        SELECT * FROM indicadores
                        WHERE id_descripcion = $1 AND activo = TRUE
                        ORDER BY id_indicadores
                    `, [desc.id_descripcion]);

                    const indicadores = [];
                    for (const ind of indRes.rows) {
                        // Evidencias
                        const evRes = await pool.query(`
                            SELECT * FROM evidencias
                            WHERE id_indicadores = $1
                            ORDER BY fecha_carga DESC
                        `, [ind.id_indicadores]);

                        indicadores.push({
                            ...ind,
                            evidencias: evRes.rows
                        });
                    }

                    descripciones.push({
                        ...desc,
                        indicadores
                    });
                }

                // Observaciones del director para esta actividad
                const obsRes = await pool.query(`
                    SELECT od.*, u.nombres || ' ' || u.apellidos AS director_nombre
                    FROM observaciones_director od
                    LEFT JOIN usuarios u ON u.id_usuario = od.director_id
                    WHERE od.id_asignacionact = $1
                    ORDER BY od.semana, od.fecha DESC
                `, [act.id_asignacionact]);

                actividades.push({
                    ...act,
                    descripciones,
                    observaciones_director: obsRes.rows
                });
            }

            funciones.push({
                ...func,
                actividades
            });
        }

        // Calcular perfil docente
        const perfilDocente = calcularPerfilDocente(docente.tipo_contrato, horasDirectas, horasInvestigacion);

        // Docencia indirecta calculada
        const decimal = horasDirectas * 0.3;
        const docenciaIndirecta = decimal % 1 >= 0.5 ? Math.ceil(decimal) : Math.floor(decimal);

        res.json({
            docente,
            funciones,
            perfil_docente: perfilDocente,
            horas_directas: horasDirectas,
            horas_investigacion: horasInvestigacion,
            docencia_indirecta: docenciaIndirecta,
            periodo: periodoRes.rows[0] || null
        });

    } catch (error) {
        console.error('Error en getAgendaDetalle:', error);
        res.status(500).json({ error: 'Error al obtener detalle de agenda.', detalles: error.message });
    }
};

// ================================================================
// PUT /api/director/agendas/:id/aprobar
// Aprueba todas las funciones del docente en el periodo activo
// ================================================================
const aprobarAgenda = async (req, res) => {
    const client = await pool.connect();
    try {
        const idUsuario = parseInt(req.params.id);
        const directorId = req.user.id;

        await client.query('BEGIN');

        const periodoRes = await client.query('SELECT id_periodo FROM periodo WHERE activo = true LIMIT 1');
        if (periodoRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No hay periodo activo.' });
        }
        const idPeriodo = periodoRes.rows[0].id_periodo;

        const result = await client.query(`
            UPDATE asignacion_funciones af
            SET estado_agenda = 'Aprobada',
                revisado_por = $1,
                fecha_revision = NOW()
            FROM usuario_asignacion ua
            WHERE ua.id_funciones = af.id_funciones
            AND ua.id_usuario = $2
            AND af.id_periodo = $3
            AND af.estado_agenda IN ('Pendiente', 'Aceptado', 'Devuelta')
            RETURNING af.id_funciones
        `, [directorId, idUsuario, idPeriodo]);

        await client.query('COMMIT');

        res.json({
            mensaje: 'Agenda aprobada exitosamente.',
            funciones_aprobadas: result.rowCount
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en aprobarAgenda:', error);
        res.status(500).json({ error: 'Error al aprobar agenda.', detalles: error.message });
    } finally {
        client.release();
    }
};

// ================================================================
// PUT /api/director/agendas/:id/devolver
// Devuelve la agenda del docente con observación general obligatoria
// Body: { observacion_general }
// ================================================================
const devolverAgenda = async (req, res) => {
    const client = await pool.connect();
    try {
        const idUsuario = parseInt(req.params.id);
        const directorId = req.user.id;
        const { observacion_general } = req.body;

        if (!observacion_general || observacion_general.trim() === '') {
            return res.status(400).json({ error: 'La observación general es obligatoria al devolver una agenda.' });
        }

        await client.query('BEGIN');

        const periodoRes = await client.query('SELECT id_periodo FROM periodo WHERE activo = true LIMIT 1');
        if (periodoRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No hay periodo activo.' });
        }
        const idPeriodo = periodoRes.rows[0].id_periodo;

        const result = await client.query(`
            UPDATE asignacion_funciones af
            SET estado_agenda = 'Devuelta',
                observaciones_generales = $1,
                revisado_por = $2,
                fecha_revision = NOW()
            FROM usuario_asignacion ua
            WHERE ua.id_funciones = af.id_funciones
            AND ua.id_usuario = $3
            AND af.id_periodo = $4
            AND af.estado_agenda IN ('Pendiente', 'Aceptado', 'Aprobada')
            RETURNING af.id_funciones
        `, [observacion_general.trim(), directorId, idUsuario, idPeriodo]);

        await client.query('COMMIT');

        res.json({
            mensaje: 'Agenda devuelta con observaciones.',
            funciones_devueltas: result.rowCount
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en devolverAgenda:', error);
        res.status(500).json({ error: 'Error al devolver agenda.', detalles: error.message });
    } finally {
        client.release();
    }
};

// ================================================================
// PUT /api/observaciones/:actividad_id
// Crea o actualiza la observación del director para una actividad
// Body: { semana, texto }
// ================================================================
const guardarObservacion = async (req, res) => {
    try {
        const idActividad = parseInt(req.params.actividad_id);
        const directorId = req.user.id;
        const { semana, texto } = req.body;

        if (!semana || ![8, 16].includes(parseInt(semana))) {
            return res.status(400).json({ error: 'La semana debe ser 8 o 16.' });
        }
        if (!texto || texto.trim() === '') {
            return res.status(400).json({ error: 'El texto de la observación es obligatorio.' });
        }

        // Verificar que la actividad existe
        const actCheck = await pool.query('SELECT id_asignacionact FROM asignacion_actividades WHERE id_asignacionact = $1', [idActividad]);
        if (actCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Actividad no encontrada.' });
        }

        // Buscar si ya existe una observación para esta actividad y semana
        const existing = await pool.query(
            'SELECT id FROM observaciones_director WHERE id_asignacionact = $1 AND semana = $2 AND director_id = $3',
            [idActividad, parseInt(semana), directorId]
        );

        let result;
        if (existing.rows.length > 0) {
            result = await pool.query(`
                UPDATE observaciones_director
                SET texto = $1, ultima_edicion = NOW()
                WHERE id = $2
                RETURNING *
            `, [texto.trim(), existing.rows[0].id]);
        } else {
            result = await pool.query(`
                INSERT INTO observaciones_director (id_asignacionact, semana, texto, director_id)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [idActividad, parseInt(semana), texto.trim(), directorId]);
        }

        res.json({
            mensaje: 'Observación guardada.',
            observacion: result.rows[0]
        });

    } catch (error) {
        console.error('Error en guardarObservacion:', error);
        res.status(500).json({ error: 'Error al guardar observación.', detalles: error.message });
    }
};

// ================================================================
// GET /api/observaciones/:actividad_id/:semana
// Obtiene la observación del director para una actividad y semana
// ================================================================
const getObservacion = async (req, res) => {
    try {
        const idActividad = parseInt(req.params.actividad_id);
        const semana = parseInt(req.params.semana);

        const result = await pool.query(`
            SELECT od.*, u.nombres || ' ' || u.apellidos AS director_nombre
            FROM observaciones_director od
            LEFT JOIN usuarios u ON u.id_usuario = od.director_id
            WHERE od.id_asignacionact = $1 AND od.semana = $2
            ORDER BY od.ultima_edicion DESC
        `, [idActividad, semana]);

        res.json({ observaciones: result.rows });

    } catch (error) {
        console.error('Error en getObservacion:', error);
        res.status(500).json({ error: 'Error al obtener observaciones.', detalles: error.message });
    }
};

// ================================================================
// GET /api/director/reportes/resumen
// Estadísticas generales para el director
// ================================================================
const getReportesResumen = async (req, res) => {
    try {
        const periodoRes = await pool.query('SELECT id_periodo, anio, semestre FROM periodo WHERE activo = true LIMIT 1');
        if (periodoRes.rows.length === 0) {
            return res.json({ periodo: null, estadisticas: null });
        }
        const periodo = periodoRes.rows[0];
        const idPeriodo = periodo.id_periodo;

        // 1. Estadísticas por programa
        const progRes = await pool.query(`
            SELECT
                pa.nombre_programa,
                COUNT(DISTINCT u.id_usuario) AS total_docentes,
                COALESCE(AVG(sub.horas_directas), 0) AS promedio_horas_directas,
                COUNT(DISTINCT CASE WHEN sub.todas_aprobadas THEN u.id_usuario END) AS agendas_aprobadas,
                COUNT(DISTINCT CASE WHEN sub.alguna_devuelta THEN u.id_usuario END) AS agendas_devueltas,
                COUNT(DISTINCT CASE WHEN sub.todas_pendiente THEN u.id_usuario END) AS agendas_pendientes
            FROM usuarios u
            JOIN programa_academico pa ON pa.id_programa = u.id_programa
            JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
            JOIN roles r ON r.id_rol = ur.id_rol AND LOWER(r.nombre_rol) = 'docente'
            LEFT JOIN LATERAL (
                SELECT
                    COALESCE(SUM(CASE WHEN af.funcion_sustantiva = 'Docencia Directa' THEN af.horas_funcion ELSE 0 END), 0) AS horas_directas,
                    BOOL_AND(af.estado_agenda = 'Aprobada') AS todas_aprobadas,
                    BOOL_OR(af.estado_agenda = 'Devuelta') AS alguna_devuelta,
                    BOOL_AND(af.estado_agenda = 'Pendiente') AS todas_pendiente
                FROM usuario_asignacion ua2
                JOIN asignacion_funciones af ON af.id_funciones = ua2.id_funciones AND af.id_periodo = $1
                WHERE ua2.id_usuario = u.id_usuario
            ) sub ON TRUE
            WHERE u.activo = TRUE
            GROUP BY pa.nombre_programa
            ORDER BY pa.nombre_programa
        `, [idPeriodo]);

        // 2. Distribución de perfiles docentes
        const perfilesRes = await pool.query(`
            SELECT
                u.id_usuario,
                tc.tipo AS tipo_contrato,
                COALESCE(SUM(CASE WHEN af.funcion_sustantiva = 'Docencia Directa' THEN af.horas_funcion ELSE 0 END), 0) AS horas_directas,
                COALESCE(SUM(CASE WHEN af.funcion_sustantiva ILIKE '%investigación%' THEN af.horas_funcion ELSE 0 END), 0) AS horas_investigacion
            FROM usuarios u
            JOIN tipo_contrato tc ON tc.id_contrato = u.id_contrato
            JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
            JOIN roles r ON r.id_rol = ur.id_rol AND LOWER(r.nombre_rol) = 'docente'
            LEFT JOIN usuario_asignacion ua ON ua.id_usuario = u.id_usuario
            LEFT JOIN asignacion_funciones af ON af.id_funciones = ua.id_funciones AND af.id_periodo = $1
            WHERE u.activo = TRUE
            GROUP BY u.id_usuario, tc.tipo
        `, [idPeriodo]);

        // Contar perfiles
        const perfilCount = {};
        for (const row of perfilesRes.rows) {
            const perfil = calcularPerfilDocente(row.tipo_contrato, row.horas_directas, row.horas_investigacion);
            perfilCount[perfil] = (perfilCount[perfil] || 0) + 1;
        }
        const distribucionPerfiles = Object.entries(perfilCount).map(([perfil, cantidad]) => ({ perfil, cantidad }));

        // 3. Avance por bloque (semana 8 y 16) — logro parcial y final
        const avanceRes = await pool.query(`
            SELECT
                af.funcion_sustantiva AS bloque,
                COALESCE(SUM(d.meta), 0) AS total_metas,
                COALESCE(SUM(i.ejecucion_8), 0) AS avance_sem8,
                COALESCE(SUM(i.ejecucion_16), 0) AS avance_sem16
            FROM asignacion_funciones af
            JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
            JOIN asignacion_actividades aa ON aa.id_funciones = af.id_funciones
            JOIN descripcion d ON d.id_asignacionact = aa.id_asignacionact AND d.activo = TRUE
            LEFT JOIN indicadores i ON i.id_descripcion = d.id_descripcion AND i.activo = TRUE
            WHERE af.id_periodo = $1
            GROUP BY af.funcion_sustantiva
            ORDER BY af.funcion_sustantiva
        `, [idPeriodo]);

        const avancePorBloque = avanceRes.rows.map(row => {
            const totalMetas = parseFloat(row.total_metas) || 1;
            const sem8 = parseFloat(row.avance_sem8) || 0;
            const sem16 = parseFloat(row.avance_sem16) || 0;
            const logroParcial = Math.min(sem8 / totalMetas, 1.0);
            const logroFinal = Math.min((sem8 + sem16) / totalMetas, 1.0);
            return {
                bloque: row.bloque,
                total_metas: totalMetas,
                avance_sem8: sem8,
                avance_sem16: sem16,
                logro_parcial: Math.round(logroParcial * 100) / 100,
                logro_final: Math.round(logroFinal * 100) / 100
            };
        });

        // 4. Totales generales
        const totalesRes = await pool.query(`
            SELECT
                COUNT(DISTINCT ua.id_usuario) AS total_docentes,
                COUNT(DISTINCT CASE WHEN af.estado_agenda = 'Aprobada' THEN ua.id_usuario END) AS docentes_aprobados,
                COUNT(DISTINCT CASE WHEN af.estado_agenda = 'Devuelta' THEN ua.id_usuario END) AS docentes_devueltos,
                COUNT(DISTINCT CASE WHEN af.estado_agenda = 'Pendiente' OR af.estado_agenda = 'Aceptado' THEN ua.id_usuario END) AS docentes_pendientes
            FROM usuario_asignacion ua
            JOIN asignacion_funciones af ON af.id_funciones = ua.id_funciones AND af.id_periodo = $1
        `, [idPeriodo]);

        res.json({
            periodo,
            estadisticas_programa: progRes.rows,
            distribucion_perfiles: distribucionPerfiles,
            avance_por_bloque: avancePorBloque,
            totales: totalesRes.rows[0] || {}
        });

    } catch (error) {
        console.error('Error en getReportesResumen:', error);
        res.status(500).json({ error: 'Error al obtener reportes.', detalles: error.message });
    }
};

// ================================================================
// GET /api/observaciones/todas
// Obtiene todas las observaciones realizadas por el director
// ================================================================
const getTodasObservaciones = async (req, res) => {
    try {
        const directorId = req.user.id;

        const result = await pool.query(`
            SELECT 
                od.id, od.semana, od.texto, od.fecha, od.ultima_edicion,
                aa.id_asignacionact, aa.rol_seleccionado, aa.horas_rol,
                af.funcion_sustantiva,
                u.nombres || ' ' || u.apellidos AS docente_nombre,
                pa.nombre_programa,
                u.id_usuario
            FROM observaciones_director od
            JOIN asignacion_actividades aa ON aa.id_asignacionact = od.id_asignacionact
            JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones
            JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
            JOIN usuarios u ON u.id_usuario = ua.id_usuario
            LEFT JOIN programa_academico pa ON pa.id_programa = u.id_programa
            WHERE od.director_id = $1
            ORDER BY od.ultima_edicion DESC
        `, [directorId]);

        res.json({ observaciones: result.rows });

    } catch (error) {
        console.error('Error en getTodasObservaciones:', error);
        res.status(500).json({ error: 'Error al obtener todas las observaciones.', detalles: error.message });
    }
};

module.exports = {
    getAgendas,
    getAgendaDetalle,
    aprobarAgenda,
    devolverAgenda,
    guardarObservacion,
    getObservacion,
    getReportesResumen,
    getTodasObservaciones
};
