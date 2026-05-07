const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { getUserRoles } = require('../controllers/userController');

// Ruta protegida: /api/user/roles
router.get('/roles', verifyToken, getUserRoles);

module.exports = router;
