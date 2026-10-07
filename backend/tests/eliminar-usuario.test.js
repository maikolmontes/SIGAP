// Regla de eliminación segura de usuarios: solo se elimina si no tiene datos relacionados.
// Se prueba con una "base falsa": no toca PostgreSQL.
const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db/connection');
const { consultarVinculosUsuario, motivosDeProteccion } = require('../controllers/usuariosController');

test.after(() => pool.end());

// Base falsa que responde según lo que se le pregunta
const baseFalsa = ({ referencias, cantidades, auditoriaExiste = true, esAdmin = false, otrosAdmin = false }) => ({
    async query(sql) {
        if (sql.includes('pg_constraint')) return { rows: referencias };
        if (sql.includes('to_regclass')) return { rows: [{ existe: auditoriaExiste }] };
        if (sql.startsWith('SELECT COUNT(*)')) {
            const tabla = Object.keys(cantidades).find((t) => sql.includes(`"${t}"`));
            return { rows: [{ n: tabla ? cantidades[tabla] : 0 }] };
        }
        if (sql.includes('FROM usuario_rol ur JOIN roles r') && sql.includes('LIMIT 1') && !sql.includes('u.activo')) {
            return { rows: esAdmin ? [{}] : [] };
        }
        if (sql.includes('u.activo = TRUE')) return { rows: otrosAdmin ? [{}] : [] };
        throw new Error('consulta inesperada: ' + sql.slice(0, 60));
    },
});

const ref = (tabla, columna) => ({ esquema: 'public', tabla, columna });

test('los vínculos de alta (rol, período) no bloquean', async () => {
    const db = baseFalsa({
        referencias: [ref('usuario_rol', 'id_usuario'), ref('docente_periodo', 'id_usuario'), ref('usuario_asignacion', 'id_usuario')],
        cantidades: { usuario_rol: 2, docente_periodo: 1, usuario_asignacion: 0 },
    });
    const v = await consultarVinculosUsuario(db, 5);
    assert.equal(v.bloqueantes.length, 0);
    assert.deepEqual(v.deAlta.map((x) => x.tabla).sort(), ['docente_periodo', 'usuario_rol']);
});

test('una función asignada en agenda bloquea, con su descripción', async () => {
    const db = baseFalsa({ referencias: [ref('usuario_asignacion', 'id_usuario')], cantidades: { usuario_asignacion: 3 } });
    const v = await consultarVinculosUsuario(db, 5);
    assert.equal(v.bloqueantes.length, 1);
    assert.equal(v.bloqueantes[0].cantidad, 3);
    assert.match(v.bloqueantes[0].descripcion, /agendas/i);
});

test('una tabla NUEVA que apunte a usuarios también bloquea (sin tocar el código)', async () => {
    const db = baseFalsa({ referencias: [ref('tabla_del_futuro', 'creado_por')], cantidades: { tabla_del_futuro: 1 } });
    const v = await consultarVinculosUsuario(db, 5);
    assert.equal(v.bloqueantes.length, 1);
    assert.equal(v.bloqueantes[0].descripcion, 'Registros en tabla_del_futuro');
});

test('las acciones registradas en la auditoría bloquean aunque no haya clave foránea', async () => {
    const db = baseFalsa({ referencias: [], cantidades: { auditoria: 4 } });
    const v = await consultarVinculosUsuario(db, 5);
    assert.equal(v.bloqueantes.length, 1);
    assert.equal(v.bloqueantes[0].tabla, 'auditoria');
});

test('un usuario sin ningún dato queda sin bloqueos', async () => {
    const db = baseFalsa({ referencias: [ref('usuario_asignacion', 'id_usuario'), ref('observaciones_director', 'director_id')], cantidades: {} });
    const v = await consultarVinculosUsuario(db, 5);
    assert.equal(v.bloqueantes.length, 0);
    assert.equal(v.deAlta.length, 0);
});

test('no se puede eliminar al propio usuario', async () => {
    const motivos = await motivosDeProteccion(baseFalsa({ referencias: [], cantidades: {} }), 7, 7);
    assert.equal(motivos.length, 1);
    assert.match(motivos[0], /propio usuario/);
});

test('no se puede eliminar al único usuario activo de Planeación', async () => {
    const motivos = await motivosDeProteccion(baseFalsa({ referencias: [], cantidades: {}, esAdmin: true, otrosAdmin: false }), 7, 1);
    assert.equal(motivos.length, 1);
    assert.match(motivos[0], /único usuario activo de Planeación/);
});

test('un Planeación SÍ se puede eliminar si hay otro activo', async () => {
    const motivos = await motivosDeProteccion(baseFalsa({ referencias: [], cantidades: {}, esAdmin: true, otrosAdmin: true }), 7, 1);
    assert.equal(motivos.length, 0);
});
