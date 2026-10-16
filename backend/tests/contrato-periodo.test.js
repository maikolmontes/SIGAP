// Contrato del docente por período (utils/contratoPeriodo.js): reglas de las horas y SQL compartido.
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolverHorasContrato, horasLibres, joinContratoPeriodo, horasContratoSql, HORAS_MAXIMAS_CATEDRA } = require('../utils/contratoPeriodo');

const TIEMPO_COMPLETO = { tipo: 'Tiempo Completo', horas_contrato: 40 };
const MEDIO_TIEMPO = { tipo: 'Medio Tiempo', horas_contrato: 20 };
const CATEDRA = { tipo: 'Hora Cátedra', horas_contrato: 0 };
const POR_DEFINIR = { tipo: 'Por Definir', horas_contrato: 0 };

test('Tiempo Completo y Medio Tiempo llevan las horas de su tipo, sin importar lo que envíe el cliente', () => {
    assert.deepEqual(resolverHorasContrato(TIEMPO_COMPLETO, 5), { ok: true, horas: 40 });
    assert.deepEqual(resolverHorasContrato(MEDIO_TIEMPO, undefined), { ok: true, horas: 20 });
    assert.deepEqual(resolverHorasContrato(POR_DEFINIR, 12), { ok: true, horas: 0 }, 'Por Definir no tiene horas fijas');
});

test('solo Hora Cátedra tiene las horas libres (con o sin tilde y mayúsculas)', () => {
    assert.equal(horasLibres('Hora Cátedra'), true);
    assert.equal(horasLibres(' hora catedra '), true);
    assert.equal(horasLibres('Medio Tiempo'), false);
    assert.equal(horasLibres(undefined), false);
});

test('Hora Cátedra: de 0 a 40 en pasos de media hora; acepta coma o punto', () => {
    for (const [pedido, esperado] of [[0, 0], [12, 12], [12.5, 12.5], ['12,5', 12.5], ['12.5', 12.5], [40, 40], ['0', 0]]) {
        assert.deepEqual(resolverHorasContrato(CATEDRA, pedido), { ok: true, horas: esperado }, String(pedido));
    }
});

test('Hora Cátedra: rechaza lo que no sea un valor válido, con un mensaje claro', () => {
    for (const malo of [undefined, null, '', 'abc', NaN, Infinity, -1, 40.5, 41, 12.3, 0.25]) {
        const r = resolverHorasContrato(CATEDRA, malo);
        assert.equal(r.ok, false, String(malo));
        assert.ok(r.error.length > 10, 'mensaje para ' + String(malo));
    }
    assert.match(resolverHorasContrato(CATEDRA, 41).error, new RegExp(`0 a ${HORAS_MAXIMAS_CATEDRA}`));
});

test('el SQL compartido usa el contrato del período y cae al del perfil si el período no tiene uno', () => {
    const sql = joinContratoPeriodo({ periodo: '$1' });
    assert.match(sql, /LEFT JOIN docente_periodo dpc ON dpc\.id_usuario = u\.id_usuario AND dpc\.id_periodo = \$1/);
    assert.match(sql, /JOIN tipo_contrato tc ON tc\.id_contrato = COALESCE\(dpc\.id_contrato, u\.id_contrato\)/);
    assert.equal(horasContratoSql(), 'COALESCE(dpc.horas_contrato, tc.horas_contrato)');

    const otro = joinContratoPeriodo({ periodo: 'per.id_periodo', u: 'usr', dp: 'x', tc: 'y', tipoJoin: 'LEFT JOIN' });
    assert.match(otro, /LEFT JOIN docente_periodo x ON x\.id_usuario = usr\.id_usuario AND x\.id_periodo = per\.id_periodo/);
    assert.match(otro, /LEFT JOIN tipo_contrato y ON y\.id_contrato = COALESCE\(x\.id_contrato, usr\.id_contrato\)/);
    assert.equal(horasContratoSql('x', 'y'), 'COALESCE(x.horas_contrato, y.horas_contrato)');
});
