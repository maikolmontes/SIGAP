// Listado de asignación académica → agenda: lectura, clasificación de filas,
// vinculación y revisión de la carga. No toca la base de datos.
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../utils/listadoAgenda');
const { perfilAgenda, revisarIndirecta } = require('../utils/perfilAgenda');

const PROGRAMAS = [
    { id_programa: 1, nombre_programa: 'Ingeniería de Sistemas' },
    { id_programa: 2, nombre_programa: 'Ingeniería Electrónica' },
];

// Extracto del catálogo maestro real (funciones 'Activo' sin docente)
const CATALOGO = new Map([
    ['Investigación', ['Co Investigador', 'Comité Institucional de investigaciones', 'Coordinación de innovación',
        'Investigador principal de proyecto con financiación externa', 'Investigador principal de proyecto con financiación interna', 'Egresados',
        'Líder de grupo de investigación', 'Mentor de semilleros de investigación', 'Proyección Social y Extensión',
        'Tutor de contenidos TAU']],
    ['Académico-Administrativo', ['Coordinador académico',
        'Coordinador de desarrollo académico e innovación pedagógica y curricular', 'Coordinador de programa de postgrado',
        'Coordinador de prácticas formativas', 'Dirección de grupo', 'Director de programa de pregrado', 'Egresados',
        'Estrategias de mejoramiento Saber Pro', 'Gestión Curricular', 'Comité curricular', 'Otro/Cuál']],
    ['Vicerrectoría', ['Docentes de acompañamiento académico', 'Docentes de acompañamiento integral', 'Otro, ¿Cuál?']],
    ['Aseguramiento de Calidad', ['Aseguramiento interno de la calidad']],
]);

const clasificar = (programa, asignatura) => L.clasificarFila({ programa, asignatura }, { programas: PROGRAMAS, catalogo: CATALOGO });

// ---------------- Lectura del Excel ----------------

const ENCABEZADOS = ['Nº', 'INSCRIPCIÓN', 'DOCENTES', 'PROGRAMAS', 'ASIGNATURAS', 'SEMESTRE', 'PERIODO', 'VIN', 'HORAS'];

test('lee el listado: encabezados, documento como texto y filas de TOTAL ignoradas', () => {
    const r = L.leerFilasListado([
        ENCABEZADOS,
        [1, 1085291480, 'VILLARREAL DIEGO', 'INGENIERÍA DE SISTEMAS', 'BASE DE DATOS I', '7E-N', '2 / 2026', 'TC', 4],
        [2, 1085291480, 'VILLARREAL DIEGO', 'HORAS INDIRECTAS', 'DOCENCIA INDIRECTA', '11-M', '2 / 2026', 'TC', '3'],
        ['', '', 'VILLARREAL DIEGO', '', '', '', 'TOTAL', 7, ''],
        ['', '', 'ZZZ', 'TOTAL', '', '', '', '', 7],
    ]);
    assert.equal(r.encabezadoEncontrado, true);
    assert.equal(r.filas.length, 2);
    // El TOTAL del docente no trae documento ni programa: se descarta como fila vacía
    assert.equal(r.totalesIgnorados, 1);
    assert.equal(r.filas[0].documento, '1085291480');
    assert.equal(r.filas[0].vinculacion, 'TC');
    assert.equal(r.filas[1].horas, 3);
    assert.equal(r.filas[0].fila, 2);
});

test('encuentra los encabezados aunque haya un título arriba y acepta "Vinculación" en lugar de VIN', () => {
    const r = L.leerFilasListado([
        ['UNIVERSIDAD CESMAG — Asignación académica 2026-2'],
        [],
        ['Documento', 'Docente', 'Programa', 'Asignatura', 'Semestre', 'Vinculación', 'Horas'],
        ['1.085.291.480', 'X', 'INGENIERÍA DE SISTEMAS', 'REDES', '5', 'Tiempo completo', '4,5'],
    ]);
    assert.equal(r.filaEncabezado, 3);
    assert.equal(r.filas[0].documento, '1085291480');
    assert.equal(r.filas[0].vinculacion, 'Tiempo completo');
    assert.equal(r.filas[0].horas, 4.5);
});

test('un archivo sin encabezados del listado se informa', () => {
    assert.equal(L.leerFilasListado([['a', 'b'], [1, 2]]).encabezadoEncontrado, false);
});

// ---------------- Vinculación ----------------

test('VIN: siglas con sufijo y nombres completos', () => {
    assert.equal(L.clasificarVinculacion('TC'), 'TC');
    assert.equal(L.clasificarVinculacion('TC - 1'), 'TC');
    assert.equal(L.clasificarVinculacion('HC - 1'), 'HC');
    assert.equal(L.clasificarVinculacion('MT'), 'MT');
    assert.equal(L.clasificarVinculacion('Medio tiempo'), 'MT');
    assert.equal(L.clasificarVinculacion('Hora cátedra'), 'HC');
    assert.equal(L.clasificarVinculacion('ADM'), 'ADM');
    assert.equal(L.clasificarVinculacion(''), null);
    assert.equal(L.clasificarVinculacion('XYZ'), 'DESCONOCIDA');
});

// ---------------- Función de la fila ----------------

test('una clase de un programa registrado es Docencia Directa con su asignatura', () => {
    const c = clasificar('INGENIERÍA DE SISTEMAS', 'BASE DE DATOS I');
    assert.equal(c.funcion, 'Docencia Directa');
    assert.equal(c.esClase, true);
    assert.equal(c.idProgramaClase, 1);
    assert.equal(c.rol, 'BASE DE DATOS I');
});

test('ADMINISTRACIÓN DE EMPRESAS es un programa, no horas administrativas', () => {
    const c = clasificar('ADMINISTRACIÓN DE EMPRESAS', 'FUNDAMENTOS DE MERCADEO');
    assert.equal(c.funcion, 'Docencia Directa');
    assert.equal(c.esClase, true);
    assert.equal(c.idProgramaClase, null);
});

test('clases de programas que no están en SIGAP son Docencia Directa, no funciones nuevas', () => {
    for (const p of ['CONTADURÍA PÚBLICA', 'DERECHO', 'ARQUITECTURA', 'TECNOLOGÍA EN MARKETING DIGITAL', 'ESPECIALIZACIÓN EN GESTIÓN DE LA CALIDAD']) {
        const c = clasificar(p, 'EXCEL AVANZADO');
        assert.equal(c.funcion, 'Docencia Directa', p);
        assert.equal(c.programaClase, p);
    }
});

test('encabezados de función del listado', () => {
    assert.equal(clasificar('HORAS INDIRECTAS', 'DOCENCIA INDIRECTA').funcion, 'Docencia Indirecta');
    assert.equal(clasificar('HORAS ADMINISTRATIVAS', 'GESTIÓN CURRICULAR').funcion, 'Académico-Administrativo');
    assert.equal(clasificar('HORAS DE ASEGURAMIENTO DE LA CALIDAD', 'APOYO AUTO EVALUACIÓN').funcion, 'Aseguramiento de Calidad');
    assert.equal(clasificar('HORAS VICERRECTORIA DE INVESTIGACIONES', 'CO-INVESTIGADOR').funcion, 'Investigación');
    assert.equal(clasificar('HORAS PROYECCION INSTITUCIONAL', 'ACOMPAÑAMIENTO INTEGRAL').funcion, 'Vicerrectoría');
});

test('"HORAS ..." que no corresponde a ninguna función no inventa una función', () => {
    const c = clasificar('HORAS EXTRA', 'ALGO');
    assert.equal(c.funcion, null);
    assert.equal(c.como, 'funcion_desconocida');
});

// ---------------- Actividad del catálogo ----------------

test('equivalencias que antes se resolvían mal', () => {
    assert.equal(clasificar('HORAS VICERRECTORIA DE INVESTIGACIONES', 'TUTORÍA DE SEMILLEROS').rol, 'Mentor de semilleros de investigación');
    assert.equal(clasificar('HORAS ADMINISTRATIVAS', 'PRACTICA PROFESIONAL').rol, 'Coordinador de prácticas formativas');
    assert.equal(clasificar('HORAS ADMINISTRATIVAS', 'COORDINACIÓN ACADÉMICO').rol, 'Coordinador académico');
    assert.equal(clasificar('HORAS VICERRECTORIA DE INVESTIGACIONES', 'DIRECCIÓN DE GRUPO').rol, 'Líder de grupo de investigación');
});

test('Proyección social se carga en Investigación, donde la ubica el catálogo', () => {
    const c = clasificar('HORAS PROYECCION INSTITUCIONAL', 'PROYECCIÓN SOCIAL');
    assert.equal(c.funcion, 'Investigación');
    assert.equal(c.rol, 'Proyección Social y Extensión');
});

test('coincidencia por palabras con el catálogo', () => {
    // Egresados es un rol de Investigación en el formato, aunque el listado lo traiga como horas administrativas
    const egresados = clasificar('HORAS ADMINISTRATIVAS', 'GESTIÓN DE EGRESADOS');
    assert.equal(egresados.rol, 'Egresados');
    assert.equal(egresados.funcion, 'Investigación');
    assert.equal(clasificar('HORAS VICERRECTORIA DE INVESTIGACIONES', 'EGRESADOS').funcion, 'Investigación');
    assert.equal(clasificar('HORAS VICERRECTORIA DE INVESTIGACIONES', 'COORDINACIÓN DE INNOVACIÓN').rol, 'Coordinación de innovación');
});

test('función con una sola actividad: se selecciona sola', () => {
    const c = clasificar('HORAS DE ASEGURAMIENTO DE LA CALIDAD', 'APOYO SEGUIMIENTO PLAN DE MEJORAMIENTO');
    assert.equal(c.rol, 'Aseguramiento interno de la calidad');
    assert.equal(c.como, 'unico');
});

test('"INVESTIGADOR PRINCIPAL" es ambiguo: el docente elige interna o externa', () => {
    const c = clasificar('HORAS VICERRECTORIA DE INVESTIGACIONES', 'INVESTIGADOR PRINCIPAL');
    assert.equal(c.rol, '');
    assert.equal(c.como, 'ambiguo');
    assert.equal(c.opciones.length, 2);
});

test('texto genérico ("INVESTIGACIONES") no se asigna a un rol cualquiera', () => {
    const c = clasificar('HORAS VICERRECTORIA DE INVESTIGACIONES', 'INVESTIGACIONES');
    assert.equal(c.rol, '');
    assert.equal(c.como, 'sin_equivalencia');
});

test('sin equivalente: se usa "Otro/Cuál" si la función lo tiene', () => {
    const c = clasificar('HORAS ADMINISTRATIVAS', 'FUNCIONES ADMINISTRATIVAS');
    assert.equal(c.rol, 'Otro/Cuál');
    assert.equal(c.como, 'otro');
});

test('docencia indirecta conserva su nombre', () => {
    const c = clasificar('HORAS INDIRECTAS', 'DOCENCIA INDIRECTA');
    assert.equal(c.rol, 'Docencia Indirecta');
});

// ---------------- Revisión de la carga ----------------

const filas = (directa, indirecta, otras = 0) => [
    { funcion: 'Docencia Directa', horas: directa },
    { funcion: 'Docencia Indirecta', horas: indirecta },
    { funcion: 'Investigación', horas: otras },
];

test('carga de Diego 2026-2 (TC 40 h: 10 + 3 + 27) no genera alertas', () => {
    const r = L.revisarCarga({ filas: filas(10, 3, 27), sigla: 'TC', horasContrato: 40 });
    assert.equal(r.total, 40);
    assert.deepEqual(r.alertas, []);
});

test('total distinto del contrato e indirecta fuera del 30 % generan alertas', () => {
    const r = L.revisarCarga({ filas: filas(20, 7, 12), sigla: 'MT', horasContrato: 20 });
    assert.equal(r.alertas.length, 2);
    assert.match(r.alertas[0], /39 h .* 20 h/);
    assert.match(r.alertas[1], /corresponden 6 h/);
});

test('hora cátedra: no se exige total ni indirecta', () => {
    assert.deepEqual(L.revisarCarga({ filas: filas(12, 0), sigla: 'HC', horasContrato: 0 }).alertas, []);
});

test('30 % redondeado como el formato institucional', () => {
    assert.equal(L.indirectaEsperada(9), 3);   // 2,7
    assert.equal(L.indirectaEsperada(15), 5);  // 4,5
    assert.equal(L.indirectaEsperada(13), 4);  // 3,9
});

// ---------------- Perfil de la agenda ----------------

test('perfil: compara con el contrato y no asume 40 h para hora cátedra', () => {
    assert.equal(perfilAgenda(40, 40), 'AGENDA CORRECTA');
    assert.equal(perfilAgenda(48, 40), 'INCONSISTENCIAS EN AGENDA AC 30');
    assert.equal(perfilAgenda(12, 0), 'SIN HORAS DE CONTRATO');
    assert.equal(perfilAgenda(12, null), 'SIN HORAS DE CONTRATO');
});

test('la docencia indirecta asignada se respeta y se compara con el 30 %', () => {
    assert.deepEqual(revisarIndirecta(20, 7), { asignada: 7, esperada: 6, cumple: false });
    assert.deepEqual(revisarIndirecta(10, 3), { asignada: 3, esperada: 3, cumple: true });
});

test('con "Otro/Cuál" en Investigación, el texto genérico se carga ahí para que el docente lo escriba', () => {
    const catalogo = new Map(CATALOGO);
    catalogo.set('Investigación', [...CATALOGO.get('Investigación'), 'Otro/Cuál']);
    const c = L.clasificarFila({ programa: 'HORAS VICERRECTORIA DE INVESTIGACIONES', asignatura: 'INVESTIGACIONES' }, { programas: PROGRAMAS, catalogo });
    assert.equal(c.rol, 'Otro/Cuál');
    assert.equal(c.como, 'otro');
});

test('una función creada por Planeación en Parámetros generales se reconoce en el listado', () => {
    const catalogo = new Map(CATALOGO);
    catalogo.set('Extensión y Proyección', ['Coordinador de extensión', 'Otro/Cuál']);
    const c = L.clasificarFila(
        { programa: 'HORAS EXTENSIÓN Y PROYECCIÓN', asignatura: 'COORDINADOR DE EXTENSIÓN' },
        { programas: PROGRAMAS, catalogo });
    assert.equal(c.funcion, 'Extensión y Proyección');
    assert.equal(c.rol, 'Coordinador de extensión');
});

test('un encabezado que no es ninguna función se informa en lugar de inventar una función', () => {
    const c = L.clasificarFila(
        { programa: 'HORAS LOGÍSTICA', asignatura: 'COORDINADOR' },
        { programas: PROGRAMAS, catalogo: CATALOGO });
    assert.equal(c.funcion, null);
});

test('una función oculta (fuera del catálogo visible) deja de reconocerse', () => {
    const catalogo = new Map(CATALOGO); // sin 'Extensión y Proyección': la oculta no llega al mapa
    assert.equal(L.clasificarFuncion('HORAS EXTENSIÓN Y PROYECCIÓN', PROGRAMAS, [...catalogo.keys()]).funcion, 'Vicerrectoría'); // vuelve a la palabra clave general
});
