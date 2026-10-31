// ================================================================
// SIGAP — Endurecimiento de seguridad del servidor (CORS, Helmet, límite de intentos)
// ----------------------------------------------------------------
// index.js lo conecta; está aparte para poder probarlo sin levantar todo el backend.
//
//  · CORS con lista blanca: solo el frontend de SIGAP (y el de desarrollo) pueden leer las respuestas
//    desde un navegador. Un origen ajeno NO recibe Access-Control-Allow-Origin. Las peticiones sin cabecera
//    Origin (curl, servidor a servidor, la propia pestaña al abrir un enlace) se dejan pasar: CORS solo
//    protege a los navegadores, la seguridad real sigue siendo el token.
//  · Helmet sin romper el visor de evidencias: el frontend (otro origen) muestra /uploads/evidencias/* en un
//    <iframe>, así que no se pone X-Frame-Options ni CSP global; solo esa ruta autoriza ser embebida por los
//    orígenes de CORS_ORIGINS (frame-ancestors). Corp "cross-origin" permite que <img>/<iframe> la carguen.
//  · Límite de intentos solo en el login con Google.
// ================================================================
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Por omisión: el frontend de producción y el de desarrollo local
const ORIGENES_POR_OMISION = Object.freeze(['https://sigap-fronted.vercel.app', 'http://localhost:5173']);

/** Orígenes permitidos: CORS_ORIGINS (separados por comas, sin barra final) o los de por omisión. */
const origenesPermitidos = (env = process.env) => {
    const lista = String(env.CORS_ORIGINS || '')
        .split(',')
        .map((o) => o.trim().replace(/\/+$/, ''))
        .filter(Boolean);
    return lista.length > 0 ? lista : [...ORIGENES_POR_OMISION];
};

/** CORS con lista blanca. Un origen no permitido simplemente no recibe las cabeceras CORS. */
const crearCors = (permitidos) => cors({
    origin: (origen, devolver) => devolver(null, !origen || permitidos.includes(origen)),
    maxAge: 86400, // el navegador recuerda la respuesta del preflight un día
});

/**
 * Helmet con tres ajustes a propósito (ver la cabecera del archivo): sin CSP global, sin X-Frame-Options y con
 * Cross-Origin-Resource-Policy "cross-origin". El resto de cabeceras (nosniff, HSTS, Referrer-Policy…) quedan por omisión.
 */
const crearHelmet = () => helmet({
    contentSecurityPolicy: false,
    frameguard: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/** Solo para /uploads/evidencias/:archivo: qué páginas pueden mostrarla en un <iframe>. */
const crearFrameAncestors = (permitidos) => (req, res, next) => {
    res.setHeader('Content-Security-Policy', `frame-ancestors ${permitidos.join(' ')}`);
    next();
};

/**
 * Límite de intentos del login con Google (20 por 15 minutos por IP por omisión).
 * OJO: en Vercel cada instancia serverless tiene su propio contador en memoria, así que esto es un freno básico
 * contra intentos repetidos, no un límite global exacto. No hay un límite general bajo a propósito: la
 * universidad comparte IP y en las semanas 8 y 16 entran muchos docentes a la vez.
 */
const crearLimitadorLoginGoogle = ({ ventanaMs = 15 * 60 * 1000, maximo = 20 } = {}) => rateLimit({
    windowMs: ventanaMs,
    limit: maximo,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de inicio de sesión desde esta red. Espera unos minutos e inténtalo de nuevo.' },
});

/**
 * Conecta lo común a todas las rutas: IP real detrás del proxy de Vercel, sin X-Powered-By, Helmet, CORS y JSON limitado.
 * Devuelve los orígenes permitidos (los necesita la ruta de evidencias).
 */
const aplicarSeguridad = (app, express, env = process.env) => {
    const permitidos = origenesPermitidos(env);
    app.set('trust proxy', 1);      // un salto: el proxy de Vercel (necesario para ver la IP real del cliente)
    app.disable('x-powered-by');
    app.use(crearHelmet());
    app.use(crearCors(permitidos));
    // 1 MB (Express trae 100 KB por omisión). Las importaciones de Excel no pasan por aquí: llegan por multer.
    app.use(express.json({ limit: '1mb' }));
    return permitidos;
};

module.exports = {
    ORIGENES_POR_OMISION,
    origenesPermitidos,
    crearCors,
    crearHelmet,
    crearFrameAncestors,
    crearLimitadorLoginGoogle,
    aplicarSeguridad,
};
