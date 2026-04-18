const express = require('express');
const router = express.Router();

const controller = require('../controllers/usuariosController');
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.patch('/:id/activo', controller.toggleActivo);

module.exports = router;