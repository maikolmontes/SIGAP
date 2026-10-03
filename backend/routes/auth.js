const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/google', authController.loginGoogle);
router.get('/stats', authController.getPublicStats);

module.exports = router;

