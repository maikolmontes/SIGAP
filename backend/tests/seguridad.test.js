// Endurecimiento de seguridad (middleware/seguridad.js): CORS con lista blanca, Helmet sin romper el visor de
// evidencias, límite de intentos solo en el login con Google y límite del JSON.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const seguridad = require('../middleware/seguridad');

const FRONTEND = 'https://sigap-fronted.vercel.app';
const LOCAL = 'http://localhost:5173';

/** Arma la misma secuencia que index.js, con un límite de intentos pequeño para poder probarlo. */
const levantar = async ({ env = {}, maximoLogin = 3 } = {}) => {
    const app = express();
    const permitidos = seguridad.aplicarSeguridad(app, express, env);
    app.post('/api/auth/google', seguridad.crearLimitadorLoginGoogle({ maximo: maximoLogin }));
    app.post('/api/auth/google', (req, res) => res.json({ ok: true }));
    app.get('/api/dato', (req, res) => res.json({ dato: 1 }));
    app.post('/api/json', (req, res) => res.json({ bytes: JSON.stringify(req.body).length }));
    app.get('/uploads/evidencias/:archivo', seguridad.crearFrameAncestors(permitidos), (req, res) => res.type('.txt').send('contenido'));
    const servidor = http.createServer(app);
    await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${servidor.address().port}`;
    return { base, permitidos, cerrar: () => new Promise((r) => servidor.close(r)) };
};

const pedir = (base, ruta, { origen, metodo = 'GET', cuerpo, cabeceras = {} } = {}) =>
    fetch(base + ruta, {
        method: metodo,
        headers: { ...(origen ? { Origin: origen } : {}), ...(cuerpo ? { 'Content-Type': 'application/json' } : {}), ...cabeceras },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });

test('los orígenes permitidos salen de CORS_ORIGINS y, si falta, son producción y localhost', () => {
    assert.deepEqual(seguridad.origenesPermitidos({}), [FRONTEND, LOCAL]);
    assert.deepEqual(seguridad.origenesPermitidos({ CORS_ORIGINS: '  ' }), [FRONTEND, LOCAL], 'vacía = por omisión');
    assert.deepEqual(seguridad.origenesPermitidos({ CORS_ORIGINS: 'https://a.co/, https://b.co ,,' }), ['https://a.co', 'https://b.co'], 'sin barra final ni vacíos');
});

test('CORS: un origen permitido recibe Access-Control-Allow-Origin; uno ajeno NO', async () => {
    const s = await levantar();
    try {
        for (const origen of [FRONTEND, LOCAL]) {
            const r = await pedir(s.base, '/api/dato', { origen });
            assert.equal(r.headers.get('access-control-allow-origin'), origen, origen);
        }
        const ajeno = await pedir(s.base, '/api/dato', { origen: 'https://sitio-malicioso.example' });
        assert.equal(ajeno.headers.get('access-control-allow-origin'), null, 'el origen ajeno no recibe la cabecera');
        assert.equal(ajeno.status, 200, 'la petición se atiende igual (CORS solo impide que el navegador lea la respuesta)');

        const parecido = await pedir(s.base, '/api/dato', { origen: FRONTEND + '.evil.com' });
        assert.equal(parecido.headers.get('access-control-allow-origin'), null, 'un dominio que solo empieza igual no cuenta');
    } finally { await s.cerrar(); }
});

test('CORS: el preflight de un origen ajeno no recibe permiso, el del frontend sí (con sus cabeceras)', async () => {
    const s = await levantar();
    try {
        const pedirPreflight = (origen) => pedir(s.base, '/api/dato', {
            metodo: 'OPTIONS', origen,
            cabeceras: { 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'authorization,x-rol-activo,content-type' },
        });
        const bueno = await pedirPreflight(FRONTEND);
        assert.equal(bueno.status, 204);
        assert.equal(bueno.headers.get('access-control-allow-origin'), FRONTEND);
        assert.match(bueno.headers.get('access-control-allow-headers') || '', /authorization/i);
        assert.match(bueno.headers.get('access-control-allow-headers') || '', /x-rol-activo/i, 'la cabecera del rol activo debe poder viajar');
        assert.match(bueno.headers.get('access-control-allow-methods') || '', /PUT/);

        const malo = await pedirPreflight('https://sitio-malicioso.example');
        assert.equal(malo.headers.get('access-control-allow-origin'), null);
        assert.equal(malo.headers.get('access-control-allow-methods'), null);
    } finally { await s.cerrar(); }
});

test('CORS: las peticiones sin cabecera Origin (curl, servidor a servidor) se atienden', async () => {
    const s = await levantar();
    try {
        const r = await pedir(s.base, '/api/dato');
        assert.equal(r.status, 200);
        assert.deepEqual(await r.json(), { dato: 1 });
    } finally { await s.cerrar(); }
});

test('CORS_ORIGINS reemplaza la lista de por omisión', async () => {
    const s = await levantar({ env: { CORS_ORIGINS: 'https://otro.cesmag.edu.co' } });
    try {
        assert.equal((await pedir(s.base, '/api/dato', { origen: 'https://otro.cesmag.edu.co' })).headers.get('access-control-allow-origin'), 'https://otro.cesmag.edu.co');
        assert.equal((await pedir(s.base, '/api/dato', { origen: FRONTEND })).headers.get('access-control-allow-origin'), null, 'el de producción ya no está en la lista');
    } finally { await s.cerrar(); }
});

test('Helmet: sin X-Powered-By ni X-Frame-Options, con nosniff y recursos entre orígenes', async () => {
    const s = await levantar();
    try {
        const r = await pedir(s.base, '/api/dato', { origen: FRONTEND });
        assert.equal(r.headers.get('x-powered-by'), null);
        assert.equal(r.headers.get('x-frame-options'), null, 'sin X-Frame-Options: el visor muestra la evidencia en un iframe de otro origen');
        assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(r.headers.get('cross-origin-resource-policy'), 'cross-origin');
        assert.equal(r.headers.get('content-security-policy'), null, 'sin CSP global');
        assert.ok(r.headers.get('strict-transport-security'), 'HSTS por omisión de Helmet');
    } finally { await s.cerrar(); }
});

test('la evidencia autoriza ser mostrada en un iframe SOLO por los orígenes de CORS; el resto de rutas no lleva CSP', async () => {
    const s = await levantar();
    try {
        const ev = await pedir(s.base, '/uploads/evidencias/x.txt', { origen: FRONTEND });
        assert.equal(ev.headers.get('content-security-policy'), `frame-ancestors ${FRONTEND} ${LOCAL}`);
        assert.equal(ev.headers.get('x-frame-options'), null);
        assert.equal(ev.headers.get('cross-origin-resource-policy'), 'cross-origin');
        assert.equal(ev.headers.get('x-powered-by'), null);
        assert.equal((await pedir(s.base, '/api/dato')).headers.get('content-security-policy'), null);
    } finally { await s.cerrar(); }

    const propio = await levantar({ env: { CORS_ORIGINS: 'https://a.co,https://b.co' } });
    try {
        const ev = await pedir(propio.base, '/uploads/evidencias/x.txt');
        assert.equal(ev.headers.get('content-security-policy'), 'frame-ancestors https://a.co https://b.co');
    } finally { await propio.cerrar(); }
});

test('el login con Google responde 429 en español al pasar el límite; las demás rutas no tienen ese límite', async () => {
    const s = await levantar({ maximoLogin: 3 });
    try {
        for (let i = 1; i <= 3; i++) {
            const r = await pedir(s.base, '/api/auth/google', { metodo: 'POST', origen: FRONTEND, cuerpo: { credential: 'x' } });
            assert.equal(r.status, 200, 'intento ' + i);
        }
        const bloqueado = await pedir(s.base, '/api/auth/google', { metodo: 'POST', origen: FRONTEND, cuerpo: { credential: 'x' } });
        assert.equal(bloqueado.status, 429);
        assert.match((await bloqueado.json()).error, /Demasiados intentos de inicio de sesión/);
        assert.ok(bloqueado.headers.get('retry-after') || bloqueado.headers.get('ratelimit'), 'avisa cuánto esperar');
        assert.equal(bloqueado.headers.get('access-control-allow-origin'), FRONTEND, 'el 429 también lleva CORS, para que el frontend pueda mostrar el mensaje');

        // el resto de la API no se ve afectado: la universidad comparte IP
        for (let i = 0; i < 30; i++) assert.equal((await pedir(s.base, '/api/dato')).status, 200);
    } finally { await s.cerrar(); }
});

test('el límite del login cuenta por IP real detrás del proxy (X-Forwarded-For)', async () => {
    const s = await levantar({ maximoLogin: 2 });
    try {
        const intento = (ip) => pedir(s.base, '/api/auth/google', { metodo: 'POST', cuerpo: { credential: 'x' }, cabeceras: { 'X-Forwarded-For': ip } });
        assert.equal((await intento('203.0.113.7')).status, 200);
        assert.equal((await intento('203.0.113.7')).status, 200);
        assert.equal((await intento('203.0.113.7')).status, 429, 'la misma IP se bloquea');
        assert.equal((await intento('198.51.100.9')).status, 200, 'otra IP distinta no se ve afectada');
    } finally { await s.cerrar(); }
});

test('JSON: hasta 1 MB pasa y por encima se rechaza con 413', async () => {
    const s = await levantar();
    try {
        const pasa = await pedir(s.base, '/api/json', { metodo: 'POST', cuerpo: { texto: 'a'.repeat(500 * 1024) } });
        assert.equal(pasa.status, 200, '500 KB (con el límite por omisión de Express, 100 KB, esto fallaba)');
        const grande = await pedir(s.base, '/api/json', { metodo: 'POST', cuerpo: { texto: 'a'.repeat(1100 * 1024) } });
        assert.equal(grande.status, 413);
    } finally { await s.cerrar(); }
});
