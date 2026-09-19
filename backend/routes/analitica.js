const express = require('express');
const router = express.Router();

const controller = require('../controllers/analiticaController');
const verifyToken = require('../middleware/verifyToken');
const verifyRole = require('../middleware/verifyRole');

// Toda la analítica es de consulta y exige un rol de supervisión.
// El alcance territorial (Director → su programa) lo impone el
// controlador a partir del JWT, no el cliente.
const supervisores = verifyRole('Planeacion', 'Admin', 'Director', 'Consultor');

router.get('/periodos', verifyToken, supervisores, controller.getPeriodos);
router.get('/ambito', verifyToken, supervisores, controller.getAmbito);
router.get('/catalogo', verifyToken, supervisores, controller.getCatalogo);
router.get('/resumen', verifyToken, supervisores, controller.getResumen);
router.get('/docentes-detalle', verifyToken, verifyRole('Planeacion', 'Admin', 'Director'), controller.getDetalleDocentes);

// Tablas de reporte
router.get('/consolidado-programas', verifyToken, supervisores, controller.getConsolidadoProgramas);
router.get('/evidencias-brecha', verifyToken, verifyRole('Planeacion', 'Admin', 'Director'), controller.getBrechaEvidencias);

// Interpretación descriptiva con IA — capa opcional, degrada sin romper
router.get('/ia/estado', verifyToken, supervisores, controller.getEstadoIA);
router.post('/interpretar', verifyToken, supervisores, controller.interpretarMetricas);

module.exports = router;
