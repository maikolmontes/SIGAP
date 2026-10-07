// ================================================================
// Listado de asignación académica (Excel de Planeación) → agenda docente
// ----------------------------------------------------------------
// Funciones puras: leen el listado, deciden a qué función sustantiva
// y a qué actividad del catálogo corresponde cada fila, y revisan la
// carga de cada docente. No tocan la base de datos, así que se prueban
// sin PostgreSQL (tests/listado-agenda.test.js).
//
// Formato del listado (una fila por asignación, un bloque por docente):
//   Nº | INSCRIPCIÓN | DOCENTES | PROGRAMAS | ASIGNATURAS | SEMESTRE | PERIODO | VIN | HORAS
// La columna PROGRAMAS cumple dos papeles:
//   - un programa académico ("INGENIERÍA DE SISTEMAS", "CONTADURÍA PÚBLICA")
//     → la fila es una clase (Docencia Directa), exista o no el programa en SIGAP;
//   - un encabezado de función ("HORAS ADMINISTRATIVAS", "HORAS INDIRECTAS")
//     → la fila es otra función sustantiva y ASIGNATURAS trae el rol.
// ================================================================
const xlsx = require('xlsx');

const DIRECTA = 'Docencia Directa';
const INDIRECTA = 'Docencia Indirecta';
const INVESTIGACION = 'Investigación';
const ACADEMICO_ADMIN = 'Académico-Administrativo';
const VICERRECTORIA = 'Vicerrectoría';
const CALIDAD = 'Aseguramiento de Calidad';

// Acuerdo 030/2024, cap. 2 art. 7: la docencia indirecta es el 30 % de la directa
const PROPORCION_INDIRECTA = 0.3;

const normalizar = (s) => String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// ----------------------------------------------------------------
// Lectura del Excel
// ----------------------------------------------------------------

// Encabezados aceptados (normalizados y sin espacios) para cada campo
const COLUMNAS = {
    documento: ['inscripcion', 'documento', 'numerodocumento', 'numerodedocumento', 'identificacion', 'cedula'],
    nombre: ['docentes', 'docente', 'nombre', 'nombres', 'nombredocente'],
    programa: ['programas', 'programa'],
    asignatura: ['asignaturas', 'asignatura', 'espaciosacademicos', 'espacioacademico', 'actividad', 'actividades'],
    semestre: ['semestre', 'semestres'],
    periodo: ['periodo'],
    vinculacion: ['vin', 'vinculacion', 'tipovinculacion', 'tipodevinculacion', 'contrato', 'tipocontrato',
        'tipodecontrato', 'dedicacion', 'dedicaciondocente'],
    horas: ['horas', 'horassemana', 'horassemanales', 'intensidadhoraria'],
};

const claveEncabezado = (s) => normalizar(s).replace(/ /g, '');

// Documento como texto: Excel guarda las cédulas como números y a veces
// con puntos de miles ("1.085.291.480"). Los documentos con letras se respetan.
const limpiarDocumento = (v) => {
    let t = String(v ?? '').trim();
    if (/^[\d.\s]+$/.test(t)) t = t.replace(/\.0+$/, '').replace(/[.\s]/g, '');
    return t;
};

const leerHoras = (v) => {
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
};

const esFilaDeTotal = (f) => [f.periodo, f.programa, f.semestre, f.nombre, f.documento]
    .some((v) => ['total', 'gran total', 'zzz'].includes(normalizar(v)));

/**
 * Convierte una matriz (filas de celdas) en filas del listado. Busca la fila de
 * encabezados en las primeras 20 filas, así que admite banners o títulos arriba.
 */
const leerFilasListado = (matriz) => {
    let filaEncabezado = -1;
    let mapa = null;
    for (let i = 0; i < Math.min(matriz.length, 20); i++) {
        const claves = (matriz[i] || []).map(claveEncabezado);
        const indice = (campo) => claves.findIndex((c) => COLUMNAS[campo].includes(c));
        if (indice('documento') !== -1 && (indice('programa') !== -1 || indice('asignatura') !== -1)) {
            filaEncabezado = i;
            mapa = Object.fromEntries(Object.keys(COLUMNAS).map((campo) => [campo, indice(campo)]));
            break;
        }
    }
    if (!mapa) return { encabezadoEncontrado: false, filas: [], totalesIgnorados: 0 };

    const filas = [];
    let totalesIgnorados = 0;
    for (let i = filaEncabezado + 1; i < matriz.length; i++) {
        const celdas = matriz[i] || [];
        const celda = (campo) => (mapa[campo] === -1 ? '' : celdas[mapa[campo]] ?? '');
        const f = {
            fila: i + 1, // número de fila tal como lo ve el usuario en Excel
            documento: limpiarDocumento(celda('documento')),
            nombre: String(celda('nombre')).trim(),
            programa: String(celda('programa')).trim(),
            asignatura: String(celda('asignatura')).trim(),
            semestre: String(celda('semestre')).trim(),
            periodo: String(celda('periodo')).trim(),
            vinculacion: String(celda('vinculacion')).trim(),
            horas: leerHoras(celda('horas')),
        };
        if (!f.documento && !f.programa && !f.asignatura) continue; // fila vacía
        if (esFilaDeTotal(f)) { totalesIgnorados++; continue; }
        filas.push(f);
    }
    return { encabezadoEncontrado: true, filaEncabezado: filaEncabezado + 1, filas, totalesIgnorados };
};

const leerListado = (buffer) => {
    const libro = xlsx.read(buffer, { type: 'buffer' });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    return leerFilasListado(xlsx.utils.sheet_to_json(hoja, { header: 1, defval: '', raw: true }));
};

// ----------------------------------------------------------------
// Vinculación (columna VIN)
// ----------------------------------------------------------------

/**
 * "TC", "TC - 1", "Tiempo completo" → 'TC'; "MT" → 'MT'; "HC", "HC - 1" → 'HC';
 * "ADM" → 'ADM' (personal administrativo con horas de docencia).
 * Devuelve null si la celda está vacía y 'DESCONOCIDA' si no se reconoce.
 */
const clasificarVinculacion = (valor) => {
    const t = normalizar(valor);
    if (!t) return null;
    const sigla = t.split(' ')[0];
    if (sigla === 'tc' || t.includes('tiempo completo')) return 'TC';
    if (sigla === 'mt' || t.includes('medio tiempo')) return 'MT';
    if (sigla === 'hc' || t.includes('catedra')) return 'HC';
    if (sigla === 'adm' || t.startsWith('administrativ')) return 'ADM';
    return 'DESCONOCIDA';
};

// Nombre del tipo de contrato en la tabla tipo_contrato para cada sigla
const TIPO_CONTRATO_POR_SIGLA = { TC: 'tiempo completo', MT: 'medio tiempo', HC: 'hora catedra' };

// ----------------------------------------------------------------
// Función sustantiva de la fila (columna PROGRAMAS)
// ----------------------------------------------------------------

// Palabras que identifican un encabezado de función. Se buscan como texto
// normalizado: "administrativ" reconoce "HORAS ADMINISTRATIVAS" pero no
// "ADMINISTRACIÓN DE EMPRESAS", que es un programa (antes se confundían).
const ENCABEZADOS_DE_FUNCION = [
    { funcion: INDIRECTA, claves: ['indirecta'] },
    { funcion: DIRECTA, claves: ['docencia directa'] },
    { funcion: INVESTIGACION, claves: ['investigacion', 'investigaciones'] },
    { funcion: CALIDAD, claves: ['calidad', 'aseguramiento', 'autoevaluacion'] },
    { funcion: ACADEMICO_ADMIN, claves: ['administrativ', 'academico administrativ'] },
    { funcion: VICERRECTORIA, claves: ['vicerrectoria', 'proyeccion', 'bienestar', 'pastoral', 'evangelizacion'] },
];

// Un nombre de programa empieza así; si el texto empieza así, es una clase
// aunque contenga una palabra clave ("Especialización en Gestión de la Calidad").
const PREFIJOS_DE_PROGRAMA = ['ingenieria', 'licenciatura', 'especializacion', 'maestria', 'doctorado',
    'tecnologia', 'tecnico', 'tecnica', 'programa', 'administracion', 'contaduria', 'derecho',
    'arquitectura', 'psicologia', 'enfermeria', 'medicina', 'diseno', 'comunicacion', 'trabajo social'];

const contieneClave = (texto, claves) => claves.some((c) => (' ' + texto).includes(' ' + c));

/**
 * Decide la función sustantiva a partir de la columna PROGRAMAS.
 * @param {string} programa   texto de la columna PROGRAMAS
 * @param {Array<{id_programa:number,nombre_programa:string}>} programas  programas registrados
 * @returns {{funcion:string, esClase:boolean, programaClase?:string, idProgramaClase?:number|null}}
 */
const clasificarFuncion = (programa, programas = []) => {
    const t = normalizar(programa);
    const registrado = programas.find((p) => normalizar(p.nombre_programa) === t);
    if (registrado) {
        return { funcion: DIRECTA, esClase: true, programaClase: registrado.nombre_programa, idProgramaClase: registrado.id_programa };
    }
    const esEncabezado = /^(horas?|funcion|funciones|docencia)\b/.test(t);
    if (t && (esEncabezado || !PREFIJOS_DE_PROGRAMA.some((p) => t.startsWith(p)))) {
        const encabezado = ENCABEZADOS_DE_FUNCION.find((e) => contieneClave(t, e.claves));
        if (encabezado) return { funcion: encabezado.funcion, esClase: encabezado.funcion === DIRECTA };
    }
    // "HORAS ..." que no corresponde a ninguna función: no se inventa una función nueva
    if (esEncabezado) return { funcion: null, esClase: false };
    // Cualquier otro texto es el nombre de un programa: la fila es una clase
    return { funcion: DIRECTA, esClase: true, programaClase: String(programa || '').trim() || null, idProgramaClase: null };
};

// ----------------------------------------------------------------
// Actividad del catálogo (columna ASIGNATURAS)
// ----------------------------------------------------------------

// Equivalencias conocidas entre el texto del listado y el rol del catálogo.
// `en` es la función que indica el encabezado; `funcion` (opcional) corrige la
// función cuando el catálogo ubica ese rol en otra (Proyección social está
// en Investigación). Si el rol no existe en el catálogo, la equivalencia se ignora.
const EQUIVALENCIAS = [
    { en: INVESTIGACION, patron: 'semillero', rol: 'Mentor Semilleros de investigación' },
    { en: INVESTIGACION, patron: 'direccion de grupo', rol: 'Líder de grupo de investigación' },
    { en: INVESTIGACION, patron: 'lider de grupo', rol: 'Líder de grupo de investigación' },
    { en: INVESTIGACION, patron: 'co investigador', rol: 'Co Investigador' },
    { en: INVESTIGACION, patron: 'coinvestigador', rol: 'Co Investigador' },
    { en: INVESTIGACION, patron: 'investigador principal', ambiguo: ['Investigador principal proyecto financiación interna', 'Investigador principal proyecto financiación externa'] },
    { en: ACADEMICO_ADMIN, patron: 'practica', rol: 'Coordinador prácticas formativas' },
    { en: ACADEMICO_ADMIN, patron: 'coordinacion academic', rol: 'Coordinador académico' },
    { en: ACADEMICO_ADMIN, patron: 'coordinador academic', rol: 'Coordinador académico' },
    { en: ACADEMICO_ADMIN, patron: 'postgrado', rol: 'Coordinador de programa de postgrado' },
    { en: ACADEMICO_ADMIN, patron: 'posgrado', rol: 'Coordinador de programa de postgrado' },
    { en: ACADEMICO_ADMIN, patron: 'director de programa', rol: 'Director de programa de pregrado' },
    { en: ACADEMICO_ADMIN, patron: 'direccion de programa', rol: 'Director de programa de pregrado' },
    { en: ACADEMICO_ADMIN, patron: 'saber pro', rol: 'Estrategias de mejoramiento Saber Pro' },
    { en: ACADEMICO_ADMIN, patron: 'egresado', rol: 'Egresados' },
    { en: ACADEMICO_ADMIN, patron: 'gestion curricular', rol: 'Gestión Curricular' },
    { en: VICERRECTORIA, patron: 'proyeccion social', funcion: INVESTIGACION, rol: 'Proyección Social y Extensión' },
    { en: VICERRECTORIA, patron: 'acompanamiento integral', rol: 'Docentes de acompañamiento integral' },
    { en: VICERRECTORIA, patron: 'acompanamiento academico', rol: 'Docentes de acompañamiento académico' },
];

const PALABRAS_VACIAS = new Set(['de', 'la', 'el', 'los', 'las', 'del', 'en', 'y', 'a', 'e', 'o', 'u',
    'por', 'para', 'con', 'cual', 'al', 'un', 'una']);

// Raíces de 5 letras: "coordinación"/"coordinador" y "académico"/"académica" coinciden
const raices = (s) => new Set(normalizar(s).split(' ')
    .filter((w) => w.length > 2 && !PALABRAS_VACIAS.has(w))
    .map((w) => w.slice(0, 5)));

const contenido = (a, b) => [...a].every((x) => b.has(x));

const esRolOtro = (rol) => normalizar(rol).startsWith('otro');

/**
 * Busca el rol del catálogo que corresponde al texto del listado.
 * @param {string} texto     columna ASIGNATURAS
 * @param {string} funcion   función decidida por el encabezado
 * @param {Map<string,string[]>} catalogo  función → roles del catálogo maestro
 * @returns {{funcion:string, rol:string, como:'equivalencia'|'catalogo'|'unico'|'otro'|'ambiguo'|'sin_equivalencia', opciones?:string[]}}
 */
const resolverRol = (texto, funcion, catalogo) => {
    const t = normalizar(texto);
    const existe = (f, rol) => (catalogo.get(f) || []).find((r) => normalizar(r) === normalizar(rol));

    const eq = EQUIVALENCIAS.find((e) => e.en === funcion && t.includes(e.patron));
    if (eq?.ambiguo) {
        const opciones = eq.ambiguo.filter((r) => existe(funcion, r));
        if (opciones.length) return { funcion, rol: '', como: 'ambiguo', opciones };
    } else if (eq) {
        const destino = eq.funcion || funcion;
        const rol = existe(destino, eq.rol);
        if (rol) return { funcion: destino, rol, como: 'equivalencia' };
    }

    const roles = catalogo.get(funcion) || [];
    if (roles.length === 0) return { funcion, rol: '', como: 'sin_equivalencia' };
    const reales = roles.filter((r) => !esRolOtro(r));
    if (reales.length === 1 && roles.length === 1) return { funcion, rol: roles[0], como: 'unico' };

    // Coincidencia por palabras: iguales, o todas las del catálogo están en el
    // texto ("GESTIÓN DE EGRESADOS" ⊇ "Egresados"), o todas las del texto en el
    // catálogo cuando el texto dice algo concreto (2 palabras o más).
    const rt = raices(texto);
    // Un texto que solo repite el nombre de la función ("INVESTIGACIONES") no dice qué rol es
    const generico = rt.size === 0 || contenido(rt, raices(funcion));
    const candidatos = [];
    for (const rol of generico ? [] : reales) {
        const rc = raices(rol);
        if (rc.size === 0 || rt.size === 0) continue;
        const iguales = rc.size === rt.size && contenido(rc, rt);
        if (iguales || contenido(rc, rt) || (rt.size >= 2 && contenido(rt, rc))) {
            const comunes = [...rt].filter((x) => rc.has(x)).length;
            candidatos.push({ rol, puntaje: comunes / new Set([...rt, ...rc]).size });
        }
    }
    candidatos.sort((a, b) => b.puntaje - a.puntaje);
    if (candidatos.length === 1 || (candidatos.length > 1 && candidatos[0].puntaje > candidatos[1].puntaje)) {
        return { funcion, rol: candidatos[0].rol, como: 'catalogo' };
    }
    if (candidatos.length > 1) {
        const mejor = candidatos[0].puntaje;
        return { funcion, rol: '', como: 'ambiguo', opciones: candidatos.filter((c) => c.puntaje === mejor).map((c) => c.rol) };
    }

    const otro = roles.find(esRolOtro);
    if (otro) return { funcion, rol: otro, como: 'otro' };
    return { funcion, rol: '', como: 'sin_equivalencia' };
};

/**
 * Clasifica una fila del listado: función, rol del catálogo y si es una clase.
 * @param {{programa:string, asignatura:string}} fila
 * @param {{programas:Array, catalogo:Map<string,string[]>}} contexto
 */
const clasificarFila = (fila, { programas = [], catalogo = new Map() } = {}) => {
    const f = clasificarFuncion(fila.programa, programas);
    if (!f.funcion) return { ...f, rol: '', como: 'funcion_desconocida' };
    if (f.esClase) {
        return { ...f, rol: String(fila.asignatura || '').trim(), como: 'clase' };
    }
    if (f.funcion === INDIRECTA) {
        return { ...f, rol: INDIRECTA, como: 'indirecta' };
    }
    return { ...f, ...resolverRol(fila.asignatura, f.funcion, catalogo) };
};

// ----------------------------------------------------------------
// Revisión de la carga de un docente
// ----------------------------------------------------------------

const indirectaEsperada = (horasDirectas) => Math.round((Number(horasDirectas) || 0) * PROPORCION_INDIRECTA);

/**
 * Alertas de la carga de un docente según el listado. No bloquean la
 * importación: el listado es la asignación oficial y el Director la revisa.
 * @param {object} p
 * @param {Array<{funcion:string, horas:number, vinculacion?:string}>} p.filas  filas ya clasificadas
 * @param {string|null} p.sigla   vinculación del listado (TC, MT, HC, ADM)
 * @param {number} p.horasContrato  horas del contrato (0 si es hora cátedra o por definir)
 */
const revisarCarga = ({ filas, sigla, horasContrato }) => {
    const alertas = [];
    const suma = (pred) => filas.filter(pred).reduce((s, f) => s + (Number(f.horas) || 0), 0);
    const total = suma(() => true);
    const directas = suma((f) => f.funcion === DIRECTA);
    const indirectas = suma((f) => f.funcion === INDIRECTA);

    if (horasContrato > 0 && total !== horasContrato) {
        alertas.push(`La carga suma ${total} h y su contrato (${sigla || 'registrado'}) es de ${horasContrato} h.`);
    }
    if (directas > 0 && sigla !== 'HC' && sigla !== 'ADM') {
        const esperada = indirectaEsperada(directas);
        if (indirectas !== esperada) {
            alertas.push(`Docencia indirecta de ${indirectas} h; por el Acuerdo 030 (30 % de ${directas} h directas) corresponden ${esperada} h.`);
        }
    }
    return { total, directas, indirectas, alertas };
};

module.exports = {
    DIRECTA, INDIRECTA, INVESTIGACION, ACADEMICO_ADMIN, VICERRECTORIA, CALIDAD,
    PROPORCION_INDIRECTA, TIPO_CONTRATO_POR_SIGLA,
    normalizar, leerListado, leerFilasListado, clasificarVinculacion,
    clasificarFuncion, resolverRol, clasificarFila, indirectaEsperada, revisarCarga,
};
