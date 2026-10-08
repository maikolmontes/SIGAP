// ================================================================
// Parámetros generales — administración del catálogo maestro
// ----------------------------------------------------------------
//   Función sustantiva → Actividad → Descripción (con meta) → Indicador
//
// Reglas de diseño:
//  - Lo habitual es "ocultar": saca el elemento de las agendas nuevas y se
//    puede revertir. Las agendas ya creadas guardan su propia copia del
//    texto, así que ocultar o agregar no las altera.
//  - "Eliminar" existe para corregir un error al crear: solo se permite en lo
//    que ninguna agenda usa, y quita también lo que cuelga de ello.
//  - Un texto que alguna agenda ya usa no se puede renombrar (el docente
//    perdería la coincidencia con su selección): se oculta y se crea otro.
//    La meta sí se puede cambiar: solo afecta a las agendas nuevas.
//  - Toda actividad nace con su descripción e indicador; si no, el docente
//    no podría aceptar la función.
//  - Las actividades "Otro/Cuál" y las funciones Docencia Directa/Indirecta
//    están protegidas: el importador y la agenda dependen de ellas.
//  - En Docencia Indirecta el catálogo llega hasta la descripción: el
//    indicador lo registra el docente.
//  - La meta la registra cada docente en su agenda. En el catálogo solo
//    existe la de Docencia Directa, que va por defecto; en las demás
//    funciones no se pide ni se modifica.
// ================================================================
const pool = require('../db/connection');
const auditoria = require('../services/auditoriaService');
const { condicionCatalogoAdmin, asegurarEsquemaCatalogo, ordenarActividades } = require('../utils/catalogo');
const { normalizar } = require('../utils/listadoAgenda');

const MAX_NOMBRE = 300;
const MAX_TEXTO = 1500;
const FUNCIONES_PROTEGIDAS = new Set(['docencia directa', 'docencia indirecta']);

const esOtro = (rol) => /^otro/i.test(String(rol || '').trim());
const esFuncionProtegida = (nombre) => FUNCIONES_PROTEGIDAS.has(normalizar(nombre));
// "Otro/Cuál" y las actividades de Docencia Directa/Indirecta no se tocan: la agenda y el importador las
// reconocen por nombre (la actividad de Docencia Indirecta debe llamarse igual que la función)
const actividadProtegida = (nombreFuncion, rol) => esOtro(rol) || esFuncionProtegida(nombreFuncion);
const motivoActividadProtegida = (rol, accion) => esOtro(rol)
    ? `La actividad "Otro/Cuál" no se puede ${accion}: el importador y la agenda la usan.`
    : `Esta actividad es del sistema (la agenda y el importador la reconocen por su nombre): no se puede ${accion}.`;
const FUNCIONES_CON_META = new Set(['docencia directa']);
// En Docencia Indirecta el formato institucional llega solo hasta la descripción: el indicador lo escribe el docente
const FUNCIONES_SIN_INDICADOR = new Set(['docencia indirecta']);
const usaIndicadores = (nombreFuncion) => !FUNCIONES_SIN_INDICADOR.has(normalizar(nombreFuncion));
const usaMeta = (nombreFuncion) => FUNCIONES_CON_META.has(normalizar(nombreFuncion));

class ErrorParametros extends Error {
    constructor(mensaje, status = 400, extra = {}) {
        super(mensaje);
        this.status = status;
        this.extra = extra;
    }
}

// ---------------- Validación ----------------

const texto = (valor, etiqueta, max, errores) => {
    const t = String(valor ?? '').replace(/\s+/g, ' ').trim();
    if (!t) { errores.push(`${etiqueta} es obligatorio.`); return ''; }
    if (t.length > max) { errores.push(`${etiqueta} no puede superar ${max} caracteres.`); return ''; }
    return t;
};

const metaValida = (valor, errores) => {
    if (valor === undefined || valor === null || valor === '') return 1;
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0 || n > 100000) {
        errores.push('La meta debe ser un número mayor o igual a 0.');
        return 1;
    }
    return n;
};

const lanzarSiHayErrores = (errores) => {
    if (errores.length > 0) throw new ErrorParametros(errores[0], 400, { errores });
};

const idDe = (req) => {
    const id = parseInt(req.params.id, 10);
    if (!id) throw new ErrorParametros('Identificador inválido.');
    return id;
};

// Datos de una actividad nueva (nombre + primera descripción + primer indicador)
const datosActividad = (cuerpo = {}, conMeta = false, conIndicador = true) => {
    const errores = [];
    const d = {
        nombre: texto(cuerpo.nombre, 'El nombre de la actividad', MAX_NOMBRE, errores),
        descripcion: texto(cuerpo.descripcion, 'La descripción / resultado esperado', MAX_TEXTO, errores),
        meta: conMeta ? metaValida(cuerpo.meta, errores) : null,
        indicador: conIndicador ? texto(cuerpo.indicador, 'El indicador', MAX_TEXTO, errores) : null,
    };
    lanzarSiHayErrores(errores);
    return d;
};

// ---------------- Consultas de apoyo ----------------

const cargarFuncion = async (client, idFunciones) => {
    const r = await client.query(`
        SELECT af.id_funciones, af.funcion_sustantiva, af.estado_agenda
        FROM asignacion_funciones af
        WHERE af.id_funciones = $1 AND ${condicionCatalogoAdmin('af')}
    `, [idFunciones]);
    if (r.rows.length === 0) throw new ErrorParametros('La función no existe en el catálogo.', 404);
    return r.rows[0];
};

const cargarActividad = async (client, idAct) => {
    const r = await client.query(`
        SELECT aa.id_asignacionact, aa.id_funciones, aa.rol_seleccionado, af.funcion_sustantiva
        FROM asignacion_actividades aa
        JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones
        WHERE aa.id_asignacionact = $1 AND ${condicionCatalogoAdmin('af')}
    `, [idAct]);
    if (r.rows.length === 0) throw new ErrorParametros('La actividad no existe en el catálogo.', 404);
    return r.rows[0];
};

const cargarDescripcion = async (client, idDesc) => {
    const r = await client.query(`
        SELECT d.id_descripcion, d.id_asignacionact, d.resultado_esperado, aa.rol_seleccionado, af.funcion_sustantiva
        FROM descripcion d
        JOIN asignacion_actividades aa ON aa.id_asignacionact = d.id_asignacionact
        JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones
        WHERE d.id_descripcion = $1 AND ${condicionCatalogoAdmin('af')}
    `, [idDesc]);
    if (r.rows.length === 0) throw new ErrorParametros('La descripción no existe en el catálogo.', 404);
    return r.rows[0];
};

const cargarIndicador = async (client, idInd) => {
    const r = await client.query(`
        SELECT i.id_indicadores, i.id_descripcion, i.nombre_indicador, af.funcion_sustantiva
        FROM indicadores i
        JOIN descripcion d ON d.id_descripcion = i.id_descripcion
        JOIN asignacion_actividades aa ON aa.id_asignacionact = d.id_asignacionact
        JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones
        WHERE i.id_indicadores = $1 AND ${condicionCatalogoAdmin('af')}
    `, [idInd]);
    if (r.rows.length === 0) throw new ErrorParametros('El indicador no existe en el catálogo.', 404);
    return r.rows[0];
};

// Agenda de docentes = función que tiene alguien asignado
const AGENDA_CON_DOCENTE = `EXISTS (SELECT 1 FROM usuario_asignacion ua WHERE ua.id_funciones = af.id_funciones)`;

const usoFuncion = async (client, funcion) => Number((await client.query(
    `SELECT COUNT(*) AS n FROM asignacion_funciones af WHERE af.funcion_sustantiva = $1 AND ${AGENDA_CON_DOCENTE}`, [funcion])).rows[0].n);

const usoActividad = async (client, funcion, rol) => Number((await client.query(`
    SELECT COUNT(*) AS n FROM asignacion_actividades aa
    JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones
    WHERE af.funcion_sustantiva = $1 AND aa.rol_seleccionado = $2 AND ${AGENDA_CON_DOCENTE}`, [funcion, rol])).rows[0].n);

const usoDescripcion = async (client, funcion, resultado) => Number((await client.query(`
    SELECT COUNT(DISTINCT aa.id_asignacionact) AS n FROM descripcion d
    JOIN asignacion_actividades aa ON aa.id_asignacionact = d.id_asignacionact
    JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones
    WHERE af.funcion_sustantiva = $1 AND d.resultado_esperado = $2 AND ${AGENDA_CON_DOCENTE}`, [funcion, resultado])).rows[0].n);

const usoIndicador = async (client, funcion, nombre) => Number((await client.query(`
    SELECT COUNT(DISTINCT aa.id_asignacionact) AS n FROM indicadores i
    JOIN descripcion d ON d.id_descripcion = i.id_descripcion
    JOIN asignacion_actividades aa ON aa.id_asignacionact = d.id_asignacionact
    JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones
    WHERE af.funcion_sustantiva = $1 AND i.nombre_indicador = $2 AND ${AGENDA_CON_DOCENTE}`, [funcion, nombre])).rows[0].n);

const nombreRepetido = (existentes, nuevo, exceptoId, campoId) =>
    existentes.some((e) => e[campoId] !== exceptoId && normalizar(e.nombre) === normalizar(nuevo));

// Crea la actividad con su primera descripción e indicador
const insertarActividad = async (client, idFunciones, datos) => {
    const orden = (await client.query(
        'SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM asignacion_actividades WHERE id_funciones = $1', [idFunciones])).rows[0].n;
    const act = await client.query(`
        INSERT INTO asignacion_actividades (id_funciones, rol_seleccionado, horas_rol, orden, activo)
        VALUES ($1, $2, 0, $3, TRUE) RETURNING id_asignacionact
    `, [idFunciones, datos.nombre, orden]);
    const idAct = act.rows[0].id_asignacionact;
    const desc = await client.query(`
        INSERT INTO descripcion (id_asignacionact, resultado_esperado, meta, activo)
        VALUES ($1, $2, $3, TRUE) RETURNING id_descripcion
    `, [idAct, datos.descripcion, datos.meta]);
    if (datos.indicador) {
        await client.query(
            'INSERT INTO indicadores (id_descripcion, nombre_indicador, activo) VALUES ($1, $2, TRUE)',
            [desc.rows[0].id_descripcion, datos.indicador]);
    }
    return idAct;
};

// ---------------- Envoltorio común ----------------

const conTransaccion = (accion, fn) => async (req, res) => {
    let client;
    try {
        await asegurarEsquemaCatalogo();
        client = await pool.connect();
        await client.query('BEGIN');
        const salida = await fn(client, req);
        await client.query('COMMIT');
        if (accion) {
            await auditoria.registrar(req, { accion: `parametros_${accion}`, entidad: 'catalogo', detalle: salida.detalle || {} });
        }
        res.status(salida.status || 200).json(salida.cuerpo);
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        if (err instanceof ErrorParametros) {
            return res.status(err.status).json({ error: err.message, ...err.extra });
        }
        if (err.code === '23503') {
            return res.status(409).json({ error: 'Tiene registros relacionados: ocúltalo en lugar de eliminarlo.' });
        }
        console.error(`Error en parametros (${accion}):`, err);
        res.status(500).json({ error: 'No se pudo completar la operación sobre el catálogo.' });
    } finally {
        if (client) client.release();
    }
};

// ================================================================
// GET /api/parametros/arbol
// ================================================================
const getArbol = async (req, res) => {
    try {
        await asegurarEsquemaCatalogo();
        const filas = (await pool.query(`
            SELECT af.id_funciones, af.funcion_sustantiva, af.estado_agenda,
                   aa.id_asignacionact, aa.rol_seleccionado, COALESCE(aa.activo, TRUE) AS act_activa,
                   d.id_descripcion, d.resultado_esperado, d.meta, COALESCE(d.activo, TRUE) AS desc_activa,
                   i.id_indicadores, i.nombre_indicador, COALESCE(i.activo, TRUE) AS ind_activo
            FROM asignacion_funciones af
            LEFT JOIN asignacion_actividades aa ON aa.id_funciones = af.id_funciones
            LEFT JOIN descripcion d ON d.id_asignacionact = aa.id_asignacionact
            LEFT JOIN indicadores i ON i.id_descripcion = d.id_descripcion
            WHERE ${condicionCatalogoAdmin('af')}
            ORDER BY af.id_funciones, (aa.rol_seleccionado ILIKE 'otro%'), aa.orden NULLS LAST, aa.id_asignacionact, d.id_descripcion, i.id_indicadores
        `)).rows;

        // Cuántas agendas de docentes usan cada texto (las agendas guardan copia del texto)
        const uso = async (sql) => {
            const m = new Map();
            for (const r of (await pool.query(sql)).rows) m.set(`${r.f}\u0001${r.k ?? ''}`, Number(r.n));
            return m;
        };
        const [uF, uA, uD, uI] = await Promise.all([
            uso(`SELECT af.funcion_sustantiva AS f, '' AS k, COUNT(*) AS n FROM asignacion_funciones af
                 WHERE ${AGENDA_CON_DOCENTE} GROUP BY 1`),
            uso(`SELECT af.funcion_sustantiva AS f, aa.rol_seleccionado AS k, COUNT(*) AS n
                 FROM asignacion_actividades aa JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones
                 WHERE ${AGENDA_CON_DOCENTE} GROUP BY 1, 2`),
            uso(`SELECT af.funcion_sustantiva AS f, d.resultado_esperado AS k, COUNT(DISTINCT aa.id_asignacionact) AS n
                 FROM descripcion d JOIN asignacion_actividades aa ON aa.id_asignacionact = d.id_asignacionact
                 JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones
                 WHERE ${AGENDA_CON_DOCENTE} GROUP BY 1, 2`),
            uso(`SELECT af.funcion_sustantiva AS f, i.nombre_indicador AS k, COUNT(DISTINCT aa.id_asignacionact) AS n
                 FROM indicadores i JOIN descripcion d ON d.id_descripcion = i.id_descripcion
                 JOIN asignacion_actividades aa ON aa.id_asignacionact = d.id_asignacionact
                 JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones
                 WHERE ${AGENDA_CON_DOCENTE} GROUP BY 1, 2`),
        ]);
        const usos = (mapa, f, k = '') => mapa.get(`${f}\u0001${k}`) || 0;

        const funciones = [];
        const fMap = new Map(), aMap = new Map(), dMap = new Map();
        for (const r of filas) {
            if (!fMap.has(r.id_funciones)) {
                const f = {
                    id: r.id_funciones,
                    nombre: r.funcion_sustantiva,
                    activo: r.estado_agenda === 'Activo',
                    en_uso: usos(uF, r.funcion_sustantiva),
                    protegida: esFuncionProtegida(r.funcion_sustantiva),
                    usa_meta: usaMeta(r.funcion_sustantiva),
                    usa_indicadores: usaIndicadores(r.funcion_sustantiva),
                    actividades: [],
                };
                fMap.set(r.id_funciones, f);
                funciones.push(f);
            }
            const f = fMap.get(r.id_funciones);
            if (!r.id_asignacionact) continue;
            if (!aMap.has(r.id_asignacionact)) {
                const a = {
                    id: r.id_asignacionact,
                    nombre: r.rol_seleccionado,
                    activo: r.act_activa,
                    en_uso: usos(uA, f.nombre, r.rol_seleccionado),
                    protegida: actividadProtegida(f.nombre, r.rol_seleccionado),
                    descripciones: [],
                };
                aMap.set(r.id_asignacionact, a);
                f.actividades.push(a);
            }
            const a = aMap.get(r.id_asignacionact);
            if (!r.id_descripcion) continue;
            if (!dMap.has(r.id_descripcion)) {
                const d = {
                    id: r.id_descripcion,
                    texto: r.resultado_esperado,
                    meta: r.meta === null ? null : Number(r.meta),
                    activo: r.desc_activa,
                    en_uso: usos(uD, f.nombre, r.resultado_esperado),
                    indicadores: [],
                };
                dMap.set(r.id_descripcion, d);
                a.descripciones.push(d);
            }
            if (r.id_indicadores) {
                dMap.get(r.id_descripcion).indicadores.push({
                    id: r.id_indicadores,
                    nombre: r.nombre_indicador,
                    activo: r.ind_activo,
                    en_uso: usos(uI, f.nombre, r.nombre_indicador),
                });
            }
        }
        funciones.forEach((f) => ordenarActividades(f.actividades, (a) => a.nombre));
        res.json({ funciones });
    } catch (err) {
        console.error('Error en parametros.getArbol:', err);
        res.status(500).json({ error: 'No se pudo cargar el catálogo.' });
    }
};

// ================================================================
// GET /api/parametros/asignaturas
// Asignaturas (espacios académicos) cargadas. Solo lectura: las crea el
// importador a partir del listado de Excel, que es la fuente oficial.
// ================================================================
const getAsignaturas = async (req, res) => {
    try {
        const filas = (await pool.query(`
            SELECT e.id_espacio_aca AS id, e.nombre_espacio AS nombre, e.codigo_espacio AS codigo,
                   e.creditos, e.horas_semana, COALESCE(e.activo, TRUE) AS activo,
                   s.nombre_sem AS semestre, pa.version_pensul AS pensum,
                   (SELECT COUNT(*) FROM asignacion_actividades aa WHERE aa.id_espacio_aca = e.id_espacio_aca) AS en_agendas
            FROM espacio_academico e
            LEFT JOIN semestres s ON s.id_semestre = e.id_semestre
            LEFT JOIN pensul_academico pa ON pa.id_pensulaca = s.id_pensulaca
            ORDER BY NULLIF(regexp_replace(COALESCE(s.nombre_sem, ''), '[^0-9]', '', 'g'), '')::int NULLS LAST, e.nombre_espacio
        `)).rows.map((r) => ({ ...r, en_agendas: Number(r.en_agendas) }));
        res.json({ asignaturas: filas });
    } catch (err) {
        console.error('Error en parametros.getAsignaturas:', err);
        res.status(500).json({ error: 'No se pudieron cargar las asignaturas.' });
    }
};

// ================================================================
// Crear
// ================================================================

// POST /funciones { nombre, actividad: { nombre, descripcion, meta, indicador } }
const crearFuncion = conTransaccion('crear_funcion', async (client, req) => {
    const errores = [];
    const nombre = texto(req.body?.nombre, 'El nombre de la función', MAX_NOMBRE, errores);
    lanzarSiHayErrores(errores);
    const actividad = datosActividad(req.body?.actividad, false);

    const existentes = (await client.query(
        `SELECT af.funcion_sustantiva AS nombre FROM asignacion_funciones af WHERE ${condicionCatalogoAdmin('af')}`)).rows;
    if (nombreRepetido(existentes, nombre, null, 'id')) {
        throw new ErrorParametros(`Ya existe una función llamada "${nombre}".`, 409);
    }
    const f = await client.query(`
        INSERT INTO asignacion_funciones (funcion_sustantiva, horas_funcion, estado_agenda, observaciones_generales)
        VALUES ($1, 0, 'Activo', 'Función del catálogo creada desde Parámetros generales') RETURNING id_funciones
    `, [nombre]);
    await insertarActividad(client, f.rows[0].id_funciones, actividad);
    return { status: 201, cuerpo: { id: f.rows[0].id_funciones }, detalle: { funcion: nombre, actividad: actividad.nombre } };
});

// POST /funciones/:id/actividades { nombre, descripcion, meta, indicador }
const crearActividad = conTransaccion('crear_actividad', async (client, req) => {
    const funcion = await cargarFuncion(client, idDe(req));
    const datos = datosActividad(req.body, usaMeta(funcion.funcion_sustantiva), usaIndicadores(funcion.funcion_sustantiva));
    const hermanas = (await client.query(
        'SELECT id_asignacionact AS id, rol_seleccionado AS nombre FROM asignacion_actividades WHERE id_funciones = $1', [funcion.id_funciones])).rows;
    if (nombreRepetido(hermanas, datos.nombre, null, 'id')) {
        throw new ErrorParametros(`${funcion.funcion_sustantiva} ya tiene una actividad llamada "${datos.nombre}".`, 409);
    }
    const id = await insertarActividad(client, funcion.id_funciones, datos);
    return { status: 201, cuerpo: { id }, detalle: { funcion: funcion.funcion_sustantiva, actividad: datos.nombre } };
});

// POST /actividades/:id/descripciones { texto, meta, indicador }
const crearDescripcion = conTransaccion('crear_descripcion', async (client, req) => {
    const act = await cargarActividad(client, idDe(req));
    const errores = [];
    const textoDesc = texto(req.body?.texto, 'La descripción / resultado esperado', MAX_TEXTO, errores);
    const meta = usaMeta(act.funcion_sustantiva) ? metaValida(req.body?.meta, errores) : null;
    const indicador = usaIndicadores(act.funcion_sustantiva) ? texto(req.body?.indicador, 'El indicador', MAX_TEXTO, errores) : null;
    lanzarSiHayErrores(errores);

    const hermanas = (await client.query(
        'SELECT id_descripcion AS id, resultado_esperado AS nombre FROM descripcion WHERE id_asignacionact = $1', [act.id_asignacionact])).rows;
    if (nombreRepetido(hermanas, textoDesc, null, 'id')) {
        throw new ErrorParametros('Esta actividad ya tiene una descripción igual.', 409);
    }
    const d = await client.query(`
        INSERT INTO descripcion (id_asignacionact, resultado_esperado, meta, activo)
        VALUES ($1, $2, $3, TRUE) RETURNING id_descripcion
    `, [act.id_asignacionact, textoDesc, meta]);
    if (indicador) {
        await client.query('INSERT INTO indicadores (id_descripcion, nombre_indicador, activo) VALUES ($1, $2, TRUE)',
            [d.rows[0].id_descripcion, indicador]);
    }
    return { status: 201, cuerpo: { id: d.rows[0].id_descripcion }, detalle: { funcion: act.funcion_sustantiva, actividad: act.rol_seleccionado, descripcion: textoDesc } };
});

// POST /descripciones/:id/indicadores { nombre }
const crearIndicador = conTransaccion('crear_indicador', async (client, req) => {
    const desc = await cargarDescripcion(client, idDe(req));
    if (!usaIndicadores(desc.funcion_sustantiva)) {
        throw new ErrorParametros(`En "${desc.funcion_sustantiva}" el indicador lo registra el docente en su agenda.`, 409);
    }
    const errores = [];
    const nombre = texto(req.body?.nombre, 'El indicador', MAX_TEXTO, errores);
    lanzarSiHayErrores(errores);
    const hermanos = (await client.query(
        'SELECT id_indicadores AS id, nombre_indicador AS nombre FROM indicadores WHERE id_descripcion = $1', [desc.id_descripcion])).rows;
    if (nombreRepetido(hermanos, nombre, null, 'id')) {
        throw new ErrorParametros('Esta descripción ya tiene un indicador igual.', 409);
    }
    const r = await client.query(
        'INSERT INTO indicadores (id_descripcion, nombre_indicador, activo) VALUES ($1, $2, TRUE) RETURNING id_indicadores',
        [desc.id_descripcion, nombre]);
    return { status: 201, cuerpo: { id: r.rows[0].id_indicadores }, detalle: { funcion: desc.funcion_sustantiva, indicador: nombre } };
});

// ================================================================
// Editar
// ================================================================

const rechazarRenombreEnUso = (enUso, que) => {
    if (enUso > 0) {
        throw new ErrorParametros(
            `${que} ya está en ${enUso} agenda${enUso === 1 ? '' : 's'} de docentes: no se puede renombrar. Ocúltalo y crea uno nuevo.`,
            409, { en_uso: enUso });
    }
};

// PUT /funciones/:id { nombre }
const editarFuncion = conTransaccion('editar_funcion', async (client, req) => {
    const f = await cargarFuncion(client, idDe(req));
    const errores = [];
    const nombre = texto(req.body?.nombre, 'El nombre de la función', MAX_NOMBRE, errores);
    lanzarSiHayErrores(errores);
    if (nombre !== f.funcion_sustantiva) {
        if (esFuncionProtegida(f.funcion_sustantiva)) {
            throw new ErrorParametros(`"${f.funcion_sustantiva}" no se puede renombrar: el sistema depende de ese nombre.`, 409);
        }
        rechazarRenombreEnUso(await usoFuncion(client, f.funcion_sustantiva), 'Esta función');
        const todas = (await client.query(
            `SELECT af.id_funciones AS id, af.funcion_sustantiva AS nombre FROM asignacion_funciones af WHERE ${condicionCatalogoAdmin('af')}`)).rows;
        if (nombreRepetido(todas, nombre, f.id_funciones, 'id')) {
            throw new ErrorParametros(`Ya existe una función llamada "${nombre}".`, 409);
        }
        await client.query('UPDATE asignacion_funciones SET funcion_sustantiva = $1 WHERE id_funciones = $2', [nombre, f.id_funciones]);
    }
    return { cuerpo: { ok: true }, detalle: { antes: f.funcion_sustantiva, despues: nombre } };
});

// PUT /actividades/:id { nombre }
const editarActividad = conTransaccion('editar_actividad', async (client, req) => {
    const a = await cargarActividad(client, idDe(req));
    const errores = [];
    const nombre = texto(req.body?.nombre, 'El nombre de la actividad', MAX_NOMBRE, errores);
    lanzarSiHayErrores(errores);
    if (nombre !== a.rol_seleccionado) {
        if (actividadProtegida(a.funcion_sustantiva, a.rol_seleccionado)) {
            throw new ErrorParametros(motivoActividadProtegida(a.rol_seleccionado, 'renombrar'), 409);
        }
        rechazarRenombreEnUso(await usoActividad(client, a.funcion_sustantiva, a.rol_seleccionado), 'Esta actividad');
        const hermanas = (await client.query(
            'SELECT id_asignacionact AS id, rol_seleccionado AS nombre FROM asignacion_actividades WHERE id_funciones = $1', [a.id_funciones])).rows;
        if (nombreRepetido(hermanas, nombre, a.id_asignacionact, 'id')) {
            throw new ErrorParametros(`${a.funcion_sustantiva} ya tiene una actividad llamada "${nombre}".`, 409);
        }
        await client.query('UPDATE asignacion_actividades SET rol_seleccionado = $1 WHERE id_asignacionact = $2', [nombre, a.id_asignacionact]);
    }
    return { cuerpo: { ok: true }, detalle: { funcion: a.funcion_sustantiva, antes: a.rol_seleccionado, despues: nombre } };
});

// PUT /descripciones/:id { texto, meta }   (la meta solo se guarda en Docencia Directa)
const editarDescripcion = conTransaccion('editar_descripcion', async (client, req) => {
    const d = await cargarDescripcion(client, idDe(req));
    const errores = [];
    const textoDesc = texto(req.body?.texto, 'La descripción / resultado esperado', MAX_TEXTO, errores);
    const conMeta = usaMeta(d.funcion_sustantiva);
    const meta = conMeta ? metaValida(req.body?.meta, errores) : null;
    lanzarSiHayErrores(errores);
    if (textoDesc !== d.resultado_esperado) {
        rechazarRenombreEnUso(await usoDescripcion(client, d.funcion_sustantiva, d.resultado_esperado), 'Esta descripción');
        const hermanas = (await client.query(
            'SELECT id_descripcion AS id, resultado_esperado AS nombre FROM descripcion WHERE id_asignacionact = $1', [d.id_asignacionact])).rows;
        if (nombreRepetido(hermanas, textoDesc, d.id_descripcion, 'id')) {
            throw new ErrorParametros('Esta actividad ya tiene una descripción igual.', 409);
        }
    }
    if (conMeta) {
        await client.query('UPDATE descripcion SET resultado_esperado = $1, meta = $2 WHERE id_descripcion = $3', [textoDesc, meta, d.id_descripcion]);
    } else {
        await client.query('UPDATE descripcion SET resultado_esperado = $1 WHERE id_descripcion = $2', [textoDesc, d.id_descripcion]);
    }
    return { cuerpo: { ok: true }, detalle: { funcion: d.funcion_sustantiva, actividad: d.rol_seleccionado, descripcion: textoDesc, ...(conMeta ? { meta } : {}) } };
});

// PUT /indicadores/:id { nombre }
const editarIndicador = conTransaccion('editar_indicador', async (client, req) => {
    const i = await cargarIndicador(client, idDe(req));
    const errores = [];
    const nombre = texto(req.body?.nombre, 'El indicador', MAX_TEXTO, errores);
    lanzarSiHayErrores(errores);
    if (nombre !== i.nombre_indicador) {
        rechazarRenombreEnUso(await usoIndicador(client, i.funcion_sustantiva, i.nombre_indicador), 'Este indicador');
        const hermanos = (await client.query(
            'SELECT id_indicadores AS id, nombre_indicador AS nombre FROM indicadores WHERE id_descripcion = $1', [i.id_descripcion])).rows;
        if (nombreRepetido(hermanos, nombre, i.id_indicadores, 'id')) {
            throw new ErrorParametros('Esta descripción ya tiene un indicador igual.', 409);
        }
        await client.query('UPDATE indicadores SET nombre_indicador = $1 WHERE id_indicadores = $2', [nombre, i.id_indicadores]);
    }
    return { cuerpo: { ok: true }, detalle: { funcion: i.funcion_sustantiva, antes: i.nombre_indicador, despues: nombre } };
});

// ================================================================
// Ocultar / mostrar — PATCH /:tipo/:id/activo { activo }
// ================================================================
const TIPOS = {
    funciones: async (client, id, activo) => {
        const f = await cargarFuncion(client, id);
        await client.query('UPDATE asignacion_funciones SET estado_agenda = $1 WHERE id_funciones = $2', [activo ? 'Activo' : 'Inactivo', id]);
        return { funcion: f.funcion_sustantiva, en_uso: await usoFuncion(client, f.funcion_sustantiva) };
    },
    actividades: async (client, id, activo) => {
        const a = await cargarActividad(client, id);
        if (!activo && actividadProtegida(a.funcion_sustantiva, a.rol_seleccionado)) {
            throw new ErrorParametros(motivoActividadProtegida(a.rol_seleccionado, 'ocultar'), 409);
        }
        await client.query('UPDATE asignacion_actividades SET activo = $1 WHERE id_asignacionact = $2', [activo, id]);
        return { funcion: a.funcion_sustantiva, actividad: a.rol_seleccionado, en_uso: await usoActividad(client, a.funcion_sustantiva, a.rol_seleccionado) };
    },
    descripciones: async (client, id, activo) => {
        const d = await cargarDescripcion(client, id);
        await client.query('UPDATE descripcion SET activo = $1 WHERE id_descripcion = $2', [activo, id]);
        return { funcion: d.funcion_sustantiva, descripcion: d.resultado_esperado, en_uso: await usoDescripcion(client, d.funcion_sustantiva, d.resultado_esperado) };
    },
    indicadores: async (client, id, activo) => {
        const i = await cargarIndicador(client, id);
        await client.query('UPDATE indicadores SET activo = $1 WHERE id_indicadores = $2', [activo, id]);
        return { funcion: i.funcion_sustantiva, indicador: i.nombre_indicador, en_uso: await usoIndicador(client, i.funcion_sustantiva, i.nombre_indicador) };
    },
};

const cambiarActivo = conTransaccion('cambiar_visibilidad', async (client, req) => {
    const aplicar = TIPOS[req.params.tipo];
    if (!aplicar) throw new ErrorParametros('Tipo de elemento no válido.', 404);
    if (typeof req.body?.activo !== 'boolean') throw new ErrorParametros('Indica si el elemento queda visible (activo) u oculto.');
    const activo = req.body.activo;
    const info = await aplicar(client, idDe(req), activo);
    return { cuerpo: { ok: true, activo, en_uso: info.en_uso }, detalle: { tipo: req.params.tipo, id: idDe(req), activo, ...info } };
});

// ================================================================
// Eliminar — DELETE /:tipo/:id
// Solo lo que ninguna agenda usa (un error al crear). Lo demás se oculta.
// ================================================================
const exigirSinUso = (usos, que) => {
    const total = usos.reduce((a, b) => a + b, 0);
    if (total > 0) {
        throw new ErrorParametros(
            `${que} ya está en agendas de docentes: no se puede eliminar. Ocúltalo para que no se ofrezca en las agendas nuevas.`,
            409, { en_uso: total });
    }
};

// Una descripción necesita al menos un indicador y una actividad al menos una
// descripción visible: si no, el docente no podría aceptar la función.
const exigirOtroVisible = async (client, sql, params, activoActual, mensaje) => {
    if (!activoActual) return;
    const otros = Number((await client.query(sql, params)).rows[0].n);
    if (otros === 0) throw new ErrorParametros(mensaje, 409);
};

const usosDeDescripciones = async (client, funcion, idsActividades) => {
    const filas = (await client.query(`
        SELECT d.id_descripcion, d.resultado_esperado FROM descripcion d
        WHERE d.id_asignacionact = ANY($1)`, [idsActividades])).rows;
    const inds = filas.length === 0 ? [] : (await client.query(
        'SELECT nombre_indicador FROM indicadores WHERE id_descripcion = ANY($1)', [filas.map((f) => f.id_descripcion)])).rows;
    const usos = [];
    for (const d of filas) usos.push(await usoDescripcion(client, funcion, d.resultado_esperado));
    for (const i of inds) usos.push(await usoIndicador(client, funcion, i.nombre_indicador));
    return { usos, descripciones: filas, indicadores: inds };
};

const borrarActividades = async (client, idsActividades) => {
    const descs = (await client.query('SELECT id_descripcion FROM descripcion WHERE id_asignacionact = ANY($1)', [idsActividades])).rows
        .map((r) => r.id_descripcion);
    const inds = await client.query('DELETE FROM indicadores WHERE id_descripcion = ANY($1)', [descs]);
    await client.query('DELETE FROM descripcion WHERE id_asignacionact = ANY($1)', [idsActividades]);
    await client.query('DELETE FROM actividad_semana WHERE id_asignacionact = ANY($1)', [idsActividades]);
    await client.query('DELETE FROM asignacion_actividades WHERE id_asignacionact = ANY($1)', [idsActividades]);
    return { actividades: idsActividades.length, descripciones: descs.length, indicadores: inds.rowCount };
};

const recortar = (lista, campo) => lista.slice(0, 50).map((x) => String(x[campo] ?? '').slice(0, 200));

const ELIMINAR = {
    funciones: async (client, id) => {
        const f = await cargarFuncion(client, id);
        if (esFuncionProtegida(f.funcion_sustantiva)) {
            throw new ErrorParametros(`"${f.funcion_sustantiva}" no se puede eliminar: el sistema depende de ella. Puedes ocultarla.`, 409);
        }
        exigirSinUso([await usoFuncion(client, f.funcion_sustantiva)], 'Esta función');
        const acts = (await client.query('SELECT id_asignacionact, rol_seleccionado FROM asignacion_actividades WHERE id_funciones = $1', [id])).rows;
        if (acts.some((x) => esOtro(x.rol_seleccionado))) {
            throw new ErrorParametros(`"${f.funcion_sustantiva}" contiene la actividad "Otro/Cuál", que el sistema necesita: no se puede eliminar. Puedes ocultarla.`, 409);
        }
        const cuenta = acts.length > 0
            ? await borrarActividades(client, acts.map((a) => a.id_asignacionact))
            : { actividades: 0, descripciones: 0, indicadores: 0 };
        await client.query('DELETE FROM asignacion_funciones WHERE id_funciones = $1', [id]);
        return { funcion: f.funcion_sustantiva, actividades_eliminadas: recortar(acts, 'rol_seleccionado'), ...cuenta };
    },
    actividades: async (client, id) => {
        const a = await cargarActividad(client, id);
        if (actividadProtegida(a.funcion_sustantiva, a.rol_seleccionado)) {
            throw new ErrorParametros(motivoActividadProtegida(a.rol_seleccionado, 'eliminar'), 409);
        }
        const hijos = await usosDeDescripciones(client, a.funcion_sustantiva, [id]);
        exigirSinUso([await usoActividad(client, a.funcion_sustantiva, a.rol_seleccionado), ...hijos.usos], 'Esta actividad');
        const cuenta = await borrarActividades(client, [id]);
        return { funcion: a.funcion_sustantiva, actividad: a.rol_seleccionado, descripciones_eliminadas: recortar(hijos.descripciones, 'resultado_esperado'), ...cuenta };
    },
    descripciones: async (client, id) => {
        const d = await cargarDescripcion(client, id);
        const activa = (await client.query('SELECT COALESCE(activo, TRUE) AS a FROM descripcion WHERE id_descripcion = $1', [id])).rows[0].a;
        const inds = (await client.query('SELECT nombre_indicador FROM indicadores WHERE id_descripcion = $1', [id])).rows;
        const usos = [await usoDescripcion(client, d.funcion_sustantiva, d.resultado_esperado)];
        for (const i of inds) usos.push(await usoIndicador(client, d.funcion_sustantiva, i.nombre_indicador));
        exigirSinUso(usos, 'Esta descripción');
        await exigirOtroVisible(client,
            'SELECT COUNT(*) AS n FROM descripcion WHERE id_asignacionact = $1 AND id_descripcion <> $2 AND COALESCE(activo, TRUE) = TRUE',
            [d.id_asignacionact, id], activa,
            'Es la única descripción visible de la actividad: agrega otra primero, o elimina la actividad completa.');
        await client.query('DELETE FROM indicadores WHERE id_descripcion = $1', [id]);
        await client.query('DELETE FROM descripcion WHERE id_descripcion = $1', [id]);
        return { funcion: d.funcion_sustantiva, actividad: d.rol_seleccionado, descripcion: d.resultado_esperado, indicadores_eliminados: recortar(inds, 'nombre_indicador'), indicadores: inds.length };
    },
    indicadores: async (client, id) => {
        const i = await cargarIndicador(client, id);
        const activo = (await client.query('SELECT COALESCE(activo, TRUE) AS a FROM indicadores WHERE id_indicadores = $1', [id])).rows[0].a;
        exigirSinUso([await usoIndicador(client, i.funcion_sustantiva, i.nombre_indicador)], 'Este indicador');
        await exigirOtroVisible(client,
            'SELECT COUNT(*) AS n FROM indicadores WHERE id_descripcion = $1 AND id_indicadores <> $2 AND COALESCE(activo, TRUE) = TRUE',
            [i.id_descripcion, id], activo,
            'Es el único indicador visible de la descripción: agrega otro primero, o elimina la descripción completa.');
        await client.query('DELETE FROM indicadores WHERE id_indicadores = $1', [id]);
        return { funcion: i.funcion_sustantiva, indicador: i.nombre_indicador };
    },
};

const eliminar = conTransaccion('eliminar', async (client, req) => {
    const borrar = ELIMINAR[req.params.tipo];
    if (!borrar) throw new ErrorParametros('Tipo de elemento no válido.', 404);
    const id = idDe(req);
    const resumen = await borrar(client, id);
    return { cuerpo: { ok: true }, detalle: { tipo: req.params.tipo, id, ...resumen } };
});

module.exports = {
    getArbol, getAsignaturas, crearFuncion, crearActividad, crearDescripcion, crearIndicador,
    editarFuncion, editarActividad, editarDescripcion, editarIndicador, cambiarActivo, eliminar,
};
