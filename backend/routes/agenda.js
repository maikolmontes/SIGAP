const express = require('express');
const router = express.Router();
const controller = require('../controllers/agendaController');

router.get('/:id_usuario', controller.getAgenda);

module.exports = router;