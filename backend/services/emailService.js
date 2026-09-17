// ================================================================
// SIGAP — Servicio central de correo electrónico (SMTP / Gmail)
// ----------------------------------------------------------------
// Encapsula el transporte de Nodemailer y expone funciones seguras
// de envío. Ningún fallo de correo debe tumbar una transacción de
// negocio: todos los errores se registran en consola y se devuelven
// como { ok: false }.
// ================================================================

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const nodemailer = require('nodemailer');

const {
    EMAIL_HOST = 'smtp.gmail.com',
    EMAIL_PORT = '465',
    EMAIL_SECURE = 'true',
    EMAIL_USER,
    EMAIL_PASS,
    EMAIL_FROM_NAME = 'SIGAP — Universidad CESMAG',
    EMAIL_ENABLED = 'true',
    EMAIL_REDIRECT_TO = '' // si se define, TODOS los correos van a esta dirección (modo pruebas)
} = process.env;

// El servicio queda activo solo si está habilitado y tiene credenciales
const habilitado = String(EMAIL_ENABLED).toLowerCase() !== 'false' && !!EMAIL_USER && !!EMAIL_PASS;

let transporter = null;

const getTransporter = () => {
    if (!habilitado) return null;
    if (transporter) return transporter;

    transporter = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: parseInt(EMAIL_PORT, 10),
        secure: String(EMAIL_SECURE).toLowerCase() === 'true', // true => 465 (SSL), false => 587 (STARTTLS)
        auth: {
            user: EMAIL_USER,
            pass: String(EMAIL_PASS).replace(/\s+/g, '') // Google muestra la clave en bloques de 4
        },
        pool: true,
        maxConnections: 3,
        maxMessages: 50
    });

    return transporter;
};

// ----------------------------------------------------------------
// Verificación de credenciales — se invoca al arrancar el servidor
// ----------------------------------------------------------------
const verificarConexion = async () => {
    if (!habilitado) {
        console.warn('[email] Servicio de correo DESACTIVADO (falta EMAIL_USER/EMAIL_PASS o EMAIL_ENABLED=false).');
        return false;
    }
    try {
        await getTransporter().verify();
        console.log(`[email] Conexión SMTP verificada correctamente (${EMAIL_USER})`);
        return true;
    } catch (error) {
        console.error('[email] No se pudo verificar la conexión SMTP:', error.message);
        return false;
    }
};

// ----------------------------------------------------------------
// Normaliza destinatarios: acepta string o arreglo, filtra vacíos
// y elimina duplicados sin distinguir mayúsculas.
// ----------------------------------------------------------------
const normalizarDestinatarios = (to) => {
    const lista = Array.isArray(to) ? to : String(to || '').split(',');
    const vistos = new Set();
    const limpios = [];

    for (const item of lista) {
        const correo = String(item || '').trim();
        if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) continue;
        const clave = correo.toLowerCase();
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        limpios.push(correo);
    }

    return limpios;
};

// Texto plano de respaldo cuando no se entrega uno explícito
const htmlATexto = (html = '') =>
    html
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|tr|h1|h2|h3|li)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

// ----------------------------------------------------------------
// Envío principal (await-able). Nunca lanza excepción.
// ----------------------------------------------------------------
const sendEmail = async ({ to, subject, html, text, cc, bcc, replyTo }) => {
    const destinatarios = normalizarDestinatarios(to);

    if (destinatarios.length === 0) {
        console.warn(`[email] Omitido "${subject}": no hay destinatarios válidos.`);
        return { ok: false, motivo: 'sin_destinatarios' };
    }

    if (!habilitado) {
        console.warn(`[email] Omitido "${subject}" para ${destinatarios.join(', ')}: servicio desactivado.`);
        return { ok: false, motivo: 'desactivado' };
    }

    // Modo pruebas: redirige todo a una sola bandeja
    const redirigir = normalizarDestinatarios(EMAIL_REDIRECT_TO);
    const paraFinal = redirigir.length > 0 ? redirigir : destinatarios;

    const asuntoFinal = redirigir.length > 0
        ? `[PRUEBA → ${destinatarios.join(', ')}] ${subject}`
        : subject;

    try {
        const info = await getTransporter().sendMail({
            from: `"${EMAIL_FROM_NAME}" <${EMAIL_USER}>`,
            to: paraFinal.join(', '),
            cc: redirigir.length > 0 ? undefined : normalizarDestinatarios(cc).join(', ') || undefined,
            bcc: redirigir.length > 0 ? undefined : normalizarDestinatarios(bcc).join(', ') || undefined,
            replyTo: replyTo || undefined,
            subject: asuntoFinal,
            html,
            text: text || htmlATexto(html)
        });

        console.log(`[email] Enviado "${asuntoFinal}" → ${paraFinal.join(', ')} (id: ${info.messageId})`);
        return { ok: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[email] Error enviando "${asuntoFinal}" → ${paraFinal.join(', ')}:`, error.message);
        return { ok: false, motivo: 'error_envio', detalle: error.message };
    }
};

// ----------------------------------------------------------------
// Envío en segundo plano (fire-and-forget): el controlador responde
// al usuario de inmediato y el correo sale después.
// ----------------------------------------------------------------
const sendEmailAsync = (opciones) => {
    setImmediate(() => {
        sendEmail(opciones).catch((error) =>
            console.error('[email] Fallo inesperado en envío asíncrono:', error.message)
        );
    });
};

module.exports = {
    sendEmail,
    sendEmailAsync,
    verificarConexion,
    normalizarDestinatarios,
    estaHabilitado: () => habilitado
};
