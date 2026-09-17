const express = require('express');
const router = express.Router();
const multer = require('multer');
const { importarAsignaciones, actualizarImportacion, getDashboardDirector, getDistribucionDocente, eliminarAgendas, eliminarAgendasDocentes } = require('../controllers/directorController');
const { getAgendas, getAgendaDetalle, aprobarAgenda, devolverAgenda, getReportesResumen } = require('../controllers/directorRevisionController');
const { getAsignaciones, corregirAsignaciones } = require('../controllers/asignacionesController');
const verifyToken = require('../middleware/verifyToken');
const verifyRole = require('../middleware/verifyRole');

// Configuración de multer en memoria
const upload = multer({ storage: multer.memoryStorage() });

// Consulta del panel de agendas — disponible para todos los roles de supervisión
router.get('/dashboard', verifyToken, verifyRole('Director', 'Planeacion', 'Admin', 'Consultor'), getDashboardDirector);
router.get('/docente/:id/distribucion', verifyToken, verifyRole('Director', 'Planeacion', 'Admin', 'Consultor'), getDistribucionDocente);

// Gestión de la carga académica (importar / actualizar / eliminar agendas).
// Exclusivo de Planeación: el Director únicamente consulta y revisa.
router.post('/importar', verifyToken, verifyRole('Planeacion', 'Admin'), upload.single('archivo'), importarAsignaciones);
router.post('/actualizar', verifyToken, verifyRole('Planeacion', 'Admin'), upload.single('archivo'), actualizarImportacion);
router.delete('/eliminar-agendas', verifyToken, verifyRole('Planeacion', 'Admin'), eliminarAgendas);
router.delete('/eliminar-agendas-docentes', verifyToken, verifyRole('Planeacion', 'Admin'), eliminarAgendasDocentes);

// Corrección de asignaciones — el Director ajusta lo que Planeación cargó mal
router.get('/asignaciones', verifyToken, verifyRole('Director', 'Consultor', 'Planeacion', 'Admin'), getAsignaciones);
router.put('/asignaciones/:id_usuario', verifyToken, verifyRole('Director'), corregirAsignaciones);

// Rutas de revisión de agendas — módulo Director
router.get('/agendas', verifyToken, verifyRole('Director', 'Consultor'), getAgendas);
router.get('/agendas/:id', verifyToken, verifyRole('Director', 'Consultor'), getAgendaDetalle);
router.put('/agendas/:id/aprobar', verifyToken, verifyRole('Director'), aprobarAgenda);
router.put('/agendas/:id/devolver', verifyToken, verifyRole('Director'), devolverAgenda);

// Reportes
router.get('/reportes/resumen', verifyToken, verifyRole('Director', 'Planeacion', 'Admin', 'Consultor'), getReportesResumen);

module.exports = router;
