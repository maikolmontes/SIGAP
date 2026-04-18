const express = require('express');
const router = express.Router();
const controller = require('../controllers/funcionesController');

router.get('/', controller.getFunciones);
router.get('/usuario/:id_usuario', controller.getFuncionesByUsuario);
router.post('/asignar', controller.asignarFuncion);

module.exports = router;