const express = require('express');
const router = express.Router();
const { guardarObservacion, getObservacion, getTodasObservaciones } = require('../controllers/directorRevisionController');
const verifyToken = require('../middleware/verifyToken');
const verifyRole = require('../middleware/verifyRole');

// GET /api/observaciones/todas — Obtener todas las observaciones del director y decano
router.get('/todas', verifyToken, verifyRole('Director', 'Consultor', 'Decano'), getTodasObservaciones);

// PUT /api/observaciones/:actividad_id — Guardar observación (Director y Decano pueden agregar observaciones)
router.put('/:actividad_id', verifyToken, verifyRole('Director', 'Decano'), guardarObservacion);

// GET /api/observaciones/:actividad_id/:semana — Obtener observaciones
router.get('/:actividad_id/:semana', verifyToken, getObservacion);

module.exports = router;
