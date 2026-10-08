// /api/mis-notificaciones — la campana de cada usuario (cualquier rol con sesión iniciada).
// No confundir con /api/notificaciones, que es el panel de correos de Planeación.
const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const c = require('../controllers/misNotificacionesController');

router.get('/', verifyToken, c.listar);
router.get('/contador', verifyToken, c.contador);
router.patch('/leidas', verifyToken, c.marcarTodasLeidas);
router.patch('/:id/leida', verifyToken, c.marcarLeida);
router.delete('/', verifyToken, c.eliminarTodas);
router.delete('/:id', verifyToken, c.eliminar);

module.exports = router;
