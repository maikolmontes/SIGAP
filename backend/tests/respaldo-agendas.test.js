// Respaldo previo al borrado de agendas: debe guardar todo y, si falla, avisar
// (el controlador cancela entonces la eliminación).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { respaldarAgendas } = require('../services/respaldoAgendasService');

const CARPETA = path.join(__dirname, '..', 'backups', 'agendas');

// Cliente falso: devuelve filas según la tabla consultada y recuerda lo que se guardó
const clienteFalso = () => {
    const guardados = [];
    return {
        guardados,
        async query(sql, params) {
            if (sql.includes('CREATE TABLE IF NOT EXISTS respaldos_agendas')) return { rows: [] };
            if (sql.includes('INSERT INTO respaldos_agendas')) {
                guardados.push({ motivo: params[0], periodo: params[1], conteos: JSON.parse(params[2]), datos: JSON.parse(params[3]) });
                return { rows: [{ id_respaldo: guardados.length }] };
            }
            if (sql.includes('FROM asignacion_funciones')) return { rows: [{ id_funciones: 1 }, { id_funciones: 2 }] };
            if (sql.includes('FROM usuario_asignacion')) return { rows: [{ id_usuario: 9, id_funciones: 1 }] };
            if (sql.includes('FROM asignacion_actividades')) return { rows: [{ id_asignacionact: 10 }, { id_asignacionact: 11 }] };
            if (sql.includes('FROM evidencias')) return { rows: [{ id_evidencias: 5 }] };
            return { rows: [] };
        },
    };
};

test('guarda en la base todo lo que se va a borrar y devuelve los conteos', async () => {
    const db = clienteFalso();
    const r = await respaldarAgendas(db, [1, 2], { motivo: 'prueba automática', periodo: 5 });
    try {
        assert.equal(db.guardados.length, 1);
        assert.equal(db.guardados[0].periodo, 5);
        assert.equal(db.guardados[0].conteos.funciones, 2);
        assert.equal(db.guardados[0].datos.asignacion_actividades.length, 2);
        assert.equal(db.guardados[0].datos.evidencias.length, 1);
        assert.equal(r.id_respaldo, 1);
        assert.equal(r.conteos.funciones, 2);
    } finally {
        fs.rmSync(path.join(CARPETA, r.archivo), { force: true });
    }
});

test('fuera de Vercel deja además la copia en disco', async () => {
    const r = await respaldarAgendas(clienteFalso(), [1, 2], { motivo: 'prueba disco', periodo: 5 });
    const ruta = path.join(CARPETA, r.archivo);
    try {
        assert.ok(fs.existsSync(ruta));
        const contenido = JSON.parse(fs.readFileSync(ruta, 'utf8'));
        assert.equal(contenido.conteos.evidencias, 1);
        assert.equal(contenido.id_respaldo, 1);
    } finally {
        fs.rmSync(ruta, { force: true });
    }
});

test('en Vercel (disco de solo lectura) el respaldo queda en la base y el borrado puede seguir', async () => {
    const antes = process.env.VERCEL;
    process.env.VERCEL = '1';
    try {
        const db = clienteFalso();
        const r = await respaldarAgendas(db, [1], { motivo: 'programa-Sistemas' });
        assert.equal(db.guardados.length, 1);
        assert.equal(r.archivo, 'respaldo #1');
    } finally {
        if (antes === undefined) delete process.env.VERCEL; else process.env.VERCEL = antes;
    }
});

test('el nombre del archivo no arrastra caracteres peligrosos del programa', async () => {
    const r = await respaldarAgendas(clienteFalso(), [1], { motivo: 'programa-../../Ingeniería de Sistemas' });
    try {
        assert.ok(!r.archivo.includes('..'));
        assert.ok(!r.archivo.includes('/'));
    } finally {
        fs.rmSync(path.join(CARPETA, r.archivo), { force: true });
    }
});

test('si no se puede guardar el respaldo en la base, el error se propaga (para cancelar el borrado)', async () => {
    const roto = { async query() { throw new Error('base caída'); } };
    await assert.rejects(() => respaldarAgendas(roto, [1], { motivo: 'x' }), /base caída/);
});
