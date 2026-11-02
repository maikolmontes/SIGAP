const express = require('express');
const router = express.Router();
const controller = require('../controllers/funcionesController');
const verifyToken = require('../middleware/verifyToken');
const soloPlaneacion = require('../middleware/soloPlaneacion');
const { propioOSupervisor } = require('../middleware/accesoDatos');

// Catálogo: cualquier usuario con sesión. Las funciones de un usuario: él mismo, Planeación/Consultor o su Director.
// Asignar funciones: solo Planeación (el docente elige las suyas por /api/agenda).
router.use(verifyToken);

router.get('/', controller.getFunciones);
router.get('/usuario/:id_usuario', propioOSupervisor('id_usuario'), controller.getFuncionesByUsuario);
router.post('/asignar', soloPlaneacion, controller.asignarFuncion);
router.get('/catalogo', controller.getCatalogoJerarquico);

module.exports = router;