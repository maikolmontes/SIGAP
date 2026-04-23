const express = require('express');
const router = express.Router();
const periodosController = require('../controllers/periodosController');

router.get('/', periodosController.getAll);
router.get('/:id', periodosController.getById);
router.post('/', periodosController.create);
router.put('/:id/cerrar', periodosController.cerrar);
router.get('/:id/docentes', periodosController.getDocentesAsignados);
router.post('/:id/docentes', periodosController.asignarDocentes);
router.delete('/:id/docentes/:idUsuario', periodosController.desasignarDocente);

module.exports = router;
