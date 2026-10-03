const express = require('express');
const router = express.Router();
const multer = require('multer');
const { importarAsignaciones, actualizarImportacion, getDashboardDirector, getDistribucionDocente, eliminarAgendas, eliminarAgendasDocentes } = require('../controllers/directorController');
const { getAgendas, getAgendaDetalle, aprobarAgenda, devolverAgenda, getReportesResumen, getMisProgramas } = require('../controllers/directorRevisionController');
const { getAsignaciones, corregirAsignaciones, aprobarAsignaciones, marcarVistoBueno } = require('../controllers/asignacionesController');
const { darVistoBueno, aprobarCorte, devolverCorte } = require('../controllers/cortesController');
const verifyToken = require('../middleware/verifyToken');
const verifyRole = require('../middleware/verifyRole');
const { puedeVerRevision, puedeRevisar } = require('../middleware/verifyRevisor');

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
router.get('/asignaciones', verifyToken, puedeVerRevision, getAsignaciones);
router.put('/asignaciones/:id_usuario', verifyToken, puedeRevisar, corregirAsignaciones);
router.put('/asignaciones/:id_usuario/aprobar', verifyToken, puedeRevisar, aprobarAsignaciones);
router.put('/asignaciones/:id_usuario/funcion/:id_funciones/visto', verifyToken, puedeRevisar, marcarVistoBueno);

// Revisión de los cortes (semana 8 y 16), en dos etapas:
// el revisor de la función da el visto bueno y luego el Director cierra.
router.put('/cortes/:id_funciones/:semana/visto', verifyToken, puedeRevisar, darVistoBueno);
router.put('/cortes/:id_funciones/:semana/aprobar', verifyToken, puedeRevisar, aprobarCorte);
router.put('/cortes/:id_funciones/:semana/devolver', verifyToken, puedeRevisar, devolverCorte);

// Rutas de revisión de agendas — módulo Director
router.get('/agendas', verifyToken, puedeVerRevision, getAgendas);
router.get('/agendas/:id', verifyToken, puedeVerRevision, getAgendaDetalle);
router.put('/agendas/:id/aprobar', verifyToken, puedeRevisar, aprobarAgenda);
router.put('/agendas/:id/devolver', verifyToken, puedeRevisar, devolverAgenda);

// Programas que gestiona el usuario (selector del panel)
router.get('/mis-programas', verifyToken, verifyRole('Director', 'Planeacion', 'Admin', 'Consultor'), getMisProgramas);

// Reportes
router.get('/reportes/resumen', verifyToken, verifyRole('Director', 'Planeacion', 'Admin', 'Consultor'), getReportesResumen);

module.exports = router;
