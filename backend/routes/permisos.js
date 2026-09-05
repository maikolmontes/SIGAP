const express = require('express');
const router = express.Router();
const controller = require('../controllers/permisosController');

// Catálogo matricial y asignaciones por rol
router.get('/catalogo', controller.getCatalogoYAsignaciones);

// Sembrado / inicialización de matriz
router.get('/seed', controller.ejecutarSeed);
router.post('/seed', controller.ejecutarSeed);

// Permisos activos de un rol específico
router.get('/rol/:id_rol', controller.getPermisosByRol);

// Actualizar permisos de un rol
router.put('/roles/:id_rol', controller.updateRolPermisos);

// Clonar permisos de un rol a otro
router.post('/copiar', controller.copiarPermisos);

module.exports = router;
