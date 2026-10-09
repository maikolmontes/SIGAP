// Reglas del balance de gestión: estado de la agenda, porcentajes y consultas con base falsa.
const test = require('node:test');
const assert = require('node:assert/strict');
const { estadoAgenda, porcentaje, construirBalance, BalanceError } = require('../services/balanceGestion');

test('el estado de la agenda sigue la misma precedencia que la analítica', () => {
    const base = { funciones: 2, alguna_devuelta: false, todas_aprobadas: false, todas_diligenciadas: false };
    assert.equal(estadoAgenda({ ...base, funciones: 0 }), 'Sin agenda');
    assert.equal(estadoAgenda({ ...base, alguna_devuelta: true, todas_aprobadas: true }), 'Devuelta', 'una función devuelta marca toda la agenda');
    assert.equal(estadoAgenda({ ...base, todas_aprobadas: true, todas_diligenciadas: true }), 'Aprobada');
    assert.equal(estadoAgenda({ ...base, todas_diligenciadas: true }), 'En revisión');
    assert.equal(estadoAgenda(base), 'Pendiente');
});

test('los porcentajes no dividen por cero ni inventan datos', () => {
    assert.equal(porcentaje(2, 8), 25);
    assert.equal(porcentaje(1, 3), 33.3);
    assert.equal(porcentaje(5, 0), null, 'sin meta no hay porcentaje');
    assert.equal(porcentaje(0, 10), 0);
    assert.equal(porcentaje(3, null), null);
});

// Base falsa: responde según el texto de la consulta
const baseFalsa = ({ programa = true, periodo = true, docentes = [], funciones = [], actividades = [], evidencias = [], revision = [], observaciones = [] } = {}) => ({
    query: async (sql) => {
        if (/FROM programa_academico pa/.test(sql)) return { rows: programa ? [{ id_programa: 1, nombre_programa: 'Ingeniería de Sistemas', nombre_facultad: 'Ingeniería' }] : [] };
        if (/FROM periodo WHERE id_periodo/.test(sql)) return { rows: periodo ? [{ id_periodo: 9, anio: 2026, semestre: 3, fecha_inicio: '2026-06-01', fecha_fin: '2026-07-30', activo: true }] : [] };
        if (/FROM director_programa/.test(sql)) return { rows: [{ nombre: 'Ana Directora' }] };
        if (/FROM docente_periodo dp/.test(sql)) return { rows: docentes };
        if (/SUM\(COALESCE\(af\.horas_funcion, 0\)\)::numeric AS horas/.test(sql)) return { rows: funciones };
        if (/FROM revision_corte/.test(sql)) return { rows: revision };
        if (/FROM observaciones_director/.test(sql)) return { rows: observaciones };
        if (/e\.nombre_archivo/.test(sql)) return { rows: evidencias };
        if (/espacio_academico/.test(sql)) return { rows: actividades };
        throw new Error('consulta no prevista: ' + sql.slice(0, 80));
    },
});

const docente = (extra) => ({
    docente: 'Docente Uno', tipo_contrato: 'Tiempo Completo', horas_contrato: '40', horas_asignadas: '40', funciones: 4,
    alguna_devuelta: false, todas_aprobadas: true, todas_diligenciadas: true,
    meta: '8', ejec8: '2', ejec16: '2', indicadores: 2, sin_soporte: 1, evidencias: 1, ...extra,
});

test('un programa o un período inexistente da 404 con un mensaje claro', async () => {
    await assert.rejects(construirBalance(baseFalsa({ programa: false }), { idPrograma: 1, idPeriodo: 9 }), (e) => e instanceof BalanceError && e.estado === 404 && /programa/.test(e.message));
    await assert.rejects(construirBalance(baseFalsa({ periodo: false }), { idPrograma: 1, idPeriodo: 9 }), (e) => e instanceof BalanceError && e.estado === 404 && /período/.test(e.message));
});

test('el informe junta docentes, funciones y cortes, y el resumen cuadra con las tablas', async () => {
    const inf = await construirBalance(baseFalsa({
        docentes: [docente(), docente({ docente: 'Docente Dos', todas_aprobadas: false, alguna_devuelta: true, funciones: 3, horas_asignadas: '30', meta: '0', ejec8: '0', ejec16: '0', sin_soporte: 0, evidencias: 0 }), docente({ docente: 'Docente Tres', funciones: 0, horas_asignadas: '0' })],
        funciones: [{ funcion: 'Investigación', horas: '5', docentes: 1 }],
        actividades: [
            { funcion: 'Investigación', actividad: 'Egresados', asignatura: '', descripcion: 'Artículo', indicador: 'Artículos', docentes: 1, ids_docentes: [7], meta: '4', ejec8: '1', ejec16: '2', evidencias: 1 },
            { funcion: 'Investigación', actividad: 'Egresados', asignatura: '', descripcion: 'Artículo', indicador: 'Ponencias', docentes: 1, ids_docentes: [7, 8], meta: '4', ejec8: '1', ejec16: '0', evidencias: 0 },
            { funcion: 'Docencia Directa', actividad: 'ALGORITMOS', asignatura: 'ALGORITMOS', descripcion: '', indicador: '', docentes: 1, ids_docentes: [7], meta: '0', ejec8: '0', ejec16: '0', evidencias: 0 },
        ],
        evidencias: [{ funcion: 'Investigación', actividad: 'Egresados', asignatura: '', descripcion: 'Artículo', indicador: 'Artículos', nombre_archivo: 'soporte.pdf', tipo_archivo: 'pdf', semana: 8, fecha_carga: '2026-10-02', docente: 'Docente Uno' }, { funcion: 'Investigación', actividad: 'Egresados', asignatura: '', descripcion: 'Artículo', indicador: 'Artículos', nombre_archivo: 'https://ejemplo.co/a', tipo_archivo: 'enlace', semana: 16, fecha_carga: '2026-10-03', docente: 'Docente Uno' }],
        revision: [{ semana: 8, estado: 'Aprobado', n: 2 }, { semana: 16, estado: 'Devuelto', n: 1 }],
        observaciones: [{ semana: 16, texto: ' faltan cosas ', fecha: '2026-10-01', docente: 'Docente Dos', funcion: 'Investigación', actividad: 'Egresados' }],
    }), { idPrograma: 1, idPeriodo: 9 });

    assert.equal(inf.periodo.etiqueta, '2026-Intersemestral I');
    assert.deepEqual(inf.nombresCortes, { corte1: 'Semana X', corte2: 'Semana X (final)' }, 'en un intersemestral los cortes se llaman Semana X');
    assert.deepEqual(inf.directores, ['Ana Directora']);

    assert.deepEqual(inf.docentes.map((d) => d.estado), ['Aprobada', 'Devuelta', 'Sin agenda']);
    assert.equal(inf.resumen.docentes, 3);
    assert.equal(inf.resumen.docentesConAgenda, 2);
    assert.deepEqual(inf.resumen.estados, { Aprobada: 1, 'En revisión': 0, Pendiente: 0, Devuelta: 1, 'Sin agenda': 1 });
    assert.equal(inf.resumen.porcentajeAprobadas, 33.3);
    assert.equal(inf.resumen.horasAsignadas, 70);
    assert.equal(inf.resumen.horasContratadas, 120);
    assert.equal(inf.resumen.evidencias, 2);
    assert.equal(inf.resumen.indicadoresSinSoporte, 2);

    const inv = inf.funciones[0];
    assert.equal(inv.meta, 8, 'la meta se suma por indicador, igual que en la analítica');
    assert.equal(inv.avanceCorte1, 25);
    assert.equal(inv.avanceFinal, 50);
    assert.equal(inf.resumen.avanceFinal, 50);

    // 3 funciones con docente en total (4 + 3 + 0 = 7); 2 revisadas en el corte 1 y 1 en el 2
    assert.equal(inf.cortes.corte1.aprobadas, 2);
    assert.equal(inf.cortes.corte1.pendientes, 5);
    assert.equal(inf.cortes.corte2.devueltas, 1);
    assert.equal(inf.cortes.corte2.pendientes, 6);

    assert.equal(inf.observaciones[0].corte, 'Semana X (final)');
    assert.equal(inf.observaciones[0].texto, 'faltan cosas', 'se recorta el texto');
});

test('un semestre ordinario conserva "Semana 8" y "Semana 16"', async () => {
    const db = baseFalsa();
    const original = db.query;
    db.query = async (sql, p) => {
        const r = await original(sql, p);
        if (/FROM periodo WHERE id_periodo/.test(sql)) return { rows: [{ ...r.rows[0], semestre: 1 }] };
        return r;
    };
    const inf = await construirBalance(db, { idPrograma: 1, idPeriodo: 9 });
    assert.equal(inf.periodo.etiqueta, '2026-I');
    assert.deepEqual(inf.nombresCortes, { corte1: 'Semana 8', corte2: 'Semana 16' });
});

test('el detalle trae una entrada por actividad, con su descripción, indicadores y evidencias', async () => {
    const inf = await construirBalance(baseFalsa({
        docentes: [docente()],
        funciones: [{ funcion: 'Investigación', horas: '5', docentes: 1 }, { funcion: 'Docencia Directa', horas: '20', docentes: 1 }],
        actividades: [
            { funcion: 'Investigación', actividad: 'Egresados', asignatura: '', descripcion: 'Artículo publicado', indicador: 'Artículos', docentes: 1, ids_docentes: [7], meta: '4', ejec8: '1', ejec16: '2', evidencias: 2 },
            { funcion: 'Investigación', actividad: 'Egresados', asignatura: '', descripcion: 'Artículo publicado', indicador: 'Ponencias', docentes: 1, ids_docentes: [7, 8], meta: '4', ejec8: '1', ejec16: '0', evidencias: 0 },
            { funcion: 'Docencia Directa', actividad: 'ALGORITMOS', asignatura: 'ALGORITMOS', descripcion: '', indicador: '', docentes: 1, ids_docentes: [7], meta: '0', ejec8: '0', ejec16: '0', evidencias: 0 },
        ],
        evidencias: [
            { funcion: 'Investigación', actividad: 'Egresados', asignatura: '', descripcion: 'Artículo publicado', indicador: 'Artículos', nombre_archivo: 'soporte.pdf', tipo_archivo: 'pdf', semana: 8, fecha_carga: '2026-10-02', docente: 'Docente Uno' },
            { funcion: 'Investigación', actividad: 'Egresados', asignatura: '', descripcion: 'Artículo publicado', indicador: 'Artículos', nombre_archivo: 'https://ejemplo.co/a', tipo_archivo: 'enlace', semana: 16, fecha_carga: '2026-10-03', docente: 'Docente Uno' },
        ],
    }), { idPrograma: 1, idPeriodo: 9 });

    assert.equal(inf.actividadesDetalle.length, 1, 'las clases sin descripción ni indicadores no entran al detalle');
    const g = inf.actividadesDetalle[0];
    assert.equal(g.titulo, 'Artículo publicado');
    assert.equal(g.docentes, 2, 'docentes distintos entre los indicadores');
    assert.equal(g.indicadores.length, 2);
    assert.equal(g.meta, 8);
    assert.equal(g.cumplimiento, 50, '(2 + 2) / 8');
    assert.equal(g.evidencias.length, 2);
    assert.deepEqual(g.evidencias.map((e) => [e.tipo, e.corte]), [['Archivo', 'Semana X'], ['Enlace', 'Semana X (final)']]);
    assert.equal(inf.evidencias.length, 2);
    assert.ok(!('idsDocentes' in inf.actividades[0]), 'el detalle interno no se envía al cliente');
});

test('en Docencia Directa las mismas descripciones de varias clases se juntan en una sola actividad del detalle', async () => {
    const clase = (asignatura, ids, meta, ejec8) => ({
        funcion: 'Docencia Directa', actividad: asignatura, asignatura, descripcion: 'Registro de calificaciones', indicador: 'Registros en el sistema académico',
        docentes: ids.length, ids_docentes: ids, meta: String(meta), ejec8: String(ejec8), ejec16: '0', evidencias: 1,
    });
    const inf = await construirBalance(baseFalsa({
        docentes: [docente()],
        funciones: [{ funcion: 'Docencia Directa', horas: '20', docentes: 2 }],
        actividades: [clase('ALGORITMOS', [7], 3, 1), clase('BASES DE DATOS', [7, 8], 3, 2)],
        evidencias: [],
    }), { idPrograma: 1, idPeriodo: 9 });

    assert.equal(inf.actividadesDetalle.length, 1, 'una sola entrada para las dos clases');
    const g = inf.actividadesDetalle[0];
    assert.equal(g.titulo, 'Registro de calificaciones');
    assert.equal(g.docentes, 2, 'docentes distintos entre las clases');
    assert.equal(g.indicadores.length, 1, 'el mismo indicador se suma, no se repite');
    assert.equal(g.indicadores[0].meta, 6);
    assert.equal(g.indicadores[0].ejecucionCorte1, 3);
    assert.equal(g.indicadores[0].evidencias, 2);
});
