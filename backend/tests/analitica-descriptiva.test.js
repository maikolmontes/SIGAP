// IND-10, IND-11 e IND-12 de la analítica descriptiva, con base falsa.
const test = require('node:test');
const assert = require('node:assert/strict');
const { indicadorPesoMetas, indicadorRevisionCortes, indicadorCobertura, clasificarCobertura } = require('../services/analiticaDescriptiva');
const { construirPayload } = require('../services/geminiService');
const catalogo = require('../config/catalogoAnalitica');

const filasMetas = [
    { funcion_sustantiva: 'Académico-Administrativo', meta: '40', ejec8: '8', ejec16: '2' },
    { funcion_sustantiva: 'Docencia Directa', meta: '960', ejec8: '300', ejec16: '120' },
    { funcion_sustantiva: 'Investigación', meta: '0', ejec8: '0', ejec16: '0' },
];

test('IND-10: Docencia Directa pesa casi toda la meta y el avance sin ella es distinto', () => {
    const m = indicadorPesoMetas({ filas: filasMetas, etiqueta: '2026-II', programa: 'Ingeniería de Sistemas' });
    assert.equal(m.indicadorId, 'IND-10');
    assert.deepEqual(m.categorias, ['Académico-Administrativo', 'Docencia Directa', 'Investigación']);
    const serie = (c) => m.series.find((s) => s.clave === c).datos;
    assert.deepEqual(serie('meta'), [40, 960, 0]);
    assert.deepEqual(serie('peso'), [4, 96, 0]);
    assert.deepEqual(serie('avance'), [25, 43.8, 0], 'función sin meta: 0 %, no división por cero');
    assert.equal(m.resumenNumerico.total, 1000);
    assert.equal(m.resumenNumerico.porcentajeGlobal, 43, '(10 + 420) / 1000');
    assert.equal(m.resumenNumerico.porcentajeSinDocenciaDirecta, 25, '10 / 40');
    assert.equal(m.resumenNumerico.pesoDocenciaDirecta, 96);
});

test('IND-10: sin metas no inventa porcentajes', () => {
    const m = indicadorPesoMetas({ filas: [{ funcion_sustantiva: 'Docencia Directa', meta: '0', ejec8: '0', ejec16: '0' }], etiqueta: '2026-II', programa: 'X' });
    assert.equal(m.resumenNumerico.porcentajeSinDocenciaDirecta, null);
    assert.equal(m.resumenNumerico.pesoDocenciaDirecta, null);
    assert.equal(m.resumenNumerico.porcentajeGlobal, 0);
});

const contexto = (extra = {}) => ({ periodo: { semestre: 2 }, etiqueta: '2026-II', programa: 'X', params: [8], filtro: '', ...extra });

test('IND-11: cuenta las funciones por estado de revisión y completa con pendientes', async () => {
    const db = {
        query: async (sql) => {
            if (/COUNT\(DISTINCT af\.id_funciones\)/.test(sql)) return { rows: [{ n: 10 }] };
            return { rows: [
                { semana: 8, estado: 'Aprobado', n: 6 }, { semana: 8, estado: 'Devuelto', n: 1 },
                { semana: 16, estado: 'Aprobado', n: 2 }, { semana: 16, estado: 'Visto bueno', n: 3 },
            ] };
        },
    };
    const m = await indicadorRevisionCortes(db, contexto());
    assert.equal(m.indicadorId, 'IND-11');
    assert.deepEqual(m.categorias, ['Semana 8', 'Semana 16']);
    const serie = (c) => m.series.find((s) => s.clave === c).datos;
    assert.deepEqual(serie('aprobadas'), [6, 2]);
    assert.deepEqual(serie('vistoBueno'), [0, 3]);
    assert.deepEqual(serie('devueltas'), [1, 0]);
    assert.deepEqual(serie('pendientes'), [3, 5]);
    assert.equal(m.resumenNumerico.total, 10);
    assert.equal(m.resumenNumerico.porcentajeCorte1, 60);
    assert.equal(m.resumenNumerico.porcentajeCorte2, 20);
});

test('IND-11: en un intersemestral los cortes se llaman Semana X', async () => {
    const db = { query: async (sql) => (/COUNT\(DISTINCT af\.id_funciones\)/.test(sql) ? { rows: [{ n: 0 }] } : { rows: [] }) };
    const m = await indicadorRevisionCortes(db, contexto({ periodo: { semestre: 3 } }));
    assert.deepEqual(m.categorias, ['Semana X', 'Semana X (final)']);
    assert.equal(m.resumenNumerico.porcentajeCorte1, 0, 'sin funciones no hay división por cero');
});

test('IND-12: clasifica a cada docente según su agenda', () => {
    assert.equal(clasificarCobertura({ funciones: 0 }), 'Sin agenda');
    assert.equal(clasificarCobertura({ funciones: 3, alguna_devuelta: true, todas_diligenciadas: false }), 'Devuelta');
    assert.equal(clasificarCobertura({ funciones: 3, alguna_devuelta: false, todas_diligenciadas: true }), 'Agenda enviada');
    assert.equal(clasificarCobertura({ funciones: 3, alguna_devuelta: false, todas_diligenciadas: false }), 'En construcción');
    assert.equal(clasificarCobertura({ funciones: 2, alguna_devuelta: true, todas_diligenciadas: true }), 'Devuelta', 'una devuelta marca toda la agenda');
});

test('IND-12: la cobertura se calcula sobre los docentes asignados, incluidos los sin agenda', async () => {
    const db = { query: async () => ({ rows: [
        { funciones: 4, alguna_devuelta: false, todas_diligenciadas: true },
        { funciones: 3, alguna_devuelta: false, todas_diligenciadas: true },
        { funciones: 2, alguna_devuelta: false, todas_diligenciadas: false },
        { funciones: 4, alguna_devuelta: true, todas_diligenciadas: false },
        { funciones: 0, alguna_devuelta: null, todas_diligenciadas: null },
    ] }) };
    const m = await indicadorCobertura(db, contexto());
    assert.deepEqual(m.categorias, ['Agenda enviada', 'En construcción', 'Devuelta', 'Sin agenda']);
    assert.deepEqual(m.series[0].datos, [2, 1, 1, 1]);
    assert.equal(m.resumenNumerico.total, 5);
    assert.equal(m.resumenNumerico.porcentajeGlobal, 40);
});

test('los tres indicadores están en el catálogo y los ven todos los roles de supervisión', () => {
    for (const id of ['IND-10', 'IND-11', 'IND-12']) {
        assert.ok(catalogo.obtenerIndicador(id), id);
        for (const rol of ['Planeacion', 'Admin', 'Director', 'Consultor']) assert.equal(catalogo.puedeVer(id, [rol]), true, id + ' ' + rol);
        assert.equal(catalogo.puedeVer(id, ['Docente']), false, id + ' no es para docentes');
    }
});

test('a la IA solo salen cifras agregadas: las nuevas se incluyen y los nombres no', () => {
    const peso = indicadorPesoMetas({ filas: filasMetas, etiqueta: '2026-II', programa: 'Ingeniería de Sistemas' });
    const payload = construirPayload([peso], '2026-II');
    assert.equal(payload.indicadores[0].resumen.porcentajeSinDocenciaDirecta, 25);
    assert.equal(payload.indicadores[0].resumen.pesoDocenciaDirecta, 96);
    assert.ok(!JSON.stringify(payload).includes('Ingeniería de Sistemas'), 'el nombre del programa no sale del servidor');
});
