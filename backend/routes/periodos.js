const express = require('express');
const router = express.Router();
const periodosController = require('../controllers/periodosController');
const verifyToken = require('../middleware/verifyToken');

// Todas estas rutas exigen iniciar sesión
router.use(verifyToken);

router.get('/', periodosController.getAll);
router.get('/activo', periodosController.getPeriodoActivo);
router.get('/:id', periodosController.getById);
router.post('/', periodosController.create);
router.put('/:id/cerrar', periodosController.cerrar);
router.put('/:id/habilitar', periodosController.habilitar);
router.get('/:id/docentes', periodosController.getDocentesAsignados);
router.post('/:id/docentes', periodosController.asignarDocentes);
router.delete('/:id/docentes/:idUsuario', periodosController.desasignarDocente);

module.exports = router;
