// Notificaciones del usuario que inició sesión (la campana). Cada quien, solo las suyas.
const notificaciones = require('../services/notificacionesApp');

const idDelUsuario = (req) => Number(req.user?.id);

const listar = async (req, res) => {
    try {
        res.json(await notificaciones.listar(idDelUsuario(req), req.query.limite));
    } catch (error) {
        console.error('Error al listar notificaciones:', error.message);
        res.status(500).json({ error: 'No se pudieron cargar las notificaciones.' });
    }
};

// Liviano: la campana lo consulta cada minuto
const contador = async (req, res) => {
    try {
        res.json({ no_leidas: await notificaciones.contarNoLeidas(idDelUsuario(req)) });
    } catch (error) {
        console.error('Error al contar notificaciones:', error.message);
        res.status(500).json({ error: 'No se pudo consultar las notificaciones.' });
    }
};

const marcarLeida = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!id) return res.status(400).json({ error: 'Identificador inválido.' });
        await notificaciones.marcarLeida(idDelUsuario(req), id);
        res.json({ ok: true });
    } catch (error) {
        console.error('Error al marcar la notificación:', error.message);
        res.status(500).json({ error: 'No se pudo marcar la notificación.' });
    }
};

const marcarTodasLeidas = async (req, res) => {
    try {
        const marcadas = await notificaciones.marcarTodasLeidas(idDelUsuario(req));
        res.json({ ok: true, marcadas });
    } catch (error) {
        console.error('Error al marcar las notificaciones:', error.message);
        res.status(500).json({ error: 'No se pudieron marcar las notificaciones.' });
    }
};

const eliminar = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!id) return res.status(400).json({ error: 'Identificador inválido.' });
        await notificaciones.eliminar(idDelUsuario(req), id);
        res.json({ ok: true });
    } catch (error) {
        console.error('Error al eliminar la notificación:', error.message);
        res.status(500).json({ error: 'No se pudo eliminar la notificación.' });
    }
};

// DELETE /api/mis-notificaciones            → todas las del usuario
// DELETE /api/mis-notificaciones?solo=leidas → solo las ya leídas
const eliminarTodas = async (req, res) => {
    try {
        const borradas = await notificaciones.eliminarTodas(idDelUsuario(req), req.query.solo === 'leidas');
        res.json({ ok: true, borradas });
    } catch (error) {
        console.error('Error al eliminar las notificaciones:', error.message);
        res.status(500).json({ error: 'No se pudieron eliminar las notificaciones.' });
    }
};

module.exports = { listar, contador, marcarLeida, marcarTodasLeidas, eliminar, eliminarTodas };
