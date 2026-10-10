/**
 * Deja pasar solo a Planeación o Admin (con el rol con el que se trabaja en ese momento).
 * Debe usarse DESPUÉS de verifyToken.
 */
const { rolesEfectivos } = require('../utils/rolActivo');

const soloPlaneacion = (req, res, next) => {
    if (rolesEfectivos(req).some((r) => r === 'planeacion' || r === 'admin')) return next();
    return res.status(403).json({ error: 'Esta acción es solo para Planeación.' });
};

module.exports = soloPlaneacion;
