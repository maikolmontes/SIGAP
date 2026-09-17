const express = require('express');
const router = express.Router();
const multer = require('multer');
const { importarAsignaciones, actualizarImportacion, getDashboardDirector, getDistribucionDocente, eliminarAgendas, eliminarAgendasDocentes } = require('../controllers/directorController');
const { getAgendas, getAgendaDetalle, aprobarAgenda, devolverAgenda, getReportesResumen } = require('../controllers/directorRevisionController');
const verifyToken = require('../middleware/verifyToken');
const verifyRole = require('../middleware/verifyRole');

// Configuración de multer en memoria
const upload = multer({ storage: multer.memoryStorage() });

// Rutas existentes — ahora protegidas con auth
router.get('/dashboard', verifyToken, verifyRole('Director', 'Planeacion', 'Consultor'), getDashboardDirector);
router.post('/importar', verifyToken, verifyRole('Director'), upload.single('archivo'), importarAsignaciones);
router.post('/actualizar', verifyToken, verifyRole('Director'), upload.single('archivo'), actualizarImportacion);
router.delete('/eliminar-agendas', verifyToken, verifyRole('Director'), eliminarAgendas);
router.delete('/eliminar-agendas-docentes', verifyToken, verifyRole('Director'), eliminarAgendasDocentes);
router.get('/docente/:id/distribucion', verifyToken, verifyRole('Director', 'Planeacion', 'Consultor'), getDistribucionDocente);

// Rutas de revisión de agendas — módulo Director
router.get('/agendas', verifyToken, verifyRole('Director', 'Consultor'), getAgendas);
router.get('/agendas/:id', verifyToken, verifyRole('Director', 'Consultor'), getAgendaDetalle);
router.put('/agendas/:id/aprobar', verifyToken, verifyRole('Director'), aprobarAgenda);
router.put('/agendas/:id/devolver', verifyToken, verifyRole('Director'), devolverAgenda);

// Reportes
router.get('/reportes/resumen', verifyToken, verifyRole('Director', 'Planeacion', 'Consultor'), getReportesResumen);

module.exports = router;
