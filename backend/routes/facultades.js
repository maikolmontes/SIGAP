const express = require('express');
const router = express.Router();
const controller = require('../controllers/facultadesController');
const verifyToken = require('../middleware/verifyToken');
const soloPlaneacion = require('../middleware/soloPlaneacion');

// Consultar: cualquier usuario con sesión. Crear, editar, activar y eliminar: solo Planeación.
router.use(verifyToken);

router.get('/', controller.getAll);
router.post('/', soloPlaneacion, controller.create);
router.put('/:id', soloPlaneacion, controller.update);
router.patch('/:id/activa', soloPlaneacion, controller.toggleActiva);
router.delete('/:id', soloPlaneacion, controller.deleteFacultad);

module.exports = router;
