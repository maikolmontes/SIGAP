// ================================================================
// SIGAP — Reglas de negocio de las notificaciones por correo
// ----------------------------------------------------------------
// Aquí se resuelve QUIÉN recibe cada notificación y CON QUÉ DATOS.
// El envío físico lo hace services/emailService.js y el HTML lo
// arma utils/emailTemplates.js.
//
// Regla de oro: una notificación jamás debe romper el flujo de
// negocio. Todo va envuelto en try/catch y se dispara en segundo
// plano con setImmediate.
// ================================================================

const pool = require('../db/connection');
const { sendEmail } = require('./emailService');
const plantillas = require('../utils/emailTemplates');

// ----------------------------------------------------------------
// Utilidades internas
// ----------------------------------------------------------------

const nombrePeriodo = (periodo) => {
    if (!periodo) return null;
    const romano = Number(periodo.semestre) === 1 ? 'I' : 'II';
    return `${periodo.anio}-${romano}`;
};

const formatearFecha = (fecha) => {
    if (!fecha) return null;
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
};

// Clave de deduplicación de la radicación de una agenda
const claveAgendaEnviada = (idUsuario, idPeriodo) => `agenda_enviada:${idUsuario}:${idPeriodo}`;

const getPeriodoActivo = async (client = pool) => {
    const res = await client.query(
        'SELECT id_periodo, anio, semestre, fecha_inicio, fecha_fin FROM periodo WHERE activo = TRUE LIMIT 1'
    );
    return res.rows[0] || null;
};

const getUsuario = async (idUsuario, client = pool) => {
    const res = await client.query(
        `SELECT u.id_usuario, u.correo,
                TRIM(u.nombres || ' ' || u.apellidos) AS nombre_completo,
                u.id_programa,
                pa.nombre_programa
         FROM usuarios u
         LEFT JOIN programa_academico pa ON pa.id_programa = u.id_programa
         WHERE u.id_usuario = $1`,
        [idUsuario]
    );
    return res.rows[0] || null;
};

// Directores activos del programa indicado. Si el programa no tiene
// director asignado, se usa como respaldo Planeación/Admin para que
// la radicación no quede sin destinatario.
const getDirectoresDePrograma = async (idPrograma, client = pool) => {
    if (idPrograma) {
        const res = await client.query(
            `SELECT DISTINCT u.correo, TRIM(u.nombres || ' ' || u.apellidos) AS nombre_completo
             FROM usuarios u
             JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
             JOIN roles r ON r.id_rol = ur.id_rol
             WHERE u.activo = TRUE
               AND u.correo IS NOT NULL AND u.correo <> ''
               AND u.id_programa = $1
               AND LOWER(r.nombre_rol) LIKE '%direct%'`,
            [idPrograma]
        );
        if (res.rows.length > 0) return res.rows;
    }

    const respaldo = await client.query(
        `SELECT DISTINCT u.correo, TRIM(u.nombres || ' ' || u.apellidos) AS nombre_completo
         FROM usuarios u
         JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
         JOIN roles r ON r.id_rol = ur.id_rol
         WHERE u.activo = TRUE
           AND u.correo IS NOT NULL AND u.correo <> ''
           AND (LOWER(r.nombre_rol) LIKE '%planea%' OR LOWER(r.nombre_rol) LIKE '%admin%')`
    );
    return respaldo.rows;
};

// ----------------------------------------------------------------
// Bitácora de notificaciones (database/notificaciones_log.sql)
// Sirve de trazabilidad y evita reenviar el mismo aviso. Si la tabla
// no existe se crea al vuelo; si algo falla, el correo igual se envía.
// ----------------------------------------------------------------
let bitacoraLista = false;

const asegurarBitacora = async () => {
    if (bitacoraLista) return true;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notificaciones_log (
                id_notificacion SERIAL PRIMARY KEY,
                tipo            VARCHAR(50)  NOT NULL,
                clave           VARCHAR(160) NOT NULL,
                destinatario    VARCHAR(180) NOT NULL,
                asunto          TEXT,
                estado          VARCHAR(20)  NOT NULL DEFAULT 'enviado',
                detalle         TEXT,
                enviado_en      TIMESTAMP    NOT NULL DEFAULT NOW()
            )
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_notificaciones_log_clave ON notificaciones_log (clave)');
        bitacoraLista = true;
        return true;
    } catch (error) {
        console.warn('[notificaciones] No se pudo preparar notificaciones_log:', error.message);
        return false;
    }
};

const yaNotificado = async (clave) => {
    if (!(await asegurarBitacora())) return false;
    try {
        const res = await pool.query(
            "SELECT 1 FROM notificaciones_log WHERE clave = $1 AND estado = 'enviado' LIMIT 1",
            [clave]
        );
        return res.rows.length > 0;
    } catch (error) {
        console.warn('[notificaciones] No se pudo consultar la bitácora:', error.message);
        return false;
    }
};

// Borra la marca de un evento para que pueda volver a notificarse
// (por ejemplo, cuando el director devuelve la agenda y el docente
// tendrá que radicarla de nuevo).
const reiniciarNotificacion = async (clave) => {
    if (!(await asegurarBitacora())) return;
    try {
        await pool.query('DELETE FROM notificaciones_log WHERE clave = $1', [clave]);
    } catch (error) {
        console.warn('[notificaciones] No se pudo reiniciar la bitácora:', error.message);
    }
};

const registrar = async ({ tipo, clave, destinatario, asunto, resultado }) => {
    if (!(await asegurarBitacora())) return;
    try {
        await pool.query(
            `INSERT INTO notificaciones_log (tipo, clave, destinatario, asunto, estado, detalle)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                tipo,
                clave,
                destinatario,
                asunto,
                resultado.ok ? 'enviado' : 'error',
                resultado.ok ? null : `${resultado.motivo || ''} ${resultado.detalle || ''}`.trim()
            ]
        );
    } catch (error) {
        console.warn('[notificaciones] No se pudo registrar en la bitácora:', error.message);
    }
};

// Envía y deja constancia en la bitácora en un solo paso
const enviarYRegistrar = async ({ tipo, clave, to, subject, html }) => {
    const resultado = await sendEmail({ to, subject, html });
    await registrar({ tipo, clave, destinatario: to, asunto: subject, resultado });
    return resultado;
};

// Ejecuta una notificación en segundo plano sin propagar errores
const enSegundoPlano = (etiqueta, fn) => {
    setImmediate(() => {
        Promise.resolve()
            .then(fn)
            .catch((error) => console.error(`[notificaciones] ${etiqueta} falló:`, error.message));
    });
};

// ================================================================
// 1. Agenda radicada por el docente  ➔  Director del programa
// ----------------------------------------------------------------
// El SIGAP no tiene un botón único de "enviar a revisión": cada
// función queda en estado 'Aceptado' al guardarla. Por eso solo se
// notifica cuando TODAS las funciones del docente en el período
// activo ya están diligenciadas (Aceptado/Aprobada); así el director
// recibe un único correo y no uno por función.
// ================================================================
const notificarAgendaEnviada = async (idUsuario) => {
    const periodo = await getPeriodoActivo();
    if (!periodo) return { ok: false, motivo: 'sin_periodo_activo' };

    const estados = await pool.query(
        `SELECT af.estado_agenda
         FROM asignacion_funciones af
         JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
         WHERE ua.id_usuario = $1 AND af.id_periodo = $2`,
        [idUsuario, periodo.id_periodo]
    );

    const total = estados.rows.length;
    if (total === 0) return { ok: false, motivo: 'sin_funciones' };

    const diligenciadas = estados.rows.filter((r) => ['Aceptado', 'Aprobada'].includes(r.estado_agenda)).length;
    if (diligenciadas < total) {
        return { ok: false, motivo: 'agenda_incompleta', diligenciadas, total };
    }

    // Si ya está toda aprobada, el trámite está cerrado: no se reenvía.
    const todasAprobadas = estados.rows.every((r) => r.estado_agenda === 'Aprobada');
    if (todasAprobadas) return { ok: false, motivo: 'agenda_ya_aprobada' };

    // Evitar un correo por cada guardado: solo se avisa una vez por
    // docente y período, hasta que el director apruebe o devuelva.
    const clave = claveAgendaEnviada(idUsuario, periodo.id_periodo);
    if (await yaNotificado(clave)) return { ok: false, motivo: 'ya_notificado' };

    const docente = await getUsuario(idUsuario);
    if (!docente) return { ok: false, motivo: 'docente_no_encontrado' };

    const directores = await getDirectoresDePrograma(docente.id_programa);
    if (directores.length === 0) return { ok: false, motivo: 'sin_directores' };

    const resultados = [];
    for (const director of directores) {
        const { subject, html } = plantillas.plantillaAgendaEnviada({
            director: director.nombre_completo,
            docente: docente.nombre_completo,
            programa: docente.nombre_programa,
            periodo: nombrePeriodo(periodo),
            totalFunciones: total,
            enlace: plantillas.url(`/director/agendas/${idUsuario}`)
        });
        resultados.push(
            await enviarYRegistrar({ tipo: 'agenda_enviada', clave, to: director.correo, subject, html })
        );
    }

    return { ok: resultados.some((r) => r.ok), enviados: resultados.length };
};

// ================================================================
// 2. Agenda aprobada  ➔  Docente
// ================================================================
const notificarAgendaAprobada = async (idUsuario, idDirector) => {
    const periodo = await getPeriodoActivo();
    const docente = await getUsuario(idUsuario);
    if (!docente || !docente.correo) return { ok: false, motivo: 'docente_sin_correo' };

    const director = idDirector ? await getUsuario(idDirector) : null;

    let totalHoras = null;
    if (periodo) {
        const horas = await pool.query(
            `SELECT COALESCE(SUM(af.horas_funcion), 0) AS total
             FROM asignacion_funciones af
             JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
             WHERE ua.id_usuario = $1 AND af.id_periodo = $2`,
            [idUsuario, periodo.id_periodo]
        );
        totalHoras = parseFloat(horas.rows[0].total) || null;
    }

    const { subject, html } = plantillas.plantillaAgendaAprobada({
        docente: docente.nombre_completo,
        director: director ? director.nombre_completo : 'Dirección de programa',
        periodo: nombrePeriodo(periodo),
        programa: docente.nombre_programa,
        totalHoras,
        enlace: plantillas.url('/docente/agenda')
    });

    // El trámite se cerró: la próxima radicación debe poder notificar de nuevo
    if (periodo) await reiniciarNotificacion(claveAgendaEnviada(idUsuario, periodo.id_periodo));

    return enviarYRegistrar({
        tipo: 'agenda_aprobada',
        clave: `agenda_aprobada:${idUsuario}:${periodo ? periodo.id_periodo : 0}:${Date.now()}`,
        to: docente.correo,
        subject,
        html
    });
};

// ================================================================
// 3. Agenda devuelta con observaciones  ➔  Docente
// ================================================================
const notificarAgendaDevuelta = async (idUsuario, idDirector, observaciones) => {
    const periodo = await getPeriodoActivo();
    const docente = await getUsuario(idUsuario);
    if (!docente || !docente.correo) return { ok: false, motivo: 'docente_sin_correo' };

    const director = idDirector ? await getUsuario(idDirector) : null;

    const { subject, html } = plantillas.plantillaAgendaDevuelta({
        docente: docente.nombre_completo,
        director: director ? director.nombre_completo : 'Dirección de programa',
        periodo: nombrePeriodo(periodo),
        observaciones,
        fechaLimite: periodo ? formatearFecha(periodo.fecha_fin) : null,
        enlace: plantillas.url('/docente/agenda')
    });

    // El docente deberá volver a radicar: se habilita otra vez el aviso al director
    if (periodo) await reiniciarNotificacion(claveAgendaEnviada(idUsuario, periodo.id_periodo));

    return enviarYRegistrar({
        tipo: 'agenda_devuelta',
        clave: `agenda_devuelta:${idUsuario}:${periodo ? periodo.id_periodo : 0}:${Date.now()}`,
        to: docente.correo,
        subject,
        html
    });
};

// ================================================================
// 4. Bienvenida de nuevo usuario
// ================================================================
const notificarBienvenida = async ({ idUsuario = null, correo, nombre, roles, programa }) => {
    // Si solo llega el id, se completan los datos desde la base
    if (idUsuario && (!correo || !nombre || !programa)) {
        const usuario = await getUsuario(idUsuario);
        if (usuario) {
            correo = correo || usuario.correo;
            nombre = nombre || usuario.nombre_completo;
            programa = programa || usuario.nombre_programa;
        }
    }

    if (!correo) return { ok: false, motivo: 'sin_correo' };

    const { subject, html } = plantillas.plantillaBienvenida({
        usuario: nombre,
        correo,
        roles: Array.isArray(roles) ? roles.join(', ') : roles,
        programa,
        enlace: plantillas.url('/login')
    });

    const clave = `bienvenida:${idUsuario || correo.toLowerCase()}`;
    if (await yaNotificado(clave)) return { ok: false, motivo: 'ya_notificado' };

    return enviarYRegistrar({ tipo: 'bienvenida', clave, to: correo, subject, html });
};

// ================================================================
// 5. Apertura de período académico  ➔  Docentes y directores
// ----------------------------------------------------------------
// Si ya hay docentes asignados al período se notifica a ellos; de lo
// contrario se avisa a todos los docentes y directores activos.
// ================================================================
const notificarAperturaPeriodo = async (idPeriodo) => {
    const periodoRes = await pool.query(
        'SELECT id_periodo, anio, semestre, fecha_inicio, fecha_fin FROM periodo WHERE id_periodo = $1',
        [idPeriodo]
    );
    const periodo = periodoRes.rows[0];
    if (!periodo) return { ok: false, motivo: 'periodo_no_encontrado' };

    let destinatarios = [];
    try {
        const asignados = await pool.query(
            `SELECT DISTINCT u.correo, TRIM(u.nombres || ' ' || u.apellidos) AS nombre_completo
             FROM docente_periodo dp
             JOIN usuarios u ON u.id_usuario = dp.id_usuario
             WHERE dp.id_periodo = $1 AND u.activo = TRUE
               AND u.correo IS NOT NULL AND u.correo <> ''`,
            [idPeriodo]
        );
        destinatarios = asignados.rows;
    } catch (error) {
        console.warn('[notificaciones] No se pudo consultar docente_periodo:', error.message);
    }

    if (destinatarios.length === 0) {
        const todos = await pool.query(
            `SELECT DISTINCT u.correo, TRIM(u.nombres || ' ' || u.apellidos) AS nombre_completo
             FROM usuarios u
             JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
             JOIN roles r ON r.id_rol = ur.id_rol
             WHERE u.activo = TRUE
               AND u.correo IS NOT NULL AND u.correo <> ''
               AND (LOWER(r.nombre_rol) LIKE '%docent%' OR LOWER(r.nombre_rol) LIKE '%direct%')`
        );
        destinatarios = todos.rows;
    }

    let enviados = 0;
    let omitidos = 0;
    for (const persona of destinatarios) {
        const clave = `apertura_periodo:${idPeriodo}:${persona.correo.toLowerCase()}`;
        if (await yaNotificado(clave)) {
            omitidos++;
            continue;
        }

        const { subject, html } = plantillas.plantillaPeriodoAperturado({
            nombre: persona.nombre_completo,
            periodo: nombrePeriodo(periodo),
            fechaInicio: formatearFecha(periodo.fecha_inicio),
            fechaFin: formatearFecha(periodo.fecha_fin),
            enlace: plantillas.url('/login')
        });
        const r = await enviarYRegistrar({ tipo: 'apertura_periodo', clave, to: persona.correo, subject, html });
        if (r.ok) enviados++;
    }

    return { ok: enviados > 0, enviados, omitidos, total: destinatarios.length };
};

// ================================================================
// 6. Asignaciones cargadas por Planeación  ➔  Docentes afectados
// ================================================================
const notificarAsignacionesCargadas = async (idsUsuarios = [], idPeriodo = null) => {
    const ids = [...new Set(idsUsuarios.filter((id) => Number.isInteger(Number(id))).map(Number))];
    if (ids.length === 0) return { ok: false, motivo: 'sin_docentes' };

    const periodo = idPeriodo
        ? (await pool.query('SELECT id_periodo, anio, semestre FROM periodo WHERE id_periodo = $1', [idPeriodo])).rows[0]
        : await getPeriodoActivo();

    const docentes = await pool.query(
        `SELECT u.id_usuario, u.correo, TRIM(u.nombres || ' ' || u.apellidos) AS nombre_completo
         FROM usuarios u
         WHERE u.id_usuario = ANY($1) AND u.activo = TRUE
           AND u.correo IS NOT NULL AND u.correo <> ''`,
        [ids]
    );

    let enviados = 0;
    for (const docente of docentes.rows) {
        let totalEspacios = null;
        if (periodo) {
            const conteo = await pool.query(
                `SELECT COUNT(DISTINCT aa.id_espacio_aca) AS total
                 FROM asignacion_actividades aa
                 JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones
                 JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
                 WHERE ua.id_usuario = $1 AND af.id_periodo = $2 AND aa.id_espacio_aca IS NOT NULL`,
                [docente.id_usuario, periodo.id_periodo]
            );
            totalEspacios = parseInt(conteo.rows[0].total, 10) || null;
        }

        const { subject, html } = plantillas.plantillaAsignacionesCargadas({
            docente: docente.nombre_completo,
            periodo: nombrePeriodo(periodo),
            totalEspacios,
            enlace: plantillas.url('/docente/agenda')
        });
        const r = await enviarYRegistrar({
            tipo: 'asignaciones_cargadas',
            clave: `asignaciones:${docente.id_usuario}:${periodo ? periodo.id_periodo : 0}:${Date.now()}`,
            to: docente.correo,
            subject,
            html
        });
        if (r.ok) enviados++;
    }

    return { ok: enviados > 0, enviados, total: docentes.rows.length };
};

// ================================================================
// 7. Recordatorio de plazo  ➔  Docentes con agenda pendiente
// ----------------------------------------------------------------
// Docentes cuya agenda del período activo tiene alguna función en
// estado 'Pendiente' o 'Devuelta'. Se puede filtrar por programa.
// ================================================================
const notificarRecordatorioPlazo = async ({ idPrograma = null } = {}) => {
    const periodo = await getPeriodoActivo();
    if (!periodo) return { ok: false, motivo: 'sin_periodo_activo' };

    const params = [periodo.id_periodo];
    let filtroPrograma = '';
    if (idPrograma) {
        params.push(idPrograma);
        filtroPrograma = ' AND u.id_programa = $2';
    }

    const pendientes = await pool.query(
        `SELECT u.id_usuario, u.correo,
                TRIM(u.nombres || ' ' || u.apellidos) AS nombre_completo,
                BOOL_OR(af.estado_agenda = 'Devuelta') AS alguna_devuelta
         FROM usuarios u
         JOIN usuario_asignacion ua ON ua.id_usuario = u.id_usuario
         JOIN asignacion_funciones af ON af.id_funciones = ua.id_funciones
         WHERE af.id_periodo = $1
           AND u.activo = TRUE
           AND u.correo IS NOT NULL AND u.correo <> ''
           AND af.estado_agenda IN ('Pendiente', 'Devuelta')${filtroPrograma}
         GROUP BY u.id_usuario, u.correo, u.nombres, u.apellidos`,
        params
    );

    const hoy = new Date();
    const fin = periodo.fecha_fin ? new Date(periodo.fecha_fin) : null;
    const diasRestantes = fin ? Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24)) : null;

    const hoyISO = hoy.toISOString().slice(0, 10);

    let enviados = 0;
    let omitidos = 0;
    for (const docente of pendientes.rows) {
        // Como máximo un recordatorio por docente y día
        const clave = `recordatorio:${docente.id_usuario}:${periodo.id_periodo}:${hoyISO}`;
        if (await yaNotificado(clave)) {
            omitidos++;
            continue;
        }

        const { subject, html } = plantillas.plantillaRecordatorioPlazo({
            docente: docente.nombre_completo,
            periodo: nombrePeriodo(periodo),
            estadoAgenda: docente.alguna_devuelta ? 'Devuelta con observaciones' : 'Borrador / sin radicar',
            fechaLimite: formatearFecha(periodo.fecha_fin),
            diasRestantes: diasRestantes !== null && diasRestantes >= 0 ? diasRestantes : null,
            enlace: plantillas.url('/docente/agenda')
        });
        const r = await enviarYRegistrar({ tipo: 'recordatorio_plazo', clave, to: docente.correo, subject, html });
        if (r.ok) enviados++;
    }

    return { ok: enviados > 0, enviados, omitidos, total: pendientes.rows.length };
};

// ----------------------------------------------------------------
// Versiones "dispara y olvida" para usar dentro de los controladores
// ----------------------------------------------------------------
const enSegundoPlanoAPI = {
    agendaEnviada: (idUsuario) =>
        enSegundoPlano('agendaEnviada', () => notificarAgendaEnviada(idUsuario)),

    agendaAprobada: (idUsuario, idDirector) =>
        enSegundoPlano('agendaAprobada', () => notificarAgendaAprobada(idUsuario, idDirector)),

    agendaDevuelta: (idUsuario, idDirector, observaciones) =>
        enSegundoPlano('agendaDevuelta', () => notificarAgendaDevuelta(idUsuario, idDirector, observaciones)),

    bienvenida: (datos) =>
        enSegundoPlano('bienvenida', () => notificarBienvenida(datos)),

    aperturaPeriodo: (idPeriodo) =>
        enSegundoPlano('aperturaPeriodo', () => notificarAperturaPeriodo(idPeriodo)),

    asignacionesCargadas: (ids, idPeriodo) =>
        enSegundoPlano('asignacionesCargadas', () => notificarAsignacionesCargadas(ids, idPeriodo))
};

module.exports = {
    // Versiones await-ables (útiles para pruebas y endpoints manuales)
    notificarAgendaEnviada,
    notificarAgendaAprobada,
    notificarAgendaDevuelta,
    notificarBienvenida,
    notificarAperturaPeriodo,
    notificarAsignacionesCargadas,
    notificarRecordatorioPlazo,
    // Versiones en segundo plano
    background: enSegundoPlanoAPI,
    // Auxiliares reutilizables
    nombrePeriodo,
    formatearFecha
};
