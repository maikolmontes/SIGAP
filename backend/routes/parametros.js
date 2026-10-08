// Parámetros generales: administración del catálogo de funciones, actividades,
// descripciones e indicadores. Exclusivo de Planeación.
const express = require('express');
const router = express.Router();
const c = require('../controllers/parametrosController');
const verifyToken = require('../middleware/verifyToken');
const verifyRole = require('../middleware/verifyRole');

const soloPlaneacion = [verifyToken, verifyRole('Planeacion', 'Admin')];

router.get('/arbol', ...soloPlaneacion, c.getArbol);
router.get('/asignaturas', ...soloPlaneacion, c.getAsignaturas);

router.post('/funciones', ...soloPlaneacion, c.crearFuncion);
router.post('/funciones/:id/actividades', ...soloPlaneacion, c.crearActividad);
router.post('/actividades/:id/descripciones', ...soloPlaneacion, c.crearDescripcion);
router.post('/descripciones/:id/indicadores', ...soloPlaneacion, c.crearIndicador);

router.put('/funciones/:id', ...soloPlaneacion, c.editarFuncion);
router.put('/actividades/:id', ...soloPlaneacion, c.editarActividad);
router.put('/descripciones/:id', ...soloPlaneacion, c.editarDescripcion);
router.put('/indicadores/:id', ...soloPlaneacion, c.editarIndicador);

router.patch('/:tipo/:id/activo', ...soloPlaneacion, c.cambiarActivo);
router.delete('/:tipo/:id', ...soloPlaneacion, c.eliminar);

module.exports = router;
