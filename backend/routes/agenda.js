const express = require('express');
const router = express.Router();
const controller = require('../controllers/agendaController');
const verifyToken = require('../middleware/verifyToken');

// Todas estas rutas exigen iniciar sesión
router.use(verifyToken);

router.get('/base/:id_usuario', controller.getAgendaBase);
router.post('/guardar-funcion', controller.guardarFuncionDocente);
router.post('/guardar-avance', controller.guardarAvanceDocente);
router.get('/:id_usuario', controller.getAgenda);

module.exports = router;