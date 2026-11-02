// Control de rol y de propiedad en rutas que antes solo exigían sesión:
//  - facultades, programas, períodos y asignar funciones: escrituras solo de Planeación (middleware/soloPlaneacion.js)
//  - funciones de un usuario, observaciones de una actividad y permisos de un rol: propiedad o alcance (middleware/accesoDatos.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db/connection');
const soloPlaneacion = require('../middleware/soloPlaneacion');
const { propioOSupervisor, lecturaObservacion, permisosDeSuRol } = require('../middleware/accesoDatos');

test.after(() => pool.end());

// ── Tabla de rutas: cada ruta que escribe (o expone datos personales) debe pasar por soloPlaneacion ──
const rutasDe = (router) => router.stack.filter((l) => l.route).map((l) => ({
    metodos: Object.keys(l.route.methods).map((m) => m.toUpperCase()),
    ruta: l.route.path,
    guardias: l.route.stack.map((s) => s.handle),
}));

const EXIGEN_PLANEACION = [
    ['facultades', ['POST /', 'PUT /:id', 'PATCH /:id/activa', 'DELETE /:id']],
    ['programas', ['POST /', 'PUT /:id', 'PATCH /:id/activo', 'DELETE /:id']],
    ['periodos', ['POST /', 'PUT /:id/cerrar', 'PUT /:id/habilitar', 'GET /:id/docentes', 'POST /:id/docentes', 'DELETE /:id/docentes/:idUsuario']],
    ['funciones', ['POST /asignar']],
];

for (const [nombre, rutas] of EXIGEN_PLANEACION) {
    test(`/api/${nombre}: ${rutas.length} rutas exigen Planeación`, () => {
        const definidas = rutasDe(require(`../routes/${nombre}`));
        for (const clave of rutas) {
            const [metodo, ruta] = clave.split(' ');
            const r = definidas.find((d) => d.ruta === ruta && d.metodos.includes(metodo));
            assert.ok(r, `${clave} no existe`);
            assert.ok(r.guardias.includes(soloPlaneacion), `${clave} no pasa por soloPlaneacion`);
        }
    });
}

test('las rutas de lectura del catálogo siguen abiertas a cualquier usuario con sesión', () => {
    for (const nombre of ['facultades', 'programas']) {
        const r = rutasDe(require(`../routes/${nombre}`)).find((d) => d.ruta === '/' && d.metodos.includes('GET'));
        assert.ok(r && !r.guardias.includes(soloPlaneacion), `GET /api/${nombre} debe seguir abierto`);
    }
    const periodos = rutasDe(require('../routes/periodos'));
    for (const ruta of ['/', '/activo']) {
        const r = periodos.find((d) => d.ruta === ruta && d.metodos.includes('GET'));
        assert.ok(r && !r.guardias.includes(soloPlaneacion), `GET /api/periodos${ruta} debe seguir abierto`);
    }
});

test('las tres lecturas con propiedad usan su guardia', () => {
    const f = rutasDe(require('../routes/funciones')).find((d) => d.ruta === '/usuario/:id_usuario');
    assert.ok(f.guardias.length >= 2, 'funciones/usuario necesita la guardia de propiedad antes del controlador');
    const o = rutasDe(require('../routes/observaciones')).find((d) => d.ruta === '/:actividad_id/:semana');
    assert.ok(o.guardias.includes(lecturaObservacion), 'observaciones debe pasar por lecturaObservacion');
    const p = rutasDe(require('../routes/permisos')).find((d) => d.ruta === '/rol/:id_rol');
    assert.ok(p.guardias.includes(permisosDeSuRol), 'permisos/rol debe pasar por permisosDeSuRol');
});

// ── Comportamiento de las guardias ──
const respuesta = () => {
    const r = { codigo: null, cuerpo: null };
    r.status = (c) => { r.codigo = c; return r; };
    r.json = (b) => { r.cuerpo = b; return r; };
    return r;
};
const correr = async (guardia, req) => {
    const res = respuesta();
    let siguio = false;
    await guardia({ headers: {}, params: {}, ...req }, res, () => { siguio = true; });
    return { siguio, codigo: res.codigo };
};
const baseFalsa = (responder) => {
    const original = pool.query;
    pool.query = async (sql, p = []) => responder(sql, p);
    return () => { pool.query = original; };
};

test('soloPlaneacion: docente y director reciben 403; Planeación y Admin pasan', async () => {
    assert.equal((await correr(soloPlaneacion, { user: { id: 1, roles: 'Docente' } })).codigo, 403);
    assert.equal((await correr(soloPlaneacion, { user: { id: 1, roles: 'Director' } })).codigo, 403);
    assert.equal((await correr(soloPlaneacion, { user: { id: 1, roles: 'Consultor' } })).codigo, 403);
    assert.equal((await correr(soloPlaneacion, { user: { id: 1, roles: 'Planeacion' } })).siguio, true);
    assert.equal((await correr(soloPlaneacion, { user: { id: 1, roles: 'Admin' } })).siguio, true);
});

test('soloPlaneacion: la cabecera de rol activo no sirve para escalar privilegios', async () => {
    const r = await correr(soloPlaneacion, { user: { id: 1, roles: 'Docente' }, headers: { 'x-rol-activo': 'Planeacion' } });
    assert.equal(r.codigo, 403);
});

test('funciones del usuario: el propio usuario, Planeación y Consultor pasan; otro docente no', async () => {
    const guardia = propioOSupervisor('id_usuario');
    assert.equal((await correr(guardia, { user: { id: 7, roles: 'Docente' }, params: { id_usuario: '7' } })).siguio, true);
    assert.equal((await correr(guardia, { user: { id: 7, roles: 'Docente' }, params: { id_usuario: '8' } })).codigo, 403);
    assert.equal((await correr(guardia, { user: { id: 1, roles: 'Planeacion' }, params: { id_usuario: '8' } })).siguio, true);
    assert.equal((await correr(guardia, { user: { id: 2, roles: 'Consultor' }, params: { id_usuario: '8' } })).siguio, true);
    assert.equal((await correr(guardia, { user: { id: 7, roles: 'Docente' }, params: { id_usuario: 'abc' } })).codigo, 403);
});

test('funciones del usuario: un Director solo ve docentes de sus programas', async () => {
    const guardia = propioOSupervisor('id_usuario');
    const restaurar = baseFalsa((sql) => {
        if (/FROM director_programa/.test(sql)) return { rows: [{ id_programa: 3 }] };
        if (/FROM usuarios WHERE id_usuario/.test(sql)) return { rows: [{ uno: 1 }] };
        return { rows: [] };
    });
    try {
        assert.equal((await correr(guardia, { user: { id: 20, roles: 'Director' }, params: { id_usuario: '8' } })).siguio, true);
    } finally { restaurar(); }
    const restaurar2 = baseFalsa((sql) => {
        if (/FROM director_programa/.test(sql)) return { rows: [{ id_programa: 3 }] };
        return { rows: [] }; // el docente no es de su programa
    });
    try {
        assert.equal((await correr(guardia, { user: { id: 20, roles: 'Director' }, params: { id_usuario: '9' } })).codigo, 403);
    } finally { restaurar2(); }
});

test('observaciones: el docente solo lee las de sus actividades', async () => {
    const restaurar = baseFalsa((sql) => (/FROM asignacion_actividades aa/.test(sql) ? { rows: [{ id_usuario: 7 }] } : { rows: [] }));
    try {
        assert.equal((await correr(lecturaObservacion, { user: { id: 7, roles: 'Docente' }, params: { actividad_id: '50', semana: '8' } })).siguio, true);
        assert.equal((await correr(lecturaObservacion, { user: { id: 8, roles: 'Docente' }, params: { actividad_id: '50', semana: '8' } })).codigo, 403);
        assert.equal((await correr(lecturaObservacion, { user: { id: 1, roles: 'Planeacion' }, params: { actividad_id: '50', semana: '8' } })).siguio, true);
        assert.equal((await correr(lecturaObservacion, { user: { id: 3, roles: 'Consultor' }, params: { actividad_id: '50', semana: '8' } })).siguio, true);
    } finally { restaurar(); }
});

test('observaciones: un Director solo lee las de actividades de sus programas', async () => {
    const dueno = (programaDelDocente) => baseFalsa((sql) => {
        if (/FROM asignacion_actividades aa/.test(sql)) return { rows: [{ id_usuario: 7 }] };
        if (/FROM director_programa/.test(sql)) return { rows: [{ id_programa: 3 }] };
        if (/FROM usuarios WHERE id_usuario/.test(sql)) return { rows: programaDelDocente === 3 ? [{ uno: 1 }] : [] };
        return { rows: [] };
    });
    const req = { user: { id: 20, roles: 'Director' }, params: { actividad_id: '50', semana: '8' } };
    let restaurar = dueno(3);
    try { assert.equal((await correr(lecturaObservacion, req)).siguio, true); } finally { restaurar(); }
    restaurar = dueno(4);
    try { assert.equal((await correr(lecturaObservacion, { ...req, _alcanceProgramas: undefined })).codigo, 403); } finally { restaurar(); }
});

test('permisos de un rol: cada usuario solo los de sus roles; Planeación los de cualquiera', async () => {
    const restaurar = baseFalsa((sql) => (/FROM roles/.test(sql)
        ? { rows: [{ id_rol: 1, nombre_rol: 'Planeacion' }, { id_rol: 2, nombre_rol: 'Docente' }, { id_rol: 3, nombre_rol: 'Director' }] }
        : { rows: [] }));
    try {
        assert.equal((await correr(permisosDeSuRol, { user: { id: 7, roles: 'Docente' }, params: { id_rol: '2' } })).siguio, true);
        assert.equal((await correr(permisosDeSuRol, { user: { id: 7, roles: 'Docente' }, params: { id_rol: '1' } })).codigo, 403);
        assert.equal((await correr(permisosDeSuRol, { user: { id: 7, roles: 'Docente' }, params: { id_rol: 'undefined' } })).codigo, 403);
        assert.equal((await correr(permisosDeSuRol, { user: { id: 20, roles: 'Docente, Director' }, params: { id_rol: '3' } })).siguio, true);
        assert.equal((await correr(permisosDeSuRol, { user: { id: 1, roles: 'Planeacion' }, params: { id_rol: '2' } })).siguio, true);
    } finally { restaurar(); }
});

test('si la base falla, las guardias deniegan (500) y no dejan pasar', async () => {
    const restaurar = baseFalsa(() => { throw new Error('base caída'); });
    const silencio = console.error; console.error = () => {};
    try {
        assert.equal((await correr(permisosDeSuRol, { user: { id: 7, roles: 'Docente' }, params: { id_rol: '2' } })).siguio, false);
        assert.equal((await correr(lecturaObservacion, { user: { id: 7, roles: 'Docente' }, params: { actividad_id: '50' } })).siguio, false);
    } finally { restaurar(); console.error = silencio; }
});
