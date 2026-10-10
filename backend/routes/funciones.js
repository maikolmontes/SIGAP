const express = require('express');
const router = express.Router();
const controller = require('../controllers/funcionesController');
const verifyToken = require('../middleware/verifyToken');

// Todas estas rutas exigen iniciar sesión
router.use(verifyToken);

router.get('/', controller.getFunciones);
router.get('/usuario/:id_usuario', controller.getFuncionesByUsuario);
router.post('/asignar', controller.asignarFuncion);
router.get('/catalogo', controller.getCatalogoJerarquico);

module.exports = router;