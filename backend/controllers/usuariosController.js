const pool = require('../db/connection');
const notificaciones = require('../services/notificacionesService');
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
                u.id_programa,
                tc.tipo            AS tipo_contrato,
                tc.horas_contrato,
                pa.nombre_programa AS programa,
                f.nombre_facultad  AS facultad,
                COALESCE((SELECT ARRAY_AGG(dp.id_programa ORDER BY dp.id_programa)
                          FROM director_programa dp
                          WHERE dp.id_usuario = u.id_usuario), '{}') AS programas_gestion,
                (SELECT STRING_AGG(pg.nombre_programa, ', ' ORDER BY pg.nombre_programa)
                 FROM director_programa dp
                 JOIN programa_academico pg ON pg.id_programa = dp.id_programa
                 WHERE dp.id_usuario = u.id_usuario) AS programas_gestion_nombres,
                STRING_AGG(DISTINCT r.nombre_rol, ', ') AS roles
            FROM usuarios u
            LEFT JOIN tipo_contrato tc       ON u.id_contrato  = tc.id_contrato
            LEFT JOIN programa_academico pa  ON u.id_programa  = pa.id_programa
            LEFT JOIN facultad f             ON pa.id_facultad = f.id_facultad
            LEFT JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
            LEFT JOIN roles r ON ur.id_rol = r.id_rol
            
            GROUP BY
                u.id_usuario, u.nombres, u.apellidos,
                u.correo, u.tipo_documento, u.numero_documento, u.activo,
                u.id_programa,
                tc.tipo, tc.horas_contrato,
                pa.nombre_programa, f.nombre_facultad
            ORDER BY u.nombres, u.apellidos
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
                u.id_programa,
                tc.tipo            AS tipo_contrato,
                tc.horas_contrato,
                pa.nombre_programa AS programa,
                f.nombre_facultad  AS facultad,
                na.nombre_titulo   AS nivel_academico,
                COALESCE((SELECT ARRAY_AGG(dp.id_programa ORDER BY dp.id_programa)
                          FROM director_programa dp
                          WHERE dp.id_usuario = u.id_usuario), '{}') AS programas_gestion,
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
                u.id_programa,
                tc.tipo, tc.horas_contrato,
                pa.nombre_programa, f.nombre_facultad,
                na.nombre_titulo
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

/**
 * GET /api/usuarios/roles
 * Catálogo de roles asignables. La interfaz de Planeación lo usa para armar
 * el selector de roles: así un rol nuevo (Investigación y los que sigan)
 * aparece solo, sin editar listas quemadas en el frontend.
 */
const getRolesAsignables = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT r.id_rol, r.nombre_rol, r.descripcion_rol,
                   COALESCE(
                     ARRAY_AGG(rf.funcion_sustantiva ORDER BY rf.funcion_sustantiva)
                     FILTER (WHERE rf.funcion_sustantiva IS NOT NULL), '{}'
                   ) AS funciones_revisa
            FROM roles r
            LEFT JOIN rol_funcion rf ON rf.id_rol = r.id_rol
            GROUP BY r.id_rol, r.nombre_rol, r.descripcion_rol
            ORDER BY r.id_rol
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error en getRolesAsignables:', error.message);
        res.status(500).json({ error: 'Error al obtener los roles' });
    }
};

const normalizeRolName = (rName) => {
    if (!rName) return 'docente';
    const low = rName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (low.includes('planea') || low.includes('admin')) return 'planeacion';
    if (low.includes('direct')) return 'director';
    if (low.includes('consult') || low.includes('auditor')) return 'consultor';
    if (low.includes('docent')) return 'docente';
    return low;
};

// Mapa canónico: nombre normalizado -> nombre en BD (según diagnóstico)
const CANONICAL_ROL_MAP = {
    'docente':    { nombre: 'Docente',    id: 2 },
    'director':   { nombre: 'Director',   id: 3 },
    'consultor':  { nombre: 'Consultor',  id: 4 },
    'planeacion': { nombre: 'Planeacion', id: 1 },
};

/**
 * Busca el id_rol de forma robusta: primero intenta el mapa canónico,
 * luego hace consulta a la BD como respaldo.
 */
const resolverIdRol = async (rName) => {
    const norm = normalizeRolName(rName);
    if (CANONICAL_ROL_MAP[norm]) {
        return CANONICAL_ROL_MAP[norm].id;
    }
    // Respaldo: consultar en la BD
    const result = await pool.query(
        'SELECT id_rol FROM roles WHERE LOWER(nombre_rol) = $1 LIMIT 1',
        [norm]
    );
    return result.rows.length > 0 ? result.rows[0].id_rol : null;
};

const parseRoles = (roles, rol) => {
    let rawList = [];
    if (Array.isArray(roles) && roles.length > 0) {
        rawList = roles;
    } else if (typeof rol === 'string' && rol.trim() !== '') {
        rawList = rol.split(',').map(r => r.trim()).filter(Boolean);
    } else {
        rawList = ['Docente'];
    }

    const canonicalMap = {
        'docente': 'Docente',
        'director': 'Director',
        'consultor': 'Consultor',
        'planeacion': 'Planeacion'
    };

    const uniqueSet = new Set();
    for (const r of rawList) {
        if (!r) continue;
        const norm = normalizeRolName(r);
        const canon = canonicalMap[norm] || r.trim();
        if (canon) uniqueSet.add(canon);
    }

    return uniqueSet.size > 0 ? Array.from(uniqueSet) : ['Docente'];
};

const isOnlyConsultorOrPlaneacion = (rolesList) => {
    if (!rolesList || rolesList.length === 0) return false;
    return rolesList.every(r => {
        const norm = normalizeRolName(r);
        return norm === 'consultor' || norm === 'planeacion';
    });
};

/**
 * Sincroniza los programas que gestiona un Director (tabla director_programa).
 * Un director puede gestionar uno o varios programas y un programa puede
 * tener varios directores.
 *
 *  · Si el usuario NO tiene rol Director, se borran sus filas.
 *  · Si es Director y no se indican programas, se usa su programa principal.
 *    Así un formulario antiguo (solo id_programa) sigue funcionando.
 *
 * @returns {Promise<number[]>} ids de programa que quedaron asignados
 */
const sincronizarProgramasDirector = async (idUsuario, rolesList, programasInput, progPrincipal, db = pool) => {
    await db.query('DELETE FROM director_programa WHERE id_usuario = $1', [idUsuario]);

    const esDirector = rolesList.some(r => normalizeRolName(r) === 'director');
    if (!esDirector) return [];

    let ids = (Array.isArray(programasInput) ? programasInput : [])
        .map(Number)
        .filter(n => Number.isInteger(n) && n > 0);
    if (ids.length === 0 && progPrincipal) ids = [Number(progPrincipal)];
    if (ids.length === 0) return [];

    // Se inserta solo lo que existe en programa_academico
    const r = await db.query(`
        INSERT INTO director_programa (id_usuario, id_programa)
        SELECT $1, id_programa FROM programa_academico WHERE id_programa = ANY($2::int[])
        ON CONFLICT DO NOTHING
        RETURNING id_programa
    `, [idUsuario, ids]);
    return r.rows.map(f => f.id_programa);
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

// ================================================================
// Validación de los datos de un usuario (alta y edición)
// ----------------------------------------------------------------
// Una sola función para crear y editar, así ambas rutas aplican
// exactamente las mismas reglas. Devuelve la lista COMPLETA de
// errores (no solo el primero) para que el formulario pueda marcar
// todos los campos de una vez.
// ================================================================
const TIPOS_DOCUMENTO = ['CC', 'CE', 'PA', 'TI'];
const REGEX_NOMBRE = /^[\p{L}][\p{L}\s'.\-]*$/u;
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_DOC_NUMERICO = /^\d{5,12}$/;
const REGEX_DOC_PASAPORTE = /^[A-Za-z0-9]{5,15}$/;

/**
 * @param {object} body        cuerpo de la petición
 * @param {object} [opciones]
 * @param {number|string|null} [opciones.idExcluir] usuario que se edita (se ignora en los duplicados)
 * @returns {Promise<{errores: {campo:string, mensaje:string, status:number}[], datos: object, advertencia: string|null}>}
 */
const validarDatosUsuario = async (body, { idExcluir = null } = {}) => {
    const errores = [];
    const agregar = (campo, mensaje, status = 400) => errores.push({ campo, mensaje, status });
    const excluir = idExcluir ? Number(idExcluir) : null;

    const limpiar = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');
    const nombres = limpiar(body.nombres);
    const apellidos = limpiar(body.apellidos);
    const correo = String(body.correo ?? '').trim().toLowerCase();
    const tipoDoc = String(body.tipo_documento || 'CC').trim().toUpperCase();
    const docNum = String(body.numero_documento ?? '').trim();

    // ---------- Nombres y apellidos ----------
    const validarNombre = (valor, campo, etiqueta) => {
        if (!valor) return agregar(campo, `${etiqueta} son obligatorios.`);
        if (valor.length < 2 || valor.length > 60) {
            return agregar(campo, `${etiqueta} deben tener entre 2 y 60 caracteres.`);
        }
        if (!REGEX_NOMBRE.test(valor)) {
            return agregar(campo, `${etiqueta} solo pueden contener letras, espacios, apóstrofes, puntos y guiones.`);
        }
    };
    validarNombre(nombres, 'nombres', 'Los nombres');
    validarNombre(apellidos, 'apellidos', 'Los apellidos');

    // ---------- Correo ----------
    let correoValido = false;
    if (!correo) {
        agregar('correo', 'El correo es obligatorio.');
    } else if (correo.length > 100) {
        agregar('correo', 'El correo no puede superar los 100 caracteres.');
    } else if (!REGEX_CORREO.test(correo)) {
        agregar('correo', 'El correo no tiene un formato válido (ejemplo: nombre@unicesmag.edu.co).');
    } else {
        correoValido = true;
    }

    // ---------- Documento ----------
    let documentoValido = false;
    if (!TIPOS_DOCUMENTO.includes(tipoDoc)) {
        agregar('tipo_documento', `El tipo de documento debe ser uno de: ${TIPOS_DOCUMENTO.join(', ')}.`);
    } else if (!docNum) {
        agregar('numero_documento', 'El número de documento es obligatorio.');
    } else if (tipoDoc === 'PA' ? !REGEX_DOC_PASAPORTE.test(docNum) : !REGEX_DOC_NUMERICO.test(docNum)) {
        agregar(
            'numero_documento',
            tipoDoc === 'PA'
                ? 'El pasaporte debe tener entre 5 y 15 caracteres alfanuméricos, sin espacios.'
                : 'El número de documento debe tener entre 5 y 12 dígitos, sin puntos ni espacios.'
        );
    } else if (/^0+$/.test(docNum)) {
        agregar('numero_documento', 'El número de documento no es válido.');
    } else {
        documentoValido = true;
    }

    // ---------- Roles ----------
    const rolesVacios = Array.isArray(body.roles) && body.roles.length === 0 && !body.rol;
    const rolesList = parseRoles(body.roles, body.rol);
    const idsRol = [];
    if (rolesVacios) {
        agregar('roles', 'Debe seleccionar al menos un rol.');
    } else {
        for (const rName of rolesList) {
            const idRol = await resolverIdRol(rName);
            if (idRol) idsRol.push(idRol);
            else agregar('roles', `El rol "${rName}" no existe.`);
        }
    }
    const soloConsultorOPlaneacion = isOnlyConsultorOrPlaneacion(rolesList);
    const esDirector = rolesList.some(r => normalizeRolName(r) === 'director');

    // ---------- Programa académico ----------
    // Consultor/Planeación no tienen programa; los demás roles sí, y debe ser real.
    let progId = null;
    if (!soloConsultorOPlaneacion) {
        let pedido = Number(body.id_programa);
        // Un director que no es docente no tiene "programa propio": el principal
        // es el primero de los que gestiona.
        const esDocente = rolesList.some(r => normalizeRolName(r) === 'docente');
        if ((!Number.isInteger(pedido) || pedido <= 0) && esDirector && !esDocente && Array.isArray(body.programas_gestion)) {
            pedido = Number(body.programas_gestion[0]);
        }
        if (!Number.isInteger(pedido) || pedido <= 0) {
            agregar('id_programa', esDirector && !esDocente
                ? 'Debe seleccionar al menos un programa que gestionará como Director.'
                : 'Debe seleccionar un programa académico.');
        } else {
            const prog = await pool.query(
                'SELECT activo FROM programa_academico WHERE id_programa = $1',
                [pedido]
            );
            if (prog.rows.length === 0) agregar('id_programa', 'El programa académico seleccionado no existe.');
            else if (prog.rows[0].activo === false) agregar('id_programa', 'El programa académico seleccionado está inactivo.');
            else progId = pedido;
        }
    }

    // ---------- Programas que gestiona un Director ----------
    let programasGestion = [];
    if (esDirector && body.programas_gestion !== undefined && body.programas_gestion !== null) {
        if (!Array.isArray(body.programas_gestion)) {
            agregar('programas_gestion', 'Los programas que gestiona deben enviarse como una lista.');
        } else {
            const pedidos = [...new Set(body.programas_gestion.map(Number))];
            if (pedidos.some(n => !Number.isInteger(n) || n <= 0)) {
                agregar('programas_gestion', 'Alguno de los programas que gestiona no es válido.');
            } else if (pedidos.length > 0) {
                const existentes = await pool.query(
                    'SELECT id_programa FROM programa_academico WHERE id_programa = ANY($1::int[])',
                    [pedidos]
                );
                if (existentes.rows.length !== pedidos.length) {
                    agregar('programas_gestion', 'Alguno de los programas que gestiona no existe.');
                } else {
                    programasGestion = pedidos;
                }
            }
        }
    }

    // ---------- Exclusividad de programas para Director (un programa solo un director activo) ----------
    if (esDirector) {
        const progsAValidar = [...new Set([
            ...programasGestion,
            ...((!rolesList.some(r => normalizeRolName(r) === 'docente') && progId) ? [progId] : [])
        ])];

        if (progsAValidar.length > 0) {
            const ocupados = await pool.query(`
                SELECT DISTINCT pa.id_programa, pa.nombre_programa, dir.id_usuario, dir.nombres, dir.apellidos
                FROM programa_academico pa
                JOIN (
                    SELECT dp.id_programa, u.id_usuario, u.nombres, u.apellidos, u.activo
                    FROM director_programa dp
                    JOIN usuarios u ON u.id_usuario = dp.id_usuario
                    JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
                    JOIN roles r ON r.id_rol = ur.id_rol AND LOWER(r.nombre_rol) = 'director'
                ) dir ON dir.id_programa = pa.id_programa
                WHERE pa.id_programa = ANY($1::int[])
                  AND dir.activo = true
                  AND ($2::int IS NULL OR dir.id_usuario <> $2)
            `, [progsAValidar, excluir]);

            for (const f of ocupados.rows) {
                agregar(
                    'programas_gestion',
                    `El programa "${f.nombre_programa}" ya se encuentra asignado al director ${f.nombres} ${f.apellidos}. Seleccione únicamente programas disponibles.`,
                    409
                );
            }
        }
    }

    // ---------- Tipo de contrato ----------
    const idContrato = Number(body.id_contrato) || resolverIdContrato(body.tipo_contrato);
    const contrato = await pool.query('SELECT 1 FROM tipo_contrato WHERE id_contrato = $1', [idContrato]);
    if (contrato.rows.length === 0) agregar('id_contrato', 'El tipo de contrato seleccionado no existe.');

    // ---------- Duplicados (409) ----------
    if (documentoValido) {
        const dup = await pool.query(
            'SELECT id_usuario FROM usuarios WHERE numero_documento = $1 AND ($2::int IS NULL OR id_usuario <> $2)',
            [docNum, excluir]
        );
        if (dup.rows.length > 0) {
            agregar('numero_documento', `Ya existe un docente/usuario registrado con la identificación ${docNum}.`, 409);
        }
    }
    if (correoValido) {
        const dup = await pool.query(
            'SELECT id_usuario FROM usuarios WHERE LOWER(correo) = $1 AND ($2::int IS NULL OR id_usuario <> $2)',
            [correo, excluir]
        );
        if (dup.rows.length > 0) {
            agregar('correo', `Ya existe un docente/usuario registrado con el correo institucional ${correo}.`, 409);
        }
    }

    // ---------- Homónimo (solo advertencia) ----------
    let advertencia = null;
    if (nombres && apellidos) {
        const dup = await pool.query(
            `SELECT 1 FROM usuarios
             WHERE LOWER(TRIM(nombres)) = LOWER($1) AND LOWER(TRIM(apellidos)) = LOWER($2)
               AND ($3::int IS NULL OR id_usuario <> $3)
             LIMIT 1`,
            [nombres, apellidos, excluir]
        );
        if (dup.rows.length > 0) {
            advertencia = '⚠️ Ya existe un docente registrado con este nombre. Verifique la identificación y el correo antes de continuar.';
        }
    }

    return {
        errores,
        advertencia,
        datos: { nombres, apellidos, correo, tipoDoc, docNum, rolesList, idsRol, progId, idContrato, programasGestion }
    };
};

/** Responde con la lista completa de errores; 409 si hay algún duplicado. */
const responderErroresValidacion = (res, errores) => {
    const status = errores.some(e => e.status === 409) ? 409 : 400;
    const principal = errores.find(e => e.status === status) || errores[0];
    return res.status(status).json({
        error: principal.mensaje,
        campo: principal.campo,
        errores: errores.map(({ campo, mensaje }) => ({ campo, mensaje }))
    });
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
    let client;
    try {
        const { errores, datos, advertencia } = await validarDatosUsuario(req.body);
        if (errores.length > 0) return responderErroresValidacion(res, errores);

        const { nombres, apellidos, correo, tipoDoc, docNum, rolesList, idsRol, progId, idContrato, programasGestion } = datos;

        // Transacción real: todas las consultas comparten la misma conexión
        client = await pool.connect();
        await client.query('BEGIN');

        const periodRes = await client.query('SELECT id_periodo FROM periodo WHERE activo = TRUE LIMIT 1');
        const idPeriodoActivo = periodRes.rows.length > 0 ? periodRes.rows[0].id_periodo : null;

        const result = await client.query(`
            INSERT INTO usuarios
                (nombres, apellidos, tipo_documento,
                 numero_documento, correo,
                 id_contrato, id_programa, activo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
            RETURNING id_usuario, nombres, apellidos, correo, id_programa
        `, [nombres, apellidos, tipoDoc, docNum, correo, idContrato, progId]);

        const nuevoUsuario = result.rows[0];

        for (const idRol of idsRol) {
            await client.query(
                'INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2) ON CONFLICT (id_usuario, id_rol) DO NOTHING',
                [nuevoUsuario.id_usuario, idRol]
            );
        }

        // Programas que gestiona (solo si es Director)
        const programasDirector = await sincronizarProgramasDirector(
            nuevoUsuario.id_usuario, rolesList, programasGestion, progId, client
        );

        // Asignar al periodo activo si existe y tiene rol docente o director
        const tieneRolAcademico = rolesList.some(r => {
            const low = r.toLowerCase();
            return low.includes('docent') || low.includes('direct');
        });

        if (idPeriodoActivo && tieneRolAcademico) {
            await client.query(`
                INSERT INTO docente_periodo (id_usuario, id_periodo)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            `, [nuevoUsuario.id_usuario, idPeriodoActivo]);

            // Asegurar programa_periodo para el programa seleccionado
            if (progId) {
                const existeProgPer = await client.query(
                    'SELECT id_progperiodo FROM programa_periodo WHERE id_programa = $1 AND id_periodo = $2',
                    [progId, idPeriodoActivo]
                );
                if (existeProgPer.rows.length === 0) {
                    const pensul = await client.query(
                        'SELECT id_pensulaca FROM pensul_academico WHERE activo = TRUE LIMIT 1'
                    );
                    const id_pensulaca = pensul.rows[0]?.id_pensulaca || 1;
                    await client.query(`
                        INSERT INTO programa_periodo (id_periodo, id_programa, id_pensulaca)
                        VALUES ($1, $2, $3)
                    `, [idPeriodoActivo, progId, id_pensulaca]);
                }
            }
        }

        await client.query('COMMIT');

        // Correo de bienvenida con instrucciones de acceso (en segundo plano, tras el COMMIT)
        notificaciones.background.bienvenida({
            idUsuario: nuevoUsuario.id_usuario,
            correo: nuevoUsuario.correo,
            nombre: `${nuevoUsuario.nombres} ${nuevoUsuario.apellidos}`.trim(),
            roles: rolesList,
            idRemitente: req.user?.id
        });

        res.status(201).json({
            ...nuevoUsuario,
            programas_gestion: programasDirector,
            roles: rolesList.join(', '),
            advertencia
        });

    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('Error en create usuario:', error);
        // Dos altas simultáneas pueden pasar la validación y chocar en la restricción UNIQUE
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Ya existe un usuario con esa identificación o ese correo.' });
        }
        res.status(500).json({ error: 'Error al crear el usuario en la base de datos.' });
    } finally {
        if (client) client.release();
    }
};

// ================================================================
// Carga masiva de usuarios (Excel)
// ----------------------------------------------------------------
// Cada fila pasa por validarDatosUsuario — las mismas reglas que el alta
// individual (formato de nombre/correo/documento, roles existentes, programa
// real y activo, exclusividad de directores, duplicados). Lo que no se puede
// importar se informa fila por fila; lo válido se guarda.
//
//  · Transacción real (una sola conexión) con un SAVEPOINT por fila: si una
//    fila falla al guardar, solo esa se descarta.
//  · El programa se resuelve de forma estricta: si no existe o es ambiguo,
//    la fila se rechaza. Antes se asignaba el primer programa de la base.
// ================================================================
const MAX_FILAS_CARGA_MASIVA = 500;

const sinTildes = (valor) =>
    String(valor ?? '')
        .normalize('NFD')
        .split('')
        .filter((c) => c.charCodeAt(0) < 0x300 || c.charCodeAt(0) > 0x36f)
        .join('')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .join(' ');

/** "Pasaporte" -> PA, "cédula de ciudadanía" -> CC, etc. Lo desconocido se devuelve en mayúscula. */
const normalizarTipoDocumento = (valor) => {
    const t = sinTildes(valor);
    if (!t) return 'CC';
    if (t.includes('pasaporte')) return 'PA';
    if (t.includes('extranjer')) return 'CE';
    if (t.includes('tarjeta')) return 'TI';
    if (t.includes('ciudadan')) return 'CC';
    return String(valor).trim().toUpperCase();
};

/**
 * Busca el programa por nombre o id. Devuelve { id } si hay exactamente uno,
 * { error } si no existe o es ambiguo, y { id: null } para "No aplica".
 */
const resolverProgramaEstricto = (entrada, programas) => {
    const t = sinTildes(entrada);
    if (['no aplica', 'ninguno', 'n a', 'na', 'null'].includes(t)) return { id: null };

    const num = Number(String(entrada).trim());
    if (Number.isInteger(num) && num > 0) {
        const p = programas.find((x) => x.id_programa === num);
        return p ? { id: p.id_programa } : { error: `El programa con id ${num} no existe.` };
    }

    const exactos = programas.filter((p) => sinTildes(p.nombre_programa) === t);
    if (exactos.length === 1) return { id: exactos[0].id_programa };

    const parecidos = programas.filter((p) => {
        const n = sinTildes(p.nombre_programa);
        return n.includes(t) || t.includes(n);
    });
    if (parecidos.length === 1) return { id: parecidos[0].id_programa };
    if (parecidos.length > 1) {
        return { error: `El programa "${entrada}" es ambiguo (${parecidos.map((p) => p.nombre_programa).join(', ')}). Escriba el nombre completo.` };
    }
    return { error: `El programa "${entrada}" no existe.` };
};

const createBulk = async (req, res) => {
    const usuarios = req.body;

    if (!Array.isArray(usuarios) || usuarios.length === 0) {
        return res.status(400).json({ error: 'No se enviaron usuarios para importar.' });
    }
    if (usuarios.length > MAX_FILAS_CARGA_MASIVA) {
        return res.status(400).json({
            error: `El archivo tiene ${usuarios.length} filas y el máximo por carga es ${MAX_FILAS_CARGA_MASIVA}. Divídalo en varios archivos.`
        });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        let insertados = 0;
        const errores = [];
        const programasInsertados = new Set();
        const docsEnLote = new Set();
        const correosEnLote = new Set();
        const directorPorPrograma = new Map(); // id_programa -> fila del director de este mismo archivo

        const periodRes = await client.query('SELECT id_periodo FROM periodo WHERE activo = TRUE LIMIT 1');
        const idPeriodoActivo = periodRes.rows.length > 0 ? periodRes.rows[0].id_periodo : null;

        const programas = (await client.query('SELECT id_programa, nombre_programa FROM programa_academico WHERE activo IS NOT FALSE')).rows;

        let posicion = 1;
        for (const u of usuarios) {
            posicion++;
            const fila = Number(u.fila) > 0 ? Number(u.fila) : posicion; // fila del Excel si el cliente la envía

            const nombres = String(u.nombres ?? '').trim();
            const apellidos = String(u.apellidos ?? '').trim();
            const correoStr = String(u.correo ?? u.Correo ?? u['Correo Institucional'] ?? '').trim().toLowerCase();
            const docStr = String(u.numero_documento ?? u.numeroDocumento ?? u['Número Documento'] ?? '').trim();
            const tipoDoc = normalizarTipoDocumento(u.tipo_documento ?? u.tipoDocumento ?? u['Tipo Documento']);
            const etiqueta = `${nombres} ${apellidos}`.trim() || 'Sin nombre';
            const rechazar = (motivo) => errores.push({ fila, usuario: etiqueta, correo: correoStr, motivo });

            // Filas guía de la plantilla (no son usuarios)
            const bajas = [nombres, apellidos, correoStr, docStr].map((v) => v.toLowerCase());
            if (bajas.some((v) => v.startsWith('ej:') || v.startsWith('ej.') || v.includes('ejemplo'))) continue;
            if (!nombres && !apellidos && !correoStr && !docStr) continue; // fila vacía

            // Duplicados dentro del propio archivo (lo guardado en este lote aún no es visible en la base)
            if (docStr && docsEnLote.has(docStr)) { rechazar(`La identificación ${docStr} está repetida dentro del mismo archivo.`); continue; }
            if (correoStr && correosEnLote.has(correoStr)) { rechazar(`El correo ${correoStr} está repetido dentro del mismo archivo.`); continue; }

            // Roles (varios separados por coma) y programa
            const rawRoles = u.roles ?? u.rol ?? u.Rol ?? u.Roles ?? '';
            const rolesPedidos = Array.isArray(rawRoles)
                ? rawRoles
                : String(rawRoles).split(',').map((r) => r.trim()).filter(Boolean);
            const rolesList = rolesPedidos.length > 0 ? rolesPedidos : ['Docente'];

            const soloSinPrograma = isOnlyConsultorOrPlaneacion(rolesList);
            const esDirector = rolesList.some((r) => normalizeRolName(r) === 'director');

            let idPrograma = null;
            if (!soloSinPrograma) {
                const rawProg = String(u.programa ?? u['Programa Académico'] ?? u.programaAcademico ?? '').trim();
                if (!rawProg) { rechazar('Debe indicar el Programa Académico (obligatorio para Docente y Director).'); continue; }
                const r = resolverProgramaEstricto(rawProg, programas);
                if (r.error) { rechazar(r.error); continue; }
                idPrograma = r.id;
                if (!idPrograma) { rechazar('Debe indicar el Programa Académico (obligatorio para Docente y Director).'); continue; }
            }

            // Mismas reglas que el alta individual
            const { errores: erroresValidacion, datos } = await validarDatosUsuario({
                nombres, apellidos, correo: correoStr,
                tipo_documento: tipoDoc, numero_documento: docStr,
                roles: rolesList,
                id_programa: idPrograma,
                programas_gestion: esDirector && idPrograma ? [idPrograma] : undefined,
                tipo_contrato: u.tipo_contrato ?? u.tipoContrato ?? u.vinculacion ?? u['Vinculación'] ?? ''
            });
            if (erroresValidacion.length > 0) {
                rechazar(erroresValidacion.map((e) => e.mensaje).join(' '));
                continue;
            }

            // Un programa solo puede tener un director: también dentro del archivo
            const choque = datos.programasGestion.find((p) => directorPorPrograma.has(p));
            if (esDirector && choque !== undefined) {
                rechazar(`El programa ya está asignado a otro director en este mismo archivo (fila ${directorPorPrograma.get(choque)}).`);
                continue;
            }

            await client.query('SAVEPOINT fila_usuario');
            try {
                const userRes = await client.query(`
                    INSERT INTO usuarios (nombres, apellidos, tipo_documento, numero_documento, correo, id_contrato, id_programa, activo)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
                    RETURNING id_usuario
                `, [datos.nombres, datos.apellidos, datos.tipoDoc, datos.docNum, datos.correo, datos.idContrato, datos.progId]);
                const idUsuario = userRes.rows[0].id_usuario;

                for (const idRol of datos.idsRol) {
                    await client.query(
                        'INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2) ON CONFLICT (id_usuario, id_rol) DO NOTHING',
                        [idUsuario, idRol]
                    );
                }

                const programasDirector = await sincronizarProgramasDirector(
                    idUsuario, datos.rolesList, datos.programasGestion, datos.progId, client
                );

                const tieneRolAcademico = datos.rolesList.some((r) => {
                    const norm = normalizeRolName(r);
                    return norm === 'docente' || norm === 'director';
                });
                if (idPeriodoActivo && tieneRolAcademico) {
                    await client.query(
                        'INSERT INTO docente_periodo (id_usuario, id_periodo) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [idUsuario, idPeriodoActivo]
                    );
                    if (datos.progId) programasInsertados.add(datos.progId);
                }

                await client.query('RELEASE SAVEPOINT fila_usuario');

                docsEnLote.add(datos.docNum);
                correosEnLote.add(datos.correo);
                programasDirector.forEach((p) => directorPorPrograma.set(p, fila));
                insertados++;
            } catch (err) {
                await client.query('ROLLBACK TO SAVEPOINT fila_usuario');
                rechazar(err.code === '23505'
                    ? 'Ya existe un usuario con esa identificación o ese correo.'
                    : `No se pudo guardar la fila: ${err.message}`);
            }
        }

        // Asegurar programa_periodo para cada programa con usuarios nuevos
        if (idPeriodoActivo && programasInsertados.size > 0) {
            const pensul = await client.query('SELECT id_pensulaca FROM pensul_academico WHERE activo = TRUE LIMIT 1');
            const idPensul = pensul.rows[0]?.id_pensulaca || 1;
            for (const pid of programasInsertados) {
                const existe = await client.query(
                    'SELECT 1 FROM programa_periodo WHERE id_programa = $1 AND id_periodo = $2',
                    [pid, idPeriodoActivo]
                );
                if (existe.rows.length === 0) {
                    await client.query(
                        'INSERT INTO programa_periodo (id_periodo, id_programa, id_pensulaca) VALUES ($1, $2, $3)',
                        [idPeriodoActivo, pid, idPensul]
                    );
                }
            }
        }

        await client.query('COMMIT');
        res.status(201).json({
            mensaje: `Proceso completado. Se importaron ${insertados} usuarios y ${errores.length} fila(s) no se pudieron importar.`,
            insertados,
            errores
        });

    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('Error en createBulk:', error);
        res.status(500).json({ error: 'Fallo crítico al realizar la carga masiva. No se guardó ningún usuario.' });
    } finally {
        if (client) client.release();
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
    const idUsuario = Number(req.params.id);
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
        return res.status(400).json({ error: 'El identificador del usuario no es válido.' });
    }

    let client;
    try {
        const { errores, datos, advertencia } = await validarDatosUsuario(req.body, { idExcluir: idUsuario });
        if (errores.length > 0) return responderErroresValidacion(res, errores);

        const { nombres, apellidos, correo, tipoDoc, docNum, rolesList, idsRol, progId, programasGestion } = datos;

        // Transacción real: todas las consultas comparten la misma conexión
        client = await pool.connect();
        await client.query('BEGIN');

        const periodRes = await client.query('SELECT id_periodo FROM periodo WHERE activo = TRUE LIMIT 1');
        const idPeriodoActivo = periodRes.rows.length > 0 ? periodRes.rows[0].id_periodo : null;

        const result = await client.query(`
            UPDATE usuarios
            SET nombres = $1,
                apellidos = $2,
                tipo_documento = $3,
                numero_documento = $4,
                correo = $5,
                id_programa = $6
            WHERE id_usuario = $7
            RETURNING id_usuario, nombres, apellidos, correo, id_programa
        `, [nombres, apellidos, tipoDoc, docNum, correo, progId, idUsuario]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const usuarioActualizado = result.rows[0];

        // Sincronizar Roles (Eliminar antiguos e insertar nuevos)
        await client.query('DELETE FROM usuario_rol WHERE id_usuario = $1', [idUsuario]);
        for (const idRol of idsRol) {
            await client.query(
                'INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2) ON CONFLICT (id_usuario, id_rol) DO NOTHING',
                [idUsuario, idRol]
            );
        }

        // Programas que gestiona (si deja de ser Director se limpian)
        const programasDirector = await sincronizarProgramasDirector(
            idUsuario, rolesList, programasGestion, progId, client
        );

        // Si hay periodo activo y rol académico (Docente/Director), asegurar docente_periodo y programa_periodo
        const tieneRolAcademico = rolesList.some(r => {
            const low = r.toLowerCase();
            return low.includes('docent') || low.includes('direct');
        });

        if (idPeriodoActivo && tieneRolAcademico) {
            await client.query(`
                INSERT INTO docente_periodo (id_usuario, id_periodo)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            `, [idUsuario, idPeriodoActivo]);

            if (progId) {
                const existeProgPer = await client.query(
                    'SELECT id_progperiodo FROM programa_periodo WHERE id_programa = $1 AND id_periodo = $2',
                    [progId, idPeriodoActivo]
                );
                if (existeProgPer.rows.length === 0) {
                    const pensul = await client.query(
                        'SELECT id_pensulaca FROM pensul_academico WHERE activo = TRUE LIMIT 1'
                    );
                    const id_pensulaca = pensul.rows[0]?.id_pensulaca || 1;
                    await client.query(`
                        INSERT INTO programa_periodo (id_periodo, id_programa, id_pensulaca)
                        VALUES ($1, $2, $3)
                    `, [idPeriodoActivo, progId, id_pensulaca]);
                }
            }
        }

        await client.query('COMMIT');
        res.json({
            ...usuarioActualizado,
            programas_gestion: programasDirector,
            roles: rolesList.join(', '),
            advertencia
        });

    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('Error en update usuario:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Ya existe un usuario con esa identificación o ese correo.' });
        }
        res.status(500).json({ error: 'Error al actualizar el usuario en la base de datos.' });
    } finally {
        if (client) client.release();
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
    normalizarTipoDocumento,
    resolverProgramaEstricto,
    toggleActivo,
    update,
    deleteUsuario,
    getPerfilCompleto,
    updatePerfil,
    getRolesAsignables
};