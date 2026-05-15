const express = require('express');
const router = express.Router();
const multer = require('multer');
const { importarAsignaciones, actualizarImportacion, getDashboardDirector } = require('../controllers/directorController');
const { getAgendas, getAgendaDetalle, aprobarAgenda, devolverAgenda, getReportesResumen } = require('../controllers/directorRevisionController');
const verifyToken = require('../middleware/verifyToken');
const verifyRole = require('../middleware/verifyRole');

// Configuración de multer en memoria
const upload = multer({ storage: multer.memoryStorage() });

// Rutas existentes — ahora protegidas con auth
router.get('/dashboard', verifyToken, verifyRole('Director'), getDashboardDirector);
router.post('/importar', verifyToken, verifyRole('Director'), upload.single('archivo'), importarAsignaciones);
router.post('/actualizar', verifyToken, verifyRole('Director'), upload.single('archivo'), actualizarImportacion);

// Rutas de revisión de agendas — módulo Director
router.get('/agendas', verifyToken, verifyRole('Director'), getAgendas);
router.get('/agendas/:id', verifyToken, verifyRole('Director'), getAgendaDetalle);
router.put('/agendas/:id/aprobar', verifyToken, verifyRole('Director'), aprobarAgenda);
router.put('/agendas/:id/devolver', verifyToken, verifyRole('Director'), devolverAgenda);

// Reportes
router.get('/reportes/resumen', verifyToken, verifyRole('Director'), getReportesResumen);

module.exports = router;
