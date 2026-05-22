const pool = require('../db/connection');

const getAll = async (req, res) => {
    try {
        const query = `
            SELECT f.id_facultad, f.nombre_facultad, f.detalle_facultad, f.activa, f.creado_en,
                   COALESCE(COUNT(p.id_programa), 0)::int AS total_programas
            FROM facultad f
            LEFT JOIN programa_academico p ON f.id_facultad = p.id_facultad
            GROUP BY f.id_facultad
            ORDER BY f.nombre_facultad
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en getAll facultades:', error.message);
        res.status(500).json({ error: 'Error al obtener las facultades' });
    }
};

const create = async (req, res) => {
    const { nombre_facultad, detalle_facultad, activa } = req.body;
    
    if (!nombre_facultad || nombre_facultad.trim() === '') {
        return res.status(400).json({ error: 'El nombre de la facultad es obligatorio' });
    }

    try {
        const query = `
            INSERT INTO facultad (nombre_facultad, detalle_facultad, activa, creado_en)
            VALUES ($1, $2, COALESCE($3, true), NOW())
            RETURNING *
        `;
        const result = await pool.query(query, [
            nombre_facultad.trim(), 
            detalle_facultad ? detalle_facultad.trim() : null, 
            activa
        ]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error en create facultad:', error.message);
        res.status(500).json({ error: 'Error al crear la facultad' });
    }
};

const update = async (req, res) => {
    const { id } = req.params;
    const { nombre_facultad, detalle_facultad, activa } = req.body;

    if (!nombre_facultad || nombre_facultad.trim() === '') {
        return res.status(400).json({ error: 'El nombre de la facultad es obligatorio' });
    }

    try {
        const query = `
            UPDATE facultad
            SET nombre_facultad = $1, detalle_facultad = $2, activa = COALESCE($3, activa)
            WHERE id_facultad = $4
            RETURNING *
        `;
        const result = await pool.query(query, [
            nombre_facultad.trim(), 
            detalle_facultad ? detalle_facultad.trim() : null, 
            activa, 
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Facultad no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error en update facultad:', error.message);
        res.status(500).json({ error: 'Error al actualizar la facultad' });
    }
};

const toggleActiva = async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            UPDATE facultad
            SET activa = NOT activa
            WHERE id_facultad = $1
            RETURNING *
        `;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Facultad no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error en toggleActiva facultad:', error.message);
        res.status(500).json({ error: 'Error al cambiar estado de la facultad' });
    }
};

const deleteFacultad = async (req, res) => {
    const { id } = req.params;
    try {
        // Validación de consistencia: programas asociados
        const checkPrograms = await pool.query(
            'SELECT COUNT(*)::int AS count FROM programa_academico WHERE id_facultad = $1', 
            [id]
        );
        
        if (checkPrograms.rows[0].count > 0) {
            return res.status(400).json({
                error: 'No se puede eliminar la facultad porque tiene programas académicos asociados. Por favor, elimine o reasigne los programas primero.'
            });
        }
        
        const result = await pool.query(
            'DELETE FROM facultad WHERE id_facultad = $1 RETURNING *', 
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Facultad no encontrada' });
        }

        res.json({ message: 'Facultad eliminada correctamente', facultad: result.rows[0] });
    } catch (error) {
        console.error('Error en delete facultad:', error.message);
        res.status(500).json({ error: 'Error al eliminar la facultad' });
    }
};

module.exports = {
    getAll,
    create,
    update,
    toggleActiva,
    deleteFacultad
};
