// Avance general del dashboard del docente: solo llega a 100 cuando todo está completo.
const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularAvanceGeneral } = require('../utils/avanceDocente');

test('sin metas no hay avance que mostrar (0 %), sin dividir por cero', () => {
    assert.deepEqual(calcularAvanceGeneral([]), { metaTotal: 0, ejecucionCumplida: 0, avanceGeneral: 0 });
    assert.equal(calcularAvanceGeneral([{ meta: 0, ejec8: 5, ejec16: 0 }]).avanceGeneral, 0);
});

test('es Σ ejecución / Σ meta: una función grande pesa más que una pequeña', () => {
    // 2 de 2 (100 %) y 0 de 98 (0 %): el promedio de porcentajes daría 50 %; el avance real es 2 %
    const r = calcularAvanceGeneral([{ meta: 2, ejec8: 2, ejec16: 0 }, { meta: 98, ejec8: 0, ejec16: 0 }]);
    assert.equal(r.avanceGeneral, 2);
    assert.equal(r.metaTotal, 100);
    assert.equal(r.ejecucionCumplida, 2);
});

test('llega a 100 cuando se cumple todo, sumando los dos cortes', () => {
    const r = calcularAvanceGeneral([{ meta: 10, ejec8: 6, ejec16: 4 }, { meta: 5, ejec8: 5, ejec16: 0 }, { meta: 1, ejec8: 0, ejec16: 1 }]);
    assert.equal(r.avanceGeneral, 100);
    assert.equal(r.ejecucionCumplida, r.metaTotal);
});

test('lo ejecutado de más no pasa de 100 ni compensa a otra función', () => {
    const r = calcularAvanceGeneral([{ meta: 10, ejec8: 50, ejec16: 0 }, { meta: 10, ejec8: 0, ejec16: 0 }]);
    assert.equal(r.avanceGeneral, 50);
    assert.equal(r.ejecucionCumplida, 10);
});

test('un 99,6 % se muestra como 99: el 100 queda reservado para "todo completo"', () => {
    const r = calcularAvanceGeneral([{ meta: 1000, ejec8: 996, ejec16: 0 }]);
    assert.equal(r.avanceGeneral, 99);
    assert.equal(calcularAvanceGeneral([{ meta: 1000, ejec8: 1000, ejec16: 0 }]).avanceGeneral, 100);
});

test('los valores que llegan como texto de la base (numeric) se leen bien', () => {
    assert.equal(calcularAvanceGeneral([{ meta: '4.00', ejec8: '1.00', ejec16: '1.00' }]).avanceGeneral, 50);
});
