const express = require('express');
const router = express.Router();
const multer = require('multer');
const { importarAsignaciones, actualizarImportacion, getDashboardDirector } = require('../controllers/directorController');

// Configuración de multer en memoria
const upload = multer({ storage: multer.memoryStorage() });

router.get('/dashboard', getDashboardDirector);
router.post('/importar', upload.single('archivo'), importarAsignaciones);
router.post('/actualizar', upload.single('archivo'), actualizarImportacion);

module.exports = router;
