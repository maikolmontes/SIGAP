/**
 * Middlewares del módulo de revisión de agendas.
 *
 * A diferencia de verifyRole, que compara contra una lista de nombres escrita
 * en el código, estos se apoyan en rol_funcion: crear un revisor nuevo
 * (p. ej. "Aseguramiento de Calidad") es insertar filas en la base, sin tocar
 * ninguna ruta.
 *
 * Deben usarse DESPUÉS de verifyToken.
 */
const { alcanceFunciones, rolesEfectivos } = require('../utils/rolActivo');

// Roles que supervisan sin revisar: ven el módulo pero no aprueban ni devuelven.
const ROLES_SUPERVISION = ['planeacion', 'admin', 'consultor'];

/**
 * Lectura del módulo de revisión: revisores de función (Director,
 * Investigación, …) más los roles de supervisión.
 */
const puedeVerRevision = async (req, res, next) => {
    try {
        const roles = rolesEfectivos(req);
        if (roles.some(r => ROLES_SUPERVISION.includes(r))) return next();

        const alcance = await alcanceFunciones(req);
        if (alcance.restringido && alcance.funciones.length > 0) return next();

        return res.status(403).json({
            error: 'Tu rol activo no tiene acceso al módulo de revisión de agendas.'
        });
    } catch (error) {
        console.error('Error en puedeVerRevision:', error);
        return res.status(500).json({ error: 'No se pudo verificar el acceso.' });
    }
};

/**
 * Acción sobre una agenda (aprobar / devolver / corregir): solo quien revisa
 * al menos una función sustantiva. Planeación y Consultor quedan fuera a
 * propósito: supervisan, no aprueban.
 *
 * Qué función concreta puede tocar se decide en el controlador con
 * alcanceFunciones(req); este middleware solo cierra la puerta de entrada.
 */
const puedeRevisar = async (req, res, next) => {
    try {
        const alcance = await alcanceFunciones(req);
        if (alcance.restringido && alcance.funciones.length > 0) return next();

        return res.status(403).json({
            error: 'Tu rol activo no revisa ninguna función sustantiva.'
        });
    } catch (error) {
        console.error('Error en puedeRevisar:', error);
        return res.status(500).json({ error: 'No se pudo verificar el permiso de revisión.' });
    }
};

module.exports = { puedeVerRevision, puedeRevisar, ROLES_SUPERVISION };
