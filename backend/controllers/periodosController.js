const pool = require('../db/connection');

const getAll = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                p.id_periodo,
                p.anio,
                p.semestre,
                p.fecha_inicio,
                p.fecha_fin,
                p.activo,
                p.creado_en,
                COUNT(DISTINCT u.id_usuario) AS total_docentes
            FROM periodo p
            LEFT JOIN programa_periodo pp ON p.id_periodo  = pp.id_periodo
            LEFT JOIN programa_academico pa ON pp.id_programa = pa.id_programa
            LEFT JOIN usuarios u ON pa.id_programa = u.id_programa AND u.activo = TRUE
            GROUP BY p.id_periodo, p.anio, p.semestre,
                     p.fecha_inicio, p.fecha_fin, p.activo, p.creado_en
            ORDER BY p.anio DESC, p.semestre DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener períodos:', error);
        res.status(500).json({ error: 'Error al obtener los períodos.' });
    }
};

const getById = async (req, res) => {
    const { id } = req.params;
    try {
        const periodo = await pool.query(
            'SELECT * FROM periodo WHERE id_periodo = $1', [id]
        );
        if (periodo.rows.length === 0) {
            return res.status(404).json({ error: 'Período no encontrado.' });
        }

        const docentes = await pool.query(`
            SELECT
                u.id_usuario,
                u.nombres,
                u.apellidos,
                u.correo,
                u.activo,
                pa.nombre_programa,
                STRING_AGG(r.nombre_rol, ', ') AS roles
            FROM usuarios u
            JOIN programa_academico pa  ON u.id_programa  = pa.id_programa
            JOIN programa_periodo pp    ON pa.id_programa = pp.id_programa
            JOIN usuario_rol ur         ON u.id_usuario   = ur.id_usuario
            JOIN roles r                ON ur.id_rol      = r.id_rol
            WHERE pp.id_periodo = $1
              AND u.activo = TRUE
            GROUP BY u.id_usuario, u.nombres, u.apellidos,
                     u.correo, u.activo, pa.nombre_programa
            ORDER BY u.apellidos, u.nombres
        `, [id]);

        res.json({
            ...periodo.rows[0],
            docentes: docentes.rows
        });
    } catch (error) {
        console.error('Error al obtener período:', error);
        res.status(500).json({ error: 'Error al obtener el período.' });
    }
};

const create = async (req, res) => {
    const { anio, semestre, fecha_inicio, fecha_fin } = req.body;

    if (!anio || !semestre || !fecha_inicio || !fecha_fin) {
        return res.status(400).json({
            error: 'Todos los campos son obligatorios: año, semestre, fecha inicio y fecha fin.'
        });
    }

    try {
        const activo = await pool.query(
            'SELECT id_periodo FROM periodo WHERE activo = TRUE'
        );
        if (activo.rows.length > 0) {
            return res.status(409).json({
                error: 'Ya existe un período activo. Debe cerrar el período actual antes de crear uno nuevo.'
            });
        }

        const duplicado = await pool.query(
            'SELECT id_periodo FROM periodo WHERE anio = $1 AND semestre = $2',
            [anio, semestre]
        );
        if (duplicado.rows.length > 0) {
            return res.status(409).json({
                error: `El período ${anio}-${semestre === 1 ? 'I' : 'II'} ya existe.`
            });
        }

        const result = await pool.query(`
            INSERT INTO periodo (anio, semestre, fecha_inicio, fecha_fin, activo, creado_en)
            VALUES ($1, $2, $3, $4, TRUE, NOW())
            RETURNING *
        `, [anio, semestre, fecha_inicio, fecha_fin]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error al crear período:', error);
        res.status(500).json({ error: 'Error al crear el período.' });
    }
};

const cerrar = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'UPDATE periodo SET activo = FALSE WHERE id_periodo = $1 RETURNING *',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Período no encontrado.' });
        }
        res.json({
            mensaje: 'Período cerrado exitosamente.',
            periodo: result.rows[0]
        });
    } catch (error) {
        console.error('Error al cerrar período:', error);
        res.status(500).json({ error: 'Error al cerrar el período.' });
    }
};

const getDocentesAsignados = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT
                u.id_usuario,
                u.nombres,
                u.apellidos,
                u.correo,
                u.activo,
                pa.nombre_programa,
                STRING_AGG(r.nombre_rol, ', ') AS roles
            FROM usuarios u
            JOIN programa_academico pa  ON u.id_programa  = pa.id_programa
            JOIN programa_periodo pp    ON pa.id_programa = pp.id_programa
            JOIN usuario_rol ur         ON u.id_usuario   = ur.id_usuario
            JOIN roles r                ON ur.id_rol      = r.id_rol
            WHERE pp.id_periodo = $1
              AND u.activo = TRUE
            GROUP BY u.id_usuario, u.nombres, u.apellidos,
                     u.correo, u.activo, pa.nombre_programa
            ORDER BY u.apellidos, u.nombres
        `, [id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener docentes del período:', error);
        res.status(500).json({ error: 'Error al obtener los docentes asignados.' });
    }
};

const asignarDocentes = async (req, res) => {
    const { id } = req.params;
    const { docentes } = req.body;

    if (!docentes || !Array.isArray(docentes) || docentes.length === 0) {
        return res.status(400).json({
            error: 'Debe enviar al menos un docente para asignar.'
        });
    }

    try {
        const periodo = await pool.query(
            'SELECT id_periodo FROM periodo WHERE id_periodo = $1', [id]
        );
        if (periodo.rows.length === 0) {
            return res.status(404).json({ error: 'Período no encontrado.' });
        }

        let insertados = 0;
        let duplicados = 0;

        for (const idUsuario of docentes) {
            const usuario = await pool.query(
                'SELECT id_programa FROM usuarios WHERE id_usuario = $1', [idUsuario]
            );
            if (usuario.rows.length === 0) continue;

            const id_programa = usuario.rows[0].id_programa;

            const existe = await pool.query(
                'SELECT id_progperiodo FROM programa_periodo WHERE id_programa = $1 AND id_periodo = $2',
                [id_programa, id]
            );

            if (existe.rows.length === 0) {
                const pensul = await pool.query(
                    'SELECT id_pensulaca FROM pensul_academico WHERE activo = TRUE LIMIT 1'
                );
                const id_pensulaca = pensul.rows[0]?.id_pensulaca || 1;

                await pool.query(`
                    INSERT INTO programa_periodo (id_periodo, id_programa, id_pensulaca)
                    VALUES ($1, $2, $3)
                `, [id, id_programa, id_pensulaca]);

                insertados++;
            } else {
                duplicados++;
            }
        }

        res.json({
            mensaje: `Se asignaron ${insertados} docente(s) al período.${duplicados > 0 ? ` ${duplicados} ya estaban asignados.` : ''}`,
            insertados,
            duplicados
        });
    } catch (error) {
        console.error('Error al asignar docentes:', error);
        res.status(500).json({ error: 'Error al asignar los docentes al período.' });
    }
};

const desasignarDocente = async (req, res) => {
    const { id, idUsuario } = req.params;
    try {
        const usuario = await pool.query(
            'SELECT id_programa FROM usuarios WHERE id_usuario = $1', [idUsuario]
        );
        if (usuario.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        const id_programa = usuario.rows[0].id_programa;

        const result = await pool.query(`
            DELETE FROM programa_periodo
            WHERE id_periodo = $1 AND id_programa = $2
            RETURNING *
        `, [id, id_programa]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'El docente no estaba asignado a este período.'
            });
        }

        res.json({ mensaje: 'Docente removido del período exitosamente.' });
    } catch (error) {
        console.error('Error al desasignar docente:', error);
        res.status(500).json({ error: 'Error al desasignar el docente.' });
    }
};

module.exports = {
    getAll,
    getById,
    create,
    cerrar,
    getDocentesAsignados,
    asignarDocentes,
    desasignarDocente
};