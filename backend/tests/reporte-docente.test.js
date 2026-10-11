// Informe de evidencias del docente (services/reporteDocente.js): redacción con datos de ejemplo, sin base de datos.
const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../db/connection');
const { redactarReporte, construirReporteDocente, ReporteDocenteError } = require('../services/reporteDocente');
const { limpiarDescripcion, MAX_DESCRIPCION } = require('../utils/esquemaEvidencias');

test.after(() => pool.end());

const PERIODO = { id: 1, etiqueta: '2026-II', semestre: 2 };

// Una fila por evidencia (o una sola, con id_evidencias null, si el indicador no tiene ninguna)
const fila = (extra = {}) => ({
    id_funciones: 10, funcion_sustantiva: 'Docencia Directa', horas_funcion: 20,
    id_asignacionact: 100, horas_rol: 4, actividad: 'ALGORITMIA', nombre_grupo: 'B-M',
    id_descripcion: 500, resultado_esperado: 'Microcurrículo y ficha temática actualizados',
    id_indicadores: 1000, nombre_indicador: 'Microcurrículo aprobado', meta: 2, ejecucion_8: 1, ejecucion_16: 1,
    id_evidencias: null, nombre_archivo: null, tipo_archivo: null, semana: null, fecha_carga: null, evidencia_descripcion: null,
    ...extra,
});
const datos = (filas, extra = {}) => ({ docente: 'Ana Pérez', programa: 'Ingeniería de Sistemas', facultad: 'Ingeniería', periodo: PERIODO, filas, generadoEn: '2026-10-10T12:00:00Z', ...extra });
const evidencia = (extra = {}) => ({ id_evidencias: 1, nombre_archivo: 'acta.pdf', tipo_archivo: 'application/pdf', semana: '8', fecha_carga: '2026-10-01T15:00:00Z', evidencia_descripcion: 'Acta firmada de la reunión de microcurrículo', ...extra });
const seccion = (doc, titulo) => doc.secciones.find((s) => s.titulo === titulo);
const tablas = (sec) => sec.bloques.filter((b) => b.tipo === 'tabla');
const nivel2 = (doc) => doc.secciones.filter((s) => s.nivel === 2);

test('la portada identifica al docente, su programa y el período', () => {
    const doc = redactarReporte(datos([fila()]));
    assert.equal(doc.titulo, 'Informe de evidencias del docente');
    assert.match(doc.subtitulo, /Ana Pérez/);
    assert.equal(doc.portada.programa, 'Ingeniería de Sistemas');
    assert.equal(doc.portada.periodo, '2026-II');
    assert.deepEqual(doc.portada.directores, []);
});

test('el informe va en este orden: resumen, cada función con sus actividades y una nota; sin sección de indicadores sin evidencia', () => {
    const doc = redactarReporte(datos([fila(evidencia()), fila({ id_funciones: 11, funcion_sustantiva: 'Investigación', horas_funcion: 5, id_asignacionact: 200, actividad: 'Egresados', nombre_grupo: null, id_descripcion: 600, id_indicadores: 2000, nombre_indicador: 'Informe' })]));
    assert.deepEqual(doc.secciones.map((s) => `${s.nivel}:${s.titulo}`), [
        '1:Resumen del período',
        '1:Docencia Directa · 20 h',
        '2:ALGORITMIA · Grupo B-M · 4 h',
        '1:Investigación · 5 h',
        '2:Egresados · 4 h', // sin grupo
        '1:Nota',
    ]);
    assert.ok(!doc.secciones.some((s) => /sin evidencia/i.test(s.titulo)));
});

test('el resumen cuenta funciones, indicadores y evidencias, con totales y avance', () => {
    const filas = [
        fila(evidencia()),
        fila(evidencia({ id_evidencias: 2, nombre_archivo: 'https://drive.google.com/x', tipo_archivo: 'enlace', semana: '16', fecha_carga: '2026-10-05T15:00:00Z' })),
        fila({ id_indicadores: 1001, nombre_indicador: 'Notas cargadas', meta: 4, ejecucion_8: 0, ejecucion_16: 0 }),
    ];
    const resumen = seccion(redactarReporte(datos(filas)), 'Resumen del período');
    assert.match(resumen.bloques[0].texto, /1 función sustantiva, 2 indicadores y 2 evidencias; 1 indicador tiene al menos una evidencia/);
    const [tabla] = tablas(resumen);
    assert.deepEqual(tabla.filas[0], ['Docencia Directa', '20', '2', '1', '2', '33 %']); // (1+1) / (2+4) = 33 %
    assert.deepEqual(tabla.filas[tabla.filas.length - 1], ['Total', '20', '2', '1', '2', '33 %']);
});

test('cada función abre con una línea de resumen (actividades, indicadores, evidencias y avance)', () => {
    const doc = redactarReporte(datos([fila(evidencia())]));
    assert.equal(seccion(doc, 'Docencia Directa · 20 h').bloques[0].texto, '1 actividad · 1 indicador · 1 evidencia · avance 100 %');
});

test('cada actividad lleva una tabla de descripciones e indicadores y, debajo, una de sus evidencias', () => {
    const doc = redactarReporte(datos([
        fila(evidencia()),
        fila(evidencia({ id_evidencias: 2, nombre_archivo: 'https://drive.google.com/x', tipo_archivo: 'enlace', semana: '16', fecha_carga: '2026-10-05T15:00:00Z', evidencia_descripcion: 'Carpeta de Drive con las fichas' })),
        fila({ id_descripcion: 501, resultado_esperado: 'Registro de calificaciones', id_indicadores: 1001, nombre_indicador: 'Notas en el sistema', meta: 3, ejecucion_8: 3, ejecucion_16: 0 }),
    ]));
    const [actividad] = nivel2(doc);
    assert.equal(actividad.titulo, 'ALGORITMIA · Grupo B-M · 4 h');
    const [indicadores, evidencias] = tablas(actividad);
    assert.deepEqual(indicadores.columnas, ['Descripción', 'Indicador', 'Meta', 'Ejecución Semana 8', 'Ejecución Semana 16', 'Avance', 'Evidencias']);
    assert.deepEqual(indicadores.filas, [
        ['Microcurrículo y ficha temática actualizados', 'Microcurrículo aprobado', '2', '1', '1', '100 %', '2'],
        ['Registro de calificaciones', 'Notas en el sistema', '3', '3', '0', '100 %', '0'],
    ]);
    assert.deepEqual(evidencias.columnas, ['Indicador', 'Corte', 'Tipo', 'Evidencia', 'Qué contiene', 'Fecha']);
    assert.deepEqual(evidencias.filas.map((f) => f.slice(0, 5)), [
        ['Microcurrículo aprobado', 'Semana 8', 'PDF', 'acta.pdf', 'Acta firmada de la reunión de microcurrículo'],
        ['Microcurrículo aprobado', 'Semana 16', 'Enlace', 'https://drive.google.com/x', 'Carpeta de Drive con las fichas'],
    ]);
    assert.match(evidencias.filas[0][5], /2026/);
});

test('una evidencia sin descripción dice "Sin descripción"', () => {
    const doc = redactarReporte(datos([fila(evidencia({ evidencia_descripcion: null }))]));
    assert.equal(tablas(nivel2(doc)[0])[1].filas[0][4], 'Sin descripción');
});

test('una actividad sin evidencias lo dice en lugar de dejar una tabla vacía', () => {
    const doc = redactarReporte(datos([fila()]));
    const bloques = nivel2(doc)[0].bloques;
    assert.equal(bloques.filter((b) => b.tipo === 'tabla').length, 1);
    assert.equal(bloques[1].texto, 'Esta actividad todavía no tiene evidencias registradas.');
});

test('en un intersemestral los cortes se llaman "Semana X"', () => {
    const doc = redactarReporte(datos([fila(evidencia())], { periodo: { ...PERIODO, semestre: 3 } }));
    const [indicadores, evidencias] = tablas(nivel2(doc)[0]);
    assert.deepEqual(indicadores.columnas.slice(3, 5), ['Ejecución Semana X', 'Ejecución Semana X (final)']);
    assert.equal(evidencias.filas[0][1], 'Semana X');
});

test('una meta en 0 no divide por cero: el avance queda sin cifra', () => {
    const doc = redactarReporte(datos([fila({ meta: 0, ejecucion_8: 0, ejecucion_16: 0 })]));
    assert.equal(tablas(nivel2(doc)[0])[0].filas[0][5], '—');
});

test('lo ejecutado de más no pasa de 100 %', () => {
    const doc = redactarReporte(datos([fila({ meta: 2, ejecucion_8: 5, ejecucion_16: 0 })]));
    assert.equal(tablas(nivel2(doc)[0])[0].filas[0][5], '100 %');
});

test('una descripción sin texto se muestra como guion, sin dejar la celda vacía', () => {
    const doc = redactarReporte(datos([fila({ resultado_esperado: null })]));
    assert.equal(tablas(nivel2(doc)[0])[0].filas[0][0], '—');
});

// ---- descripción de la evidencia al guardarla ----
test('la descripción se limpia: espacios normalizados, recortada al máximo y vacía = sin descripción', () => {
    assert.equal(limpiarDescripcion('  Acta   firmada \n de la reunión '), 'Acta firmada de la reunión');
    assert.equal(limpiarDescripcion('   '), null);
    assert.equal(limpiarDescripcion(undefined), null);
    assert.equal(limpiarDescripcion('a'.repeat(MAX_DESCRIPCION + 50)).length, MAX_DESCRIPCION);
});

// ---- consulta ----
const dbFalsa = (filas, { alVerFilas } = {}) => ({
    query: async (sql, p) => {
        if (/ALTER TABLE evidencias/.test(sql)) return { rows: [] };
        if (/FROM periodo/.test(sql)) return { rows: [{ id_periodo: 1, anio: 2026, semestre: 2, fecha_inicio: '2026-07-10', fecha_fin: '2026-12-31', activo: true }] };
        if (/FROM usuarios u/.test(sql)) return { rows: [{ nombre: 'Ana Pérez', nombre_programa: 'Sistemas', nombre_facultad: 'Ingeniería' }] };
        if (alVerFilas) alVerFilas(p);
        return { rows: filas };
    },
});

test('construirReporteDocente: sin agenda en el período responde 404 con un mensaje claro', async () => {
    await assert.rejects(construirReporteDocente(dbFalsa([]), { idUsuario: 5, idPeriodo: 1 }), (e) => e instanceof ReporteDocenteError && e.estado === 404 && /agenda/.test(e.message));
});

test('construirReporteDocente: un período que no existe responde 404', async () => {
    const db = { query: async () => ({ rows: [] }) };
    await assert.rejects(construirReporteDocente(db, { idUsuario: 5, idPeriodo: 99 }), (e) => e.estado === 404 && /período/.test(e.message));
});

test('construirReporteDocente: arma el informe con la forma del balance (programa, período, documento) y nombre de archivo', async () => {
    let parametros;
    const r = await construirReporteDocente(dbFalsa([fila()], { alVerFilas: (p) => { parametros = p; } }), { idUsuario: 5, idPeriodo: 1 });
    assert.deepEqual(parametros, [5, 1], 'solo se consultan los datos del propio usuario');
    assert.equal(r.periodo.etiqueta, '2026-II');
    assert.equal(r.programa.nombre, 'Sistemas');
    assert.deepEqual(r.directores, []);
    assert.match(r.archivoBase, /Ana Pérez/);
    assert.equal(r.documento.titulo, 'Informe de evidencias del docente');
});
