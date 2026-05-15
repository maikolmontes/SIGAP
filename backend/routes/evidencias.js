const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const evidenciasController = require('../controllers/evidenciasController');

// Asegurarnos de que exista la carpeta de uploads/evidencias
const uploadsDir = path.join(__dirname, '..', 'uploads', 'evidencias');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuración de Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        // Generar un nombre único para evitar colisiones
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'evidencia-' + uniqueSuffix + ext);
    }
});

// Límite de 10MB
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } 
});

router.get('/:id_usuario', evidenciasController.obtenerEvidenciasDocente);
// El campo se llamará 'archivo' en el FormData
router.post('/subir', (req, res, next) => {
    upload.single('archivo')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'El archivo supera el límite de 10MB permitidos.' });
            }
            return res.status(400).json({ error: 'Error al procesar el archivo: ' + err.message });
        }
        next();
    });
}, evidenciasController.subirEvidencia);
router.delete('/:id_evidencia', evidenciasController.eliminarEvidencia);

module.exports = router;
