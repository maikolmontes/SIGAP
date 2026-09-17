const express = require('express');
const router = express.Router();

const controller = require('../controllers/notificacionesController');
const verifyToken = require('../middleware/verifyToken');
const verifyRole = require('../middleware/verifyRole');

// Diagnóstico y envío de prueba — solo administración
router.get('/estado', verifyToken, verifyRole('Planeacion', 'Admin'), controller.getEstado);
router.post('/prueba', verifyToken, verifyRole('Planeacion', 'Admin'), controller.enviarPrueba);

// Recordatorios de radicación — Planeación y Director de programa
router.post('/recordatorios', verifyToken, verifyRole('Planeacion', 'Admin', 'Director'), controller.enviarRecordatorios);

// Reenvío del aviso de apertura de período
router.post('/periodo/:id', verifyToken, verifyRole('Planeacion', 'Admin'), controller.enviarAvisoPeriodo);

module.exports = router;
