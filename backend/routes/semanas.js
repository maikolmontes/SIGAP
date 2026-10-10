const express = require('express');
const router = express.Router();
const semanasController = require('../controllers/semanasController');
const verifyToken = require('../middleware/verifyToken');
const soloPlaneacion = require('../middleware/soloPlaneacion');

// Ver las semanas: cualquier usuario con sesión. Habilitarlas o cambiar sus fechas: solo Planeación.
router.use(verifyToken);

router.get('/', semanasController.getAll);
router.put('/', soloPlaneacion, semanasController.updateSemanas);

module.exports = router;
