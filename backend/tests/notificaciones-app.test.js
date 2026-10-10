// Notificaciones dentro de la aplicación (la campana): reglas con una base falsa, sin PostgreSQL.
const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db/connection');
const app = require('../services/notificacionesApp');

test.after(() => pool.end());

// Base falsa: guarda las notificaciones en memoria e interpreta las consultas que usa el servicio
const baseFalsa = () => {
    const filas = [];
    let id = 0;
    return {
        filas,
        async query(sql, p = []) {
            if (/CREATE (TABLE|INDEX)/.test(sql)) return { rows: [] };
            if (/^\s*SELECT 1 FROM notificaciones_app/.test(sql)) {
                return { rows: filas.filter((f) => f.id_usuario === p[0] && f.clave === p[1] && !f.leida).slice(0, 1) };
            }
            if (/^\s*INSERT INTO notificaciones_app/.test(sql)) {
                filas.push({ id_notificacion: ++id, id_usuario: p[0], tipo: p[1], titulo: p[2], mensaje: p[3], enlace: p[4], clave: p[5], leida: false });
                return { rows: [], rowCount: 1 };
            }
            if (/^\s*UPDATE notificaciones_app SET leida = TRUE, leida_en = NOW\(\)\s+WHERE id_notificacion/.test(sql)) {
                const f = filas.find((x) => x.id_notificacion === p[0] && x.id_usuario === p[1] && !x.leida);
                if (f) f.leida = true;
                return { rowCount: f ? 1 : 0 };
            }
            if (/^\s*UPDATE notificaciones_app SET leida = TRUE/.test(sql)) {
                const mias = filas.filter((x) => x.id_usuario === p[0] && !x.leida);
                mias.forEach((x) => { x.leida = true; });
                return { rowCount: mias.length };
            }
            if (/COUNT\(\*\)/.test(sql)) return { rows: [{ n: String(filas.filter((f) => f.id_usuario === p[0] && !f.leida).length) }] };
            if (/^\s*DELETE FROM notificaciones_app WHERE id_notificacion/.test(sql)) {
                const i = filas.findIndex((x) => x.id_notificacion === p[0] && x.id_usuario === p[1]);
                if (i >= 0) filas.splice(i, 1);
                return { rowCount: i >= 0 ? 1 : 0 };
            }
            if (/^\s*DELETE FROM notificaciones_app WHERE id_usuario = \$1( AND leida = TRUE)?\s*$/.test(sql)) {
                const soloLeidas = /leida = TRUE/.test(sql);
                const antes = filas.length;
                for (let i = filas.length - 1; i >= 0; i--) {
                    if (filas[i].id_usuario === p[0] && (!soloLeidas || filas[i].leida)) filas.splice(i, 1);
                }
                return { rowCount: antes - filas.length };
            }
            if (/^\s*DELETE FROM notificaciones_app/.test(sql)) return { rowCount: 0 }; // limpieza automática de antiguas
            if (/^\s*SELECT id_notificacion AS id/.test(sql)) {
                return { rows: filas.filter((f) => f.id_usuario === p[0]).reverse().slice(0, p[1]).map((f) => ({ id: f.id_notificacion, ...f })) };
            }
            throw new Error('consulta inesperada: ' + sql.slice(0, 60));
        },
    };
};

const aviso = (extra = {}) => ({ idUsuario: 5, tipo: 'agenda_aprobada', titulo: 'Tu agenda fue aprobada', enlace: '/docente/agenda', ...extra });

test('crea una notificación para el usuario y la cuenta como no leída', async () => {
    const db = baseFalsa();
    assert.equal(await app.crear(aviso(), db), true);
    assert.equal(await app.contarNoLeidas(5, db), 1);
    assert.equal(await app.contarNoLeidas(6, db), 0);
});

test('no crea dos avisos con la misma clave mientras el primero siga sin leer', async () => {
    const db = baseFalsa();
    assert.equal(await app.crear(aviso({ clave: 'agenda_enviada:9' }), db), true);
    assert.equal(await app.crear(aviso({ clave: 'agenda_enviada:9' }), db), false);
    await app.marcarTodasLeidas(5, db);
    assert.equal(await app.crear(aviso({ clave: 'agenda_enviada:9' }), db), true, 'leído el anterior, puede volver a avisar');
    assert.equal(db.filas.length, 2);
});

test('cada usuario solo marca como leídas las suyas', async () => {
    const db = baseFalsa();
    await app.crear(aviso({ idUsuario: 5 }), db);
    await app.crear(aviso({ idUsuario: 6 }), db);
    assert.equal(await app.marcarLeida(6, db.filas[0].id_notificacion, db), 0, 'la de otro usuario no se toca');
    assert.equal(await app.marcarLeida(5, db.filas[0].id_notificacion, db), 1);
    assert.equal(await app.marcarTodasLeidas(6, db), 1);
    assert.equal(await app.contarNoLeidas(5, db), 0);
});

test('lista las más recientes primero y entrega el contador', async () => {
    const db = baseFalsa();
    await app.crear(aviso({ titulo: 'primera' }), db);
    await app.crear(aviso({ titulo: 'segunda' }), db);
    const r = await app.listar(5, 20, db);
    assert.deepEqual(r.notificaciones.map((n) => n.titulo), ['segunda', 'primera']);
    assert.equal(r.no_leidas, 2);
});

test('una notificación nunca rompe el flujo: si la base falla, devuelve false', async () => {
    const rota = { async query() { throw new Error('base caída'); } };
    assert.equal(await app.crear(aviso(), rota), false);
});

test('ignora datos incompletos y crea una sola vez por usuario en los avisos a varios', async () => {
    const db = baseFalsa();
    assert.equal(await app.crear({ idUsuario: null, tipo: 'x', titulo: 'y' }, db), false);
    assert.equal(await app.crear({ idUsuario: 5, tipo: 'x' }, db), false);
    const n = await app.crearParaVarios([5, 5, '6', 0, null], { tipo: 'x', titulo: 'aviso' }, db);
    assert.equal(n, 2);
});

test('los textos largos se recortan', async () => {
    const db = baseFalsa();
    await app.crear(aviso({ titulo: 'T'.repeat(500), mensaje: 'M'.repeat(2000) }), db);
    assert.ok(db.filas[0].titulo.length <= 200);
    assert.ok(db.filas[0].mensaje.length <= 600);
});

test('el usuario borra una de sus notificaciones, pero no las de otro', async () => {
    const db = baseFalsa();
    await app.crear(aviso({ idUsuario: 5 }), db);
    await app.crear(aviso({ idUsuario: 6 }), db);
    assert.equal(await app.eliminar(6, db.filas[0].id_notificacion, db), 0, 'no puede borrar la de otro usuario');
    assert.equal(db.filas.length, 2);
    assert.equal(await app.eliminar(5, db.filas[0].id_notificacion, db), 1);
    assert.equal(db.filas.length, 1);
});

test('vaciar la campana borra solo las del usuario; "solo leídas" conserva las nuevas', async () => {
    const db = baseFalsa();
    await app.crear(aviso({ idUsuario: 5, titulo: 'a' }), db);
    await app.crear(aviso({ idUsuario: 5, titulo: 'b' }), db);
    await app.crear(aviso({ idUsuario: 6, titulo: 'ajena' }), db);
    await app.marcarLeida(5, db.filas[0].id_notificacion, db);

    assert.equal(await app.eliminarTodas(5, true, db), 1, 'solo la leída');
    assert.deepEqual(db.filas.filter((f) => f.id_usuario === 5).map((f) => f.titulo), ['b']);

    assert.equal(await app.eliminarTodas(5, false, db), 1);
    assert.equal(db.filas.filter((f) => f.id_usuario === 5).length, 0);
    assert.equal(db.filas.filter((f) => f.id_usuario === 6).length, 1, 'las de otro usuario siguen ahí');
});

// ---------------- Observaciones del director ----------------

// Añade a la base falsa las dos consultas del aviso: dueño de la actividad y nombre del director
const conActividades = (db, actividades, usuarios = { 9: 'Ana Directora' }) => ({
    filas: db.filas,
    async query(sql, p = []) {
        if (/FROM asignacion_actividades aa/.test(sql)) return { rows: actividades.filter((a) => a.id === p[0]).slice(0, 1) };
        if (/FROM usuarios WHERE id_usuario/.test(sql)) return { rows: usuarios[p[0]] ? [{ nombre: usuarios[p[0]] }] : [] };
        return db.query(sql, p);
    },
});
const ACTIVIDAD = { id: 100, id_docente: 5, actividad: 'Gestión Curricular', semestre: 1 };

test('observación del director: el aviso llega al docente dueño de la actividad, con el corte y el enlace al reporte', async () => {
    const db = conActividades(baseFalsa(), [ACTIVIDAD]);
    const creada = await app.avisarObservacionDirector({ idActividad: 100, semana: 8, idDirector: 9, texto: 'Falta adjuntar el acta.' }, db);
    assert.equal(creada, true);
    assert.equal(db.filas.length, 1);
    const n = db.filas[0];
    assert.equal(n.id_usuario, 5, 'va al docente, no al director');
    assert.equal(n.tipo, 'observacion_director');
    assert.match(n.titulo, /Semana 8/);
    assert.match(n.mensaje, /Ana Directora/);
    assert.match(n.mensaje, /Gestión Curricular/);
    assert.match(n.mensaje, /Falta adjuntar el acta\./);
    assert.equal(n.enlace, '/docente/avance-semana-8');
});

test('observación del director: en el corte 16 el enlace va al reporte de la semana 16', async () => {
    const db = conActividades(baseFalsa(), [ACTIVIDAD]);
    await app.avisarObservacionDirector({ idActividad: 100, semana: 16, idDirector: 9, texto: 'Revisar.' }, db);
    assert.equal(db.filas[0].enlace, '/docente/avance-semana-16');
});

test('observación del director: en un intersemestral el corte se llama "Semana X"', async () => {
    const db = conActividades(baseFalsa(), [{ ...ACTIVIDAD, semestre: 3 }]);
    await app.avisarObservacionDirector({ idActividad: 100, semana: 8, idDirector: 9, texto: 'Revisar.' }, db);
    assert.match(db.filas[0].titulo, /Semana X/);
    assert.doesNotMatch(db.filas[0].titulo, /Semana 8/);
});

test('observación del director: varias seguidas en la misma actividad y corte no llenan la campana', async () => {
    const db = conActividades(baseFalsa(), [ACTIVIDAD]);
    assert.equal(await app.avisarObservacionDirector({ idActividad: 100, semana: 8, idDirector: 9, texto: 'Primera.' }, db), true);
    assert.equal(await app.avisarObservacionDirector({ idActividad: 100, semana: 8, idDirector: 9, texto: 'Segunda.' }, db), false);
    assert.equal(db.filas.length, 1);
    // Otro corte sí es otro aviso
    assert.equal(await app.avisarObservacionDirector({ idActividad: 100, semana: 16, idDirector: 9, texto: 'Otra.' }, db), true);
    // Y cuando el docente ya leyó el primero, una nueva observación vuelve a avisar
    db.filas[0].leida = true;
    assert.equal(await app.avisarObservacionDirector({ idActividad: 100, semana: 8, idDirector: 9, texto: 'Tercera.' }, db), true);
});

test('observación del director: sin dueño de la actividad, o si el docente es quien escribe, no se avisa', async () => {
    const db = conActividades(baseFalsa(), [ACTIVIDAD]);
    assert.equal(await app.avisarObservacionDirector({ idActividad: 999, semana: 8, idDirector: 9, texto: 'x' }, db), false);
    assert.equal(await app.avisarObservacionDirector({ idActividad: 100, semana: 8, idDirector: 5, texto: 'x' }, db), false);
    assert.equal(db.filas.length, 0);
});

test('observación del director: un texto largo se recorta en el aviso', async () => {
    const db = conActividades(baseFalsa(), [ACTIVIDAD]);
    await app.avisarObservacionDirector({ idActividad: 100, semana: 8, idDirector: 9, texto: 'a'.repeat(900) }, db);
    assert.ok(db.filas[0].mensaje.length <= 600);
});
