const express = require('express');
const router = express.Router();
const controller = require('../controllers/programasController');

router.get('/', controller.getAll);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id/activo', controller.toggleActivo);
router.delete('/:id', controller.deletePrograma);

module.exports = router;
