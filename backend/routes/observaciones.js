const express = require('express');
const router = express.Router();
const {
    guardarObservacion, getObservacion, getTodasObservaciones,
    agregarObservacion, eliminarObservacion
} = require('../controllers/directorRevisionController');
const verifyToken = require('../middleware/verifyToken');
const { puedeVerRevision, puedeRevisar } = require('../middleware/verifyRevisor');

// GET /api/observaciones/todas — Todas las observaciones del alcance
router.get('/todas', verifyToken, puedeVerRevision, getTodasObservaciones);

// DELETE /api/observaciones/item/:id — Retirar una observación propia
// (va antes de las rutas con :actividad_id para que no la capturen)
router.delete('/item/:id', verifyToken, puedeRevisar, eliminarObservacion);

// POST /api/observaciones/:actividad_id — Agregar una observación más
router.post('/:actividad_id', verifyToken, puedeRevisar, agregarObservacion);

// PUT /api/observaciones/:actividad_id — Reemplaza la del director en esa semana
router.put('/:actividad_id', verifyToken, puedeRevisar, guardarObservacion);

// GET /api/observaciones/:actividad_id/:semana — Consultar observaciones
router.get('/:actividad_id/:semana', verifyToken, getObservacion);

module.exports = router;
