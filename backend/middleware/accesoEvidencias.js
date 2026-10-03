/**
 * Control de acceso a las evidencias.
 *
 * Reglas:
 *   · Docente: solo sus propias evidencias.
 *   · Cualquier otro rol (Director, Investigación, Planeación, Consultor…):
 *     las de los docentes que su alcance le permite ver (docenteEnAlcance).
 *   · Subir y borrar: solo el dueño; Planeación/Admin pueden borrar.
 *
 * Los archivos NO se sirven como carpeta estática: pasan por servirArchivo,
 * que exige token y comprueba el permiso contra la base. Como un <iframe> o un
 * <a href> no pueden mandar cabeceras, el token también se acepta en ?token=.
 */
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');
const path = require('path');
const fs = require('fs');
const pool = require('../db/connection');
const { rolesEfectivos, docenteEnAlcance } = require('../utils/rolActivo');

const UPLOADS_EVIDENCIAS = path.join(__dirname, '..', 'uploads', 'evidencias');

// Extensiones permitidas (coinciden con el selector del frontend)
const EXTENSIONES_PERMITIDAS = new Set([
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.rar', '.txt', '.csv', '.jpg', '.jpeg', '.png', '.gif', '.webp',
]);

const idUsuarioDe = (req) => Number(req.user?.id ?? req.user?.id_usuario);

/** Como verifyToken, pero acepta también ?token= (para ver/descargar archivos). */
const verifyTokenFlexible = (req, res, next) => {
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader) token = authHeader.split(' ')[1];
    if (!token && req.query.token) token = String(req.query.token);

    if (!token) return res.status(403).json({ error: 'No se proporcionó un token' });

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
};

/** ¿El usuario autenticado puede ver las evidencias de este docente? */
const puedeVerDocente = async (req, idDocente) => {
    if (idUsuarioDe(req) === Number(idDocente)) return true;

    const otrosRoles = rolesEfectivos(req).filter(r => r !== 'docente');
    if (otrosRoles.length === 0) return false;

    return docenteEnAlcance(req, idDocente);
};

/** Docente dueño de un indicador (null si no existe). */
const duenoDeIndicador = async (idIndicador) => {
    const r = await pool.query(`
        SELECT ua.id_usuario
        FROM indicadores i
        JOIN descripcion d ON d.id_descripcion = i.id_descripcion
        JOIN asignacion_actividades aa ON aa.id_asignacionact = d.id_asignacionact
        JOIN usuario_asignacion ua ON ua.id_funciones = aa.id_funciones
        WHERE i.id_indicadores = $1
        LIMIT 1
    `, [idIndicador]);
    return r.rows[0]?.id_usuario ?? null;
};

/** Docente dueño de una evidencia (null si no existe). */
const duenoDeEvidencia = async (idEvidencia) => {
    const r = await pool.query(`
        SELECT ua.id_usuario
        FROM evidencias e
        JOIN indicadores i ON i.id_indicadores = e.id_indicadores
        JOIN descripcion d ON d.id_descripcion = i.id_descripcion
        JOIN asignacion_actividades aa ON aa.id_asignacionact = d.id_asignacionact
        JOIN usuario_asignacion ua ON ua.id_funciones = aa.id_funciones
        WHERE e.id_evidencias = $1
        LIMIT 1
    `, [idEvidencia]);
    return r.rows[0]?.id_usuario ?? null;
};

/** GET /uploads/evidencias/:archivo — valida token y permiso antes de enviar. */
const servirArchivo = async (req, res) => {
    try {
        // basename evita ../ para salirse de la carpeta
        const nombre = path.basename(req.params.archivo);
        const ruta = `/uploads/evidencias/${nombre}`;

        const ev = await pool.query(
            'SELECT id_evidencias, nombre_archivo FROM evidencias WHERE ruta_archivo = $1 LIMIT 1',
            [ruta]
        );
        if (ev.rows.length === 0) return res.status(404).json({ error: 'Archivo no encontrado.' });

        const dueno = await duenoDeEvidencia(ev.rows[0].id_evidencias);
        if (!dueno || !(await puedeVerDocente(req, dueno))) {
            return res.status(403).json({ error: 'No tienes permiso para ver esta evidencia.' });
        }

        const archivo = path.join(UPLOADS_EVIDENCIAS, nombre);
        if (!fs.existsSync(archivo)) {
            return res.status(404).json({ error: 'El archivo ya no está en el servidor.' });
        }

        // nosniff: el navegador no debe "adivinar" un tipo ejecutable.
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition',
            `inline; filename*=UTF-8''${encodeURIComponent(ev.rows[0].nombre_archivo || nombre)}`);
        res.sendFile(archivo);
    } catch (error) {
        console.error('Error sirviendo evidencia:', error);
        res.status(500).json({ error: 'No se pudo abrir el archivo.' });
    }
};

module.exports = {
    UPLOADS_EVIDENCIAS,
    EXTENSIONES_PERMITIDAS,
    idUsuarioDe,
    verifyTokenFlexible,
    puedeVerDocente,
    duenoDeIndicador,
    duenoDeEvidencia,
    servirArchivo,
};
