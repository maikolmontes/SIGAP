const express = require('express');
const router = express.Router();
const controller = require('../controllers/facultadesController');

router.get('/', controller.getAll);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id/activa', controller.toggleActiva);
router.delete('/:id', controller.deleteFacultad);

module.exports = router;
