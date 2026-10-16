// Los enlaces de los correos ("Ir a mi agenda") deben llevar a producción cuando el servidor corre en producción.
const test = require('node:test');
const assert = require('node:assert/strict');
const { urlFrontend, URL_PRODUCCION, URL_DESARROLLO } = require('../utils/urlFrontend');
const plantillas = require('../utils/emailTemplates');

test('en Vercel sin FRONTEND_URL el enlace va a producción (no a localhost)', () => {
    assert.equal(urlFrontend({ VERCEL: '1' }), URL_PRODUCCION);
    assert.equal(urlFrontend({ NODE_ENV: 'production' }), URL_PRODUCCION);
    assert.equal(URL_PRODUCCION, 'https://sigap-fronted.vercel.app');
});

test('en Vercel una FRONTEND_URL que apunta a localhost por error se ignora', () => {
    assert.equal(urlFrontend({ VERCEL: '1', FRONTEND_URL: 'http://localhost:5173' }), URL_PRODUCCION);
    assert.equal(urlFrontend({ VERCEL: '1', FRONTEND_URL: 'http://127.0.0.1:3000/' }), URL_PRODUCCION);
});

test('si FRONTEND_URL está bien configurada se respeta, sin barra final', () => {
    assert.equal(urlFrontend({ VERCEL: '1', FRONTEND_URL: 'https://sigap.cesmag.edu.co/' }), 'https://sigap.cesmag.edu.co');
    assert.equal(urlFrontend({ FRONTEND_URL: 'https://sigap-fronted.vercel.app' }), 'https://sigap-fronted.vercel.app');
});

test('en desarrollo: localhost por omisión, o lo que diga FRONTEND_URL (incluso localhost)', () => {
    assert.equal(urlFrontend({}), URL_DESARROLLO);
    assert.equal(urlFrontend({ FRONTEND_URL: 'http://localhost:4000' }), 'http://localhost:4000');
});

test('las plantillas arman el enlace con esa dirección', () => {
    const original = { ...process.env };
    try {
        process.env.VERCEL = '1';
        delete process.env.FRONTEND_URL;
        assert.equal(plantillas.url('/docente/agenda'), 'https://sigap-fronted.vercel.app/docente/agenda');
        assert.equal(plantillas.url('docente/agenda'), 'https://sigap-fronted.vercel.app/docente/agenda');
    } finally {
        for (const k of ['VERCEL', 'FRONTEND_URL']) { if (original[k] === undefined) delete process.env[k]; else process.env[k] = original[k]; }
    }
});
