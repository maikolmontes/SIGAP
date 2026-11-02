/**
 * Guardias de LECTURA que dependen de a quién pertenece el dato (propiedad y alcance).
 * Las de ESCRITURA exclusiva de Planeación usan middleware/soloPlaneacion.js.
 *
 * Todas van DESPUÉS de verifyToken. Si algo falla al consultar la base, deniegan (nunca dejan pasar).
 */
const pool = require('../db/connection');
const { rolesEfectivos, docenteEnAlcance } = require('../utils/rolActivo');
const { puedeVerRevision } = require('./verifyRevisor');

const SUPERVISORES = ['planeacion', 'admin', 'consultor'];
const normalizar = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const denegar = (res, mensaje) => res.status(403).json({ error: mensaje });
const falloInterno = (res, etiqueta, error) => {
    console.error(`Error en ${etiqueta}:`, error);
    return res.status(500).json({ error: 'No se pudo verificar el acceso.' });
};

/**
 * Datos de un usuario (`req.params[nombreParametro]`): el propio usuario, Planeación/Admin/Consultor,
 * o un Director cuando el docente es de alguno de sus programas.
 */
const propioOSupervisor = (nombreParametro = 'id_usuario') => async (req, res, next) => {
    try {
        const idObjetivo = Number(req.params[nombreParametro]);
        if (!Number.isInteger(idObjetivo)) return denegar(res, 'Usuario no válido.');
        if (idObjetivo === Number(req.user?.id)) return next();

        const roles = rolesEfectivos(req);
        if (roles.some((r) => SUPERVISORES.includes(r))) return next();
        if (roles.includes('director') && await docenteEnAlcance(req, idObjetivo)) return next();

        return denegar(res, 'No puedes consultar los datos de otro usuario.');
    } catch (error) {
        return falloInterno(res, 'propioOSupervisor', error);
    }
};

/**
 * Observaciones de una actividad (`:actividad_id`): su dueño (el docente), Planeación/Admin/Consultor, y los
 * revisores (Director dentro de sus programas; Investigación y similares según rol_funcion).
 */
const lecturaObservacion = async (req, res, next) => {
    try {
        const idActividad = Number(req.params.actividad_id);
        if (!Number.isInteger(idActividad)) return denegar(res, 'Actividad no válida.');

        const roles = rolesEfectivos(req);
        if (roles.some((r) => SUPERVISORES.includes(r))) return next();

        const duenos = await pool.query(`
            SELECT DISTINCT ua.id_usuario
            FROM asignacion_actividades aa
            JOIN usuario_asignacion ua ON ua.id_funciones = aa.id_funciones
            WHERE aa.id_asignacionact = $1
        `, [idActividad]);
        const ids = duenos.rows.map((f) => Number(f.id_usuario));

        if (ids.includes(Number(req.user?.id))) return next();

        if (roles.includes('director')) {
            for (const id of ids) if (await docenteEnAlcance(req, id)) return next();
            return denegar(res, 'Esa actividad no pertenece a tus programas.');
        }

        // Otros revisores de función (p. ej. Investigación): la regla de rol_funcion decide.
        return puedeVerRevision(req, res, next);
    } catch (error) {
        return falloInterno(res, 'lecturaObservacion', error);
    }
};

/**
 * Permisos de un rol (`:id_rol`): Planeación/Admin ven cualquiera; el resto solo los de sus propios roles
 * (las pantallas los leen al entrar con el rol con el que iniciaron sesión).
 */
const permisosDeSuRol = async (req, res, next) => {
    try {
        const roles = rolesEfectivos(req);
        if (roles.some((r) => r === 'planeacion' || r === 'admin')) return next();

        const idRol = Number(req.params.id_rol);
        if (!Number.isInteger(idRol)) return denegar(res, 'Rol no válido.');

        const propios = String(req.user?.roles || '').split(',').map(normalizar).filter(Boolean);
        const r = await pool.query('SELECT id_rol, nombre_rol FROM roles');
        const permitidos = r.rows.filter((f) => propios.includes(normalizar(f.nombre_rol))).map((f) => Number(f.id_rol));

        if (permitidos.includes(idRol)) return next();
        return denegar(res, 'Solo puedes consultar los permisos de tus propios roles.');
    } catch (error) {
        return falloInterno(res, 'permisosDeSuRol', error);
    }
};

module.exports = { propioOSupervisor, lecturaObservacion, permisosDeSuRol };
