// Sincronización del catálogo con el formato Excel: lectura y plan de cambios (sin base de datos).
const test = require('node:test');
const assert = require('node:assert/strict');
const { emparejar, similitud, leerCatalogoExcel, planificarFuncion } = require('../utils/catalogoExcel');

const hoja = (filas) => filas.map((f) => f.map(String));

// ---------------- Lectura ----------------

test('lee la tabla de INDICADORES: rol, actividad e indicadores, con filas de continuación', () => {
    const indicadores = hoja([
        ['INVESTIGACIÓN', 'ACTIVIDAD', 'INDICADOR'],
        ['Co Investigador', 'Proyecto de investigación', 'Informe avance', 'Informe Final'],
        ['Mentor Semilleros', 'Acompañamiento a semilleros', 'Reporte SNIES'],
        ['', 'Otra actividad del mismo rol', 'Informe de gestión'],
        ['Otro/Cual?'],
    ]);
    const cat = leerCatalogoExcel((h) => (h === 'INDICADORES' ? indicadores : []));
    const inv = cat['Investigación'];
    assert.equal(inv.length, 2); // "Otro/Cual?" no trae descripciones: se descarta
    assert.deepEqual(inv[0], { nombre: 'Co Investigador', descripciones: [{ texto: 'Proyecto de investigación', indicadores: ['Informe de avance', 'Informe final'] }] });
    assert.equal(inv[1].descripciones.length, 2);
});

test('los textos del Excel llegan con la ortografía corregida y con los espacios ordenados', () => {
    const indicadores = hoja([['X', 'Y', 'Z'], ['Asesoraria  Investigación', 'Gestiòn   proceso', 'Informe atividades']]);
    const cat = leerCatalogoExcel((h) => (h === 'INDICADORES' ? indicadores : []));
    assert.equal(cat['Investigación'][0].nombre, 'Asesoría Investigación');
    assert.equal(cat['Investigación'][0].descripciones[0].texto, 'Gestión proceso');
    assert.equal(cat['Investigación'][0].descripciones[0].indicadores[0], 'Informe de actividades');
});

// ---------------- Emparejar ----------------

test('empareja primero lo idéntico y después lo más parecido, uno a uno', () => {
    const objetivo = ['Asesoraria Investigación cuantitativa', 'Asesoraria Investigación cualitativa'];
    const actual = ['Asesoría Investigación cualitativa', 'Asesoría Investigación cuantitativa'];
    assert.deepEqual(emparejar(objetivo, actual), [1, 0]); // cuantitativa↔cuantitativa, no se cruzan
});

test('textos distintos no se emparejan', () => {
    assert.deepEqual(emparejar(['Informe final'], ['Informe de gestión']), [-1]);
    assert.ok(similitud('Informe de publicación', 'Informe de publicaciòn') > 0.9);
});

// ---------------- Plan ----------------

const base = () => [
    { id: 1, nombre: 'Co Investigador', orden: 1, activo: true, descripciones: [
        { id: 10, texto: 'Proyecto de investigación', activo: true, indicadores: [{ id: 100, nombre: 'Informe avance', activo: true }, { id: 101, nombre: 'Sobra', activo: true }] }] },
    { id: 2, nombre: 'Sobra todo', orden: 2, activo: true, descripciones: [] },
    { id: 3, nombre: 'Otro/Cuál', orden: 999, activo: true, descripciones: [{ id: 30, texto: 'Otra', activo: true, indicadores: [] }] },
];

test('crea lo que falta, quita lo que sobra y no toca "Otro/Cuál"', () => {
    const objetivo = [
        { nombre: 'Co Investigador', descripciones: [{ texto: 'Proyecto de investigación', indicadores: ['Informe avance', 'Informe Final'] }] },
        { nombre: 'Egresados', descripciones: [{ texto: 'Informe Integral', indicadores: ['A', 'B'] }] },
    ];
    const ops = planificarFuncion(objetivo, base());
    const tipos = ops.map((o) => o.op);
    assert.ok(tipos.includes('crear_indicador'));
    assert.ok(tipos.includes('quitar_indicador'));
    assert.ok(tipos.includes('crear_actividad'));
    assert.ok(tipos.includes('quitar_actividad'));
    assert.equal(ops.find((o) => o.op === 'quitar_actividad').nombre, 'Sobra todo');
    assert.ok(!JSON.stringify(ops).includes('Otro/Cuál'), 'Otro/Cuál no debe aparecer en el plan');
});

test('un texto con otra redacción se renombra con el del Excel', () => {
    const objetivo = [{ nombre: 'Co Investigador', descripciones: [{ texto: 'Proyecto de Investigacion', indicadores: ['Informe avance'] }] }];
    const ops = planificarFuncion(objetivo, base());
    const r = ops.find((o) => o.op === 'renombrar_descripcion');
    assert.deepEqual([r.de, r.a], ['Proyecto de investigación', 'Proyecto de Investigacion']);
});

test('si el Excel no trae indicadores para una descripción, se conservan los de la base', () => {
    const objetivo = [{ nombre: 'Co Investigador', descripciones: [{ texto: 'Proyecto de investigación', indicadores: [] }] }];
    const ops = planificarFuncion(objetivo, base());
    assert.ok(!ops.some((o) => o.op === 'quitar_indicador'));
});

test('lo oculto que sí está en el Excel vuelve a mostrarse', () => {
    const actual = base();
    actual[0].activo = false;
    const objetivo = [{ nombre: 'Co Investigador', descripciones: [{ texto: 'Proyecto de investigación', indicadores: ['Informe avance'] }] }];
    const ops = planificarFuncion(objetivo, actual);
    assert.ok(ops.some((o) => o.op === 'mostrar' && o.tipo === 'actividades'));
});

test('una base ya igual al Excel no genera ningún cambio', () => {
    const objetivo = [{ nombre: 'Co Investigador', descripciones: [{ texto: 'Proyecto de investigación', indicadores: ['Informe avance', 'Sobra'] }] }];
    assert.deepEqual(planificarFuncion(objetivo, base().filter((a) => a.id !== 2)), []);
});

// ---------------- Orden alfabético ----------------

test('las actividades salen de la A a la Z, sin distinguir tildes, y "Otro/Cuál" al final', () => {
    const { ordenarActividades } = require('../utils/catalogo');
    const lista = ['Traductor', 'Otro/Cuál', 'Égida', 'Asesor estadístico', 'comité editorial', 'Co Investigador', 'Autor'].map((nombre) => ({ nombre }));
    const orden = ordenarActividades(lista, (a) => a.nombre).map((a) => a.nombre);
    assert.deepEqual(orden, ['Asesor estadístico', 'Autor', 'Co Investigador', 'comité editorial', 'Égida', 'Traductor', 'Otro/Cuál']);
});

// ---------------- Ortografía ----------------

test('corrige los errores de digitación del formato sin tocar lo que está bien', () => {
    const { corregirOrtografia: c } = require('../utils/catalogoExcel');
    assert.equal(c('Informe tecnico general'), 'Informe técnico general');
    assert.equal(c('Gestiòn proceso editorial de Boletín CEHUMA'), 'Gestión del proceso editorial del Boletín CEHUMA');
    assert.equal(c('Asistente del Centro de lnvestigaciones Socio jurídicas'), 'Asistente del Centro de Investigaciones Sociojurídicas');
    assert.equal(c('Tutor contenidos Tau y gestión cursos estuantes y docentes'), 'Tutor de contenidos TAU y gestión de cursos, estudiantes y docentes');
    assert.equal(c('Articulación con Ia Coordinación de lnnovación'), 'Articulación con la Coordinación de Innovación');
    assert.equal(c('informe de gestión'), 'Informe de gestión');
    assert.equal(c('Planeación, ejecución y evaluación de los componentes relacionados con paz y convivencia.'),
        'Planeación, ejecución y evaluación de los componentes relacionados con paz y convivencia');
    assert.equal(c('Aseguramiento interno de la calidad'), 'Aseguramiento interno de la calidad');
    assert.equal(c('  Comite   curricular '), 'Comité curricular');
});

test('el catálogo leído del formato no deja ninguna palabra mal escrita conocida', () => {
    const filas = hoja([
        ['X', 'Y', 'Z'],
        ['Comité Etica de investigaciones', 'Participaciòn en Comité institucional', 'Actas', 'informe de gestiòn'],
        ['Asesoraria  x', 'Artìculo y capitulo', 'Informe atividades'],
    ]);
    const roles = leerCatalogoExcel((h) => (h === 'INDICADORES' ? filas : []))['Investigación'];
    const todo = JSON.stringify(roles);
    for (const mala of ['Etica', 'Participaciòn', 'gestiòn', 'Asesoraria', 'Artìculo', 'atividades', 'capitulo']) {
        assert.ok(!todo.includes(mala), `quedó "${mala}"`);
    }
});
