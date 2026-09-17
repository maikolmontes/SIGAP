/**
 * Controller para corrección de asignaciones — Módulo Director
 *
 * Las asignaciones las carga Planeación desde Excel y quedan visibles
 * de inmediato para el docente. Este módulo permite al Director corregir
 * las horas cuando Planeación subió algo mal, sin pasar por aprobación.
 *
 * IMPORTANTE: asignacion_funciones.horas_funcion es un valor DERIVADO
 * (SUM de asignacion_actividades.horas_rol). Por eso la corrección se
 * aplica sobre horas_rol y luego se recalcula horas_funcion — así el
 * cambio sobrevive al recálculo que hace la importación.
 */
const pool = require('../db/connection');
const { calcularAlcance } = require('../utils/rolActivo');

// ================================================================
// Helper: resuelve el alcance según el ROL ACTIVO de la interfaz.
// Decano → su facultad · Director → su programa · resto → todo
// ================================================================
const resolverAlcance = async (req) => {
    const user = req.user;
    const { limitadoPorFacultad: isDecano, limitadoPorPrograma: isDirector } = calcularAlcance(req);

    let facultadId = user?.id_facultad || null;
    if (isDecano && !facultadId && user?.id) {
        const facQ = await pool.query('SELECT id_facultad FROM usuarios WHERE id_usuario = $1', [user.id]);
        facultadId = facQ.rows[0]?.id_facultad || null;
    }

    let programaId = user?.id_programa || null;
    if (isDirector && !programaId && user?.id) {
        const progQ = await pool.query('SELECT id_programa FROM usuarios WHERE id_usuario = $1', [user.id]);
        programaId = progQ.rows[0]?.id_programa || null;
    }

    return { isDecano, isDirector, facultadId, programaId };
};

// ================================================================
// GET /api/director/asignaciones
// Lista los docentes del periodo activo con sus funciones sustantivas,
// las actividades de cada función y el contraste de horas contra el
// contrato (si coinciden o no).
// ================================================================
const getAsignaciones = async (req, res) => {
    try {
        const periodoRes = await pool.query(`
            SELECT id_periodo, anio, semestre, fecha_inicio, fecha_fin
            FROM periodo WHERE activo = true LIMIT 1
        `);
        if (periodoRes.rows.length === 0) {
            return res.json({ asignaciones: [], periodo: null });
        }
        const periodo = periodoRes.rows[0];
        const idPeriodo = periodo.id_periodo;

        const { isDecano, isDirector, facultadId, programaId } = await resolverAlcance(req);

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
                af.estado_agenda
            FROM usuarios u
            JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
            JOIN roles r ON r.id_rol = ur.id_rol AND LOWER(r.nombre_rol) = 'docente'
            JOIN tipo_contrato tc ON tc.id_contrato = u.id_contrato
            JOIN programa_academico pa ON pa.id_programa = u.id_programa
            JOIN usuario_asignacion ua ON ua.id_usuario = u.id_usuario
            JOIN asignacion_funciones af ON af.id_funciones = ua.id_funciones AND af.id_periodo = $1
            WHERE u.activo = TRUE
        `;
        const params = [idPeriodo];

        if (isDecano && facultadId) {
            query += ` AND pa.id_facultad = $2`;
            params.push(facultadId);
        } else if (isDirector && programaId) {
            query += ` AND u.id_programa = $2`;
            params.push(programaId);
        }

        query += ` ORDER BY u.apellidos, u.nombres, af.funcion_sustantiva`;

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.json({ asignaciones: [], periodo });
        }

        // Traer todas las actividades de las funciones encontradas en una sola consulta
        const idsFunciones = [...new Set(result.rows.map(r => r.id_funciones))];
        const actividadesRes = await pool.query(`
            SELECT
                aa.id_asignacionact,
                aa.id_funciones,
                aa.rol_seleccionado,
                aa.horas_rol,
                aa.orden,
                ea.nombre_espacio,
                ea.codigo_espacio,
                g.nombre_grupo
            FROM asignacion_actividades aa
            LEFT JOIN espacio_academico ea ON ea.id_espacio_aca = aa.id_espacio_aca
            LEFT JOIN grupos g ON g.id_grupos = aa.id_grupos
            WHERE aa.id_funciones = ANY($1)
            ORDER BY aa.orden, aa.id_asignacionact
        `, [idsFunciones]);

        const actividadesPorFuncion = new Map();
        for (const act of actividadesRes.rows) {
            if (!actividadesPorFuncion.has(act.id_funciones)) {
                actividadesPorFuncion.set(act.id_funciones, []);
            }
            actividadesPorFuncion.get(act.id_funciones).push({
                id_asignacionact: act.id_asignacionact,
                // Nombre legible: espacio académico si existe, si no el rol libre
                nombre: act.nombre_espacio || act.rol_seleccionado || 'Actividad sin nombre',
                codigo_espacio: act.codigo_espacio,
                grupo: act.nombre_grupo,
                horas_rol: parseFloat(act.horas_rol) || 0
            });
        }

        // Agrupar por docente
        const docentesMap = new Map();
        for (const row of result.rows) {
            if (!docentesMap.has(row.id_usuario)) {
                docentesMap.set(row.id_usuario, {
                    id_usuario: row.id_usuario,
                    nombre_docente: row.nombre_docente,
                    correo: row.correo,
                    nombre_programa: row.nombre_programa,
                    tipo_contrato: row.tipo_contrato,
                    horas_contrato: parseFloat(row.horas_contrato) || 0,
                    funciones: [],
                    total_horas: 0
                });
            }
            const docente = docentesMap.get(row.id_usuario);
            const horasFuncion = parseFloat(row.horas_funcion) || 0;

            docente.funciones.push({
                id_funciones: row.id_funciones,
                funcion_sustantiva: row.funcion_sustantiva,
                horas_funcion: horasFuncion,
                estado_agenda: row.estado_agenda,
                // El docente ya diligenció esta función: corregirla la desincroniza
                diligenciada: ['Aceptado', 'Aprobada'].includes(row.estado_agenda),
                actividades: actividadesPorFuncion.get(row.id_funciones) || []
            });
            docente.total_horas += horasFuncion;
        }

        const asignaciones = Array.from(docentesMap.values()).map(d => {
            const diferencia = d.total_horas - d.horas_contrato;
            return {
                ...d,
                diferencia,
                coincide: diferencia === 0,
                estado_carga: diferencia === 0
                    ? 'Correcta'
                    : diferencia > 0 ? 'Excede contrato' : 'Faltan horas'
            };
        });

        res.json({ asignaciones, periodo });

    } catch (error) {
        console.error('Error en getAsignaciones:', error);
        res.status(500).json({ error: 'Error al obtener las asignaciones.', detalles: error.message });
    }
};

// ================================================================
// PUT /api/director/asignaciones/:id_usuario
// Corrige las horas de las actividades de un docente.
// Body: { actividades: [{ id_asignacionact, horas_rol }] }
// ================================================================
const corregirAsignaciones = async (req, res) => {
    const idUsuario = parseInt(req.params.id_usuario, 10);
    const { actividades } = req.body;

    if (isNaN(idUsuario)) {
        return res.status(400).json({ error: 'ID de docente inválido.' });
    }
    if (!Array.isArray(actividades) || actividades.length === 0) {
        return res.status(400).json({ error: 'Debes enviar al menos una actividad a corregir.' });
    }

    // Validar el formato y los valores ANTES de tocar la base de datos
    const cambios = [];
    for (const act of actividades) {
        const idAct = parseInt(act.id_asignacionact, 10);
        const horas = parseFloat(act.horas_rol);

        if (isNaN(idAct)) {
            return res.status(400).json({ error: 'Una de las actividades no tiene un identificador válido.' });
        }
        if (isNaN(horas) || horas < 0) {
            return res.status(400).json({ error: 'Las horas deben ser un número mayor o igual a cero.' });
        }
        if (horas > 60) {
            return res.status(400).json({ error: 'Una actividad no puede superar las 60 horas semanales.' });
        }
        cambios.push({ idAct, horas });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const periodoRes = await client.query('SELECT id_periodo FROM periodo WHERE activo = true LIMIT 1');
        if (periodoRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No hay un período académico activo.' });
        }
        const idPeriodo = periodoRes.rows[0].id_periodo;

        // Verificar que TODAS las actividades pertenezcan a este docente en el periodo
        // activo. Evita que se editen las asignaciones de otro docente.
        const idsAct = cambios.map(c => c.idAct);
        const propiedadRes = await client.query(`
            SELECT aa.id_asignacionact
            FROM asignacion_actividades aa
            JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones
            JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
            WHERE aa.id_asignacionact = ANY($1)
              AND ua.id_usuario = $2
              AND af.id_periodo = $3
        `, [idsAct, idUsuario, idPeriodo]);

        const idsValidos = new Set(propiedadRes.rows.map(r => r.id_asignacionact));
        const idsInvalidos = idsAct.filter(id => !idsValidos.has(id));
        if (idsInvalidos.length > 0) {
            await client.query('ROLLBACK');
            return res.status(403).json({
                error: 'Algunas actividades no pertenecen a este docente en el período activo.',
                actividades_invalidas: idsInvalidos
            });
        }

        // Aplicar la corrección
        for (const { idAct, horas } of cambios) {
            await client.query(
                'UPDATE asignacion_actividades SET horas_rol = $1 WHERE id_asignacionact = $2',
                [horas, idAct]
            );
        }

        // Recalcular horas_funcion — mismo criterio que usa la importación
        await client.query(`
            UPDATE asignacion_funciones af
            SET horas_funcion = COALESCE(sub.total, 0)
            FROM (
                SELECT id_funciones, SUM(horas_rol) AS total
                FROM asignacion_actividades
                GROUP BY id_funciones
            ) sub
            WHERE af.id_funciones = sub.id_funciones
              AND af.id_funciones IN (
                  SELECT af2.id_funciones
                  FROM asignacion_funciones af2
                  JOIN usuario_asignacion ua ON ua.id_funciones = af2.id_funciones
                  WHERE ua.id_usuario = $1 AND af2.id_periodo = $2
              )
        `, [idUsuario, idPeriodo]);

        // Devolver el nuevo balance de horas del docente
        const balanceRes = await client.query(`
            SELECT
                COALESCE(SUM(af.horas_funcion), 0) AS total_horas,
                tc.horas_contrato
            FROM usuario_asignacion ua
            JOIN asignacion_funciones af ON af.id_funciones = ua.id_funciones AND af.id_periodo = $2
            JOIN usuarios u ON u.id_usuario = ua.id_usuario
            JOIN tipo_contrato tc ON tc.id_contrato = u.id_contrato
            WHERE ua.id_usuario = $1
            GROUP BY tc.horas_contrato
        `, [idUsuario, idPeriodo]);

        await client.query('COMMIT');

        const balance = balanceRes.rows[0] || {};
        const totalHoras = parseFloat(balance.total_horas) || 0;
        const horasContrato = parseFloat(balance.horas_contrato) || 0;
        const diferencia = totalHoras - horasContrato;

        res.json({
            mensaje: 'Asignaciones corregidas correctamente.',
            actividades_actualizadas: cambios.length,
            total_horas: totalHoras,
            horas_contrato: horasContrato,
            diferencia,
            coincide: diferencia === 0
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en corregirAsignaciones:', error);
        res.status(500).json({ error: 'Error al corregir las asignaciones.', detalles: error.message });
    } finally {
        client.release();
    }
};

module.exports = { getAsignaciones, corregirAsignaciones };
