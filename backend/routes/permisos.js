const express = require('express');
const router = express.Router();
const controller = require('../controllers/permisosController');
const verifyToken = require('../middleware/verifyToken');
const soloPlaneacion = require('../middleware/soloPlaneacion');
const { permisosDeSuRol } = require('../middleware/accesoDatos');

// Consultar permisos: cada usuario los de sus propios roles (las pantallas los leen al entrar); Planeación, los de cualquiera.
// Sembrar, editar o copiar la matriz de permisos: solo Planeación.
router.use(verifyToken);

// Catálogo matricial y asignaciones por rol
router.get('/catalogo', soloPlaneacion, controller.getCatalogoYAsignaciones);

// Sembrado / inicialización de matriz
router.get('/seed', soloPlaneacion, controller.ejecutarSeed);
router.post('/seed', soloPlaneacion, controller.ejecutarSeed);

// Permisos activos de un rol específico
router.get('/rol/:id_rol', permisosDeSuRol, controller.getPermisosByRol);

// Actualizar permisos de un rol
router.put('/roles/:id_rol', soloPlaneacion, controller.updateRolPermisos);

// Clonar permisos de un rol a otro
router.post('/copiar', soloPlaneacion, controller.copiarPermisos);

module.exports = router;
