// ================================================================
// Catálogo de la agenda a partir del formato institucional (Excel)
// ----------------------------------------------------------------
// Funciones puras: leen las pestañas de catálogo del "FORMATO AGENDA DE TRABAJO
// DOCENTE" y calculan qué cambios necesita la base para quedar igual al Excel.
// No tocan la base de datos (tests/catalogo-excel.test.js).
//
// Correspondencia con SIGAP:
//   "rol"        del Excel → actividad
//   "ACTIVIDAD"  del Excel → descripción / resultado esperado
//   "indicador"  del Excel → indicador
//
// Fuentes:
//   Investigación, Vicerrectoría (Bienestar) y Aseguramiento de Calidad → tabla de la
//   pestaña INDICADORES (una fila por rol: rol | actividad | indicadores…).
//   Académico-Administrativo → pestaña ACADEMICO_ADMIN (lista de roles de la columna A y,
//   debajo, la definición de cada rol).
// Los textos se toman del Excel con la ortografía corregida (ver corregirOrtografia).
// ================================================================

const limpiar = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

const normalizar = (s) => limpiar(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const distancia = (a, b) => {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let previa = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
        const actual = [i];
        for (let j = 1; j <= n; j++) {
            actual[j] = Math.min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        previa = actual;
    }
    return previa[n];
};

/** Parecido entre dos textos, de 0 a 1, sin tildes, mayúsculas ni signos. */
const similitud = (a, b) => {
    const x = normalizar(a), y = normalizar(b);
    const largo = Math.max(x.length, y.length);
    return largo === 0 ? 1 : 1 - distancia(x, y) / largo;
};

const UMBRAL = 0.8;

// ---------------- Ortografía ----------------
// El formato institucional trae errores de digitación ("estuantes", "Gestiòn", "lnvestigaciones" con
// ele minúscula...). Los textos del catálogo se corrigen al leerlos, de modo que cualquier
// sincronización posterior deje la ortografía correcta y no la deshaga.

// Frases completas que necesitan más que cambiar una palabra (concordancia, comas, preposiciones)
const FRASES = {
    // Investigación
    'Administración técnica de gestión cursos estuantes y docentes': 'Administración técnica de gestión de cursos, estudiantes y docentes',
    'Tutor contenidos Tau y gestión cursos estuantes y docentes': 'Tutor de contenidos TAU y gestión de cursos, estudiantes y docentes',
    'Asesoraria Investigación cuantitativa': 'Asesoría en investigación cuantitativa',
    'Asesoraria Investigación cualitativa': 'Asesoría en investigación cualitativa',
    'Producto Generación De Nuevo Conocimiento': 'Producto de generación de nuevo conocimiento',
    'Producto investigación creación': 'Producto de investigación-creación',
    'Capitulo Libro': 'Capítulo de libro',
    'Informe avance': 'Informe de avance',
    'Informe Final': 'Informe final',
    'Comité institucional de investigaciones': 'Comité Institucional de investigaciones',
    'Participación Comité editorial': 'Participación en Comité editorial',
    'Comité Etica de investigaciones': 'Comité de Ética de investigaciones',
    'Participación Comité Etica de investigaciones': 'Participación en el Comité de Ética de investigaciones',
    'Informe atividades': 'Informe de actividades',
    'Informe de resultados (Actividades y Cantidad de usuarios atendidos y demás indicadores de pertinencia)':
        'Informe de resultados (actividades, cantidad de usuarios atendidos y demás indicadores de pertinencia)',
    'Investigador principal proyecto financiación externa': 'Investigador principal de proyecto con financiación externa',
    'Investigador principal proyecto financiación interna': 'Investigador principal de proyecto con financiación interna',
    'Proyecto de investigación financiación externa': 'Proyecto de investigación con financiación externa',
    'Proyecto de investigación financiación interna': 'Proyecto de investigación con financiación interna',
    'Mentor Semilleros de investigación': 'Mentor de semilleros de investigación',
    'Autor Productos de Investigación': 'Autor de productos de investigación',
    'Informe de gestión y Bases de datos': 'Informe de gestión y bases de datos',
    'Coordinador exámenes preparatorios': 'Coordinador de exámenes preparatorios',
    'Coordinación de exámenes preparatorios programa Derecho': 'Coordinación de exámenes preparatorios del programa de Derecho',
    'Coordinador practicas formativas': 'Coordinador de prácticas formativas',
    'Monitor practicas formativas': 'Monitor de prácticas formativas',
    'Coordinación de desarrollo académico pedagógico y curricular': 'Coordinación de desarrollo académico, pedagógico y curricular',
    'Participaciòn en Comité institucional de investigaciones': 'Participación en Comité Institucional de investigaciones',
    'Gestiòn proceso editorial de Boletín CEHUMA': 'Gestión del proceso editorial del Boletín CEHUMA',
    'Gestión convenios de cooperación investigativa e innovación': 'Gestión de convenios de cooperación investigativa e innovación',
    'Informe de gestión Coordinación de innovación': 'Informe de gestión de la Coordinación de innovación',
    'Vinculación con sector público mesas de trabajo': 'Vinculación con el sector público y mesas de trabajo',
    'Coordinador de revista cientificas': 'Coordinador de revistas científicas',
    'Gestiòn proceso editorial revista Investigium IRE': 'Gestión del proceso editorial de la revista Investigium IRE',
    'Gestiòn proceso editorial revista Electronica Educación y Pedagogía': 'Gestión del proceso editorial de la revista Electrónica Educación y Pedagogía',
    'Gestiòn proceso de investigaciòn cientifica y cosolidaciòn Información SNIES del grupo de investigación':
        'Gestión del proceso de investigación científica y consolidación de información SNIES del grupo de investigación',
    'Reporte plantillas estadisticas SNIES': 'Reporte de plantillas estadísticas SNIES',
    'Informe Gestión de los semilleros del programa': 'Informe de gestión de los semilleros del programa',
    'Reporte SNIES Informe Gestión que contenga entre otros Educación continua Consultoría Proyecto de extensión Servicios de extensión y Asesorias':
        'Reporte SNIES. Informe de gestión que contenga, entre otros: educación continua, consultoría, proyecto de extensión, servicios de extensión y asesorías',
    'Integración académica_Educación continua y formación para el desarrollo': 'Integración académica, educación continua y formación para el desarrollo',
    'Impacto y transformación social_generación social transferencia social y apropiación social del conocimiento':
        'Impacto y transformación social, generación social, transferencia social y apropiación social del conocimiento',
    'Desarrollo de programas y proyectos sociales_Asesoría y Consultoría especializada': 'Desarrollo de programas y proyectos sociales, asesoría y consultoría especializada',
    'Extensión Universitaria_Proyectos diferenciales': 'Extensión universitaria, proyectos diferenciales',
    'Voluntariado y responsabilidad social Universitaria': 'Voluntariado y responsabilidad social universitaria',
    'Vinculación e Interacción con la comunidad': 'Vinculación e interacción con la comunidad',
    'Apoyo académico sobre la traducción de artículos resúmenes y contribuciones': 'Apoyo académico sobre la traducción de artículos, resúmenes y contribuciones',
    'Informe vinculación de egresados UNICESMAG actividades programas proyectos asociaciones redes académicas y cuerpos colegiados desarrollados por unidades académico administrativas (número participantes, actividades realizadas y el propòsito de las mismas)':
        'Informe de vinculación de egresados UNICESMAG: actividades, programas, proyectos, asociaciones, redes académicas y cuerpos colegiados desarrollados por unidades académico-administrativas (número de participantes, actividades realizadas y el propósito de las mismas)',
    'Inform basado en el analisis Observatorio laboral de Momentos 0, 1 y 5': 'Informe basado en el análisis del Observatorio laboral de Momentos 0, 1 y 5',
    'Aliados estrategicos para fortalecer la bolsa de empleo institucional': 'Aliados estratégicos para fortalecer la bolsa de empleo institucional',
    // Académico-Administrativo
    'Director departamento': 'Director de departamento',
    'Dirección del Departamento': 'Dirección del departamento',
    'Coordinación del programa de pregrado asignación según total estudiantes AC 018 art 15 literal e':
        'Coordinación del programa de pregrado: asignación según total de estudiantes, AC 018, art. 15, literal e',
    'Gestión de Coordinación del programa de postgrado asignación según total estudiantes AC 018 art 15 literal d':
        'Gestión de la Coordinación del programa de postgrado: asignación según total de estudiantes, AC 018, art. 15, literal d',
    'Dirección del programa asignación según total de estudiantes AC 018 art 15 literal b':
        'Dirección del programa: asignación según total de estudiantes, AC 018, art. 15, literal b',
    'Cumplimiento Plan de acción': 'Cumplimiento del Plan de acción',
    'Informe de gestión en cumplimiento al plan de acción': 'Informe de gestión en cumplimiento del plan de acción',
    'Informe gestión en cumplimiento al plan de acción': 'Informe de gestión en cumplimiento del plan de acción',
    'Apoyo plan de acción': 'Apoyo al plan de acción',
    'Realiza seguimiento inducción de la parte formativa académica y operativa de las prácticas':
        'Realiza seguimiento e inducción de la parte formativa, académica y operativa de las prácticas',
    'Gestión de la dirección de consultorios centro de conciliación y las clínicas jurídicas':
        'Gestión de la dirección de consultorios, centro de conciliación y clínicas jurídicas',
    'Acompañamiento diciplinar Revisión de componentes curriculares Gestion de la calidad Autoevalucón permanente Otras designaciones':
        'Acompañamiento disciplinar, revisión de componentes curriculares, gestión de la calidad, autoevaluación permanente y otras designaciones',
    'Analisis de resultados formulación implementación y evaluación de estrategias de mejoramiento':
        'Análisis de resultados, formulación, implementación y evaluación de estrategias de mejoramiento',
    'Documento análisis de resultados pruebas Saber Pro y de estrategias implementadas':
        'Documento de análisis de resultados de las pruebas Saber Pro y de estrategias implementadas',
    'Revisión de áreas componentes y espacios académicos del plan de estudios respecto a de Resultados de Aprendizaje y perfil de egreso':
        'Revisión de áreas, componentes y espacios académicos del plan de estudios respecto a los Resultados de Aprendizaje y al perfil de egreso',
    'Orientacion estudiantes': 'Orientación a estudiantes',
    'informe ejecutivo acompañamiento realizado': 'Informe ejecutivo del acompañamiento realizado',
    'Participacion Comite Curricular': 'Participación en Comité Curricular',
    'Informe de gestión comité curricular': 'Informe de gestión del comité curricular',
    'Informe proyectos de investigación': 'Informe de proyectos de investigación',
    // Vicerrectoría
    'Docente de deporte arte y cultura': 'Docente de deporte, arte y cultura',
    'Docente área paz y convivencia': 'Docente del área de paz y convivencia',
    'Desarrollo de componentes programas y proyectos de bienestar relacionados con deporte y cultura':
        'Desarrollo de componentes, programas y proyectos de bienestar relacionados con deporte y cultura',
    'Desarrollo de estrategias de bienestar permanencia inclusión y graduación oportuna en el programa académico de acuerdo al análisis de información sobre alertas tempranas':
        'Desarrollo de estrategias de bienestar, permanencia, inclusión y graduación oportuna en el programa académico, de acuerdo con el análisis de información sobre alertas tempranas',
    // Aseguramiento de la calidad
    'Informe de cumplimiento etapas autoevalución y cargue de evidencias en repositorio':
        'Informe de cumplimiento de etapas de autoevaluación y cargue de evidencias en repositorio',
    'Informe cumplimiento plan de trabajo para procesos de acreditación alta calidad':
        'Informe de cumplimiento del plan de trabajo para procesos de acreditación de alta calidad',
    'Organización actividades académicas': 'Organización de actividades académicas',
    'Presentación e Informe de visita de acreditación de alta calidad': 'Presentación e informe de visita de acreditación de alta calidad',
    'Presentación e Informe de visita de verificación de condiciones de calidad': 'Presentación e informe de visita de verificación de condiciones de calidad',
    'Documento Maestro de condiciones de calidad aprobado': 'Documento maestro de condiciones de calidad aprobado',
    // Docencia Indirecta
    'Preparación clases, atención estudiantes y calificación pruebas académicas.':
        'Preparación de clases, atención a estudiantes y calificación de pruebas académicas',
};

// Palabras mal escritas (se cambian palabra completa, respetando mayúsculas del inicio)
const PALABRAS = {
    estuantes: 'estudiantes', asesoraria: 'asesoría', asesorias: 'asesorías', tecnico: 'técnico', 'artìculo': 'artículo',
    capitulo: 'capítulo', etica: 'ética', 'participaciòn': 'participación', participacion: 'participación',
    'correcciòn': 'corrección', 'gestiòn': 'gestión', 'gestón': 'gestión', gestion: 'gestión', 'publicaciòn': 'publicación',
    boletin: 'boletín', cientificas: 'científicas', cientifica: 'científica', electronica: 'electrónica',
    'cosolidaciòn': 'consolidación', estadisticas: 'estadísticas',
    componenetes: 'componentes', estrategicos: 'estratégicos', analisis: 'análisis', 'propòsito': 'propósito',
    atividades: 'actividades', 'cordinación': 'coordinación', desarolla: 'desarrolla', practicas: 'prácticas',
    orientacion: 'orientación', comite: 'comité', diciplinar: 'disciplinar', 'autoevalucón': 'autoevaluación',
    autoevaluacion: 'autoevaluación', 'autoevalución': 'autoevaluación', renovacion: 'renovación', acreditacion: 'acreditación',
    'investigaciòn': 'investigación', inform: 'informe', tau: 'TAU',
};

// Letras confundidas en el Excel ("lnvestigaciones" lleva ele minúscula en lugar de i mayúscula; "Ia" es "la"):
// aquí la mayúscula importa, así que se cambian tal cual
const PALABRAS_FIJAS = { 'lnvestigaciones': 'Investigaciones', 'lnnovación': 'Innovación', 'Ia': 'la' };

const conMayusculaInicial = (original, correcta) =>
    original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()
        ? correcta[0].toUpperCase() + correcta.slice(1)
        : correcta;

/**
 * Corrige la ortografía de un texto del catálogo: frases conocidas, palabras mal escritas,
 * mayúscula inicial y sin punto final.
 */
const corregirOrtografia = (texto) => {
    const t = limpiar(texto);
    if (!t) return t;
    if (FRASES[t]) return FRASES[t];
    let r = t.replace(/[\p{L}]+/gu, (palabra) => {
        if (PALABRAS_FIJAS[palabra]) return PALABRAS_FIJAS[palabra];
        const buena = PALABRAS[palabra.toLowerCase()];
        return buena ? conMayusculaInicial(palabra, buena) : palabra;
    });
    r = r.replace(/\.$/, '').replace(/Socio jurídicas/g, 'Sociojurídicas');
    return FRASES[r] || r[0].toUpperCase() + r.slice(1);
};

// ---------------- Lectura del Excel ----------------

const sinRepetidosParecidos = (lista) => {
    const out = [];
    for (const t of lista.map(limpiar).filter(Boolean)) {
        if (!out.some((o) => similitud(o, t) >= 0.9)) out.push(t);
    }
    return out;
};

/** Tabla plana de INDICADORES entre dos filas (1 = primera fila de la hoja). */
const tablaPlana = (filas, desde, hasta) => {
    const roles = [];
    let rol = null;
    for (let i = desde - 1; i < hasta; i++) {
        const r = (filas[i] || []).map(limpiar);
        if (r.every((c) => !c)) continue;
        if (r[0]) {
            rol = { nombre: r[0], descripciones: [] };
            roles.push(rol);
        }
        if (rol && r[1]) rol.descripciones.push({ texto: r[1], indicadores: sinRepetidosParecidos(r.slice(2)) });
    }
    return roles;
};

/** ACADEMICO_ADMIN: lista de roles (A2:A22) y definición de cada uno más abajo. */
const academicoAdministrativo = (filas) => {
    const lista = [];
    for (let i = 1; i <= 21; i++) if (limpiar(filas[i]?.[0])) lista.push(limpiar(filas[i][0]));
    const conocidos = [...lista, 'Comite curricular'];
    // Nombre del rol tal como está en la lista desplegable: primero el idéntico, si no el más parecido
    const nombreOficial = (n) => {
        const igual = lista.find((l) => normalizar(l) === normalizar(n));
        if (igual) return igual;
        const mejor = lista.map((l) => ({ l, s: similitud(l, n) })).sort((x, y) => y.s - x.s)[0];
        return mejor && mejor.s >= UMBRAL ? mejor.l : n;
    };

    const roles = [];
    let rol = null, actividad = null;
    for (let i = 22; i < 99; i++) {
        const r = (filas[i] || []).map(limpiar);
        if (r.every((c) => !c)) continue;
        const c0 = r[0];
        const resto = r.slice(1).filter(Boolean);

        const comoDescripcion = rol && c0 && rol.descripciones.find((d) => normalizar(d.texto) === normalizar(c0));
        const esRol = c0 && resto.length > 0 && !comoDescripcion && conocidos.some((k) => similitud(k, c0) >= UMBRAL);
        if (esRol) {
            rol = { nombre: nombreOficial(c0), descripciones: resto.map((t) => ({ texto: t, indicadores: [] })) };
            roles.push(rol);
            actividad = null;
            continue;
        }
        if (rol && c0) {
            const d = comoDescripcion || rol.descripciones.find((x) => similitud(x.texto, c0) >= 0.85);
            if (d) {
                actividad = d;
                d.indicadores = sinRepetidosParecidos([...d.indicadores, ...resto]);
                continue;
            }
        }
        if (!c0 && resto.length && actividad) actividad.indicadores = sinRepetidosParecidos([...actividad.indicadores, ...resto]);
    }
    return roles;
};

/**
 * @param {(hoja:string) => string[][]} filasDe  devuelve las filas de una hoja
 * @returns {Object<string, Array<{nombre:string, descripciones:Array<{texto:string, indicadores:string[]}>}>>}
 */
const leerCatalogoExcel = (filasDe) => {
    const indicadores = filasDe('INDICADORES');
    const crudo = {
        'Investigación': tablaPlana(indicadores, 2, 31).filter((r) => r.descripciones.length > 0),
        'Vicerrectoría': tablaPlana(indicadores, 35, 38),
        'Aseguramiento de Calidad': tablaPlana(indicadores, 41, 45),
        'Académico-Administrativo': academicoAdministrativo(filasDe('ACADEMICO_ADMIN')).filter((r) => r.descripciones.length > 0),
    };
    const corregido = {};
    for (const [funcion, roles] of Object.entries(crudo)) {
        corregido[funcion] = roles.map((r) => ({
            nombre: corregirOrtografia(r.nombre),
            descripciones: r.descripciones.map((d) => ({
                texto: corregirOrtografia(d.texto),
                indicadores: sinRepetidosParecidos(d.indicadores.map(corregirOrtografia)),
            })),
        }));
    }
    return corregido;
};

// ---------------- Comparación con la base ----------------

/**
 * Empareja los textos del Excel con los de la base: primero los iguales (sin tildes ni
 * mayúsculas) y después los más parecidos, uno a uno.
 * @returns {number[]} para cada texto del Excel, el índice del texto de la base o -1
 */
const emparejar = (objetivo, actual) => {
    const resultado = objetivo.map(() => -1);
    const usados = new Set();
    objetivo.forEach((t, i) => {
        const j = actual.findIndex((a, k) => !usados.has(k) && normalizar(a) === normalizar(t));
        if (j !== -1) { resultado[i] = j; usados.add(j); }
    });
    const candidatos = [];
    objetivo.forEach((t, i) => {
        if (resultado[i] !== -1) return;
        actual.forEach((a, j) => { if (!usados.has(j)) candidatos.push({ i, j, s: similitud(t, a) }); });
    });
    candidatos.sort((x, y) => y.s - x.s);
    for (const c of candidatos) {
        if (c.s < UMBRAL || resultado[c.i] !== -1 || usados.has(c.j)) continue;
        resultado[c.i] = c.j;
        usados.add(c.j);
    }
    return resultado;
};

const esOtro = (nombre) => /^otro/i.test(limpiar(nombre));

/**
 * Cambios que necesita la base de una función para quedar igual al Excel.
 * @param {Array} objetivo  roles del Excel
 * @param {Array<{id,nombre,descripciones:Array<{id,texto,indicadores:Array<{id,nombre}>}>}>} actual  actividades de la base
 * "Otro/Cuál" es la salida del sistema: nunca se toca.
 */
const planificarFuncion = (objetivo, actual) => {
    const ops = [];
    const propias = actual.filter((a) => !esOtro(a.nombre));
    const par = emparejar(objetivo.map((o) => o.nombre), propias.map((a) => a.nombre));

    objetivo.forEach((rol, idx) => {
        const orden = idx + 1; // solo se usa al crear; las actividades se muestran de la A a la Z
        const a = par[idx] === -1 ? null : propias[par[idx]];
        if (!a) {
            ops.push({ op: 'crear_actividad', nombre: rol.nombre, orden, descripciones: rol.descripciones });
            return;
        }
        if (a.nombre !== rol.nombre) ops.push({ op: 'renombrar_actividad', id: a.id, de: a.nombre, a: rol.nombre });
        if (a.activo === false) ops.push({ op: 'mostrar', tipo: 'actividades', id: a.id, nombre: rol.nombre });

        const pd = emparejar(rol.descripciones.map((d) => d.texto), a.descripciones.map((d) => d.texto));
        rol.descripciones.forEach((desc, k) => {
            const d = pd[k] === -1 ? null : a.descripciones[pd[k]];
            if (!d) {
                ops.push({ op: 'crear_descripcion', idActividad: a.id, actividad: rol.nombre, texto: desc.texto, indicadores: desc.indicadores });
                return;
            }
            if (d.texto !== desc.texto) ops.push({ op: 'renombrar_descripcion', id: d.id, de: d.texto, a: desc.texto });
            if (d.activo === false) ops.push({ op: 'mostrar', tipo: 'descripciones', id: d.id, nombre: desc.texto });
            // Si el Excel no trae indicadores para esa descripción se conservan los de la base:
            // sin indicador el docente no podría aceptar la función
            if (desc.indicadores.length === 0) return;
            const pi = emparejar(desc.indicadores, d.indicadores.map((i) => i.nombre));
            desc.indicadores.forEach((ind, m) => {
                const i = pi[m] === -1 ? null : d.indicadores[pi[m]];
                if (!i) ops.push({ op: 'crear_indicador', idDescripcion: d.id, descripcion: desc.texto, nombre: ind });
                else {
                    if (i.nombre !== ind) ops.push({ op: 'renombrar_indicador', id: i.id, de: i.nombre, a: ind });
                    if (i.activo === false) ops.push({ op: 'mostrar', tipo: 'indicadores', id: i.id, nombre: ind });
                }
            });
            d.indicadores.forEach((i, m) => { if (!pi.includes(m)) ops.push({ op: 'quitar_indicador', id: i.id, nombre: i.nombre, descripcion: desc.texto }); });
        });
        a.descripciones.forEach((d, k) => {
            if (!pd.includes(k)) ops.push({ op: 'quitar_descripcion', id: d.id, texto: d.texto, actividad: rol.nombre });
        });
    });
    propias.forEach((a, k) => { if (!par.includes(k)) ops.push({ op: 'quitar_actividad', id: a.id, nombre: a.nombre }); });
    return ops;
};

module.exports = {
    limpiar, normalizar, similitud, emparejar, esOtro, corregirOrtografia,
    leerCatalogoExcel, planificarFuncion,
};
