const express = require('express');
const router = express.Router();
const periodosController = require('../controllers/periodosController');
const verifyToken = require('../middleware/verifyToken');
const soloPlaneacion = require('../middleware/soloPlaneacion');

// Consultar períodos: cualquier usuario con sesión. Crear, cerrar, habilitar y gestionar los docentes del período: solo Planeación.
router.use(verifyToken);

router.get('/', periodosController.getAll);
router.get('/activo', periodosController.getPeriodoActivo);
router.get('/:id', periodosController.getById);
router.post('/', soloPlaneacion, periodosController.create);
router.put('/:id/cerrar', soloPlaneacion, periodosController.cerrar);
router.put('/:id/habilitar', soloPlaneacion, periodosController.habilitar);
router.get('/:id/docentes', soloPlaneacion, periodosController.getDocentesAsignados);
router.post('/:id/docentes', soloPlaneacion, periodosController.asignarDocentes);
router.delete('/:id/docentes/:idUsuario', soloPlaneacion, periodosController.desasignarDocente);

module.exports = router;
