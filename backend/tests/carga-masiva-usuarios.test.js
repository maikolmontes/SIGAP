// Carga masiva de usuarios: lector del Excel (frontend) y reglas del servidor.
// No toca la base de datos.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const pool = require('../db/connection');
const { normalizarTipoDocumento, resolverProgramaEstricto } = require('../controllers/usuariosController');

test.after(() => pool.end());

// El lector es un módulo ES del frontend: se importa de forma dinámica
const cargarLector = () =>
    import(pathToFileURL(path.resolve(__dirname, '../../frontend/src/utils/excelUsuarios.js')).href);

// ---------------- Lector del Excel ----------------

// Reproduce la plantilla oficial: banner en las primeras filas y encabezados en la fila 8
const plantillaOficial = (filasDeDatos) => {
    const m = [];
    for (let i = 0; i < 7; i++) m.push(['UNIVERSIDAD CESMAG', '', '', '', '', '', '']);
    m.push(['Nombres *', 'Apellidos *', 'Tipo Documento *', 'Número Documento *', 'Correo Institucional *', 'Roles *', 'Programa Académico']);
    m.push(['Ej: Juan Carlos', 'Ej: Pérez Gómez', 'CC', 'Ej: 1085123456', 'Ej: jperez@cesmag.edu.co', 'Ej: Docente, Director', 'Ej: Ingeniería de Sistemas']);
    return m.concat(filasDeDatos);
};

test('lee la plantilla oficial: encuentra los encabezados en la fila 8 y toma los usuarios desde la 10', async () => {
    const { leerFilasUsuarios } = await cargarLector();
    const r = leerFilasUsuarios(plantillaOficial([
        ['Ana María', 'Pérez Gómez', 'CC', 1000000001, 'ana@cesmag.edu.co', 'Docente', 'Ingeniería de Sistemas'],
        ['Luis', 'Mora', 'CC', '1000000002', 'luis@cesmag.edu.co', 'Docente, Director', 'Ingeniería Electrónica'],
    ]));
    assert.equal(r.encabezadoEncontrado, true);
    assert.equal(r.filaEncabezado, 8);
    assert.equal(r.filas.length, 2);
    assert.equal(r.ignoradas, 1); // la fila guía "Ej:"
    assert.equal(r.filas[0].fila, 10);
    assert.equal(r.filas[0].numero_documento, '1000000001'); // los números llegan como texto
    assert.equal(r.filas[1].roles, 'Docente, Director');
});

test('acepta encabezados sin asteriscos, con otras mayúsculas y sin tildes', async () => {
    const { leerFilasUsuarios } = await cargarLector();
    const r = leerFilasUsuarios([['NOMBRE', 'apellidos', 'CORREO', 'Numero de Documento'], ['Ana', 'Ruiz', 'a@b.co', 1085123456]]);
    assert.equal(r.filas.length, 1);
    assert.deepEqual(
        { n: r.filas[0].nombres, c: r.filas[0].correo, d: r.filas[0].numero_documento },
        { n: 'Ana', c: 'a@b.co', d: '1085123456' }
    );
});

test('no inventa datos: lo que falta llega vacío para que el servidor lo rechace', async () => {
    const { leerFilasUsuarios } = await cargarLector();
    const r = leerFilasUsuarios([['Nombres', 'Apellidos', 'Correo', 'Programa Académico'], ['Ana', 'Ruiz', 'a@b.co', '']]);
    assert.equal(r.filas[0].programa, '');
    assert.equal(r.filas[0].numero_documento, undefined);
});

test('ignora filas vacías', async () => {
    const { leerFilasUsuarios } = await cargarLector();
    const r = leerFilasUsuarios(plantillaOficial([[], ['', '', '', '', '', '', ''], ['Ana', 'R', 'CC', 1, 'a@b.co', 'Docente', 'X']]));
    assert.equal(r.filas.length, 1);
});

test('un archivo sin los encabezados de la plantilla se informa, no se importa a ciegas', async () => {
    const { leerFilasUsuarios } = await cargarLector();
    const r = leerFilasUsuarios([['a', 'b'], ['1', '2']]);
    assert.equal(r.encabezadoEncontrado, false);
    assert.equal(r.filas.length, 0);
});

// ---------------- Reglas del servidor ----------------

test('tipo de documento: acepta nombres completos y siglas', () => {
    assert.equal(normalizarTipoDocumento('Pasaporte'), 'PA');
    assert.equal(normalizarTipoDocumento('cédula de ciudadanía'), 'CC');
    assert.equal(normalizarTipoDocumento('Cédula de Extranjería'), 'CE');
    assert.equal(normalizarTipoDocumento('tarjeta de identidad'), 'TI');
    assert.equal(normalizarTipoDocumento('ce'), 'CE');
    assert.equal(normalizarTipoDocumento(''), 'CC');
});

const PROGRAMAS = [
    { id_programa: 1, nombre_programa: 'Ingeniería de Sistemas' },
    { id_programa: 2, nombre_programa: 'Ingeniería Electrónica' },
    { id_programa: 3, nombre_programa: 'Ingeniería Industrial' },
];

test('programa: coincidencia exacta, sin importar tildes ni mayúsculas', () => {
    assert.deepEqual(resolverProgramaEstricto('INGENIERIA DE SISTEMAS', PROGRAMAS), { id: 1 });
});

test('programa: un nombre corto y único se acepta ("Electrónica")', () => {
    assert.deepEqual(resolverProgramaEstricto('electronica', PROGRAMAS), { id: 2 });
});

test('programa ambiguo ("Ingeniería") se rechaza: antes se asignaba el primero', () => {
    const r = resolverProgramaEstricto('Ingeniería', PROGRAMAS);
    assert.ok(r.error);
    assert.match(r.error, /ambiguo/);
});

test('programa inexistente se rechaza: antes se asignaba el primero', () => {
    const r = resolverProgramaEstricto('Medicina', PROGRAMAS);
    assert.match(r.error, /no existe/);
});

test('"No aplica" devuelve sin programa; un id numérico se respeta si existe', () => {
    assert.deepEqual(resolverProgramaEstricto('No aplica', PROGRAMAS), { id: null });
    assert.deepEqual(resolverProgramaEstricto('3', PROGRAMAS), { id: 3 });
    assert.ok(resolverProgramaEstricto('99', PROGRAMAS).error);
});
