const express = require('express');
const router = express.Router();

const controller = require('../controllers/usuariosController');
const verifyToken = require('../middleware/verifyToken');
const verifyRole = require('../middleware/verifyRole');

// Todas las rutas exigen sesión. Antes estaban abiertas: cualquiera podía crear
// usuarios (incluso con rol Planeación) sin autenticarse.
router.use(verifyToken);

// Administración de usuarios: exclusivo de Planeación/Admin.
// Rutas específicas PRIMERO (antes que los manejadores genéricos /:id)
const soloAdmin = verifyRole('Planeacion', 'Admin');

// Perfil: cada usuario solo accede al suyo; Planeación/Admin a cualquiera.
const propioOAdmin = (req, res, next) => {
    const roles = String(req.user?.roles || '').split(',').map(r => r.trim());
    const esAdmin = roles.includes('Planeacion') || roles.includes('Admin');
    if (esAdmin || Number(req.params.id) === Number(req.user?.id)) return next();
    return res.status(403).json({ error: 'No puedes acceder a los datos de otro usuario.' });
};

router.get('/', soloAdmin, controller.getAll);
router.post('/validar', soloAdmin, controller.validar);
router.post('/bulk', soloAdmin, controller.createBulk);
router.post('/', soloAdmin, controller.create);

// Rutas con sub-paths específicos (deben ir antes de /:id genérico)
router.get('/:id/perfil-completo', propioOAdmin, controller.getPerfilCompleto);
router.put('/:id/perfil', propioOAdmin, controller.updatePerfil);
router.patch('/:id/activo', soloAdmin, controller.toggleActivo);

// Manejadores genéricos (al final para no capturar las rutas anteriores)
router.get('/:id', propioOAdmin, controller.getById);
router.put('/:id', soloAdmin, controller.update);
router.delete('/:id', soloAdmin, controller.deleteUsuario);

module.exports = router;
