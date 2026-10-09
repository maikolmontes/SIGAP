// Redacción del balance de gestión: que las frases digan lo correcto y concuerden en número.
const test = require('node:test');
const assert = require('node:assert/strict');
const { construirDocumento, unir, nombres } = require('../services/balanceDocumento');

const base = (extra = {}) => ({
    generadoEn: '2026-10-09T15:00:00.000Z',
    programa: { id: 1, nombre: 'Ingeniería de Sistemas', facultad: 'Ingeniería' },
    periodo: { id: 8, etiqueta: '2026-II', semestre: 2, fechaInicio: '2026-07-20T05:00:00.000Z', fechaFin: '2026-11-28T05:00:00.000Z', activo: true },
    directores: ['Ana Directora'],
    nombresCortes: { corte1: 'Semana 8', corte2: 'Semana 16' },
    resumen: {
        docentes: 3, docentesConAgenda: 3, estados: { Aprobada: 1, 'En revisión': 1, Pendiente: 0, Devuelta: 1, 'Sin agenda': 0 },
        porcentajeAprobadas: 33.3, horasContratadas: 100, horasAsignadas: 120, ocupacion: 120, meta: 10, ejecucionCorte1: 3, ejecucionCorte2: 2,
        avanceCorte1: 30, avanceFinal: 50, evidencias: 2, indicadoresSinSoporte: 1, observaciones: 1,
    },
    funciones: [
        { funcion: 'Investigación', horas: 20, docentes: 2, actividades: 1, meta: 10, ejecucionCorte1: 3, ejecucionCorte2: 2, avanceCorte1: 30, avanceFinal: 50, evidencias: 2 },
        { funcion: 'Docencia Indirecta', horas: 30, docentes: 1, actividades: 1, meta: 0, ejecucionCorte1: 0, ejecucionCorte2: 0, avanceCorte1: null, avanceFinal: null, evidencias: 0 },
    ],
    actividadesDetalle: [
        { funcion: 'Investigación', actividad: 'Egresados', asignatura: '', titulo: 'Artículo publicado en revista indexada', docentes: 1, meta: 10, ejecucionCorte1: 3, ejecucionCorte2: 2, cumplimiento: 50,
            indicadores: [{ indicador: 'Artículos publicados', meta: 10, ejecucionCorte1: 3, ejecucionCorte2: 2, cumplimiento: 50, evidencias: 2 }], evidencias: [] },
        { funcion: 'Docencia Indirecta', actividad: 'Docencia Indirecta', asignatura: '', titulo: 'Preparación de clases y atención a estudiantes', docentes: 3, meta: 0, ejecucionCorte1: 0, ejecucionCorte2: 0, cumplimiento: null, indicadores: [], evidencias: [] },
    ],
    cortes: { corte1: { nombre: 'Semana 8', aprobadas: 1, vistoBueno: 0, devueltas: 1, pendientes: 4 }, corte2: { nombre: 'Semana 16', aprobadas: 0, vistoBueno: 0, devueltas: 0, pendientes: 6 } },
    docentes: [
        { docente: 'Uno', tipoContrato: 'Tiempo Completo', horasContrato: 40, horasAsignadas: 50, estado: 'Aprobada', funciones: 2, meta: 5, ejecucionCorte1: 2, ejecucionCorte2: 1, avanceFinal: 60, indicadoresSinSoporte: 1, evidencias: 1 },
        { docente: 'Dos', tipoContrato: 'Tiempo Completo', horasContrato: 40, horasAsignadas: 30, estado: 'En revisión', funciones: 2, meta: 5, ejecucionCorte1: 1, ejecucionCorte2: 1, avanceFinal: 40, indicadoresSinSoporte: 0, evidencias: 1 },
        { docente: 'Tres', tipoContrato: 'Medio Tiempo', horasContrato: 20, horasAsignadas: 40, estado: 'Devuelta', funciones: 2, meta: 0, ejecucionCorte1: 0, ejecucionCorte2: 0, avanceFinal: null, indicadoresSinSoporte: 0, evidencias: 0 },
    ],
    evidencias: [
        { funcion: 'Investigación', actividad: 'Egresados', asignatura: '', descripcion: 'Artículo publicado', indicador: 'Artículos', nombre: 'soporte.pdf', tipo: 'Archivo', corte: 'Semana 8', docente: 'Uno', fecha: '2026-10-02' },
        { funcion: 'Investigación', actividad: 'Egresados', asignatura: '', descripcion: 'Artículo publicado', indicador: 'Artículos', nombre: 'https://ejemplo.co/a', tipo: 'Enlace', corte: 'Semana 16', docente: 'Dos', fecha: '2026-10-03' },
    ],
    observaciones: [{ corte: 'Semana 16', docente: 'Tres', funcion: 'Investigación', actividad: 'Egresados', texto: 'Faltan evidencias', fecha: '2026-10-04' }],
    ...extra,
});

const textoDe = (doc, titulo) => doc.secciones.find((s) => s.titulo === titulo).bloques.filter((b) => b.tipo === 'parrafo').map((b) => b.texto).join(' ');

test('unir y nombres arman listas con "y" y acortan las largas', () => {
    assert.equal(unir([]), '');
    assert.equal(unir(['a']), 'a');
    assert.equal(unir(['a', false, 'b']), 'a y b');
    assert.equal(unir(['a', 'b', 'c']), 'a, b y c');
    assert.equal(nombres(['a', 'b', 'c', 'd'], 2), 'a, b y 2 más');
});

test('el documento trae las secciones esperadas, en orden', () => {
    const doc = construirDocumento(base());
    assert.equal(doc.titulo, 'Balance de gestión del período 2026-II');
    assert.deepEqual(doc.secciones.map((s) => s.titulo), [
        'Resumen general', 'Revisión de los cortes', 'Gestión por función sustantiva', 'Investigación', 'Docencia Indirecta',
        'Docentes y agendas', 'Evidencias', 'Observaciones del director', 'Anexo A. Evidencias cargadas',
    ]);
});

test('el resumen redacta las cifras con la concordancia correcta', () => {
    const t = textoDe(construirDocumento(base()), 'Resumen general');
    assert.match(t, /programa de Ingeniería de Sistemas \(Facultad de Ingeniería\) durante el período 2026-II/);
    assert.match(t, /Lo presenta Ana Directora/);
    assert.match(t, /3 docentes asignados al período y todos tienen agenda/);
    assert.match(t, /1 fue aprobada \(33,3 %\), 1 está en revisión del director y 1 fue devuelta para corrección/);
    assert.match(t, /120 horas frente a 100 contratadas \(120 % de ocupación\): la carga asignada supera lo contratado/);
    assert.match(t, /suman 10\. En Semana 8 se reportó una ejecución de 3 \(30 %\) y, sumando Semana 16, de 5 \(50 %\)/);
    assert.match(t, /2 evidencias como soporte; 1 indicador reporta ejecución sin ninguna evidencia/);
    assert.match(t, /1 observación sobre/);
});

test('cada actividad aparece con su descripción, sus indicadores y su concordancia', () => {
    const doc = construirDocumento(base());
    const inv = doc.secciones.find((s) => s.titulo === 'Investigación');
    const parrafo = inv.bloques.find((b) => b.tipo === 'parrafo').texto;
    assert.match(parrafo, /Participaron 2 docentes con 20 horas en total, repartidas en 1 actividad\./);
    assert.match(parrafo, /Frente a una meta de 10, la ejecución fue de 3 en Semana 8 \(30 %\) y de 5 acumulada al segundo corte \(50 %\)\./);
    const item = inv.bloques.find((b) => b.tipo === 'lista').items[0];
    assert.equal(item.titulo, 'Artículo publicado en revista indexada');
    assert.match(item.texto, /Actividad: Egresados\. La reportó 1 docente\./);
    assert.match(item.texto, /la meta fue 10 y la ejecución, 5 \(50 %\): 3 en Semana 8 y 2 en Semana 16\./);
    assert.match(item.texto, /Indicador «Artículos publicados»: meta 10, ejecutado 5 \(50 %\), 2 evidencias\./);

    const di = doc.secciones.find((s) => s.titulo === 'Docencia Indirecta');
    assert.match(di.bloques[0].texto, /Esta función no maneja metas ni indicadores\./);
    assert.ok(!/ $/.test(di.bloques[0].texto), 'sin espacios sobrantes al final');
    assert.match(di.bloques[1].items[0].texto, /La reportaron 3 docentes\. Esta función no lleva indicadores\./);
});

test('los docentes se agrupan por estado y se señalan los problemas', () => {
    const doc = construirDocumento(base());
    const lista = doc.secciones.find((s) => s.titulo === 'Docentes y agendas').bloques.find((b) => b.tipo === 'lista');
    const titulos = lista.items.map((i) => i.titulo);
    assert.ok(titulos.includes('Agendas aprobadas (1)'));
    assert.ok(titulos.includes('Agendas devueltas para corrección (1)'));
    assert.ok(titulos.includes('Con ejecución reportada y sin evidencia (1)'));
    assert.ok(titulos.includes('Con más horas asignadas que contratadas (2)'), 'Uno (50/40) y Tres (40/20)');
    assert.ok(titulos.includes('Con menos horas asignadas que contratadas (1)'), 'Dos (30/40)');
});

test('en un intersemestral los cortes se nombran como llegan ("Semana X")', () => {
    const doc = construirDocumento(base({ nombresCortes: { corte1: 'Semana X', corte2: 'Semana X (final)' } }));
    assert.match(textoDe(doc, 'Resumen general'), /En Semana X se reportó una ejecución/);
});

test('sin docentes el documento es corto y lo dice', () => {
    const vacio = base({ docentes: [], funciones: [], actividadesDetalle: [], evidencias: [], observaciones: [], resumen: { ...base().resumen, docentes: 0, docentesConAgenda: 0, evidencias: 0, observaciones: 0 } });
    const doc = construirDocumento(vacio);
    assert.deepEqual(doc.secciones.map((s) => s.titulo), ['Resumen general']);
    assert.match(textoDe(doc, 'Resumen general'), /no tiene docentes asignados/);
});

test('un solo docente: singular en todo el texto', () => {
    const uno = base({ resumen: { ...base().resumen, docentes: 1, docentesConAgenda: 1, estados: { Aprobada: 1, 'En revisión': 0, Pendiente: 0, Devuelta: 0, 'Sin agenda': 0 }, evidencias: 1, indicadoresSinSoporte: 0, observaciones: 0 } });
    const t = textoDe(construirDocumento(uno), 'Resumen general');
    assert.match(t, /1 docente asignado al período y todos tienen agenda\. De la agenda registrada, 1 fue aprobada/);
    assert.match(t, /1 evidencia como soporte\./);
});

test('la sección de evidencias dice el tipo sin repetirse', () => {
    const solo = (tipo, n) => base({ evidencias: Array.from({ length: n }, () => ({ funcion: 'Investigación', actividad: 'x', asignatura: '', descripcion: '', indicador: '', nombre: 'n', tipo, corte: 'Semana 8', docente: 'Uno', fecha: null })) });
    assert.match(textoDe(construirDocumento(solo('Enlace', 3)), 'Evidencias'), /3 evidencias \(todas enlaces\)/);
    assert.match(textoDe(construirDocumento(solo('Archivo', 1)), 'Evidencias'), /1 evidencia \(un archivo\)/);
    const mixto = base();
    assert.match(textoDe(construirDocumento(mixto), 'Evidencias'), /2 evidencias \(1 archivo y 1 enlace\)/);
});

test('una función con un solo docente concuerda en singular', () => {
    const unico = base();
    unico.funciones[0] = { ...unico.funciones[0], docentes: 1, horas: 1 };
    const inv = construirDocumento(unico).secciones.find((s) => s.titulo === 'Investigación');
    assert.match(inv.bloques[0].texto, /^Participó 1 docente con 1 hora en total/);
});
