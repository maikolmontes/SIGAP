// Lectura del semestre y el grupo desde el Excel de asignaciones.
const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db/connection');
const { parseSemestre } = require('../controllers/directorController');

test.after(() => pool.end());

test('"1B-M" → semestre 1, grupo B-M', () => {
    assert.deepEqual(parseSemestre('1B-M'), { numero: '1', grupo: 'B-M' });
});

test('"9E-N" → semestre 9, grupo E-N (nocturno)', () => {
    assert.deepEqual(parseSemestre('9E-N'), { numero: '9', grupo: 'E-N' });
});

test('"11-M" → el guion es separador: grupo M, no "-M"', () => {
    assert.deepEqual(parseSemestre('11-M'), { numero: '11', grupo: 'M' });
});

test('solo número → grupo A por defecto', () => {
    assert.deepEqual(parseSemestre('5'), { numero: '5', grupo: 'A' });
});

test('vacío → semestre 1, grupo A', () => {
    assert.deepEqual(parseSemestre(''), { numero: '1', grupo: 'A' });
    assert.deepEqual(parseSemestre(undefined), { numero: '1', grupo: 'A' });
});

test('espacios alrededor se ignoran', () => {
    assert.deepEqual(parseSemestre('  6A-M '), { numero: '6', grupo: 'A-M' });
});
