const express = require('express');
const router = express.Router();
const multer = require('multer');
const controller = require('../controllers/directorController');

// Configuración de multer en memoria
const upload = multer({ storage: multer.memoryStorage() });

router.post('/importar', upload.single('archivo'), controller.importarAsignaciones);
router.post('/actualizar', upload.single('archivo'), controller.actualizarImportacion);

module.exports = router;
