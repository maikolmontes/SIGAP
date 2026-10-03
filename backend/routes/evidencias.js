const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const evidenciasController = require('../controllers/evidenciasController');
const verifyToken = require('../middleware/verifyToken');
const { UPLOADS_EVIDENCIAS, EXTENSIONES_PERMITIDAS } = require('../middleware/accesoEvidencias');

// Asegurarnos de que exista la carpeta de uploads/evidencias
if (!fs.existsSync(UPLOADS_EVIDENCIAS)) {
    fs.mkdirSync(UPLOADS_EVIDENCIAS, { recursive: true });
}

// Configuración de Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_EVIDENCIAS);
    },
    filename: function (req, file, cb) {
        // Generar un nombre único para evitar colisiones
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'evidencia-' + uniqueSuffix + ext);
    }
});

// Límite de 10MB y lista blanca de extensiones
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!EXTENSIONES_PERMITIDAS.has(ext)) {
            return cb(new Error(
                `Tipo de archivo no permitido (${ext || 'sin extensión'}). ` +
                'Usa PDF, Word, Excel, PowerPoint, ZIP/RAR o imágenes.'
            ));
        }
        cb(null, true);
    }
});

// Todas las rutas exigen sesión; el permiso por docente se valida en el controlador.
router.use(verifyToken);

router.get('/:id_usuario', evidenciasController.obtenerEvidenciasDocente);
// El campo se llamará 'archivo' en el FormData
router.post('/subir', (req, res, next) => {
    upload.single('archivo')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'El archivo supera el límite de 10MB permitidos.' });
            }
            return res.status(400).json({ error: err.message.startsWith('Tipo de archivo')
                ? err.message
                : 'Error al procesar el archivo: ' + err.message });
        }
        next();
    });
}, evidenciasController.subirEvidencia);
router.delete('/:id_evidencia', evidenciasController.eliminarEvidencia);

module.exports = router;
