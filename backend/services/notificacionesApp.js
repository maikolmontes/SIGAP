// ================================================================
// SIGAP — Notificaciones dentro de la aplicación (la campana de arriba)
// ----------------------------------------------------------------
// Son los mismos avisos que se envían por correo, con los mismos
// destinatarios, pero guardados para cada usuario: aparecen en la campana
// aunque el correo esté desactivado, falle o tarde en llegar.
//
// Reglas:
//  - Una notificación jamás debe romper el flujo de negocio: crear() no lanza
//    errores, solo los registra.
//  - "clave": mientras el usuario tenga SIN LEER una notificación con la misma
//    clave no se crea otra igual (evita avisos repetidos por cada guardado).
//  - Cada usuario solo ve y marca las suyas.
//  - La tabla se crea sola si no existe (database/notificaciones_app.sql).
// ================================================================
const pool = require('../db/connection');
const { etiquetaPeriodo, etiquetaCorte } = require('../utils/periodo');

const MAX_TITULO = 200;
const MAX_MENSAJE = 600;
const DIAS_CONSERVAR_LEIDAS = 90;

let tablaLista = false;

const asegurarTabla = async (db = pool) => {
    if (tablaLista) return;
    await db.query(`
        CREATE TABLE IF NOT EXISTS notificaciones_app (
            id_notificacion SERIAL PRIMARY KEY,
            id_usuario      INTEGER      NOT NULL,
            tipo            VARCHAR(40)  NOT NULL,
            titulo          VARCHAR(200) NOT NULL,
            mensaje         TEXT,
            enlace          VARCHAR(300),
            clave           VARCHAR(200),
            leida           BOOLEAN      NOT NULL DEFAULT FALSE,
            creado_en       TIMESTAMP    NOT NULL DEFAULT NOW(),
            leida_en        TIMESTAMP
        )
    `);
    await db.query('CREATE INDEX IF NOT EXISTS idx_notif_app_usuario ON notificaciones_app (id_usuario, leida, creado_en DESC)');
    tablaLista = true;
};

const recortar = (texto, max) => {
    const t = String(texto ?? '').trim();
    return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
};

const nombrePeriodo = (periodo) => etiquetaPeriodo(periodo);

/**
 * Crea una notificación para un usuario. Devuelve true si se creó.
 * Nunca lanza: si algo falla lo deja en el registro y sigue.
 */
const crear = async ({ idUsuario, tipo, titulo, mensaje = null, enlace = null, clave = null }, db = pool) => {
    try {
        const id = Number(idUsuario);
        if (!Number.isInteger(id) || id <= 0 || !tipo || !titulo) return false;
        await asegurarTabla(db);
        if (clave) {
            const existe = await db.query(
                'SELECT 1 FROM notificaciones_app WHERE id_usuario = $1 AND clave = $2 AND leida = FALSE LIMIT 1',
                [id, clave]
            );
            if (existe.rows.length > 0) return false;
        }
        await db.query(
            `INSERT INTO notificaciones_app (id_usuario, tipo, titulo, mensaje, enlace, clave)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, tipo, recortar(titulo, MAX_TITULO), mensaje ? recortar(mensaje, MAX_MENSAJE) : null, enlace, clave]
        );
        return true;
    } catch (error) {
        console.warn('[notificaciones-app] No se pudo crear la notificación:', error.message);
        return false;
    }
};

/** Misma notificación para varios usuarios (sin repetir). Devuelve cuántas se crearon. */
const crearParaVarios = async (idsUsuarios, datos, db = pool) => {
    const ids = [...new Set((idsUsuarios || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    let creadas = 0;
    for (const idUsuario of ids) {
        if (await crear({ ...datos, idUsuario }, db)) creadas++;
    }
    return creadas;
};

// ---------------- Consulta y lectura (cada usuario, solo lo suyo) ----------------

const listar = async (idUsuario, limite = 20, db = pool) => {
    await asegurarTabla(db);
    const tope = Math.min(Math.max(parseInt(limite, 10) || 20, 1), 50);
    // Las leídas con más de 90 días se descartan solas
    await db.query(
        `DELETE FROM notificaciones_app WHERE id_usuario = $1 AND leida = TRUE AND creado_en < NOW() - ($2 || ' days')::interval`,
        [idUsuario, String(DIAS_CONSERVAR_LEIDAS)]
    );
    const filas = (await db.query(
        `SELECT id_notificacion AS id, tipo, titulo, mensaje, enlace, leida, creado_en
         FROM notificaciones_app WHERE id_usuario = $1
         ORDER BY creado_en DESC, id_notificacion DESC LIMIT $2`,
        [idUsuario, tope]
    )).rows;
    return { notificaciones: filas, no_leidas: await contarNoLeidas(idUsuario, db) };
};

const contarNoLeidas = async (idUsuario, db = pool) => {
    await asegurarTabla(db);
    const r = await db.query('SELECT COUNT(*) AS n FROM notificaciones_app WHERE id_usuario = $1 AND leida = FALSE', [idUsuario]);
    return Number(r.rows[0].n);
};

const marcarLeida = async (idUsuario, idNotificacion, db = pool) => {
    await asegurarTabla(db);
    const r = await db.query(
        `UPDATE notificaciones_app SET leida = TRUE, leida_en = NOW()
         WHERE id_notificacion = $1 AND id_usuario = $2 AND leida = FALSE`,
        [idNotificacion, idUsuario]
    );
    return r.rowCount;
};

const marcarTodasLeidas = async (idUsuario, db = pool) => {
    await asegurarTabla(db);
    const r = await db.query(
        'UPDATE notificaciones_app SET leida = TRUE, leida_en = NOW() WHERE id_usuario = $1 AND leida = FALSE',
        [idUsuario]
    );
    return r.rowCount;
};

/** Borra una notificación del usuario (solo si es suya). Devuelve cuántas borró (0 o 1). */
const eliminar = async (idUsuario, idNotificacion, db = pool) => {
    await asegurarTabla(db);
    const r = await db.query(
        'DELETE FROM notificaciones_app WHERE id_notificacion = $1 AND id_usuario = $2',
        [idNotificacion, idUsuario]
    );
    return r.rowCount;
};

/** Vacía la campana del usuario: todas, o solo las ya leídas. */
const eliminarTodas = async (idUsuario, soloLeidas = false, db = pool) => {
    await asegurarTabla(db);
    const r = await db.query(
        `DELETE FROM notificaciones_app WHERE id_usuario = $1${soloLeidas ? ' AND leida = TRUE' : ''}`,
        [idUsuario]
    );
    return r.rowCount;
};

// ---------------- Avisos masivos (no dependen de que el correo esté activo) ----------------

/** Apertura de período: docentes del período; si aún no hay, docentes y directores activos. */
const avisarAperturaPeriodo = async (idPeriodo, db = pool) => {
    const periodo = (await db.query('SELECT id_periodo, anio, semestre, fecha_fin FROM periodo WHERE id_periodo = $1', [idPeriodo])).rows[0];
    if (!periodo) return 0;

    let ids = [];
    try {
        ids = (await db.query(
            `SELECT DISTINCT u.id_usuario FROM docente_periodo dp JOIN usuarios u ON u.id_usuario = dp.id_usuario
             WHERE dp.id_periodo = $1 AND u.activo = TRUE`, [idPeriodo])).rows.map((r) => r.id_usuario);
    } catch { /* sin docente_periodo */ }
    if (ids.length === 0) {
        ids = (await db.query(
            `SELECT DISTINCT u.id_usuario FROM usuarios u
             JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario JOIN roles r ON r.id_rol = ur.id_rol
             WHERE u.activo = TRUE AND (LOWER(r.nombre_rol) LIKE '%docent%' OR LOWER(r.nombre_rol) LIKE '%direct%')`)).rows.map((r) => r.id_usuario);
    }
    const fin = periodo.fecha_fin ? new Date(periodo.fecha_fin).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
    return crearParaVarios(ids, {
        tipo: 'apertura_periodo',
        titulo: `Se abrió el período ${nombrePeriodo(periodo)}`,
        mensaje: fin ? `Ya puedes trabajar tu agenda. El período cierra el ${fin}.` : 'Ya puedes trabajar tu agenda.',
        enlace: '/docente/agenda',
        clave: `apertura_periodo:${periodo.id_periodo}`,
    }, db);
};

/** Planeación cargó la carga académica de estos docentes. */
const avisarAsignacionesCargadas = async (idsUsuarios, idPeriodo = null, db = pool) => {
    const periodo = idPeriodo
        ? (await db.query('SELECT id_periodo, anio, semestre FROM periodo WHERE id_periodo = $1', [idPeriodo])).rows[0]
        : (await db.query('SELECT id_periodo, anio, semestre FROM periodo WHERE activo = TRUE LIMIT 1')).rows[0];
    return crearParaVarios(idsUsuarios, {
        tipo: 'asignaciones_cargadas',
        titulo: 'Tu carga académica ya está cargada',
        mensaje: `Planeación cargó tus asignaciones${periodo ? ` del período ${nombrePeriodo(periodo)}` : ''}. Revísalas y completa tu agenda.`,
        enlace: '/docente/agenda',
        clave: `asignaciones_cargadas:${periodo ? periodo.id_periodo : 0}`,
    }, db);
};

/**
 * Datos de una observación del director: de quién es la actividad, cómo se llama, en qué período y
 * quién la escribió. Los usan la campana y el correo, para que digan lo mismo.
 * Devuelve null si la actividad no existe. Si quien escribe es también el dueño de la actividad (un usuario
 * con rol de director y de docente que revisa su propia agenda) igual se le avisa: lo verá como docente.
 */
const datosObservacion = async ({ idActividad, semana, idDirector }, db = pool) => {
    const actividad = (await db.query(
        `SELECT ua.id_usuario AS id_docente,
                COALESCE(NULLIF(TRIM(ea.nombre_espacio), ''), NULLIF(TRIM(aa.rol_seleccionado), ''), af.funcion_sustantiva) AS actividad,
                p.anio, p.semestre
         FROM asignacion_actividades aa
         JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones
         JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
         LEFT JOIN espacio_academico ea ON ea.id_espacio_aca = aa.id_espacio_aca
         LEFT JOIN periodo p ON p.id_periodo = af.id_periodo
         WHERE aa.id_asignacionact = $1
         LIMIT 1`,
        [idActividad]
    )).rows[0];
    if (!actividad) return null;

    const director = idDirector
        ? (await db.query("SELECT TRIM(nombres || ' ' || apellidos) AS nombre FROM usuarios WHERE id_usuario = $1", [idDirector])).rows[0]
        : null;
    return {
        idDocente: actividad.id_docente,
        actividad: actividad.actividad,
        periodo: actividad.anio ? nombrePeriodo({ anio: actividad.anio, semestre: actividad.semestre }) : null,
        corte: etiquetaCorte(semana, actividad.semestre),
        director: director?.nombre || 'La dirección de programa',
        enlace: `/docente/avance-semana-${Number(semana) === 16 ? 16 : 8}`,
    };
};

/**
 * El director dejó una observación en una actividad del docente (semana 8 o 16): se avisa al docente
 * en la campana, con el enlace al reporte de ese corte. Devuelve true si se creó el aviso.
 *  - El aviso va al DUEÑO de la actividad (no al director que la escribe).
 *  - "clave" por actividad y corte: si el docente aún no ha leído un aviso igual, no se crea otro
 *    (el director puede dejar varias observaciones seguidas sin llenarle la campana).
 */
const avisarObservacionDirector = async ({ idActividad, semana, idDirector, texto }, db = pool) => {
    const datos = await datosObservacion({ idActividad, semana, idDirector }, db);
    if (!datos) return false;
    return crear({
        idUsuario: datos.idDocente,
        tipo: 'observacion_director',
        titulo: `Nueva observación del director en tu avance de ${datos.corte}`,
        mensaje: `${datos.director} comentó «${datos.actividad}»: ${recortar(texto, 300)}`,
        enlace: datos.enlace,
        clave: `observacion_director:${idActividad}:${Number(semana)}`,
    }, db);
};

// Dispara y olvida, como el correo: no frena la respuesta ni propaga errores
const enSegundoPlano = (etiqueta, fn) => {
    setImmediate(() => {
        Promise.resolve().then(fn).catch((e) => console.warn(`[notificaciones-app] ${etiqueta} falló:`, e.message));
    });
};

const background = {
    aperturaPeriodo: (idPeriodo) => enSegundoPlano('aperturaPeriodo', () => avisarAperturaPeriodo(idPeriodo)),
    asignacionesCargadas: (ids, idPeriodo) => enSegundoPlano('asignacionesCargadas', () => avisarAsignacionesCargadas(ids, idPeriodo)),
};

module.exports = {
    crear, crearParaVarios, listar, contarNoLeidas, marcarLeida, marcarTodasLeidas, eliminar, eliminarTodas,
    avisarAperturaPeriodo, avisarAsignacionesCargadas, avisarObservacionDirector, datosObservacion, background, nombrePeriodo,
};
