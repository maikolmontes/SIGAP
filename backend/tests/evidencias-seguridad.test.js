// Seguridad de las evidencias: quién puede subir/ver y qué archivos se aceptan.
// No toca la base de datos: solo la lógica previa a las consultas.
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const pool = require('../db/connection');
const { JWT_SECRET } = require('../config/jwt');
const {
    EXTENSIONES_PERMITIDAS, verifyTokenFlexible, puedeVerDocente,
} = require('../middleware/accesoEvidencias');

test.after(() => pool.end());

const token = (id, roles = 'Docente') => jwt.sign({ id, roles, correo: 'x@y.co' }, JWT_SECRET, { expiresIn: '5m' });

// Ejecuta el middleware y dice qué pasó (next o respuesta con código)
const pasar = (req) => new Promise((resolve) => {
    const res = { status(c) { this.c = c; return this; }, json() { resolve({ codigo: this.c }); } };
    verifyTokenFlexible({ headers: {}, query: {}, ...req }, res, () => resolve({ codigo: 'next' }));
});

test('lista blanca: se aceptan documentos habituales', () => {
    for (const ext of ['.pdf', '.docx', '.xlsx', '.pptx', '.zip', '.png', '.jpg', '.txt', '.csv']) {
        assert.ok(EXTENSIONES_PERMITIDAS.has(ext), ext);
    }
});

test('lista blanca: se rechazan archivos ejecutables o con script', () => {
    for (const ext of ['.html', '.htm', '.js', '.exe', '.bat', '.svg', '.php', '.sh']) {
        assert.ok(!EXTENSIONES_PERMITIDAS.has(ext), ext);
    }
});

test('sin token → 403', async () => {
    assert.equal((await pasar({})).codigo, 403);
});

test('token firmado con otro secreto → 401', async () => {
    const falso = jwt.sign({ id: 1 }, 'otro-secreto-cualquiera-123456');
    assert.equal((await pasar({ headers: { authorization: `Bearer ${falso}` } })).codigo, 401);
});

test('token válido en la cabecera → pasa', async () => {
    assert.equal((await pasar({ headers: { authorization: `Bearer ${token(5)}` } })).codigo, 'next');
});

test('token válido en ?token= (visor/descarga) → pasa', async () => {
    assert.equal((await pasar({ query: { token: token(5) } })).codigo, 'next');
});

test('un docente ve sus propias evidencias', async () => {
    assert.equal(await puedeVerDocente({ user: { id: 7, roles: 'Docente' }, headers: {} }, 7), true);
});

test('un docente NO ve las evidencias de otro docente', async () => {
    assert.equal(await puedeVerDocente({ user: { id: 7, roles: 'Docente' }, headers: {} }, 8), false);
});

test('un docente no gana acceso pidiendo actuar como Planeación', async () => {
    const req = { user: { id: 7, roles: 'Docente' }, headers: { 'x-rol-activo': 'Planeacion' } };
    assert.equal(await puedeVerDocente(req, 8), false);
});
