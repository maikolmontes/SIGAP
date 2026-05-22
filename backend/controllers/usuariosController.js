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
                u.tipo_documento,
                u.numero_documento,
                u.activo,
                tc.tipo            AS tipo_contrato,
                tc.horas_contrato,
                pa.nombre_programa AS programa,
                f.nombre_facultad  AS facultad,
                STRING_AGG(r.nombre_rol, ', ') AS roles
            FROM usuarios u
            LEFT JOIN tipo_contrato tc       ON u.id_contrato  = tc.id_contrato
            LEFT JOIN programa_academico pa  ON u.id_programa  = pa.id_programa
            LEFT JOIN facultad f             ON pa.id_facultad = f.id_facultad
            LEFT JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
            LEFT JOIN roles r ON ur.id_rol = r.id_rol
            
            GROUP BY
                u.id_usuario, u.nombres, u.apellidos,
                u.correo, u.tipo_documento, u.numero_documento, u.activo,
                tc.tipo, tc.horas_contrato,
                pa.nombre_programa, f.nombre_facultad
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
            LEFT JOIN tipo_contrato tc       ON u.id_contrato   = tc.id_contrato
            LEFT JOIN programa_academico pa  ON u.id_programa   = pa.id_programa
            LEFT JOIN facultad f             ON pa.id_facultad  = f.id_facultad
            LEFT JOIN usuario_rol ur         ON u.id_usuario    = ur.id_usuario
            LEFT JOIN roles r                ON ur.id_rol       = r.id_rol
            LEFT JOIN usuario_nivel un       ON u.id_usuario    = un.id_usuario
            LEFT JOIN nivel_academico na     ON un.id_nivelaca  = na.id_nivelaca
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

    const isPlaneacion = rol && rol.toLowerCase().includes('plane');
    const progId = isPlaneacion ? null : (id_programa || 1);

    try {
        await pool.query('BEGIN'); // Iniciar transacción

        // Buscar periodo activo
        const periodRes = await pool.query('SELECT id_periodo FROM periodo WHERE activo = TRUE LIMIT 1');
        const idPeriodoActivo = periodRes.rows.length > 0 ? periodRes.rows[0].id_periodo : null;

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
            progId
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

        // Asignar al periodo activo si existe
        if (idPeriodoActivo) {
            await pool.query(`
                INSERT INTO docente_periodo (id_usuario, id_periodo)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            `, [nuevoUsuario.id_usuario, idPeriodoActivo]);

            // Asegurar programa_periodo para el programa seleccionado
            if (progId) {
                const existeProgPer = await pool.query(
                    'SELECT id_progperiodo FROM programa_periodo WHERE id_programa = $1 AND id_periodo = $2',
                    [progId, idPeriodoActivo]
                );
                if (existeProgPer.rows.length === 0) {
                    const pensul = await pool.query(
                        'SELECT id_pensulaca FROM pensul_academico WHERE activo = TRUE LIMIT 1'
                    );
                    const id_pensulaca = pensul.rows[0]?.id_pensulaca || 1;
                    await pool.query(`
                        INSERT INTO programa_periodo (id_periodo, id_programa, id_pensulaca)
                        VALUES ($1, $2, $3)
                    `, [idPeriodoActivo, progId, id_pensulaca]);
                }
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
        const programasInsertados = new Set();

        // Buscar periodo activo
        const periodRes = await pool.query('SELECT id_periodo FROM periodo WHERE activo = TRUE LIMIT 1');
        const idPeriodoActivo = periodRes.rows.length > 0 ? periodRes.rows[0].id_periodo : null;

        // Obtener todos los roles para no consultar en cada iteración
        const rolesResult = await pool.query('SELECT id_rol, nombre_rol FROM roles');
        const rolesMap = {};
        rolesResult.rows.forEach(r => { rolesMap[r.nombre_rol.toLowerCase()] = r.id_rol; });

        for (const u of usuarios) {
            try {
                const tipoDoc = u.tipo_documento || u.tipoDocumento || u['tipo documento'] || 'CC';
                const numDoc = u.numero_documento || u.numeroDocumento || u['numero documento'] || '0000000000';

                const userRol = (u.rol || 'Docente').toLowerCase();
                const isPlaneacion = userRol.includes('plane');

                // Mapear programa a su ID
                let progId = null;
                if (!isPlaneacion) {
                    progId = 1; // Por defecto Sistemas para docentes
                    const progName = (u.programa || u['programa académico'] || u.programaAcademico || '').toLowerCase();
                    if (progName.includes('electrónica') || progName.includes('electronica')) {
                        progId = 2;
                    } else if (progName.includes('industrial')) {
                        progId = 3;
                    } else if (progName.includes('financiera')) {
                        progId = 4;
                    } else if (u.id_programa) {
                        progId = Number(u.id_programa);
                    }
                }

                // Insertar usuario
                const userRes = await pool.query(`
                    INSERT INTO usuarios (nombres, apellidos, tipo_documento, numero_documento, correo, id_contrato, id_programa, activo)
                    VALUES ($1, $2, $3, $4, $5, 1, $6, TRUE)
                    RETURNING id_usuario
                `, [u.nombres, u.apellidos, tipoDoc, numDoc, u.correo, progId]);

                const idUsuario = userRes.rows[0].id_usuario;
                if (progId) {
                    programasInsertados.add(progId);
                }

                // Insertar rol
                const idRol = rolesMap[(u.rol || 'Docente').toLowerCase()] || rolesMap['docente'];
                if (idRol) {
                    await pool.query('INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)', [idUsuario, idRol]);
                }

                // Asignar al periodo activo si existe
                if (idPeriodoActivo) {
                    await pool.query(`
                        INSERT INTO docente_periodo (id_usuario, id_periodo)
                        VALUES ($1, $2)
                        ON CONFLICT DO NOTHING
                    `, [idUsuario, idPeriodoActivo]);
                }

                insertados++;
            } catch (err) {
                // Capturar el error pero seguir con los demás
                errores.push({ correo: u.correo, motivo: err.message });
            }
        }

        // Asegurar programa_periodo para cada programa insertado si hay periodo activo e inserciones exitosas
        if (idPeriodoActivo && insertados > 0) {
            for (const pid of programasInsertados) {
                const existeProgPer = await pool.query(
                    'SELECT id_progperiodo FROM programa_periodo WHERE id_programa = $1 AND id_periodo = $2',
                    [pid, idPeriodoActivo]
                );
                if (existeProgPer.rows.length === 0) {
                    const pensul = await pool.query(
                        'SELECT id_pensulaca FROM pensul_academico WHERE activo = TRUE LIMIT 1'
                    );
                    const id_pensulaca = pensul.rows[0]?.id_pensulaca || 1;
                    await pool.query(`
                        INSERT INTO programa_periodo (id_periodo, id_programa, id_pensulaca)
                        VALUES ($1, $2, $3)
                    `, [idPeriodoActivo, pid, id_pensulaca]);
                }
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

const update = async (req, res) => {
    const { id } = req.params;
    const {
        nombres,
        apellidos,
        tipo_documento,
        numero_documento,
        correo,
        id_programa,
        rol
    } = req.body;

    const isPlaneacion = rol && rol.toLowerCase().includes('plane');
    const progId = isPlaneacion ? null : (id_programa || 1);

    try {
        await pool.query('BEGIN');

        // Buscar periodo activo
        const periodRes = await pool.query('SELECT id_periodo FROM periodo WHERE activo = TRUE LIMIT 1');
        const idPeriodoActivo = periodRes.rows.length > 0 ? periodRes.rows[0].id_periodo : null;

        // Actualizar datos del usuario
        const result = await pool.query(`
            UPDATE usuarios
            SET nombres = $1,
                apellidos = $2,
                tipo_documento = $3,
                numero_documento = $4,
                correo = $5,
                id_programa = $6
            WHERE id_usuario = $7
            RETURNING id_usuario, nombres, apellidos, correo, id_programa
        `, [
            nombres,
            apellidos,
            tipo_documento || 'CC',
            numero_documento || '0000000000',
            correo,
            progId,
            id
        ]);

        if (result.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const usuarioActualizado = result.rows[0];

        // Sincronizar Rol
        if (rol) {
            // Eliminar rol actual
            await pool.query('DELETE FROM usuario_rol WHERE id_usuario = $1', [id]);

            // Obtener ID del nuevo rol
            const roleResult = await pool.query('SELECT id_rol FROM roles WHERE nombre_rol = $1', [rol]);
            if (roleResult.rows.length > 0) {
                const idRol = roleResult.rows[0].id_rol;
                await pool.query('INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)', [id, idRol]);
            }
        }

        // Si hay periodo activo y un programa, asegurar programa_periodo
        if (idPeriodoActivo && progId) {
            const existeProgPer = await pool.query(
                'SELECT id_progperiodo FROM programa_periodo WHERE id_programa = $1 AND id_periodo = $2',
                [progId, idPeriodoActivo]
            );
            if (existeProgPer.rows.length === 0) {
                const pensul = await pool.query(
                    'SELECT id_pensulaca FROM pensul_academico WHERE activo = TRUE LIMIT 1'
                );
                const id_pensulaca = pensul.rows[0]?.id_pensulaca || 1;
                await pool.query(`
                    INSERT INTO programa_periodo (id_periodo, id_programa, id_pensulaca)
                    VALUES ($1, $2, $3)
                `, [idPeriodoActivo, progId, id_pensulaca]);
            }
        }

        await pool.query('COMMIT');
        res.json(usuarioActualizado);

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error en update usuario:', error);
        res.status(500).json({ error: 'Error al actualizar el usuario. Posible correo duplicado o error de base de datos.' });
    }
};

const deleteUsuario = async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query('BEGIN');

        // 1. Eliminar relaciones de rol
        await pool.query('DELETE FROM usuario_rol WHERE id_usuario = $1', [id]);

        // 2. Eliminar relaciones de periodos
        await pool.query('DELETE FROM docente_periodo WHERE id_usuario = $1', [id]);

        // 3. Eliminar relaciones de nivel académico
        await pool.query('DELETE FROM usuario_nivel WHERE id_usuario = $1', [id]);

        // 4. Eliminar asignaciones de agenda
        await pool.query('DELETE FROM usuario_asignacion WHERE id_usuario = $1', [id]);

        // 5. Eliminar observaciones de director creadas por el usuario si era Director
        await pool.query('DELETE FROM observaciones_director WHERE director_id = $1', [id]);

        // 6. Desvincular revisión en asignacion_funciones
        await pool.query('UPDATE asignacion_funciones SET revisado_por = NULL WHERE revisado_por = $1', [id]);

        // 7. Eliminar finalmente el usuario
        const result = await pool.query('DELETE FROM usuarios WHERE id_usuario = $1 RETURNING id_usuario', [id]);

        if (result.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        await pool.query('COMMIT');
        res.json({ message: 'Usuario eliminado exitosamente' });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error en deleteUsuario:', error.message);
        res.status(500).json({ error: 'Error al eliminar el usuario' });
    }
};

module.exports = {
    getAll,
    getById,
    create,
    createBulk,
    toggleActivo,
    update,
    deleteUsuario
};