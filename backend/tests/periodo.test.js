// Cómo se nombra un período y sus cortes (semestres I, II e intersemestrales).
const test = require('node:test');
const assert = require('node:assert/strict');
const { semestreValido, esIntersemestral, etiquetaSemestre, etiquetaPeriodo, etiquetaCorte } = require('../utils/periodo');

test('los semestres ordinarios conservan su nombre de siempre', () => {
    assert.equal(etiquetaPeriodo({ anio: 2026, semestre: 1 }), '2026-I');
    assert.equal(etiquetaPeriodo({ anio: 2026, semestre: 2 }), '2026-II');
    assert.equal(etiquetaPeriodo({ anio: 2026, semestre: '2' }), '2026-II', 'también si llega como texto');
});

test('los intersemestrales se llaman Intersemestral I e Intersemestral II', () => {
    assert.equal(etiquetaSemestre(3), 'Intersemestral I');
    assert.equal(etiquetaSemestre(4), 'Intersemestral II');
    assert.equal(etiquetaPeriodo({ anio: 2026, semestre: 3 }), '2026-Intersemestral I');
    assert.equal(etiquetaPeriodo({ anio: 2027, semestre: 4 }), '2027-Intersemestral II');
});

test('solo se aceptan los semestres 1 a 4', () => {
    for (const ok of [1, 2, 3, 4, '3']) assert.equal(semestreValido(ok), true, String(ok));
    for (const mal of [0, 5, -1, 1.5, null, undefined, 'x', '']) assert.equal(semestreValido(mal), false, String(mal));
});

test('sin período no hay etiqueta', () => {
    assert.equal(etiquetaPeriodo(null), null);
    assert.equal(etiquetaPeriodo(undefined), null);
});

test('un semestre desconocido no se disfraza de otro', () => {
    assert.equal(etiquetaSemestre(7), '7');
});

test('los cortes: semana 8 y 16 en un semestre; "Semana X" mientras no se definan en un intersemestral', () => {
    assert.equal(esIntersemestral(2), false);
    assert.equal(esIntersemestral(3), true);
    assert.equal(etiquetaCorte(8, 1), 'Semana 8');
    assert.equal(etiquetaCorte(16, 2), 'Semana 16');
    assert.equal(etiquetaCorte(8, 3), 'Semana X');
    assert.equal(etiquetaCorte(16, 4), 'Semana X (final)');
});
