const pool = require('../db/connection');
const getAll = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                u.id_usuario,
                u.nombres,
                u.apellidos,
                u.nombres || ' ' || u.apellidos AS nombre_completo,
                u.correo,
                u.activo,
                tc.tipo            AS tipo_contrato,
                tc.horas_contrato,
                pa.nombre_programa AS programa,
                STRING_AGG(r.nombre_rol, ', ') AS roles
            FROM usuarios u
            LEFT JOIN tipo_contrato tc       ON u.id_contrato  = tc.id_contrato
LEFT JOIN programa_academico pa  ON u.id_programa  = pa.id_programa
LEFT JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
LEFT JOIN roles r ON ur.id_rol = r.id_rol
            
            GROUP BY
                u.id_usuario, u.nombres, u.apellidos,
                u.correo, u.activo,
                tc.tipo, tc.horas_contrato,
                pa.nombre_programa
            ORDER BY u.apellidos
        `);

        res.json(result.rows);

    } catch (error) {
        console.error('Error en getAll usuarios:', error.message);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
};

const getById = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`
            SELECT
                u.id_usuario,
                u.nombres,
                u.apellidos,
                u.nombres || ' ' || u.apellidos AS nombre_completo,
                u.numero_documento,
                u.tipo_documento,
                u.correo,
                u.activo,
                tc.tipo            AS tipo_contrato,
                tc.horas_contrato,
                pa.nombre_programa AS programa,
                f.nombre_facultad  AS facultad,
                na.nivel           AS nivel_academico,
                STRING_AGG(DISTINCT r.nombre_rol, ', ') AS roles
            FROM usuarios u
            JOIN tipo_contrato tc       ON u.id_contrato   = tc.id_contrato
            JOIN programa_academico pa  ON u.id_programa   = pa.id_programa
            JOIN facultad f             ON pa.id_facultad  = f.id_facultad
            JOIN usuario_rol ur         ON u.id_usuario    = ur.id_usuario
            JOIN roles r                ON ur.id_rol       = r.id_rol
            JOIN usuario_nivel un       ON u.id_usuario    = un.id_usuario
            JOIN nivel_academico na     ON un.id_nivelaca  = na.id_nivelaca
            WHERE u.id_usuario = $1
            GROUP BY
                u.id_usuario, u.nombres, u.apellidos,
                u.numero_documento, u.tipo_documento,
                u.correo, u.activo,
                tc.tipo, tc.horas_contrato,
                pa.nombre_programa, f.nombre_facultad,
                na.nivel
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Error en getById usuarios:', error.message);
        res.status(500).json({ error: 'Error al obtener el usuario' });
    }
};

const create = async (req, res) => {
    const {
        nombres,
        apellidos,
        tipo_documento,
        numero_documento,
        correo,
        id_contrato,
        id_programa
    } = req.body;

    try {
        const result = await pool.query(`
            INSERT INTO usuarios
                (nombres, apellidos, tipo_documento,
                 numero_documento, correo,
                 id_contrato, id_programa, activo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
            RETURNING id_usuario, nombres, apellidos, correo
        `, [nombres, apellidos, tipo_documento,
            numero_documento, correo,
            id_contrato, id_programa]);

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error('Error en create usuario:', error.message);
        res.status(500).json({ error: 'Error al crear el usuario' });
    }
};

const toggleActivo = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`
            UPDATE usuarios
            SET activo = NOT activo
            WHERE id_usuario = $1
            RETURNING id_usuario, nombres, apellidos, activo
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Error en toggleActivo:', error.message);
        res.status(500).json({ error: 'Error al actualizar el usuario' });
    }
};

module.exports = {
    getAll,
    getById,
    create,
    toggleActivo
};