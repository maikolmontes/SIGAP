// ================================================================
// SIGAP — Endpoints de administración del servicio de correo
// ----------------------------------------------------------------
// Permiten a Planeación/Admin diagnosticar la configuración SMTP y
// disparar manualmente las notificaciones masivas (recordatorios y
// apertura de período).
// ================================================================

const { sendEmail, verificarConexion, estaHabilitado } = require('../services/emailService');
const plantillas = require('../utils/emailTemplates');
const { urlFrontend } = require('../utils/urlFrontend');
const notificaciones = require('../services/notificacionesService');

// GET /api/notificaciones/estado
const getEstado = async (req, res) => {
    const habilitado = estaHabilitado();
    const conexion = habilitado ? await verificarConexion() : false;

    res.json({
        habilitado,
        conexion_smtp: conexion,
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        puerto: process.env.EMAIL_PORT || '465',
        remitente: process.env.EMAIL_USER || null,
        redireccion_pruebas: process.env.EMAIL_REDIRECT_TO || null,
        frontend_url: urlFrontend()
    });
};

// POST /api/notificaciones/prueba   Body: { correo? }
const enviarPrueba = async (req, res) => {
    const destino = (req.body && req.body.correo) || req.user.correo;

    if (!destino) {
        return res.status(400).json({ error: 'No se pudo determinar el correo de destino.' });
    }

    const { subject, html } = plantillas.plantillaPrueba({ solicitante: req.user.correo });
    const resultado = await sendEmail({ to: destino, subject, html });

    if (!resultado.ok) {
        return res.status(502).json({
            error: 'No se pudo enviar el correo de prueba.',
            motivo: resultado.motivo,
            detalles: resultado.detalle || null
        });
    }

    res.json({ mensaje: `Correo de prueba enviado a ${destino}.`, messageId: resultado.messageId });
};

// POST /api/notificaciones/recordatorios   Body: { id_programa? }
const enviarRecordatorios = async (req, res) => {
    try {
        const idPrograma = req.body && req.body.id_programa ? parseInt(req.body.id_programa, 10) : null;
        const resultado = await notificaciones.notificarRecordatorioPlazo({ idPrograma, idRemitente: req.user?.id });

        res.json({
            mensaje: resultado.enviados
                ? `Se enviaron ${resultado.enviados} recordatorio(s).`
                : 'No hay docentes con agenda pendiente o no se pudo enviar ningún correo.',
            ...resultado
        });
    } catch (error) {
        console.error('Error en enviarRecordatorios:', error);
        res.status(500).json({ error: 'Error al enviar los recordatorios.', detalles: error.message });
    }
};

// POST /api/notificaciones/cortes-por-cerrar   Body: { dias? (3 por omisión), correo? (true por omisión) }
// Avisa a los docentes que aún no registran avance en un corte (semana 8 o 16) que cierra pronto.
const enviarCortesPorCerrar = async (req, res) => {
    try {
        const dias = req.body && req.body.dias !== undefined ? parseInt(req.body.dias, 10) : 3;
        const correo = !(req.body && req.body.correo === false);
        const resultado = await notificaciones.notificarCortesPorCerrar({ dias, correo, idRemitente: req.user?.id });

        res.json({
            mensaje: resultado.ok
                ? `Se avisó a ${resultado.total} docente(s) con avance pendiente en ${resultado.cortes} corte(s) por cerrar.`
                : 'No hay cortes por cerrar en ese plazo.',
            ...resultado
        });
    } catch (error) {
        console.error('Error en enviarCortesPorCerrar:', error);
        res.status(500).json({ error: 'Error al avisar de los cortes por cerrar.', detalles: error.message });
    }
};

// POST /api/notificaciones/periodo/:id  — reenvío manual del aviso de apertura
const enviarAvisoPeriodo = async (req, res) => {
    try {
        const idPeriodo = parseInt(req.params.id, 10);
        const resultado = await notificaciones.notificarAperturaPeriodo(idPeriodo, req.user?.id);

        res.json({
            mensaje: resultado.enviados
                ? `Se notificó la apertura del período a ${resultado.enviados} persona(s).`
                : 'No se envió ningún correo.',
            ...resultado
        });
    } catch (error) {
        console.error('Error en enviarAvisoPeriodo:', error);
        res.status(500).json({ error: 'Error al notificar la apertura del período.', detalles: error.message });
    }
};

module.exports = { getEstado, enviarPrueba, enviarRecordatorios, enviarCortesPorCerrar, enviarAvisoPeriodo };
