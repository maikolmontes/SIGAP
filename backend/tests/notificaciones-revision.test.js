// Avisos de revisión de cortes, asignaciones y semanas (services/notificacionesService.js):
// cada uno debe llegar a la campana Y al correo. Con una base falsa y el correo desactivado, sin PostgreSQL ni envíos reales.
process.env.EMAIL_ENABLED = 'false'; // antes de cargar el servicio: ningún correo sale de verdad
const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db/connection');
const servicio = require('../services/notificacionesService');
const plantillas = require('../utils/emailTemplates');

test.after(() => pool.end());

const USUARIOS = {
    1: { id_usuario: 1, correo: 'ana@cesmag.edu.co', nombre_completo: 'Ana Docente', id_programa: 7, nombre_programa: 'Ingeniería de Sistemas' },
    2: { id_usuario: 2, correo: 'luis@cesmag.edu.co', nombre_completo: 'Luis Director', id_programa: 7, nombre_programa: 'Ingeniería de Sistemas' },
    3: { id_usuario: 3, correo: 'eva@cesmag.edu.co', nombre_completo: 'Eva Directora', id_programa: 7, nombre_programa: 'Ingeniería de Sistemas' },
    4: { id_usuario: 4, correo: 'rita@cesmag.edu.co', nombre_completo: 'Rita Revisora', id_programa: 7, nombre_programa: 'Ingeniería de Sistemas' },
    5: { id_usuario: 5, correo: null, nombre_completo: 'Sin Correo', id_programa: 7, nombre_programa: 'Ingeniería de Sistemas' },
};

// Base falsa: campana, bitácora de correos y las consultas de datos que usa el servicio
const baseFalsa = (cfg = {}) => {
    const campana = [];
    const bitacora = []; // { tipo, clave, destinatario, asunto, estado }
    const config = {
        semestre: 2,
        directores: [USUARIOS[2], USUARIOS[3]],
        docentesConAgenda: [USUARIOS[1], USUARIOS[5]],
        agendaVisible: true,
        cortes: [],
        pendientes: [USUARIOS[1]],
        ...cfg,
    };
    pool.query = async (sql, p = []) => {
        if (/CREATE (TABLE|INDEX)|ALTER TABLE/.test(sql)) return { rows: [] };
        // campana
        if (/^\s*SELECT 1 FROM notificaciones_app/.test(sql)) {
            return { rows: campana.filter((f) => f.id_usuario === p[0] && f.clave === p[1] && !f.leida).slice(0, 1) };
        }
        if (/^\s*INSERT INTO notificaciones_app/.test(sql)) {
            campana.push({ id_usuario: p[0], tipo: p[1], titulo: p[2], mensaje: p[3], enlace: p[4], clave: p[5], leida: false });
            return { rows: [], rowCount: 1 };
        }
        // bitácora de correos
        if (/^\s*SELECT 1 FROM notificaciones_log/.test(sql)) {
            return { rows: bitacora.filter((b) => b.clave === p[0] && b.estado === 'enviado').slice(0, 1) };
        }
        if (/^\s*DELETE FROM notificaciones_log/.test(sql)) {
            for (let i = bitacora.length - 1; i >= 0; i--) if (bitacora[i].clave === p[0]) bitacora.splice(i, 1);
            return { rowCount: 1 };
        }
        if (/^\s*INSERT INTO notificaciones_log/.test(sql)) {
            bitacora.push({ tipo: p[0], clave: p[1], destinatario: p[2], asunto: p[3], estado: p[4], remitente: p[6] });
            return { rows: [], rowCount: 1 };
        }
        // datos
        if (/FROM periodo WHERE activo/.test(sql)) return { rows: [{ id_periodo: 10, anio: 2026, semestre: config.semestre, fecha_inicio: '2026-07-10', fecha_fin: '2026-12-31' }] };
        if (/LEFT JOIN programa_academico pa/.test(sql)) return { rows: USUARIOS[p[0]] ? [USUARIOS[p[0]]] : [] };
        if (/director_programa/.test(sql)) return { rows: config.directores };
        if (/LIKE '%planea%'/.test(sql)) return { rows: [] };
        if (/SELECT af.id_funciones, af.funcion_sustantiva, af.id_periodo, ua.id_usuario AS id_docente/.test(sql)) {
            return { rows: [{ id_funciones: p[0], funcion_sustantiva: 'Docencia Directa', id_periodo: 10, id_docente: 1, anio: 2026, semestre: config.semestre }] };
        }
        if (/af.estado_agenda <> 'Por Aprobar' LIMIT 1/.test(sql)) return { rows: config.agendaVisible ? [{ '?column?': 1 }] : [] };
        if (/NOT EXISTS/.test(sql)) return { rows: config.pendientes };
        if (/estado_agenda <> 'Por Aprobar' AND u.activo = TRUE/.test(sql)) return { rows: config.docentesConAgenda };
        if (/FROM semana/.test(sql)) return { rows: config.cortes };
        throw new Error('consulta inesperada: ' + sql.replace(/\s+/g, ' ').slice(0, 90));
    };
    return { campana, bitacora, config };
};

const deUsuario = (campana, id) => campana.filter((c) => c.id_usuario === id);
const correosA = (bitacora, correo) => bitacora.filter((b) => b.destinatario === correo);

// ---- Corte aprobado / devuelto ➔ docente ----
test('corte aprobado: el docente recibe campana y correo con el enlace a su reporte', async () => {
    const db = baseFalsa();
    await servicio.notificarCorteRevisado({ idFunciones: 100, semana: 8, estado: 'Aprobado', idRevisor: 2 });
    const [aviso] = deUsuario(db.campana, 1);
    assert.equal(aviso.tipo, 'corte_aprobado');
    assert.equal(aviso.enlace, '/docente/avance-semana-8');
    assert.match(aviso.mensaje, /Docencia Directa/);
    assert.match(aviso.titulo, /Semana 8/);
    const [correo] = correosA(db.bitacora, 'ana@cesmag.edu.co');
    assert.equal(correo.tipo, 'corte_aprobado');
    assert.match(correo.asunto, /aprobado/i);
});

test('corte devuelto: campana y correo llevan el motivo y reinician el aviso de "avance guardado"', async () => {
    const db = baseFalsa();
    db.bitacora.push({ tipo: 'avance_guardado', clave: 'avance_guardado:1:10:16', destinatario: 'luis@cesmag.edu.co', estado: 'enviado' });
    await servicio.notificarCorteRevisado({ idFunciones: 100, semana: 16, estado: 'Devuelto', idRevisor: 2, observacion: 'Falta el acta firmada' });
    const [aviso] = deUsuario(db.campana, 1);
    assert.equal(aviso.tipo, 'corte_devuelto');
    assert.equal(aviso.enlace, '/docente/avance-semana-16');
    assert.match(aviso.mensaje, /Falta el acta firmada/);
    assert.ok(correosA(db.bitacora, 'ana@cesmag.edu.co').some((b) => b.tipo === 'corte_devuelto'));
    assert.ok(!db.bitacora.some((b) => b.clave === 'avance_guardado:1:10:16'), 'el docente debe poder volver a avisar al guardar');
});

test('en un intersemestral el corte también se llama "Semana 8"', async () => {
    const db = baseFalsa({ semestre: 3 });
    await servicio.notificarCorteRevisado({ idFunciones: 100, semana: 8, estado: 'Aprobado', idRevisor: 2 });
    assert.match(deUsuario(db.campana, 1)[0].titulo, /Semana 8/);
});

test('un estado que no es Aprobado ni Devuelto no avisa', async () => {
    const db = baseFalsa();
    const r = await servicio.notificarCorteRevisado({ idFunciones: 100, semana: 8, estado: 'Visto bueno' });
    assert.equal(r.motivo, 'estado_sin_aviso');
    assert.equal(db.campana.length, 0);
});

// ---- Visto bueno de un corte ➔ directores ----
test('visto bueno de un corte: campana y correo a los directores, sin avisar al propio revisor', async () => {
    const db = baseFalsa({ directores: [USUARIOS[2], USUARIOS[3], USUARIOS[4]] });
    await servicio.notificarVistoBuenoCorte({ idFunciones: 100, semana: 8, idRevisor: 4 });
    assert.equal(deUsuario(db.campana, 2)[0].tipo, 'corte_visto_bueno');
    assert.equal(deUsuario(db.campana, 3).length, 1);
    assert.equal(deUsuario(db.campana, 4).length, 0, 'el revisor no se avisa a sí mismo');
    assert.equal(deUsuario(db.campana, 2)[0].enlace, '/director/agendas/1/semana/8');
    assert.equal(correosA(db.bitacora, 'luis@cesmag.edu.co').length, 1);
    assert.equal(correosA(db.bitacora, 'rita@cesmag.edu.co').length, 0);
});

test('visto bueno de un corte: no se repite mientras ya se avisó, y retirarlo permite avisar de nuevo', async () => {
    const db = baseFalsa();
    db.bitacora.push({ tipo: 'corte_visto_bueno', clave: 'corte_visto:100:8', destinatario: 'luis@cesmag.edu.co', estado: 'enviado' });
    const repetido = await servicio.notificarVistoBuenoCorte({ idFunciones: 100, semana: 8, idRevisor: 4 });
    assert.equal(repetido.motivo, 'ya_notificado');
    assert.equal(db.campana.length, 0);

    await servicio.reiniciarAvisoVistoCorte(100, 8);
    await servicio.notificarVistoBuenoCorte({ idFunciones: 100, semana: 8, idRevisor: 4 });
    assert.equal(deUsuario(db.campana, 2).length, 1);
});

// ---- El docente guardó su avance ➔ directores ----
test('avance guardado: campana y correo a los directores del programa, con enlace al corte del docente', async () => {
    const db = baseFalsa();
    await servicio.notificarAvanceGuardado({ idDocente: 1, semana: 16 });
    for (const id of [2, 3]) {
        const [aviso] = deUsuario(db.campana, id);
        assert.equal(aviso.tipo, 'avance_guardado');
        assert.equal(aviso.enlace, '/director/agendas/1/semana/16');
        assert.match(aviso.mensaje, /Ana Docente/);
    }
    assert.equal(correosA(db.bitacora, 'luis@cesmag.edu.co')[0].tipo, 'avance_guardado');
    assert.equal(correosA(db.bitacora, 'eva@cesmag.edu.co').length, 1);
});

test('avance guardado: un solo aviso por docente y corte, y no se avisa a quien es su propio director', async () => {
    const db = baseFalsa({ directores: [USUARIOS[1], USUARIOS[2]] });
    await servicio.notificarAvanceGuardado({ idDocente: 1, semana: 8 });
    assert.equal(deUsuario(db.campana, 1).length, 0, 'un director que es también el docente no se avisa a sí mismo');
    assert.equal(deUsuario(db.campana, 2).length, 1);

    db.bitacora.push({ tipo: 'avance_guardado', clave: 'avance_guardado:1:10:8', destinatario: 'luis@cesmag.edu.co', estado: 'enviado' });
    const otra = await servicio.notificarAvanceGuardado({ idDocente: 1, semana: 8 });
    assert.equal(otra.motivo, 'ya_notificado');
    assert.equal(deUsuario(db.campana, 2).length, 1, 'no se crea otro aviso');
});

test('avance guardado: solo los cortes 8 y 16', async () => {
    baseFalsa();
    assert.equal((await servicio.notificarAvanceGuardado({ idDocente: 1, semana: 0 })).motivo, 'corte_invalido');
});

// ---- Asignaciones ----
test('asignaciones aprobadas: el docente recibe campana y correo de que su agenda ya está disponible', async () => {
    const db = baseFalsa();
    await servicio.notificarAsignacionesAprobadas({ idDocente: 1, idDirector: 2 });
    const [aviso] = deUsuario(db.campana, 1);
    assert.equal(aviso.tipo, 'asignaciones_aprobadas');
    assert.equal(aviso.enlace, '/docente/agenda');
    assert.equal(correosA(db.bitacora, 'ana@cesmag.edu.co')[0].tipo, 'asignaciones_aprobadas');
});

test('asignaciones aprobadas: sin correo registrado igual llega a la campana', async () => {
    const db = baseFalsa();
    const r = await servicio.notificarAsignacionesAprobadas({ idDocente: 5, idDirector: 2 });
    assert.equal(r.motivo, 'docente_sin_correo');
    assert.equal(deUsuario(db.campana, 5).length, 1);
});

test('horas corregidas: solo avisa si el docente ya ve su agenda', async () => {
    const oculta = baseFalsa({ agendaVisible: false });
    const r = await servicio.notificarAsignacionesCorregidas({ idDocente: 1, idDirector: 2, cantidad: 2 });
    assert.equal(r.motivo, 'agenda_aun_oculta');
    assert.equal(oculta.campana.length, 0);

    const visible = baseFalsa({ agendaVisible: true });
    await servicio.notificarAsignacionesCorregidas({ idDocente: 1, idDirector: 2, cantidad: 2 });
    assert.equal(deUsuario(visible.campana, 1)[0].tipo, 'asignaciones_corregidas');
    assert.match(deUsuario(visible.campana, 1)[0].mensaje, /2 actividades/);
    assert.equal(correosA(visible.bitacora, 'ana@cesmag.edu.co').length, 1);
});

test('visto bueno de las asignaciones: campana y correo a los directores, una vez hasta que se retire', async () => {
    const db = baseFalsa();
    await servicio.notificarVistoBuenoAsignacion({ idDocente: 1, idFunciones: 100, idRevisor: 4 });
    assert.equal(deUsuario(db.campana, 2)[0].tipo, 'visto_bueno_asignacion');
    assert.equal(deUsuario(db.campana, 2)[0].enlace, '/director/agendas/1');
    assert.equal(correosA(db.bitacora, 'eva@cesmag.edu.co').length, 1);

    db.bitacora.push({ tipo: 'visto_bueno_asignacion', clave: 'visto_asignacion:100', destinatario: 'luis@cesmag.edu.co', estado: 'enviado' });
    assert.equal((await servicio.notificarVistoBuenoAsignacion({ idDocente: 1, idFunciones: 100, idRevisor: 4 })).motivo, 'ya_notificado');
    await servicio.reiniciarAvisoVistoAsignacion(100);
    assert.ok(!db.bitacora.some((b) => b.clave === 'visto_asignacion:100'));
});

// ---- Semanas ----
test('semana habilitada: la campana avisa a todos los docentes con agenda, y el correo solo si se pide', async () => {
    const sinCorreo = baseFalsa();
    await servicio.notificarSemanaHabilitada({ semanas: [{ numero_semana: '8', fecha_inicio: '2026-09-01', fecha_fin: '2026-09-10' }], correo: false });
    for (const id of [1, 5]) {
        const [aviso] = deUsuario(sinCorreo.campana, id);
        assert.equal(aviso.tipo, 'semana_habilitada');
        assert.equal(aviso.enlace, '/docente/avance-semana-8');
        assert.match(aviso.titulo, /Semana 8/);
    }
    assert.equal(sinCorreo.bitacora.length, 0, 'el correo masivo no sale sin pedirlo');

    const conCorreo = baseFalsa();
    await servicio.notificarSemanaHabilitada({ semanas: [{ numero_semana: '16' }], correo: true, idRemitente: 2 });
    assert.equal(correosA(conCorreo.bitacora, 'ana@cesmag.edu.co').length, 1);
    assert.equal(correosA(conCorreo.bitacora, 'ana@cesmag.edu.co')[0].tipo, 'semana_habilitada');
    assert.equal(deUsuario(conCorreo.campana, 5).length, 1, 'quien no tiene correo igual ve la campana');
});

test('semana 0: avisa que se abrió el registro de la agenda; una semana inválida se ignora', async () => {
    const db = baseFalsa();
    await servicio.notificarSemanaHabilitada({ semanas: [{ numero_semana: '0' }, { numero_semana: '99' }], correo: false });
    const [aviso] = deUsuario(db.campana, 1);
    assert.match(aviso.titulo, /registro de tu agenda/);
    assert.equal(aviso.enlace, '/docente/agenda');
    assert.equal(deUsuario(db.campana, 1).length, 1);
});

test('corte por cerrar: avisa por campana y correo a quien aún no registra avance', async () => {
    const db = baseFalsa({ cortes: [{ numero_semana: '8', fecha_fin: '2026-10-12' }], pendientes: [USUARIOS[1], USUARIOS[5]] });
    const r = await servicio.notificarCortesPorCerrar({ dias: 3 });
    assert.equal(r.cortes, 1);
    assert.equal(r.total, 2);
    assert.equal(deUsuario(db.campana, 1)[0].tipo, 'corte_por_cerrar');
    assert.equal(deUsuario(db.campana, 1)[0].enlace, '/docente/avance-semana-8');
    assert.equal(deUsuario(db.campana, 5).length, 1);
    assert.equal(correosA(db.bitacora, 'ana@cesmag.edu.co')[0].tipo, 'corte_por_cerrar');
});

test('corte por cerrar: sin cortes próximos no avisa a nadie', async () => {
    const db = baseFalsa({ cortes: [] });
    assert.equal((await servicio.notificarCortesPorCerrar({ dias: 3 })).motivo, 'sin_cortes_por_cerrar');
    assert.equal(db.campana.length, 0);
});

test('corte por cerrar: con correo en false solo llega la campana', async () => {
    const db = baseFalsa({ cortes: [{ numero_semana: '16', fecha_fin: '2026-12-10' }] });
    await servicio.notificarCortesPorCerrar({ dias: 3, correo: false });
    assert.equal(deUsuario(db.campana, 1).length, 1);
    assert.equal(db.bitacora.length, 0);
});

// ---- Plantilla genérica ----
test('la plantilla de aviso escapa los datos de usuario y conserva los saltos de línea', () => {
    const { subject, html } = plantillas.plantillaAviso({
        asunto: 'Asunto', titulo: 'Título', nombre: 'Ana <b>', parrafo: 'Texto & más',
        datos: [['Docente', '<i>Ana</i>']], recuadro: { titulo: 'Motivo', texto: '<script>x</script>\nSegunda línea' },
        boton: { texto: 'Ir', enlace: 'http://localhost:5173/docente/agenda' },
    });
    assert.equal(subject, 'Asunto');
    assert.ok(html.includes('Ana &lt;b&gt;') && html.includes('&lt;i&gt;Ana&lt;/i&gt;'));
    assert.ok(!html.includes('<script>x</script>') && html.includes('&lt;script&gt;'));
    assert.ok(html.includes('<br>'));
    assert.ok(html.includes('href="http://localhost:5173/docente/agenda"'));
});
