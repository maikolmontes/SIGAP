// IND-10 e IND-11 de la analítica descriptiva, con base falsa.
const test = require('node:test');
const assert = require('node:assert/strict');
const { indicadorPesoMetas, indicadorRevisionCortes } = require('../services/analiticaDescriptiva');
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

test('IND-11: solo cuenta las funciones liberadas; separa "por revisar" de "sin reportar" y informa las que faltan por liberar', async () => {
    const consultas = [];
    const db = {
        query: async (sql) => {
            consultas.push(sql);
            if (/COUNT\(DISTINCT af\.id_funciones\)/.test(sql)) return { rows: [{ total: 14, liberadas: 10 }] };
            return { rows: [
                { semana: 8, estado: 'Aprobado', n: 6 }, { semana: 8, estado: 'Devuelto', n: 1 }, { semana: 8, estado: 'Pendiente', n: 2 },
                { semana: 16, estado: 'Aprobado', n: 2 }, { semana: 16, estado: 'Visto bueno', n: 3 },
            ] };
        },
    };
    const m = await indicadorRevisionCortes(db, contexto());
    assert.equal(m.indicadorId, 'IND-11');
    assert.deepEqual(m.categorias, ['Semana 8', 'Semana 16']);
    const serie = (c) => m.series.find((x) => x.clave === c).datos;
    assert.deepEqual(serie('aprobadas'), [6, 2]);
    assert.deepEqual(serie('vistoBueno'), [0, 3]);
    assert.deepEqual(serie('devueltas'), [1, 0]);
    assert.deepEqual(serie('porRevisar'), [2, 0], 'el docente ya reportó y falta la revisión del director');
    assert.deepEqual(serie('sinReportar'), [1, 5], '10 liberadas menos las que ya tienen estado');
    assert.equal(m.resumenNumerico.total, 10, 'el total son las funciones liberadas, no todas');
    assert.equal(m.resumenNumerico.porLiberar, 4, '14 asignadas - 10 liberadas: su carga sigue por aprobar');
    assert.equal(m.resumenNumerico.porcentajeCorte1, 60);
    assert.equal(m.resumenNumerico.porcentajeCorte2, 20);
    assert.ok(consultas.every((q) => /'Por Aprobar'/.test(q)), 'las dos consultas distinguen las funciones sin liberar');
});

test('IND-11: nunca da negativos aunque haya más filas de revisión que funciones liberadas', async () => {
    const db = { query: async (sql) => (/COUNT\(DISTINCT af\.id_funciones\)/.test(sql) ? { rows: [{ total: 2, liberadas: 2 }] } : { rows: [{ semana: 8, estado: 'Aprobado', n: 5 }] }) };
    const m = await indicadorRevisionCortes(db, contexto());
    assert.deepEqual(m.series.find((x) => x.clave === 'sinReportar').datos, [0, 2]);
});

test('IND-11: en un intersemestral los cortes también se llaman Semana 8 y Semana 16', async () => {
    const db = { query: async (sql) => (/COUNT\(DISTINCT af\.id_funciones\)/.test(sql) ? { rows: [{ total: 0, liberadas: 0 }] } : { rows: [] }) };
    const m = await indicadorRevisionCortes(db, contexto({ periodo: { semestre: 3 } }));
    assert.deepEqual(m.categorias, ['Semana 8', 'Semana 16']);
    assert.equal(m.resumenNumerico.porcentajeCorte1, 0, 'sin funciones no hay división por cero');
    assert.equal(m.resumenNumerico.porLiberar, 0);
});

test('los indicadores están en el catálogo y los ven todos los roles de supervisión; IND-12 se integró a IND-01', () => {
    assert.equal(catalogo.obtenerIndicador('IND-12'), null, 'la cobertura ahora es parte del estado de las agendas (IND-01)');
    for (const id of ['IND-10', 'IND-11']) {
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
