// Remitente "en nombre de" (services/emailService.js): sale de la cuenta
// institucional, con el nombre y el Reply-To de quien ejecuta la acción.
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolverRemitente } = require('../services/emailService');

const CUENTA = process.env.EMAIL_USER;

test('sin remitente se usa el institucional', () => {
    const r = resolverRemitente(null);
    assert.equal(r.replyTo, undefined);
    assert.equal(r.nombre, null);
});

test('con remitente: nombre visible con cargo y Reply-To al correo del usuario', () => {
    const r = resolverRemitente({ nombre: 'Juan Pérez', correo: 'jperez@cesmag.edu.co', etiqueta: 'Dirección de programa' });
    assert.equal(r.nombre, 'Juan Pérez (Dirección de programa · SIGAP)');
    assert.equal(r.replyTo, 'jperez@cesmag.edu.co');
    // El remitente real SIGUE siendo la cuenta autenticada (Gmail no permite otra)
    assert.ok(r.from.endsWith(`<${CUENTA}>`));
});

test('un nombre con salto de línea no puede inyectar cabeceras', () => {
    const r = resolverRemitente({ nombre: 'Ana\r\nBcc: malo@x.com', correo: 'a@b.co' });
    assert.ok(!r.from.includes('\r'));
    assert.ok(!r.from.includes('\n'));
});

test('comillas y signos <> se eliminan del nombre', () => {
    const r = resolverRemitente({ nombre: 'Ana "la" <jefa>', correo: 'a@b.co' });
    assert.ok(!r.nombre.includes('"'));
    assert.ok(!r.nombre.includes('<'));
});

test('correo inválido o nombre vacío: vuelve al remitente institucional', () => {
    assert.equal(resolverRemitente({ nombre: 'Ana', correo: 'no-es-correo' }).replyTo, undefined);
    assert.equal(resolverRemitente({ nombre: '', correo: 'a@b.co' }).replyTo, undefined);
});
