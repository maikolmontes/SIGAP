const express = require('express');
const router = express.Router();
const docenteController = require('../controllers/docenteController');
const { JWT_SECRET } = require('../config/jwt');

// Middleware para verificar JWT (se asume que existe un middleware global o se maneja en cada ruta)
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'No se proporcionó token de autenticación.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Formato de token inválido.' });
    }

    const jwt = require('jsonwebtoken');
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido o expirado.' });
    }
};

router.get('/dashboard', verifyToken, docenteController.getDashboard);
router.get('/agendas-por-periodo', verifyToken, docenteController.getAgendasPorPeriodo);
router.get('/reporte-evidencias', verifyToken, docenteController.getReporteEvidencias);

module.exports = router;
