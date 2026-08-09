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
                na.nombre_titulo   AS nivel_academico,
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

const parseRoles = (roles, rol) => {
    if (Array.isArray(roles) && roles.length > 0) {
        return roles;
    }
    if (typeof rol === 'string' && rol.trim() !== '') {
        return [rol.trim()];
    }
    return ['Docente'];
};

const normalizeRolName = (rName) => {
    if (!rName) return 'docente';
    const low = rName.trim().toLowerCase();
    if (low.includes('planea')) return 'planeacion';
    if (low.includes('direct')) return 'director';
    if (low.includes('consult')) return 'consultor';
    if (low.includes('docent')) return 'docente';
    return low;
};

const isOnlyConsultorOrPlaneacion = (rolesList) => {
    if (!rolesList || rolesList.length === 0) return false;
    return rolesList.every(r => {
        const norm = normalizeRolName(r);
        return norm === 'consultor' || norm === 'planeacion';
    });
};

const resolverIdContrato = (contratoInput) => {
    if (!contratoInput) return 4; // Por Definir por defecto (id_contrato = 4)
    const str = String(contratoInput).trim().toLowerCase();

    if (str.includes('mt') || str.includes('medio')) return 2; // Medio Tiempo (20h)
    if (str.includes('tc') || str.includes('completo')) return 1; // Tiempo Completo (40h)
    if (str.includes('hc') || str.includes('catedra') || str.includes('cátedra')) return 3; // Hora Cátedra

    const num = Number(contratoInput);
    if (!isNaN(num) && [1, 2, 3, 4].includes(num)) return num;

    return 4; // Por Definir
};

const validar = async (req, res) => {
    const { numero_documento, correo, nombres, apellidos, id_usuario } = req.body;
    try {
        let duplicaDocumento = false;
        let duplicaCorreo = false;
        let coincideNombre = false;

        if (numero_documento) {
            const resDoc = await pool.query(
                'SELECT id_usuario FROM usuarios WHERE numero_documento = $1 AND ($2::integer IS NULL OR id_usuario != $2)',
                [numero_documento, id_usuario || null]
            );
            if (resDoc.rows.length > 0) duplicaDocumento = true;
        }

        if (correo) {
            const resMail = await pool.query(
                'SELECT id_usuario FROM usuarios WHERE LOWER(correo) = LOWER($1) AND ($2::integer IS NULL OR id_usuario != $2)',
                [correo, id_usuario || null]
            );
            if (resMail.rows.length > 0) duplicaCorreo = true;
        }

        if (nombres && apellidos) {
            const resNom = await pool.query(
                'SELECT id_usuario FROM usuarios WHERE LOWER(TRIM(nombres)) = LOWER(TRIM($1)) AND LOWER(TRIM(apellidos)) = LOWER(TRIM($2)) AND ($3::integer IS NULL OR id_usuario != $3)',
                [nombres, apellidos, id_usuario || null]
            );
            if (resNom.rows.length > 0) coincideNombre = true;
        }

        res.json({
            duplicaDocumento,
            duplicaCorreo,
            coincideNombre,
            mensajeDocumento: duplicaDocumento ? 'Ya existe un usuario/docente registrado con esta identificación.' : null,
            mensajeCorreo: duplicaCorreo ? 'Ya existe un usuario/docente registrado con este correo institucional.' : null,
            mensajeNombre: coincideNombre ? '⚠️ Ya existe un docente registrado con este nombre. Verifique la identificación y el correo antes de continuar.' : null
        });
    } catch (error) {
        console.error('Error en validar usuario:', error);
        res.status(500).json({ error: 'Error al validar datos del usuario' });
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
        rol,
        roles
    } = req.body;

    const rolesList = parseRoles(roles, rol);
    const soloConsultorOPlaneacion = isOnlyConsultorOrPlaneacion(rolesList);
    const progId = soloConsultorOPlaneacion ? null : (id_programa || 1);

    const docNum = numero_documento ? String(numero_documento).trim() : '';
    const emailStr = correo ? String(correo).trim().toLowerCase() : '';

    try {
        // 1. Validar Identificación duplicada
        if (docNum) {
            const dupDoc = await pool.query(
                'SELECT id_usuario FROM usuarios WHERE numero_documento = $1',
                [docNum]
            );
            if (dupDoc.rows.length > 0) {
                return res.status(409).json({
                    error: `Ya existe un docente/usuario registrado con la identificación ${docNum}.`,
                    campo: 'numero_documento'
                });
            }
        }

        // 2. Validar Correo duplicado
        if (emailStr) {
            const dupEmail = await pool.query(
                'SELECT id_usuario FROM usuarios WHERE LOWER(correo) = LOWER($1)',
                [emailStr]
            );
            if (dupEmail.rows.length > 0) {
                return res.status(409).json({
                    error: `Ya existe un docente/usuario registrado con el correo institucional ${emailStr}.`,
                    campo: 'correo'
                });
            }
        }

        // 3. Verificar coincidencia por Nombre (Advertencia)
        let advertencia = null;
        if (nombres && apellidos) {
            const dupName = await pool.query(
                'SELECT id_usuario FROM usuarios WHERE LOWER(TRIM(nombres)) = LOWER(TRIM($1)) AND LOWER(TRIM(apellidos)) = LOWER(TRIM($2))',
                [nombres.trim(), apellidos.trim()]
            );
            if (dupName.rows.length > 0) {
                advertencia = '⚠️ Ya existe un docente registrado con este nombre. Verifique la identificación y el correo antes de continuar.';
            }
        }

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
            nombres ? nombres.trim() : '',
            apellidos ? apellidos.trim() : '',
            tipo_documento || 'CC',
            docNum || '0000000000',
            emailStr,
            id_contrato || resolverIdContrato(req.body.tipo_contrato) || 4,
            progId
        ]);

        const nuevoUsuario = result.rows[0];

        // Insertar múltiples roles
        for (const rName of rolesList) {
            const roleResult = await pool.query(
                'SELECT id_rol FROM roles WHERE LOWER(nombre_rol) = LOWER($1) OR LOWER(nombre_rol) = $2',
                [rName.trim(), normalizeRolName(rName)]
            );
            if (roleResult.rows.length > 0) {
                const idRol = roleResult.rows[0].id_rol;
                await pool.query(
                    'INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [nuevoUsuario.id_usuario, idRol]
                );
            }
        }

        // Asignar al periodo activo si existe y tiene rol docente o director
        const tieneRolAcademico = rolesList.some(r => {
            const low = r.toLowerCase();
            return low.includes('docent') || low.includes('direct');
        });

        if (idPeriodoActivo && tieneRolAcademico) {
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
        res.status(201).json({
            ...nuevoUsuario,
            roles: rolesList.join(', '),
            advertencia
        });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error en create usuario:', error);
        res.status(500).json({ error: 'Error al crear el usuario en la base de datos.' });
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
        const docsProcesadosEnLote = new Set();
        const correosProcesadosEnLote = new Set();

        // Buscar periodo activo
        const periodRes = await pool.query('SELECT id_periodo FROM periodo WHERE activo = TRUE LIMIT 1');
        const idPeriodoActivo = periodRes.rows.length > 0 ? periodRes.rows[0].id_periodo : null;

        // Cargar todos los roles para no consultar repetidamente
        const rolesResult = await pool.query('SELECT id_rol, nombre_rol FROM roles');
        const rolesMap = {};
        rolesResult.rows.forEach(r => {
            rolesMap[r.nombre_rol.toLowerCase()] = r.id_rol;
        });

        // Cargar programas académicos válidos existentes en la base de datos
        const progResult = await pool.query('SELECT id_programa, nombre_programa FROM programa_academico');
        const programasValidos = progResult.rows;
        const defaultProgId = programasValidos.length > 0 ? programasValidos[0].id_programa : 1;

        const resolverIdPrograma = (progInput) => {
            if (!progInput) return defaultProgId;
            const str = String(progInput).trim().toLowerCase();
            if (str === 'no aplica' || str === 'ninguno' || str === 'null' || str === '') return null;

            // Coincidencia por nombre en la BD
            const encontrado = programasValidos.find(p => {
                const pNombre = p.nombre_programa.toLowerCase();
                return pNombre.includes(str) || str.includes(pNombre);
            });
            if (encontrado) return encontrado.id_programa;

            // Búsqueda por palabras clave
            if (str.includes('electrónica') || str.includes('electronica')) {
                const pElec = programasValidos.find(p => p.nombre_programa.toLowerCase().includes('electrónica') || p.nombre_programa.toLowerCase().includes('electronica'));
                if (pElec) return pElec.id_programa;
            }
            if (str.includes('industrial')) {
                const pInd = programasValidos.find(p => p.nombre_programa.toLowerCase().includes('industrial'));
                if (pInd) return pInd.id_programa;
            }
            if (str.includes('sistemas')) {
                const pSis = programasValidos.find(p => p.nombre_programa.toLowerCase().includes('sistemas'));
                if (pSis) return pSis.id_programa;
            }

            // Si es un ID numérico directo y existe en la BD
            const num = Number(progInput);
            if (!isNaN(num) && programasValidos.some(p => p.id_programa === num)) {
                return num;
            }

            return defaultProgId;
        };

        let filaIdx = 1;
        for (const u of usuarios) {
            filaIdx++;
            const nombres = u.nombres ? String(u.nombres).trim() : '';
            const apellidos = u.apellidos ? String(u.apellidos).trim() : '';
            const tipoDoc = u.tipo_documento || u.tipoDocumento || u['tipo documento'] || u['Tipo Documento'] || 'CC';
            const numDoc = u.numero_documento || u.numeroDocumento || u['numero documento'] || u['Número Documento'] || u['Numero Documento'] || '';
            const correo = u.correo || u['correo'] || u['Correo'] || u['Correo Institucional'] || '';
            const correoStr = String(correo).trim().toLowerCase();
            const docStr = String(numDoc).trim();

            if (!nombres || !apellidos || !correoStr || !docStr) {
                errores.push({
                    fila: filaIdx,
                    usuario: `${nombres} ${apellidos}`.trim() || 'Desconocido',
                    correo: correoStr,
                    motivo: 'Faltan campos obligatorios (Nombres, Apellidos, Identificación o Correo).'
                });
                continue;
            }

            // 1. Validar si la identificación ya existe en la base de datos o en este lote
            if (docsProcesadosEnLote.has(docStr)) {
                errores.push({
                    fila: filaIdx,
                    usuario: `${nombres} ${apellidos}`,
                    correo: correoStr,
                    motivo: `La identificación ${docStr} está duplicada dentro del mismo archivo Excel.`
                });
                continue;
            }

            const dupDoc = await pool.query('SELECT id_usuario FROM usuarios WHERE numero_documento = $1', [docStr]);
            if (dupDoc.rows.length > 0) {
                errores.push({
                    fila: filaIdx,
                    usuario: `${nombres} ${apellidos}`,
                    correo: correoStr,
                    motivo: `La identificación ${docStr} ya está registrada en el sistema.`
                });
                continue;
            }

            // 2. Validar si el correo ya existe en la base de datos o en este lote
            if (correosProcesadosEnLote.has(correoStr)) {
                errores.push({
                    fila: filaIdx,
                    usuario: `${nombres} ${apellidos}`,
                    correo: correoStr,
                    motivo: `El correo ${correoStr} está duplicado dentro del mismo archivo Excel.`
                });
                continue;
            }

            const dupEmail = await pool.query('SELECT id_usuario FROM usuarios WHERE LOWER(correo) = LOWER($1)', [correoStr]);
            if (dupEmail.rows.length > 0) {
                errores.push({
                    fila: filaIdx,
                    usuario: `${nombres} ${apellidos}`,
                    correo: correoStr,
                    motivo: `El correo ${correoStr} ya está registrado en el sistema.`
                });
                continue;
            }

            // Parsear roles (soporta múltiples separados por coma)
            const rawRoles = u.roles || u.Rol || u.rol || u['Roles'] || u['roles'] || u['Roles de Acceso'] || 'Docente';
            const rolesList = typeof rawRoles === 'string'
                ? rawRoles.split(',').map(r => r.trim()).filter(Boolean)
                : (Array.isArray(rawRoles) ? rawRoles : ['Docente']);

            const soloConsultorOPlaneacion = isOnlyConsultorOrPlaneacion(rolesList);

            // Mapear programa de forma segura consultando la base de datos
            let progId = null;
            if (!soloConsultorOPlaneacion) {
                const rawProg = u.programa || u['programa académico'] || u['Programa Académico'] || u.programaAcademico || u.Programa || '';
                progId = resolverIdPrograma(rawProg);
            }

            // Mapear tipo de contrato / vinculación de forma segura (MT, TC, HC, Por Definir)
            const rawContrato = u.tipo_contrato || u.tipoContrato || u['tipo contrato'] || u['Tipo Contrato'] || u.vinculacion || u['vinculación'] || u['Vinculación'] || u.dedicacion || '';
            const contratoId = resolverIdContrato(rawContrato);

            try {
                // Insertar usuario
                const userRes = await pool.query(`
                    INSERT INTO usuarios (nombres, apellidos, tipo_documento, numero_documento, correo, id_contrato, id_programa, activo)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
                    RETURNING id_usuario
                `, [nombres, apellidos, tipoDoc, docStr, correoStr, contratoId, progId]);

                const idUsuario = userRes.rows[0].id_usuario;
                if (progId) {
                    programasInsertados.add(progId);
                }

                docsProcesadosEnLote.add(docStr);
                correosProcesadosEnLote.add(correoStr);

                // Insertar múltiples roles
                for (const rName of rolesList) {
                    const norm = normalizeRolName(rName);
                    const idRol = rolesMap[norm] || rolesMap['docente'];
                    if (idRol) {
                        await pool.query('INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2) ON CONFLICT DO NOTHING', [idUsuario, idRol]);
                    }
                }

                // Asignar al periodo activo si tiene rol académico (Docente/Director)
                const tieneRolAcademico = rolesList.some(r => {
                    const norm = normalizeRolName(r);
                    return norm === 'docente' || norm === 'director';
                });

                if (idPeriodoActivo && tieneRolAcademico) {
                    await pool.query(`
                        INSERT INTO docente_periodo (id_usuario, id_periodo)
                        VALUES ($1, $2)
                        ON CONFLICT DO NOTHING
                    `, [idUsuario, idPeriodoActivo]);
                }

                insertados++;
            } catch (err) {
                errores.push({
                    fila: filaIdx,
                    usuario: `${nombres} ${apellidos}`,
                    correo: correoStr,
                    motivo: err.message
                });
            }
        }

        // Asegurar programa_periodo para cada programa insertado
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
            mensaje: `Proceso completado. Se importaron ${insertados} usuarios exitosamente.`,
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
        rol,
        roles
    } = req.body;

    const rolesList = parseRoles(roles, rol);
    const soloConsultorOPlaneacion = isOnlyConsultorOrPlaneacion(rolesList);
    const progId = soloConsultorOPlaneacion ? null : (id_programa || 1);

    const docNum = numero_documento ? String(numero_documento).trim() : '';
    const emailStr = correo ? String(correo).trim().toLowerCase() : '';

    try {
        // 1. Validar Identificación duplicada (excluyendo el usuario actual)
        if (docNum) {
            const dupDoc = await pool.query(
                'SELECT id_usuario FROM usuarios WHERE numero_documento = $1 AND id_usuario != $2',
                [docNum, id]
            );
            if (dupDoc.rows.length > 0) {
                return res.status(409).json({
                    error: `Ya existe un docente/usuario registrado con la identificación ${docNum}.`,
                    campo: 'numero_documento'
                });
            }
        }

        // 2. Validar Correo duplicado (excluyendo el usuario actual)
        if (emailStr) {
            const dupEmail = await pool.query(
                'SELECT id_usuario FROM usuarios WHERE LOWER(correo) = LOWER($1) AND id_usuario != $2',
                [emailStr, id]
            );
            if (dupEmail.rows.length > 0) {
                return res.status(409).json({
                    error: `Ya existe un docente/usuario registrado con el correo institucional ${emailStr}.`,
                    campo: 'correo'
                });
            }
        }

        // 3. Verificar coincidencia por Nombre (Advertencia)
        let advertencia = null;
        if (nombres && apellidos) {
            const dupName = await pool.query(
                'SELECT id_usuario FROM usuarios WHERE LOWER(TRIM(nombres)) = LOWER(TRIM($1)) AND LOWER(TRIM(apellidos)) = LOWER(TRIM($2)) AND id_usuario != $3',
                [nombres.trim(), apellidos.trim(), id]
            );
            if (dupName.rows.length > 0) {
                advertencia = '⚠️ Ya existe un docente registrado con este nombre. Verifique la identificación y el correo antes de continuar.';
            }
        }

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
            nombres ? nombres.trim() : '',
            apellidos ? apellidos.trim() : '',
            tipo_documento || 'CC',
            docNum || '0000000000',
            emailStr,
            progId,
            id
        ]);

        if (result.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const usuarioActualizado = result.rows[0];

        // Sincronizar Roles (Eliminar antiguos e insertar nuevos)
        await pool.query('DELETE FROM usuario_rol WHERE id_usuario = $1', [id]);
        for (const rName of rolesList) {
            const roleResult = await pool.query(
                'SELECT id_rol FROM roles WHERE LOWER(nombre_rol) = LOWER($1) OR LOWER(nombre_rol) = $2',
                [rName.trim(), normalizeRolName(rName)]
            );
            if (roleResult.rows.length > 0) {
                const idRol = roleResult.rows[0].id_rol;
                await pool.query(
                    'INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [id, idRol]
                );
            }
        }

        // Si hay periodo activo y rol académico (Docente/Director), asegurar docente_periodo y programa_periodo
        const tieneRolAcademico = rolesList.some(r => {
            const low = r.toLowerCase();
            return low.includes('docent') || low.includes('direct');
        });

        if (idPeriodoActivo && tieneRolAcademico) {
            await pool.query(`
                INSERT INTO docente_periodo (id_usuario, id_periodo)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            `, [id, idPeriodoActivo]);

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
        res.json({
            ...usuarioActualizado,
            roles: rolesList.join(', '),
            advertencia
        });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error en update usuario:', error);
        res.status(500).json({ error: 'Error al actualizar el usuario en la base de datos.' });
    }
};

const getPerfilCompleto = async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Datos básicos del usuario
        const userResult = await pool.query(`
            SELECT
                u.id_usuario,
                u.nombres,
                u.apellidos,
                u.tipo_documento,
                u.numero_documento,
                u.correo,
                u.id_contrato,
                u.id_programa,
                u.activo,
                tc.tipo AS tipo_contrato,
                tc.horas_contrato,
                pa.nombre_programa AS programa,
                f.nombre_facultad AS facultad,
                STRING_AGG(DISTINCT r.nombre_rol, ', ') AS roles
            FROM usuarios u
            LEFT JOIN tipo_contrato tc ON u.id_contrato = tc.id_contrato
            LEFT JOIN programa_academico pa ON u.id_programa = pa.id_programa
            LEFT JOIN facultad f ON pa.id_facultad = f.id_facultad
            LEFT JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
            LEFT JOIN roles r ON ur.id_rol = r.id_rol
            WHERE u.id_usuario = $1
            GROUP BY u.id_usuario, tc.tipo, tc.horas_contrato, pa.nombre_programa, f.nombre_facultad
        `, [id]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const usuario = userResult.rows[0];

        // 2. Títulos académicos del usuario (desde usuario_nivel + nivel_academico)
        const titulosResult = await pool.query(`
            SELECT
                na.id_nivelaca,
                na.nombre_titulo,
                na.nivel,
                na.titulo_convalidado
            FROM usuario_nivel un
            JOIN nivel_academico na ON un.id_nivelaca = na.id_nivelaca
            WHERE un.id_usuario = $1
            ORDER BY na.nivel
        `, [id]);

        const titulos = titulosResult.rows;
        const titulo_pregrado = titulos.find(t => t.nivel && t.nivel.toLowerCase().includes('pregrado'));
        const titulo_posgrado = titulos.find(t => t.nivel && t.nivel.toLowerCase().includes('posgrado'));
        const titulo_convalidado = titulos.find(t => t.titulo_convalidado === true);

        // 3. Listas para los dropdowns del formulario
        const contratosResult = await pool.query('SELECT id_contrato, tipo, horas_contrato FROM tipo_contrato WHERE activo = TRUE ORDER BY tipo');
        const programasResult = await pool.query('SELECT id_programa, nombre_programa FROM programa_academico WHERE activo = TRUE ORDER BY nombre_programa');
        const periodoResult = await pool.query('SELECT id_periodo, anio, semestre FROM periodo WHERE activo = TRUE LIMIT 1');

        const periodoActivo = periodoResult.rows.length > 0 ? periodoResult.rows[0] : null;

        // 4. Determinar si el perfil está completo
        const perfilCompleto = !!(
            usuario.nombres && usuario.nombres.trim() !== '' &&
            usuario.apellidos && usuario.apellidos.trim() !== '' &&
            usuario.tipo_documento && usuario.tipo_documento.trim() !== '' &&
            usuario.numero_documento && usuario.numero_documento.trim() !== '' && usuario.numero_documento !== '0000000000' &&
            usuario.id_contrato && usuario.id_contrato !== 4 &&
            usuario.id_programa &&
            titulo_pregrado
        );

        res.json({
            ...usuario,
            titulo_pregrado: titulo_pregrado ? { id_nivelaca: titulo_pregrado.id_nivelaca, nombre_titulo: titulo_pregrado.nombre_titulo } : null,
            titulo_posgrado: titulo_posgrado ? { id_nivelaca: titulo_posgrado.id_nivelaca, nombre_titulo: titulo_posgrado.nombre_titulo } : null,
            titulo_convalidado: titulo_convalidado ? { id_nivelaca: titulo_convalidado.id_nivelaca, nombre_titulo: titulo_convalidado.nombre_titulo } : null,
            contratos: contratosResult.rows,
            programas: programasResult.rows,
            periodo_activo: periodoActivo,
            perfil_completo: perfilCompleto
        });

    } catch (error) {
        console.error('Error en getPerfilCompleto:', error.message);
        res.status(500).json({ error: 'Error al obtener el perfil completo.' });
    }
};

const updatePerfil = async (req, res) => {
    const { id } = req.params;
    const {
        nombres,
        apellidos,
        tipo_documento,
        numero_documento,
        id_contrato,
        id_programa,
        titulo_pregrado,
        titulo_posgrado,
        titulo_convalidado
    } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Actualizar datos básicos del usuario
        const docNum = numero_documento ? String(numero_documento).trim() : '';

        // Validar documento duplicado
        if (docNum) {
            const dupDoc = await client.query(
                'SELECT id_usuario FROM usuarios WHERE numero_documento = $1 AND id_usuario != $2',
                [docNum, id]
            );
            if (dupDoc.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: `Ya existe un usuario registrado con la identificación ${docNum}.` });
            }
        }

        await client.query(`
            UPDATE usuarios
            SET nombres = $1,
                apellidos = $2,
                tipo_documento = $3,
                numero_documento = $4,
                id_contrato = $5,
                id_programa = $6
            WHERE id_usuario = $7
        `, [
            nombres ? nombres.trim() : '',
            apellidos ? apellidos.trim() : '',
            tipo_documento || 'CC',
            docNum || '0000000000',
            id_contrato || 4,
            id_programa || null,
            id
        ]);

        // 2. Gestionar títulos académicos (upsert en nivel_academico + usuario_nivel)
        const upsertTitulo = async (nombreTitulo, nivel, esConvalidado) => {
            if (!nombreTitulo || nombreTitulo.trim() === '') return;

            // Buscar si ya existe un registro del usuario para este nivel
            const existente = await client.query(`
                SELECT un.id_usuarionivel, na.id_nivelaca
                FROM usuario_nivel un
                JOIN nivel_academico na ON un.id_nivelaca = na.id_nivelaca
                WHERE un.id_usuario = $1 AND LOWER(na.nivel) = LOWER($2)
                ${esConvalidado ? 'AND na.titulo_convalidado = TRUE' : 'AND (na.titulo_convalidado = FALSE OR na.titulo_convalidado IS NULL)'}
            `, [id, nivel]);

            if (existente.rows.length > 0) {
                // Actualizar el título existente
                await client.query(`
                    UPDATE nivel_academico SET nombre_titulo = $1 WHERE id_nivelaca = $2
                `, [nombreTitulo.trim(), existente.rows[0].id_nivelaca]);
            } else {
                // Crear nuevo registro en nivel_academico y vincular
                const newNivel = await client.query(`
                    INSERT INTO nivel_academico (nombre_titulo, nivel, titulo_convalidado, activo)
                    VALUES ($1, $2, $3, TRUE)
                    RETURNING id_nivelaca
                `, [nombreTitulo.trim(), nivel, esConvalidado || false]);

                await client.query(`
                    INSERT INTO usuario_nivel (id_usuario, id_nivelaca, fecha_inicio)
                    VALUES ($1, $2, NOW())
                `, [id, newNivel.rows[0].id_nivelaca]);
            }
        };

        await upsertTitulo(titulo_pregrado, 'Pregrado', false);
        await upsertTitulo(titulo_posgrado, 'Posgrado', false);
        await upsertTitulo(titulo_convalidado, 'Posgrado', true);

        // 3. Asegurar docente_periodo para el periodo activo
        const periodoRes = await client.query('SELECT id_periodo FROM periodo WHERE activo = TRUE LIMIT 1');
        if (periodoRes.rows.length > 0) {
            await client.query(`
                INSERT INTO docente_periodo (id_usuario, id_periodo)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            `, [id, periodoRes.rows[0].id_periodo]);
        }

        await client.query('COMMIT');
        res.json({ mensaje: 'Perfil actualizado correctamente.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en updatePerfil:', error.message);
        res.status(500).json({ error: 'Error al actualizar el perfil.' });
    } finally {
        client.release();
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
    validar,
    create,
    createBulk,
    toggleActivo,
    update,
    deleteUsuario,
    getPerfilCompleto,
    updatePerfil
};