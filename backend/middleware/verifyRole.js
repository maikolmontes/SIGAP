/**
 * Middleware para verificar que el usuario tenga un rol específico.
 * Debe usarse DESPUÉS de verifyToken.
 * Uso: verifyRole('Director')
 */
const verifyRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.roles) {
            return res.status(403).json({ error: 'No se pudo determinar el rol del usuario.' });
        }

        // req.user.roles es un string como "Director, Docente"
        const userRoles = req.user.roles.split(',').map(r => r.trim());
        const hasRole = allowedRoles.some(role => userRoles.includes(role));

        if (!hasRole) {
            return res.status(403).json({ error: `Acceso denegado. Se requiere rol: ${allowedRoles.join(' o ')}.` });
        }

        next();
    };
};

module.exports = verifyRole;
