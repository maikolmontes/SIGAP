const express = require('express');
const router = express.Router();

const controller = require('../controllers/usuariosController');

// Rutas específicas PRIMERO (antes que los manejadores genéricos /:id)
router.get('/', controller.getAll);
router.post('/validar', controller.validar);
router.post('/bulk', controller.createBulk);
router.post('/', controller.create);

// Rutas con sub-paths específicos (deben ir antes de /:id genérico)
router.get('/:id/perfil-completo', controller.getPerfilCompleto);
router.put('/:id/perfil', controller.updatePerfil);
router.patch('/:id/activo', controller.toggleActivo);

// Manejadores genéricos (al final para no capturar las rutas anteriores)
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.deleteUsuario);

module.exports = router;