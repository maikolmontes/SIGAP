// Estado consolidado de la agenda de un docente (utils/estadoDocente.js) y orden de las funciones.
const test = require('node:test');
const assert = require('node:assert/strict');
const { estadoConsolidado, contarEstados, ESTADOS_DOCENTE } = require('../utils/estadoDocente');
const { ordenarPorFuncion } = require('../utils/ordenFunciones');

const base = { funciones: 3, alguna_devuelta: false, todas_aprobadas: false, todas_diligenciadas: false, alguna_por_aprobar: false };

test('cada docente cae en una sola categoría, con esta precedencia', () => {
    assert.equal(estadoConsolidado({ ...base, funciones: 0 }), 'Sin carga');
    assert.equal(estadoConsolidado({ funciones: null }), 'Sin carga', 'sin funciones el resto de campos viene nulo');
    assert.equal(estadoConsolidado({ ...base, alguna_devuelta: true, todas_aprobadas: true }), 'Devuelta', 'una función devuelta marca toda la agenda');
    assert.equal(estadoConsolidado({ ...base, todas_aprobadas: true, todas_diligenciadas: true }), 'Aprobada');
    assert.equal(estadoConsolidado({ ...base, todas_diligenciadas: true }), 'En revisión');
    assert.equal(estadoConsolidado({ ...base, alguna_por_aprobar: true }), 'Por aprobar', 'carga sin liberar: no es "pendiente de diligenciar"');
    assert.equal(estadoConsolidado(base), 'Pendiente');
});

test('contarEstados reparte a todos los docentes: la suma es siempre el total', () => {
    const filas = [
        { ...base, todas_aprobadas: true, todas_diligenciadas: true },
        { ...base, alguna_por_aprobar: true }, { ...base, alguna_por_aprobar: true }, { ...base, alguna_por_aprobar: true },
        { ...base, funciones: 0 }, { ...base, alguna_devuelta: true }, base,
    ];
    const c = contarEstados(filas);
    assert.deepEqual(Object.keys(c), [...ESTADOS_DOCENTE]);
    assert.deepEqual(c, { Aprobada: 1, 'En revisión': 0, Pendiente: 1, 'Por aprobar': 3, Devuelta: 1, 'Sin carga': 1 });
    assert.equal(Object.values(c).reduce((a, n) => a + n, 0), filas.length);
});

test('las funciones salen como en la agenda: Docencia Directa, Docencia Indirecta y luego las demás sin moverlas', () => {
    const filas = ['Investigación', 'Docencia Indirecta', 'Académico-Administrativo', 'Docencia Directa'].map((f) => ({ f }));
    assert.deepEqual(ordenarPorFuncion(filas, (x) => x.f).map((x) => x.f), ['Docencia Directa', 'Docencia Indirecta', 'Investigación', 'Académico-Administrativo']);
});
