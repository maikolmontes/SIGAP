// El secreto de los JWT: obligatorio en producción, con aviso en desarrollo.
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
