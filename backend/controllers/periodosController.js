const pool = require('../db/connection');

// Listar todos los períodos con conteo de docentes vinculados
const getAll = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                p.*,
                COUNT(up.id_usuario_periodo) AS total_docentes
            FROM periodo p
            LEFT JOIN usuario_periodo up ON p.id_periodo = up.id_periodo
            GROUP BY p.id_periodo
            ORDER BY p.anio DESC, p.semestre DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener períodos:', error);
        res.status(500).json({ error: 'Error al obtener los períodos.' });
    }
};

// Obtener un período por ID con sus docentes asignados
const getById = async (req, res) => {
    const { id } = req.params;
    try {
        const periodo = await pool.query('SELECT * FROM periodo WHERE id_periodo = $1', [id]);
        if (periodo.rows.length === 0) {
            return res.status(404).json({ error: 'Período no encontrado.' });
        }

        const docentes = await pool.query(`
            SELECT u.id_usuario, u.nombres, u.apellidos, u.correo, u.activo, up.creado_en AS fecha_asignacion
            FROM usuario_periodo up
            JOIN usuarios u ON up.id_usuario = u.id_usuario
            WHERE up.id_periodo = $1
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

// Crear un nuevo período
const create = async (req, res) => {
    const { anio, semestre, fecha_inicio, fecha_fin } = req.body;

    if (!anio || !semestre || !fecha_inicio || !fecha_fin) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios: año, semestre, fecha inicio y fecha fin.' });
    }

    try {
        // Verificar si hay un período activo
        const activo = await pool.query('SELECT id_periodo FROM periodo WHERE activo = TRUE');
        if (activo.rows.length > 0) {
            return res.status(409).json({
                error: 'Ya existe un período activo. Debe cerrar el período actual antes de crear uno nuevo.'
            });
        }

        // Verificar que no exista un período con el mismo año y semestre
        const duplicado = await pool.query(
            'SELECT id_periodo FROM periodo WHERE anio = $1 AND semestre = $2',
            [anio, semestre]
        );
        if (duplicado.rows.length > 0) {
            return res.status(409).json({
                error: `El período ${anio}-${semestre === 1 ? 'I' : 'II'} ya existe.`
            });
        }

        const result = await pool.query(
            `INSERT INTO periodo (anio, semestre, fecha_inicio, fecha_fin, activo, creado_en)
             VALUES ($1, $2, $3, $4, TRUE, NOW())
             RETURNING *`,
            [anio, semestre, fecha_inicio, fecha_fin]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error al crear período:', error);
        res.status(500).json({ error: 'Error al crear el período.' });
    }
};

// Cerrar un período (desactivarlo)
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
        res.json({ mensaje: 'Período cerrado exitosamente.', periodo: result.rows[0] });
    } catch (error) {
        console.error('Error al cerrar período:', error);
        res.status(500).json({ error: 'Error al cerrar el período.' });
    }
};

// Obtener docentes asignados a un período
const getDocentesAsignados = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT u.id_usuario, u.nombres, u.apellidos, u.correo, u.activo, up.creado_en AS fecha_asignacion
            FROM usuario_periodo up
            JOIN usuarios u ON up.id_usuario = u.id_usuario
            WHERE up.id_periodo = $1
            ORDER BY u.apellidos, u.nombres
        `, [id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener docentes del período:', error);
        res.status(500).json({ error: 'Error al obtener los docentes asignados.' });
    }
};

// Asignar docentes a un período (masivo)
const asignarDocentes = async (req, res) => {
    const { id } = req.params;
    const { docentes } = req.body; // Array de id_usuario

    if (!docentes || !Array.isArray(docentes) || docentes.length === 0) {
        return res.status(400).json({ error: 'Debe enviar al menos un docente para asignar.' });
    }

    try {
        // Verificar que el período exista
        const periodo = await pool.query('SELECT id_periodo FROM periodo WHERE id_periodo = $1', [id]);
        if (periodo.rows.length === 0) {
            return res.status(404).json({ error: 'Período no encontrado.' });
        }

        let insertados = 0;
        let duplicados = 0;

        for (const idUsuario of docentes) {
            // Verificar si ya está asignado (evitar duplicados)
            const exists = await pool.query(
                'SELECT id_usuario_periodo FROM usuario_periodo WHERE id_usuario = $1 AND id_periodo = $2',
                [idUsuario, id]
            );
            if (exists.rows.length === 0) {
                await pool.query(
                    'INSERT INTO usuario_periodo (id_usuario, id_periodo) VALUES ($1, $2)',
                    [idUsuario, id]
                );
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

// Desasignar un docente de un período
const desasignarDocente = async (req, res) => {
    const { id, idUsuario } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM usuario_periodo WHERE id_periodo = $1 AND id_usuario = $2 RETURNING *',
            [id, idUsuario]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'El docente no estaba asignado a este período.' });
        }
        res.json({ mensaje: 'Docente removido del período exitosamente.' });
    } catch (error) {
        console.error('Error al desasignar docente:', error);
        res.status(500).json({ error: 'Error al remover el docente del período.' });
    }
};

module.exports = { getAll, getById, create, cerrar, getDocentesAsignados, asignarDocentes, desasignarDocente };
