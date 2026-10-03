// Reglas de qué rol activo se respeta y qué alcance tiene (utils/rolActivo.js).
// Son funciones puras: no tocan la base de datos.
const test = require('node:test');
const assert = require('node:assert/strict');
const { rolesEfectivos, calcularAlcance, normalizar } = require('../utils/rolActivo');

const peticion = (roles, rolActivo) => ({
    user: { roles },
    headers: rolActivo ? { 'x-rol-activo': rolActivo } : {},
});

test('normalizar quita tildes y mayúsculas', () => {
    assert.equal(normalizar('  Planeación '), 'planeacion');
});

test('sin cabecera se usan todos los roles del token', () => {
    assert.deepEqual(rolesEfectivos(peticion('Docente,Director')), ['docente', 'director']);
});

test('la cabecera X-Rol-Activo restringe al rol pedido si el usuario lo tiene', () => {
    assert.deepEqual(rolesEfectivos(peticion('Docente,Director', 'Director')), ['director']);
});

test('la cabecera NO sirve para escalar privilegios a un rol que no se tiene', () => {
    // Un docente que pide actuar como Planeación sigue siendo solo docente
    assert.deepEqual(rolesEfectivos(peticion('Docente', 'Planeacion')), ['docente']);
});

test('Director queda limitado por programa', () => {
    const a = calcularAlcance(peticion('Director'));
    assert.equal(a.limitadoPorPrograma, true);
});

test('Planeación y Consultor ven toda la institución', () => {
    assert.equal(calcularAlcance(peticion('Planeacion')).limitadoPorPrograma, false);
    assert.equal(calcularAlcance(peticion('Consultor')).limitadoPorPrograma, false);
});

test('un usuario Director+Planeación con rol activo Director queda limitado', () => {
    const a = calcularAlcance(peticion('Director,Planeacion', 'Director'));
    assert.equal(a.limitadoPorPrograma, true);
});

test('un usuario Director+Planeación sin elegir rol NO queda limitado', () => {
    const a = calcularAlcance(peticion('Director,Planeacion'));
    assert.equal(a.limitadoPorPrograma, false);
});
