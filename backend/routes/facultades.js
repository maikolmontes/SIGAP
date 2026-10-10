const express = require('express');
const router = express.Router();
const controller = require('../controllers/facultadesController');
const verifyToken = require('../middleware/verifyToken');

// Todas estas rutas exigen iniciar sesión
router.use(verifyToken);

router.get('/', controller.getAll);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id/activa', controller.toggleActiva);
router.delete('/:id', controller.deleteFacultad);

module.exports = router;
