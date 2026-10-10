// Una semana está abierta solo si está habilitada Y hoy cae dentro de sus fechas (utils/semanaAbierta.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db/connection');
const { estadoDeSemana, verificarSemana, hoyEnColombia, fechaTexto } = require('../utils/semanaAbierta');

test.after(() => pool.end());

const semana = (extra = {}) => ({ numero_semana: '8', habilitada: true, fecha_inicio: '2026-09-01', fecha_fin: '2026-10-09', ...extra });

test('habilitada y dentro de las fechas: abierta', () => {
    const e = estadoDeSemana(semana(), { hoy: '2026-09-20' });
    assert.equal(e.abierta, true);
    assert.equal(e.motivo, null);
});

test('los dos días extremos cuentan: el de inicio y el de cierre', () => {
    assert.equal(estadoDeSemana(semana(), { hoy: '2026-09-01' }).abierta, true);
    assert.equal(estadoDeSemana(semana(), { hoy: '2026-10-09' }).abierta, true);
});

test('pasada la fecha de cierre: cerrada, con la fecha en el mensaje', () => {
    const e = estadoDeSemana(semana(), { hoy: '2026-10-10' });
    assert.equal(e.abierta, false);
    assert.equal(e.motivo, 'cerrada');
    assert.match(e.mensaje, /Semana 8 cerró el/);
    assert.match(e.mensaje, /2026/);
    assert.match(e.mensaje, /consultarla/);
});

test('antes de la fecha de inicio: aún no abre', () => {
    const e = estadoDeSemana(semana(), { hoy: '2026-08-31' });
    assert.equal(e.abierta, false);
    assert.equal(e.motivo, 'no_inicia');
    assert.match(e.mensaje, /inicia el/);
});

test('con el interruptor de Planeación apagado está cerrada aunque la fecha sirva', () => {
    const e = estadoDeSemana(semana({ habilitada: false }), { hoy: '2026-09-20' });
    assert.equal(e.abierta, false);
    assert.equal(e.motivo, 'deshabilitada');
});

test('sin fecha de cierre (o de inicio) ese extremo no limita', () => {
    assert.equal(estadoDeSemana(semana({ fecha_fin: null }), { hoy: '2030-01-01' }).abierta, true);
    assert.equal(estadoDeSemana(semana({ fecha_inicio: null }), { hoy: '2000-01-01' }).abierta, true);
    assert.equal(estadoDeSemana(semana({ fecha_inicio: null, fecha_fin: null }), { hoy: '2026-09-20' }).abierta, true);
});

test('sin fila de semana: cerrada', () => {
    assert.equal(estadoDeSemana(null).abierta, false);
    assert.equal(estadoDeSemana(undefined).motivo, 'sin_semana');
});

test('las fechas pueden llegar como Date de pg o como texto, con o sin hora', () => {
    assert.equal(fechaTexto(new Date(2026, 9, 9)), '2026-10-09');
    assert.equal(fechaTexto('2026-10-09'), '2026-10-09');
    assert.equal(fechaTexto('2026-10-09T05:00:00.000Z'), '2026-10-09');
    assert.equal(fechaTexto(null), null);
    assert.equal(fechaTexto('no es fecha'), null);
    assert.equal(estadoDeSemana(semana({ fecha_fin: new Date(2026, 9, 9) }), { hoy: '2026-10-10' }).motivo, 'cerrada');
});

test('en un intersemestral el corte se llama "Semana X"', () => {
    const e = estadoDeSemana(semana(), { hoy: '2026-10-10', semestre: 3 });
    assert.match(e.mensaje, /Semana X cerró/);
    assert.doesNotMatch(e.mensaje, /Semana 8/);
});

test('"hoy" se toma en la hora de Colombia, no en UTC', () => {
    // 2026-10-10 02:00 UTC todavía es 2026-10-09 21:00 en Colombia
    assert.equal(hoyEnColombia(new Date('2026-10-10T02:00:00Z')), '2026-10-09');
    assert.equal(hoyEnColombia(new Date('2026-10-10T06:00:00Z')), '2026-10-10');
});

test('verificarSemana consulta la semana del período activo y la evalúa', async () => {
    let consulta;
    const db = { query: async (sql, p) => { consulta = { sql, p }; return { rows: [semana({ fecha_fin: '2000-01-01', semestre: 1 })] }; } };
    const e = await verificarSemana(8, null, db);
    assert.deepEqual(consulta.p, ['8', null]);
    assert.equal(e.abierta, false);
    assert.equal(e.motivo, 'cerrada');
    const sinFila = await verificarSemana('16', 5, { query: async () => ({ rows: [] }) });
    assert.equal(sinFila.motivo, 'sin_semana');
});
