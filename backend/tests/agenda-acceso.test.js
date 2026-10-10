// La agenda solo la ve y la modifica su dueño (y Planeación/Admin): controllers/agendaController.js.
// Se reemplaza pool.query por una base falsa que responde según la consulta.
const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db/connection');
const agenda = require('../controllers/agendaController');

test.after(() => pool.end());

const SEMANA_ABIERTA = { numero_semana: '8', habilitada: true, fecha_inicio: null, fecha_fin: null, semestre: 1 };
const PARO = new Error('llegó a la base: pasó los controles de acceso');

// Responde a cada consulta; "misIndicadores" son los ids que SÍ son del usuario, "misActividades" las de su función.
const baseFalsa = ({ semana = SEMANA_ABIERTA, esDuenoDeFuncion = true, misIndicadores = [], misActividades = [] } = {}) => {
    const original = { query: pool.query, connect: pool.connect };
    const consultas = [];
    pool.query = async (sql, p = []) => {
        consultas.push(sql);
        if (/FROM semana s/.test(sql)) return { rows: semana ? [semana] : [] };
        if (/SELECT id_periodo FROM asignacion_funciones/.test(sql)) return { rows: [{ id_periodo: 1 }] };
        if (/SELECT 1 FROM usuario_asignacion/.test(sql)) return { rows: esDuenoDeFuncion ? [{ uno: 1 }] : [] };
        if (/SELECT id_asignacionact FROM asignacion_actividades/.test(sql)) return { rows: misActividades.map((id) => ({ id_asignacionact: id })) };
        if (/SELECT DISTINCT i\.id_indicadores/.test(sql)) {
            const pedidos = p[1] || [];
            return { rows: misIndicadores.filter((id) => pedidos.includes(id)).map((id) => ({ id_indicadores: id })) };
        }
        return { rows: [] };
    };
    let conexiones = 0;
    pool.connect = async () => { conexiones++; throw PARO; };
    return { consultas, conexiones: () => conexiones, restaurar: () => { pool.query = original.query; pool.connect = original.connect; } };
};

const respuesta = () => {
    const r = { codigo: 200, cuerpo: null };
    r.status = (c) => { r.codigo = c; return r; };
    r.json = (b) => { r.cuerpo = b; return r; };
    return r;
};
const peticion = (extra = {}) => ({ user: { id: 5, roles: 'Docente' }, headers: {}, params: {}, body: {}, ...extra });
const ejecutar = async (controlador, req) => {
    const res = respuesta();
    try { await controlador(req, res); } catch (e) { if (e !== PARO) throw e; res.llegoALaBase = true; }
    return res;
};

test('guardar avance: si algún indicador no es del usuario, 403 y no se abre ni una transacción', async () => {
    const db = baseFalsa({ misIndicadores: [10] });
    try {
        const res = await ejecutar(agenda.guardarAvanceDocente, peticion({ body: { semana: '8', indicadores: [{ id_indicador: 10 }, { id_indicador: 11 }] } }));
        assert.equal(res.codigo, 403);
        assert.match(res.cuerpo.error, /no pertenece a tu agenda/);
        assert.equal(db.conexiones(), 0);
    } finally { db.restaurar(); }
});

test('guardar avance: con todos los indicadores propios, sigue adelante', async () => {
    const db = baseFalsa({ misIndicadores: [10, 11] });
    try {
        const res = await ejecutar(agenda.guardarAvanceDocente, peticion({ body: { semana: '8', indicadores: [{ id_indicador: 10 }, { id_indicador: 11 }, { id_indicador: 10 }] } }));
        assert.equal(res.llegoALaBase, true, 'debe pasar los controles');
        assert.equal(db.conexiones(), 1);
    } finally { db.restaurar(); }
});

test('guardar avance: un id inválido se rechaza con 400', async () => {
    const db = baseFalsa();
    try {
        const res = await ejecutar(agenda.guardarAvanceDocente, peticion({ body: { semana: '8', indicadores: [{ id_indicador: 'x' }] } }));
        assert.equal(res.codigo, 400);
        assert.equal(db.conexiones(), 0);
    } finally { db.restaurar(); }
});

test('guardar avance: Planeación puede guardar sin ser dueña (no se consulta la pertenencia)', async () => {
    const db = baseFalsa();
    try {
        const res = await ejecutar(agenda.guardarAvanceDocente, peticion({ user: { id: 1, roles: 'Planeación' }, body: { semana: '8', indicadores: [{ id_indicador: 99 }] } }));
        assert.equal(res.llegoALaBase, true);
        assert.ok(!db.consultas.some((q) => /SELECT DISTINCT i\.id_indicadores/.test(q)));
    } finally { db.restaurar(); }
});

test('guardar avance: con la semana cerrada se rechaza antes de revisar nada más', async () => {
    const db = baseFalsa({ semana: { ...SEMANA_ABIERTA, fecha_fin: '2000-01-01' }, misIndicadores: [10] });
    try {
        const res = await ejecutar(agenda.guardarAvanceDocente, peticion({ body: { semana: '8', indicadores: [{ id_indicador: 10 }] } }));
        assert.equal(res.codigo, 403);
        assert.match(res.cuerpo.error, /cerró el/);
        assert.equal(db.conexiones(), 0);
    } finally { db.restaurar(); }
});

test('guardar función: una función de otro docente se rechaza', async () => {
    const db = baseFalsa({ esDuenoDeFuncion: false });
    try {
        const res = await ejecutar(agenda.guardarFuncionDocente, peticion({ body: { id_funciones: 7, actividades: [] } }));
        assert.equal(res.codigo, 403);
        assert.match(res.cuerpo.error, /no pertenece a tu agenda/);
        assert.equal(db.conexiones(), 0);
    } finally { db.restaurar(); }
});

test('guardar función: una actividad que no es de esa función se rechaza (aunque la función sea suya)', async () => {
    const db = baseFalsa({ misActividades: [100, 101] });
    try {
        const res = await ejecutar(agenda.guardarFuncionDocente, peticion({ body: { id_funciones: 7, actividades: [{ id_asignacionact: 100 }, { id_asignacionact: 555 }] } }));
        assert.equal(res.codigo, 403);
        assert.match(res.cuerpo.error, /no pertenece a esta función/);
        assert.equal(db.conexiones(), 0);
    } finally { db.restaurar(); }
});

test('guardar función: función y actividades propias, con la Semana 0 abierta, sigue adelante', async () => {
    const db = baseFalsa({ misActividades: [100, 101] });
    try {
        const res = await ejecutar(agenda.guardarFuncionDocente, peticion({ body: { id_funciones: 7, actividades: [{ id_asignacionact: '100' }, { id_asignacionact: 101 }] } }));
        assert.equal(res.llegoALaBase, true);
    } finally { db.restaurar(); }
});

test('ver una agenda: la ajena se rechaza; la propia y la de Planeación pasan', async () => {
    const db = baseFalsa();
    try {
        const ajena = await ejecutar(agenda.getAgendaBase, peticion({ params: { id_usuario: '76' } }));
        assert.equal(ajena.codigo, 403);
        assert.equal((await ejecutar(agenda.getAgenda, peticion({ params: { id_usuario: '76' } }))).codigo, 403);

        const propia = await ejecutar(agenda.getAgendaBase, peticion({ params: { id_usuario: '5' } }));
        assert.notEqual(propia.codigo, 403);

        const planeacion = await ejecutar(agenda.getAgendaBase, peticion({ user: { id: 1, roles: 'Planeación' }, params: { id_usuario: '76' } }));
        assert.notEqual(planeacion.codigo, 403);
    } finally { db.restaurar(); }
});
