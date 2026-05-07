const pool = require('../db/connection');

const getFunciones = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id_funciones,
                funcion_sustantiva,
                horas_funcion,
                estado_agenda,
                observaciones_generales
            FROM asignacion_funciones
            WHERE estado_agenda = 'Activo'
            ORDER BY id_funciones
        `);

        res.json(result.rows);

    } catch (error) {
        console.error('Error en getFunciones:', error.message);
        res.status(500).json({ error: 'Error al obtener funciones' });
    }
};

const getFuncionesByUsuario = async (req, res) => {
    const { id_usuario } = req.params;

    try {
        const result = await pool.query(`
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

        res.json(result.rows);

    } catch (error) {
        console.error('Error en getFuncionesByUsuario:', error.message);
        res.status(500).json({ error: 'Error al obtener funciones del usuario' });
    }
};

const asignarFuncion = async (req, res) => {
    const { id_usuario, id_funciones } = req.body;

    try {
        const existe = await pool.query(`
            SELECT id_usuarioasig
            FROM usuario_asignacion
            WHERE id_usuario = $1 AND id_funciones = $2
        `, [id_usuario, id_funciones]);

        if (existe.rows.length > 0) {
            return res.status(400).json({ error: 'El docente ya tiene esa función asignada' });
        }

        const result = await pool.query(`
            INSERT INTO usuario_asignacion (id_usuario, id_funciones)
            VALUES ($1, $2)
            RETURNING id_usuarioasig, id_usuario, id_funciones
        `, [id_usuario, id_funciones]);

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error('Error en asignarFuncion:', error.message);
        res.status(500).json({ error: 'Error al asignar función' });
    }
};

module.exports = {
    getFunciones,
    getFuncionesByUsuario,
    asignarFuncion
};