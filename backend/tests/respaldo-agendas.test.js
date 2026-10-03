// Respaldo previo al borrado de agendas: debe guardar todo y, si falla, avisar
// (el controlador cancela entonces la eliminación).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { respaldarAgendas } = require('../services/respaldoAgendasService');

const CARPETA = path.join(__dirname, '..', 'backups', 'agendas');

// Cliente falso: devuelve filas según la tabla consultada
const clienteFalso = () => ({
    async query(sql) {
        if (sql.includes('FROM asignacion_funciones')) return { rows: [{ id_funciones: 1 }, { id_funciones: 2 }] };
        if (sql.includes('FROM usuario_asignacion')) return { rows: [{ id_usuario: 9, id_funciones: 1 }] };
        if (sql.includes('FROM asignacion_actividades')) return { rows: [{ id_asignacionact: 10 }, { id_asignacionact: 11 }] };
        if (sql.includes('FROM evidencias')) return { rows: [{ id_evidencias: 5 }] };
        return { rows: [] };
    },
});

test('guarda un JSON con todo lo que se va a borrar y devuelve los conteos', async () => {
    const r = await respaldarAgendas(clienteFalso(), [1, 2], { motivo: 'prueba automática', periodo: 5 });
    const ruta = path.join(CARPETA, r.archivo);
    try {
        assert.ok(fs.existsSync(ruta));
        const contenido = JSON.parse(fs.readFileSync(ruta, 'utf8'));
        assert.equal(contenido.conteos.funciones, 2);
        assert.equal(contenido.conteos.actividades, 2);
        assert.equal(contenido.conteos.evidencias, 1);
        assert.equal(contenido.periodo, 5);
        assert.equal(r.conteos.funciones, 2);
    } finally {
        fs.rmSync(ruta, { force: true });
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

test('si la consulta falla, el error se propaga (para cancelar el borrado)', async () => {
    const roto = { async query() { throw new Error('base caída'); } };
    await assert.rejects(() => respaldarAgendas(roto, [1], { motivo: 'x' }), /base caída/);
});
