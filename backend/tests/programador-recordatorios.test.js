// Cuándo toca enviar el recordatorio automático de plazo (services/programadorTareas.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db/connection');
const { diasRestantes, leerDias, debeEnviarHoy, iniciar } = require('../services/programadorTareas');

test.after(() => pool.end());

const fecha = (anio, mes, dia, hora = 12) => new Date(anio, mes - 1, dia, hora, 0, 0);

test('cuenta días enteros hasta el cierre', () => {
    assert.equal(diasRestantes(fecha(2026, 11, 10), fecha(2026, 11, 3)), 7);
    assert.equal(diasRestantes(fecha(2026, 11, 10), fecha(2026, 11, 9)), 1);
});

test('el día del cierre faltan 0 y después son negativos', () => {
    assert.equal(diasRestantes(fecha(2026, 11, 10), fecha(2026, 11, 10)), 0);
    assert.equal(diasRestantes(fecha(2026, 11, 10), fecha(2026, 11, 12)), -2);
});

test('la hora del día no altera el conteo', () => {
    assert.equal(diasRestantes(fecha(2026, 11, 10, 23), fecha(2026, 11, 3, 0)), 7);
});

test('sin fecha de cierre no hay recordatorio', () => {
    assert.equal(diasRestantes(null), null);
    assert.equal(diasRestantes('no-es-fecha'), null);
});

test('lee la lista de días del .env y descarta basura', () => {
    assert.deepEqual(leerDias('7, 3 ,1'), [7, 3, 1]);
    assert.deepEqual(leerDias('7,abc,-2,,0'), [7, 0]);
    assert.deepEqual(leerDias(), [7, 3, 1]);
});

test('solo avisa en los días configurados', () => {
    assert.equal(debeEnviarHoy(7, [7, 3, 1]), true);
    assert.equal(debeEnviarHoy(5, [7, 3, 1]), false);
    assert.equal(debeEnviarHoy(null, [7, 3, 1]), false);
    assert.equal(debeEnviarHoy(-1, [7, 3, 1]), false); // período ya cerrado
});

test('desactivado por defecto: sin EMAIL_RECORDATORIOS_AUTO no programa nada', () => {
    const anterior = process.env.EMAIL_RECORDATORIOS_AUTO;
    delete process.env.EMAIL_RECORDATORIOS_AUTO;
    try {
        assert.equal(iniciar(), null);
    } finally {
        if (anterior !== undefined) process.env.EMAIL_RECORDATORIOS_AUTO = anterior;
    }
});
