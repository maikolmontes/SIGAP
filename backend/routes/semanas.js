const express = require('express');
const router = express.Router();
const semanasController = require('../controllers/semanasController');

router.get('/', semanasController.getAll);
router.put('/', semanasController.updateSemanas);

module.exports = router;
