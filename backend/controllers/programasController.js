const pool = require('../db/connection');

const getAll = async (req, res) => {
    try {
        const query = `
            SELECT p.id_programa, p.id_facultad, p.nombre_programa, p.activo, p.creado_en,
                   f.nombre_facultad AS facultad
            FROM programa_academico p
            LEFT JOIN facultad f ON p.id_facultad = f.id_facultad
            ORDER BY p.nombre_programa
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en getAll programas:', error.message);
        res.status(500).json({ error: 'Error al obtener los programas académicos' });
    }
};

const create = async (req, res) => {
    const { nombre_programa, id_facultad, activo } = req.body;

    if (!nombre_programa || nombre_programa.trim() === '') {
        return res.status(400).json({ error: 'El nombre del programa es obligatorio' });
    }
    if (!id_facultad) {
        return res.status(400).json({ error: 'La facultad asociada es obligatoria' });
    }

    try {
        const query = `
            INSERT INTO programa_academico (nombre_programa, id_facultad, activo, creado_en)
            VALUES ($1, $2, COALESCE($3, true), NOW())
            RETURNING *
        `;
        const result = await pool.query(query, [
            nombre_programa.trim(), 
            id_facultad, 
            activo
        ]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error en create programa:', error.message);
        res.status(500).json({ error: 'Error al crear el programa académico' });
    }
};

const update = async (req, res) => {
    const { id } = req.params;
    const { nombre_programa, id_facultad, activo } = req.body;

    if (!nombre_programa || nombre_programa.trim() === '') {
        return res.status(400).json({ error: 'El nombre del programa es obligatorio' });
    }
    if (!id_facultad) {
        return res.status(400).json({ error: 'La facultad asociada es obligatoria' });
    }

    try {
        const query = `
            UPDATE programa_academico
            SET nombre_programa = $1, id_facultad = $2, activo = COALESCE($3, activo)
            WHERE id_programa = $4
            RETURNING *
        `;
        const result = await pool.query(query, [
            nombre_programa.trim(), 
            id_facultad, 
            activo, 
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Programa académico no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error en update programa:', error.message);
        res.status(500).json({ error: 'Error al actualizar el programa académico' });
    }
};

const toggleActivo = async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            UPDATE programa_academico
            SET activo = NOT activo
            WHERE id_programa = $1
            RETURNING *
        `;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Programa académico no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error en toggleActivo programa:', error.message);
        res.status(500).json({ error: 'Error al cambiar estado del programa académico' });
    }
};

const deletePrograma = async (req, res) => {
    const { id } = req.params;
    try {
        // Validación de consistencia: usuarios asociados
        const checkUsers = await pool.query(
            'SELECT COUNT(*)::int AS count FROM usuarios WHERE id_programa = $1', 
            [id]
        );
        
        if (checkUsers.rows[0].count > 0) {
            return res.status(400).json({
                error: 'No se puede eliminar el programa académico porque tiene usuarios o docentes asociados. Por favor, reasigne los usuarios a otro programa primero.'
            });
        }
        
        const result = await pool.query(
            'DELETE FROM programa_academico WHERE id_programa = $1 RETURNING *', 
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Programa académico no encontrado' });
        }

        res.json({ message: 'Programa académico eliminado correctamente', programa: result.rows[0] });
    } catch (error) {
        console.error('Error en delete programa:', error.message);
        res.status(500).json({ error: 'Error al eliminar el programa académico' });
    }
};

module.exports = {
    getAll,
    create,
    update,
    toggleActivo,
    deletePrograma
};
