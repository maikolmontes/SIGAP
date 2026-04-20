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
        id_programa,
        rol // Nuevo campo esperado (ej: 'Docente')
    } = req.body;

    try {
        await pool.query('BEGIN'); // Iniciar transacción

        const result = await pool.query(`
            INSERT INTO usuarios
                (nombres, apellidos, tipo_documento,
                 numero_documento, correo,
                 id_contrato, id_programa, activo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
            RETURNING id_usuario, nombres, apellidos, correo
        `, [
            nombres, apellidos, 
            tipo_documento || 'CC', 
            numero_documento || '0000000000', 
            correo, 
            id_contrato || 1, 
            id_programa || 1
        ]);

        const nuevoUsuario = result.rows[0];

        // Insertar rol si se proporciona
        if (rol) {
            const roleResult = await pool.query('SELECT id_rol FROM roles WHERE nombre_rol = $1', [rol]);
            if (roleResult.rows.length > 0) {
                const idRol = roleResult.rows[0].id_rol;
                await pool.query('INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)', [nuevoUsuario.id_usuario, idRol]);
            }
        }

        await pool.query('COMMIT');
        res.status(201).json(nuevoUsuario);

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error en create usuario:', error);
        res.status(500).json({ error: 'Error al crear el usuario. Posible correo duplicado.' });
    }
};

const createBulk = async (req, res) => {
    const usuarios = req.body;

    if (!Array.isArray(usuarios) || usuarios.length === 0) {
        return res.status(400).json({ error: 'No se enviaron usuarios para importar.' });
    }

    try {
        await pool.query('BEGIN');
        let insertados = 0;
        let errores = [];

        // Obtener todos los roles para no consultar en cada iteración
        const rolesResult = await pool.query('SELECT id_rol, nombre_rol FROM roles');
        const rolesMap = {};
        rolesResult.rows.forEach(r => { rolesMap[r.nombre_rol.toLowerCase()] = r.id_rol; });

        for (const u of usuarios) {
            try {
                // Insertar usuario
                const userRes = await pool.query(`
                    INSERT INTO usuarios (nombres, apellidos, tipo_documento, numero_documento, correo, id_contrato, id_programa, activo)
                    VALUES ($1, $2, 'CC', '0000000000', $3, 1, 1, TRUE)
                    RETURNING id_usuario
                `, [u.nombres, u.apellidos, u.correo]);

                const idUsuario = userRes.rows[0].id_usuario;

                // Insertar rol
                const idRol = rolesMap[(u.rol || 'Docente').toLowerCase()] || rolesMap['docente'];
                if (idRol) {
                    await pool.query('INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)', [idUsuario, idRol]);
                }

                insertados++;
            } catch (err) {
                // Capturar el error pero seguir con los demás
                errores.push({ correo: u.correo, motivo: err.message });
            }
        }

        await pool.query('COMMIT');
        res.status(201).json({
            mensaje: `Se importaron ${insertados} usuarios exitosamente.`,
            insertados,
            errores
        });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error en createBulk:', error);
        res.status(500).json({ error: 'Fallo crítico al realizar la carga masiva.' });
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
    createBulk,
    toggleActivo
};