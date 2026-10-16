// Avance semanal obligatorio (utils/avanceObligatorio.js): todo indicador debe quedar en más de 0, con una sola excepción.
const test = require('node:test');
const assert = require('node:assert/strict');
const { indicadoresSinAvance, puedeQuedarEnCero } = require('../utils/avanceObligatorio');

const ind = (extra = {}) => ({ nombre_indicador: 'Informe', meta: 2, ejecucion_8: 0, ejecucion_16: 0, ...extra });
const nombres = (lista) => lista.map((i) => i.nombre_indicador);

test('semana 8: un indicador en 0 falta; con 0,1 ya cuenta', () => {
    assert.deepEqual(nombres(indicadoresSinAvance([ind({ nombre_indicador: 'A' }), ind({ nombre_indicador: 'B', ejecucion_8: 0.1 })], 8)), ['A']);
});

test('los valores que llegan como texto de la base se leen bien', () => {
    assert.equal(indicadoresSinAvance([ind({ ejecucion_8: '0.00' })], 8).length, 1);
    assert.equal(indicadoresSinAvance([ind({ ejecucion_8: '0.50' })], 8).length, 0);
});

test('la excepción: "Evidencia de entrega de notas finales" puede ir en 0 en la semana 8 (sin importar tildes ni mayúsculas)', () => {
    const notas = ind({ nombre_indicador: 'Evidencia de entrega de notas finales', meta: 1 });
    assert.equal(indicadoresSinAvance([notas], 8).length, 0);
    assert.equal(indicadoresSinAvance([{ ...notas, nombre_indicador: '  EVIDENCIA de entrega de NOTAS finales ' }], 8).length, 0);
    assert.equal(puedeQuedarEnCero('Evidencia de entrega de notas finales', 8), true);
});

test('la excepción es solo de la semana 8: en la 16 ese indicador sí debe registrarse', () => {
    const notas = ind({ nombre_indicador: 'Evidencia de entrega de notas finales', meta: 1, ejecucion_8: 0, ejecucion_16: 0 });
    assert.equal(indicadoresSinAvance([notas], 16).length, 1);
    assert.equal(indicadoresSinAvance([{ ...notas, ejecucion_16: 1 }], 16).length, 0);
    assert.equal(puedeQuedarEnCero('Evidencia de entrega de notas finales', 16), false);
});

test('otro indicador parecido no tiene la excepción', () => {
    assert.equal(indicadoresSinAvance([ind({ nombre_indicador: 'Registros de calificaciones en el sistema académico institucional', meta: 3 })], 8).length, 1);
});

test('semana 16: debe registrarse algo en la 16, salvo que la meta ya se haya cumplido en la 8', () => {
    assert.equal(indicadoresSinAvance([ind({ meta: 4, ejecucion_8: 2, ejecucion_16: 0 })], 16).length, 1);
    assert.equal(indicadoresSinAvance([ind({ meta: 4, ejecucion_8: 2, ejecucion_16: 1 })], 16).length, 0);
    assert.equal(indicadoresSinAvance([ind({ meta: 2, ejecucion_8: 2, ejecucion_16: 0 })], 16).length, 0, 'ya cumplió la meta: no queda nada por registrar');
});

test('un indicador sin meta no exige nada', () => {
    assert.equal(indicadoresSinAvance([ind({ meta: 0 }), ind({ meta: null })], 8).length, 0);
});

test('sin indicadores no falta nada', () => {
    assert.deepEqual(indicadoresSinAvance([], 8), []);
    assert.deepEqual(indicadoresSinAvance(undefined, 16), []);
});
