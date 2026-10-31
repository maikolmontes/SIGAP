// El secreto de los JWT: obligatorio en producción y en Vercel, con aviso en desarrollo.
// Se prueba en un proceso hijo porque config/jwt.js resuelve el secreto al cargarse.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');

const jwtModulo = path.resolve(__dirname, '../config/jwt.js');

const cargar = (env) =>
    spawnSync(process.execPath, ['-e', `console.log('LONGITUD=' + require(${JSON.stringify(jwtModulo)}).JWT_SECRET.length)`], {
        encoding: 'utf8',
        env: { ...process.env, ...env },
    });

test('en producción sin secreto el servidor se niega a arrancar', () => {
    const r = cargar({ NODE_ENV: 'production', JWT_SECRET: '' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /JWT_SECRET no está definido/);
});

test('en producción un secreto demasiado corto también se rechaza', () => {
    const r = cargar({ NODE_ENV: 'production', JWT_SECRET: 'corto' });
    assert.notEqual(r.status, 0);
});

test('en producción con secreto válido arranca y usa ese secreto', () => {
    const r = cargar({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40) });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /LONGITUD=40/);
});

test('en desarrollo sin secreto arranca, pero avisa', () => {
    const r = cargar({ NODE_ENV: 'development', JWT_SECRET: '' });
    assert.equal(r.status, 0);
    assert.match(r.stderr, /JWT_SECRET no está definido/);
});

test('en Vercel sin secreto el servidor NO arranca y dice por qué (no firma con el secreto por defecto)', () => {
    const r = cargar({ NODE_ENV: 'production', VERCEL: '1', JWT_SECRET: '' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /JWT_SECRET no está definido en Vercel/);
    assert.match(r.stderr, /Settings > Environment Variables/, 'el mensaje dice dónde corregirlo');
    assert.doesNotMatch(r.stdout, /LONGITUD=/, 'no llegó a exportar ningún secreto');
});

test('en Vercel un secreto en blanco cuenta como no definido', () => {
    const r = cargar({ NODE_ENV: 'production', VERCEL: '1', JWT_SECRET: '    ' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /JWT_SECRET no está definido en Vercel/);
});

test('en Vercel sin NODE_ENV tampoco se usa el secreto por defecto', () => {
    const r = cargar({ NODE_ENV: '', VERCEL: '1', JWT_SECRET: '' });
    assert.notEqual(r.status, 0);
    assert.doesNotMatch(r.stdout + r.stderr, /jwt_secret_key_sigap_2026/, 'el secreto por defecto no se imprime ni se usa');
});

test('en Vercel un secreto válido arranca y se usa tal cual', () => {
    const r = cargar({ NODE_ENV: 'production', VERCEL: '1', JWT_SECRET: 'y'.repeat(48) });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /LONGITUD=48/);
    assert.doesNotMatch(r.stderr, /JWT_SECRET/, 'sin avisos');
});

test('en Vercel un secreto ya configurado se respeta, aunque sea corto', () => {
    const r = cargar({ NODE_ENV: 'production', VERCEL: '1', JWT_SECRET: 'corto-12' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /LONGITUD=8/);
});
