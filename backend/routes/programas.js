const express = require('express');
const router = express.Router();
const controller = require('../controllers/programasController');
const verifyToken = require('../middleware/verifyToken');
const soloPlaneacion = require('../middleware/soloPlaneacion');

// Consultar: cualquier usuario con sesión. Crear, editar, activar y eliminar: solo Planeación.
router.use(verifyToken);

router.get('/', controller.getAll);
router.post('/', soloPlaneacion, controller.create);
router.put('/:id', soloPlaneacion, controller.update);
router.patch('/:id/activo', soloPlaneacion, controller.toggleActivo);
router.delete('/:id', soloPlaneacion, controller.deletePrograma);

module.exports = router;
