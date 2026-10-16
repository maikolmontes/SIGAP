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
const { sendEmail, resolverRemitente } = require('./emailService');
const plantillas = require('../utils/emailTemplates');
const notificacionesApp = require('./notificacionesApp');
const { etiquetaPeriodo, etiquetaCorte } = require('../utils/periodo');
const { hoyEnColombia } = require('../utils/semanaAbierta');

// ----------------------------------------------------------------
// Utilidades internas
// ----------------------------------------------------------------

const nombrePeriodo = (periodo) => {
    return etiquetaPeriodo(periodo);
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

// Remitente "en nombre de" quien ejecuta la acción (ver resolverRemitente en
// emailService): el correo sale de la cuenta institucional pero con su nombre
// y su Reply-To. Devuelve null si no hay usuario o no tiene correo, y el envío
// cae al remitente institucional.
// etiqueta: cargo visible junto al nombre ("Dirección de programa", "Planeación").
const getRemitente = async (idUsuario, etiqueta) => {
    if (!idUsuario) return null;
    try {
        const usuario = await getUsuario(idUsuario);
        if (!usuario || !usuario.correo) return null;
        return { nombre: usuario.nombre_completo, correo: usuario.correo, etiqueta };
    } catch (error) {
        console.warn('[notificaciones] No se pudo resolver el remitente:', error.message);
        return null;
    }
};

const ETIQUETA_DIRECTOR = 'Dirección de programa';
const ETIQUETA_PLANEACION = 'Planeación';

// Directores activos que gestionan el programa indicado (director_programa:
// un programa puede tener varios y un director varios programas). Si el
// programa no tiene director asignado, se usa como respaldo Planeación/Admin
// para que la radicación no quede sin destinatario.
const getDirectoresDePrograma = async (idPrograma, client = pool) => {
    if (idPrograma) {
        const res = await client.query(
            `SELECT DISTINCT u.id_usuario, u.correo, TRIM(u.nombres || ' ' || u.apellidos) AS nombre_completo
             FROM usuarios u
             JOIN director_programa dp ON dp.id_usuario = u.id_usuario
             JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
             JOIN roles r ON r.id_rol = ur.id_rol
             WHERE u.activo = TRUE
               AND u.correo IS NOT NULL AND u.correo <> ''
               AND dp.id_programa = $1
               AND LOWER(r.nombre_rol) LIKE '%direct%'`,
            [idPrograma]
        );
        if (res.rows.length > 0) return res.rows;
    }

    const respaldo = await client.query(
        `SELECT DISTINCT u.id_usuario, u.correo, TRIM(u.nombres || ' ' || u.apellidos) AS nombre_completo
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
        // Quién envió el correo (nombre visible); NULL = remitente institucional
        await pool.query('ALTER TABLE notificaciones_log ADD COLUMN IF NOT EXISTS remitente VARCHAR(220)');
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

const registrar = async ({ tipo, clave, destinatario, asunto, resultado, remitente = null }) => {
    if (!(await asegurarBitacora())) return;
    try {
        await pool.query(
            `INSERT INTO notificaciones_log (tipo, clave, destinatario, asunto, estado, detalle, remitente)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                tipo,
                clave,
                destinatario,
                asunto,
                resultado.ok ? 'enviado' : 'error',
                resultado.ok ? null : `${resultado.motivo || ''} ${resultado.detalle || ''}`.trim(),
                remitente
            ]
        );
    } catch (error) {
        console.warn('[notificaciones] No se pudo registrar en la bitácora:', error.message);
    }
};

// Envía y deja constancia en la bitácora en un solo paso
const enviarYRegistrar = async ({ tipo, clave, to, subject, html, remitente = null }) => {
    const resultado = await sendEmail({ to, subject, html, remitente });
    // Nombre visible con el que salió (null = remitente institucional)
    await registrar({
        tipo, clave, destinatario: to, asunto: subject, resultado,
        remitente: resolverRemitente(remitente).nombre
    });
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

    // Campana: el mismo aviso, para los mismos directores
    await notificacionesApp.crearParaVarios(directores.map((d) => d.id_usuario), {
        tipo: 'agenda_enviada',
        titulo: 'Agenda lista para revisión',
        mensaje: `${docente.nombre_completo} radicó su agenda del período ${nombrePeriodo(periodo)} (${total === 1 ? '1 función' : total + ' funciones'}).`,
        enlace: `/director/agendas/${idUsuario}`,
        clave: `agenda_enviada:${idUsuario}`,
    });

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
    const director = idDirector ? await getUsuario(idDirector) : null;

    // Campana: llega aunque el docente no tenga correo o el envío falle
    if (docente) {
        await notificacionesApp.crear({
            idUsuario,
            tipo: 'agenda_aprobada',
            titulo: 'Tu agenda fue aprobada',
            mensaje: `${director ? director.nombre_completo : 'La dirección de programa'} aprobó tu agenda${periodo ? ` del período ${nombrePeriodo(periodo)}` : ''}.`,
            enlace: '/docente/agenda',
        });
    }
    if (!docente || !docente.correo) return { ok: false, motivo: 'docente_sin_correo' };

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
        html,
        remitente: await getRemitente(idDirector, ETIQUETA_DIRECTOR)
    });
};

// ================================================================
// 3. Agenda devuelta con observaciones  ➔  Docente
// ================================================================
const notificarAgendaDevuelta = async (idUsuario, idDirector, observaciones) => {
    const periodo = await getPeriodoActivo();
    const docente = await getUsuario(idUsuario);
    const director = idDirector ? await getUsuario(idDirector) : null;

    if (docente) {
        await notificacionesApp.crear({
            idUsuario,
            tipo: 'agenda_devuelta',
            titulo: 'Tu agenda fue devuelta con observaciones',
            mensaje: observaciones
                ? `${director ? director.nombre_completo : 'La dirección de programa'}: ${observaciones}`
                : 'Revisa las observaciones y vuelve a enviarla.',
            enlace: '/docente/agenda',
        });
    }
    if (!docente || !docente.correo) return { ok: false, motivo: 'docente_sin_correo' };

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
        html,
        remitente: await getRemitente(idDirector, ETIQUETA_DIRECTOR)
    });
};

// ================================================================
// 3b. Observación del director en el avance (semana 8 / 16)  ➔  Docente
// ----------------------------------------------------------------
// Campana + correo. Mientras el docente no lea el aviso anterior de la
// misma actividad y corte no se crea otro (ni se envía otro correo): si el
// director deja varias observaciones seguidas, el docente recibe un solo aviso.
// ================================================================
const notificarObservacionDirector = async ({ idActividad, semana, idDirector, texto }) => {
    const datos = await notificacionesApp.datosObservacion({ idActividad, semana, idDirector });
    if (!datos) return { ok: false, motivo: 'sin_destinatario' };

    const creada = await notificacionesApp.avisarObservacionDirector({ idActividad, semana, idDirector, texto });
    if (!creada) return { ok: false, motivo: 'ya_avisado' };

    const docente = await getUsuario(datos.idDocente);
    if (!docente || !docente.correo) return { ok: false, motivo: 'docente_sin_correo' };

    const { subject, html } = plantillas.plantillaObservacionDirector({
        docente: docente.nombre_completo,
        director: datos.director,
        periodo: datos.periodo,
        corte: datos.corte,
        actividad: datos.actividad,
        observacion: texto,
        enlace: plantillas.url(datos.enlace)
    });

    return enviarYRegistrar({
        tipo: 'observacion_director',
        clave: `observacion_director:${datos.idDocente}:${idActividad}:${Number(semana)}:${Date.now()}`,
        to: docente.correo,
        subject,
        html,
        remitente: await getRemitente(idDirector, ETIQUETA_DIRECTOR)
    });
};

// ================================================================
// 4. Bienvenida de nuevo usuario
// ================================================================
const notificarBienvenida = async ({ idUsuario = null, correo, nombre, roles, programa, idRemitente = null }) => {
    // Si solo llega el id, se completan los datos desde la base
    if (idUsuario && (!correo || !nombre || !programa)) {
        const usuario = await getUsuario(idUsuario);
        if (usuario) {
            correo = correo || usuario.correo;
            nombre = nombre || usuario.nombre_completo;
            programa = programa || usuario.nombre_programa;
        }
    }

    if (idUsuario) {
        await notificacionesApp.crear({
            idUsuario,
            tipo: 'bienvenida',
            titulo: '¡Bienvenido(a) a SIGAP!',
            mensaje: 'Tu cuenta quedó creada. Completa tu perfil para empezar.',
            enlace: '/perfil',
            clave: 'bienvenida',
        });
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

    return enviarYRegistrar({
        tipo: 'bienvenida', clave, to: correo, subject, html,
        remitente: await getRemitente(idRemitente, ETIQUETA_PLANEACION)
    });
};

// ================================================================
// 5. Apertura de período académico  ➔  Docentes y directores
// ----------------------------------------------------------------
// Si ya hay docentes asignados al período se notifica a ellos; de lo
// contrario se avisa a todos los docentes y directores activos.
// ================================================================
const notificarAperturaPeriodo = async (idPeriodo, idRemitente = null) => {
    const remitente = await getRemitente(idRemitente, ETIQUETA_PLANEACION);
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
        const r = await enviarYRegistrar({ tipo: 'apertura_periodo', clave, to: persona.correo, subject, html, remitente });
        if (r.ok) enviados++;
    }

    return { ok: enviados > 0, enviados, omitidos, total: destinatarios.length };
};

// ================================================================
// 6. Asignaciones cargadas por Planeación  ➔  Docentes afectados
// ================================================================
const notificarAsignacionesCargadas = async (idsUsuarios = [], idPeriodo = null, idRemitente = null) => {
    const remitente = await getRemitente(idRemitente, ETIQUETA_PLANEACION);
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
            html,
            remitente
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
const notificarRecordatorioPlazo = async ({ idPrograma = null, idRemitente = null } = {}) => {
    const remitente = await getRemitente(idRemitente, ETIQUETA_PLANEACION);
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
        // Campana: un recordatorio por docente y día, mientras no lo lea
        await notificacionesApp.crear({
            idUsuario: docente.id_usuario,
            tipo: 'recordatorio_plazo',
            titulo: docente.alguna_devuelta ? 'Tienes una agenda devuelta por corregir' : 'Recuerda completar tu agenda',
            mensaje: diasRestantes !== null && diasRestantes >= 0
                ? `El período ${nombrePeriodo(periodo)} cierra en ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}.`
                : `El período ${nombrePeriodo(periodo)} sigue abierto y tu agenda está pendiente.`,
            enlace: '/docente/agenda',
            clave: `recordatorio:${periodo.id_periodo}`,
        });

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
        const r = await enviarYRegistrar({ tipo: 'recordatorio_plazo', clave, to: docente.correo, subject, html, remitente });
        if (r.ok) enviados++;
    }

    return { ok: enviados > 0, enviados, omitidos, total: pendientes.rows.length };
};

// ================================================================
// 8. Revisión de cortes, asignaciones y semanas
// ----------------------------------------------------------------
// Todos llevan campana Y correo, con los mismos destinatarios:
//   · corte aprobado / devuelto            ➔ Docente
//   · visto bueno de un corte              ➔ Directores del programa
//   · docente guardó su avance de un corte ➔ Directores del programa
//   · asignaciones aprobadas / corregidas  ➔ Docente
//   · visto bueno de las asignaciones      ➔ Directores del programa
//   · semana habilitada, corte por cerrar  ➔ Docentes con agenda
// ================================================================
const ETIQUETA_REVISION = 'Revisión de agenda';

const claveAvanceGuardado = (idDocente, idPeriodo, semana) => `avance_guardado:${idDocente}:${idPeriodo}:${Number(semana)}`;
const claveVistoCorte = (idFunciones, semana) => `corte_visto:${idFunciones}:${Number(semana)}`;
const claveVistoAsignacion = (idFunciones) => `visto_asignacion:${idFunciones}`;

const enlaceAvanceDocente = (semana) => `/docente/avance-semana-${Number(semana) === 16 ? 16 : 8}`;

// Función sustantiva de un docente: nombre, dueño y período
const datosDeFuncion = async (idFunciones) => {
    const r = await pool.query(
        `SELECT af.id_funciones, af.funcion_sustantiva, af.id_periodo, ua.id_usuario AS id_docente, p.anio, p.semestre
         FROM asignacion_funciones af
         JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
         LEFT JOIN periodo p ON p.id_periodo = af.id_periodo
         WHERE af.id_funciones = $1
         LIMIT 1`,
        [idFunciones]
    );
    return r.rows[0] || null;
};

const periodoDeFuncion = (f) => (f && f.anio ? nombrePeriodo({ anio: f.anio, semestre: f.semestre }) : null);

// Docentes con la agenda ya liberada (los de "Por Aprobar" todavía no la ven) en el período dado
const getDocentesConAgenda = async (idPeriodo) => {
    const r = await pool.query(
        `SELECT DISTINCT u.id_usuario, u.correo, TRIM(u.nombres || ' ' || u.apellidos) AS nombre_completo
         FROM usuarios u
         JOIN usuario_asignacion ua ON ua.id_usuario = u.id_usuario
         JOIN asignacion_funciones af ON af.id_funciones = ua.id_funciones
         WHERE af.id_periodo = $1 AND af.estado_agenda <> 'Por Aprobar' AND u.activo = TRUE`,
        [idPeriodo]
    );
    return r.rows;
};

// ---- 8.1 Corte aprobado o devuelto  ➔  Docente --------------------------------
const notificarCorteRevisado = async ({ idFunciones, semana, estado, idRevisor = null, observacion = null, esDirector = true }) => {
    if (!['Aprobado', 'Devuelto'].includes(estado)) return { ok: false, motivo: 'estado_sin_aviso' };
    const f = await datosDeFuncion(idFunciones);
    if (!f) return { ok: false, motivo: 'funcion_no_encontrada' };
    const docente = await getUsuario(f.id_docente);
    if (!docente) return { ok: false, motivo: 'docente_no_encontrado' };
    const revisor = idRevisor ? await getUsuario(idRevisor) : null;

    const aprobado = estado === 'Aprobado';
    const corte = etiquetaCorte(semana, f.semestre);
    const quien = revisor ? revisor.nombre_completo : 'La dirección de programa';
    // Si lo devolvieron, el enlace abre el reporte con el motivo a la vista (?devuelto=1 muestra la ventana del motivo)
    const enlaceCorte = aprobado ? enlaceAvanceDocente(semana) : `${enlaceAvanceDocente(semana)}?devuelto=1`;

    // Si lo devolvieron, tendrá que volver a guardar: el próximo guardado debe avisar de nuevo a la dirección
    if (!aprobado) await reiniciarNotificacion(claveAvanceGuardado(f.id_docente, f.id_periodo, semana));

    await notificacionesApp.crear({
        idUsuario: f.id_docente,
        tipo: aprobado ? 'corte_aprobado' : 'corte_devuelto',
        titulo: aprobado ? `Tu avance de ${corte} fue aprobado` : `Tu avance de ${corte} fue devuelto`,
        mensaje: aprobado
            ? `${quien} aprobó «${f.funcion_sustantiva}» en ${corte}.`
            : `${quien} devolvió «${f.funcion_sustantiva}» en ${corte}: ${observacion || 'revisa las observaciones.'}`,
        enlace: enlaceCorte,
    });
    if (!docente.correo) return { ok: false, motivo: 'docente_sin_correo' };

    const { subject, html } = plantillas.plantillaAviso({
        asunto: aprobado ? `Su avance de ${corte} fue aprobado` : `Su avance de ${corte} fue devuelto`,
        titulo: aprobado ? `Avance de ${corte} aprobado` : `Avance de ${corte} devuelto`,
        preheader: aprobado ? `${quien} aprobó su avance de ${corte}.` : `${quien} devolvió su avance de ${corte} con observaciones.`,
        nombre: docente.nombre_completo,
        parrafo: aprobado
            ? `Le informamos que su avance de la función «${f.funcion_sustantiva}» fue aprobado. No necesita hacer nada más en este corte.`
            : `Su avance de la función «${f.funcion_sustantiva}» fue devuelto para que lo revise y lo ajuste. Cuando termine, guárdelo de nuevo para que vuelva a revisión.`,
        datos: [['Período', periodoDeFuncion(f)], ['Corte', corte], ['Función', f.funcion_sustantiva], [aprobado ? 'Aprobado por' : 'Devuelto por', quien]],
        recuadro: aprobado ? null : { titulo: 'Motivo de la devolución', texto: observacion },
        boton: { texto: aprobado ? 'Ver mi avance' : 'Ver el motivo y corregir', enlace: plantillas.url(enlaceCorte), color: aprobado ? plantillas.COLORES.verde : plantillas.COLORES.naranja },
    });
    return enviarYRegistrar({
        tipo: aprobado ? 'corte_aprobado' : 'corte_devuelto',
        clave: `${aprobado ? 'corte_aprobado' : 'corte_devuelto'}:${idFunciones}:${Number(semana)}:${Date.now()}`,
        to: docente.correo, subject, html,
        remitente: await getRemitente(idRevisor, esDirector ? ETIQUETA_DIRECTOR : ETIQUETA_REVISION),
    });
};

// ---- 8.2 Visto bueno de un corte  ➔  Directores del programa --------------------
const notificarVistoBuenoCorte = async ({ idFunciones, semana, idRevisor = null }) => {
    const f = await datosDeFuncion(idFunciones);
    if (!f) return { ok: false, motivo: 'funcion_no_encontrada' };
    const clave = claveVistoCorte(idFunciones, semana);
    if (await yaNotificado(clave)) return { ok: false, motivo: 'ya_notificado' };

    const docente = await getUsuario(f.id_docente);
    if (!docente) return { ok: false, motivo: 'docente_no_encontrado' };
    const revisor = idRevisor ? await getUsuario(idRevisor) : null;
    const directores = (await getDirectoresDePrograma(docente.id_programa)).filter((d) => Number(d.id_usuario) !== Number(idRevisor));
    if (directores.length === 0) return { ok: false, motivo: 'sin_directores' };

    const corte = etiquetaCorte(semana, f.semestre);
    const quien = revisor ? revisor.nombre_completo : 'El revisor de la función';
    const enlace = `/director/agendas/${f.id_docente}/semana/${Number(semana)}`;

    await notificacionesApp.crearParaVarios(directores.map((d) => d.id_usuario), {
        tipo: 'corte_visto_bueno',
        titulo: `Visto bueno en ${corte}: pasa a tu revisión`,
        mensaje: `${quien} dio el visto bueno a «${f.funcion_sustantiva}» de ${docente.nombre_completo} en ${corte}. Falta tu aprobación.`,
        enlace,
        clave,
    });

    const resultados = [];
    for (const director of directores) {
        const { subject, html } = plantillas.plantillaAviso({
            asunto: `Visto bueno en ${corte} — ${docente.nombre_completo}`,
            titulo: `Visto bueno en ${corte}`,
            nombre: director.nombre_completo,
            parrafo: `${quien} revisó «${f.funcion_sustantiva}» de ${docente.nombre_completo} y le dio el visto bueno. Ahora le corresponde a usted aprobar o devolver el corte.`,
            datos: [['Docente', docente.nombre_completo], ['Programa', docente.nombre_programa], ['Período', periodoDeFuncion(f)], ['Corte', corte], ['Función', f.funcion_sustantiva]],
            boton: { texto: 'Revisar el corte', enlace: plantillas.url(enlace) },
        });
        resultados.push(await enviarYRegistrar({
            tipo: 'corte_visto_bueno', clave, to: director.correo, subject, html,
            remitente: await getRemitente(idRevisor, ETIQUETA_REVISION),
        }));
    }
    return { ok: resultados.some((r) => r.ok), enviados: resultados.length };
};

// Si retiran el visto bueno (o devuelven el corte) y luego lo vuelven a dar, la dirección debe enterarse otra vez
const reiniciarAvisoVistoCorte = (idFunciones, semana) => reiniciarNotificacion(claveVistoCorte(idFunciones, semana));

// ---- 8.3 El docente guardó su avance de un corte  ➔  Directores del programa -----
// Un solo aviso por docente y corte hasta que se devuelva el corte: guardar varias veces no llena la campana
// ni la bandeja de correo de la dirección.
const notificarAvanceGuardado = async ({ idDocente, semana }) => {
    if (![8, 16].includes(Number(semana))) return { ok: false, motivo: 'corte_invalido' };
    const periodo = await getPeriodoActivo();
    if (!periodo) return { ok: false, motivo: 'sin_periodo_activo' };

    const clave = claveAvanceGuardado(idDocente, periodo.id_periodo, semana);
    if (await yaNotificado(clave)) return { ok: false, motivo: 'ya_notificado' };

    const docente = await getUsuario(idDocente);
    if (!docente) return { ok: false, motivo: 'docente_no_encontrado' };
    const directores = (await getDirectoresDePrograma(docente.id_programa)).filter((d) => Number(d.id_usuario) !== Number(idDocente));
    if (directores.length === 0) return { ok: false, motivo: 'sin_directores' };

    const corte = etiquetaCorte(semana, periodo.semestre);
    const enlace = `/director/agendas/${idDocente}/semana/${Number(semana)}`;

    await notificacionesApp.crearParaVarios(directores.map((d) => d.id_usuario), {
        tipo: 'avance_guardado',
        titulo: `Avance de ${corte} listo para revisión`,
        mensaje: `${docente.nombre_completo} registró su avance de ${corte} (${nombrePeriodo(periodo)}).`,
        enlace,
        clave: `avance_guardado:${idDocente}:${Number(semana)}`,
    });

    const resultados = [];
    for (const director of directores) {
        const { subject, html } = plantillas.plantillaAviso({
            asunto: `Avance de ${corte} listo para revisión — ${docente.nombre_completo}`,
            titulo: `Avance de ${corte} listo para revisión`,
            nombre: director.nombre_completo,
            parrafo: `${docente.nombre_completo} registró su avance de ${corte} y está disponible para su revisión.`,
            datos: [['Docente', docente.nombre_completo], ['Programa', docente.nombre_programa], ['Período', nombrePeriodo(periodo)], ['Corte', corte]],
            boton: { texto: 'Revisar el avance', enlace: plantillas.url(enlace) },
        });
        resultados.push(await enviarYRegistrar({ tipo: 'avance_guardado', clave, to: director.correo, subject, html }));
    }
    return { ok: resultados.some((r) => r.ok), enviados: resultados.length };
};

// ---- 8.4 Asignaciones aprobadas por el Director  ➔  Docente ----------------------
const notificarAsignacionesAprobadas = async ({ idDocente, idDirector = null }) => {
    const periodo = await getPeriodoActivo();
    const docente = await getUsuario(idDocente);
    if (!docente) return { ok: false, motivo: 'docente_no_encontrado' };
    const director = idDirector ? await getUsuario(idDirector) : null;
    const quien = director ? director.nombre_completo : 'La dirección de programa';

    await notificacionesApp.crear({
        idUsuario: idDocente,
        tipo: 'asignaciones_aprobadas',
        titulo: 'Tu agenda ya está disponible',
        mensaje: `${quien} aprobó tu carga académica${periodo ? ` del período ${nombrePeriodo(periodo)}` : ''}. Ya puedes diligenciar tu agenda.`,
        enlace: '/docente/agenda',
    });
    if (!docente.correo) return { ok: false, motivo: 'docente_sin_correo' };

    const { subject, html } = plantillas.plantillaAviso({
        asunto: `Su agenda ya está disponible${periodo ? ` — ${nombrePeriodo(periodo)}` : ''}`,
        titulo: 'Su agenda ya está disponible',
        nombre: docente.nombre_completo,
        parrafo: 'La dirección del programa revisó y aprobó su carga académica. Ya puede ingresar al SIGAP, completar su agenda y enviarla a revisión.',
        datos: [['Período', periodo ? nombrePeriodo(periodo) : null], ['Aprobada por', quien], ['Programa', docente.nombre_programa]],
        boton: { texto: 'Ir a mi agenda', enlace: plantillas.url('/docente/agenda') },
    });
    return enviarYRegistrar({
        tipo: 'asignaciones_aprobadas',
        clave: `asignaciones_aprobadas:${idDocente}:${periodo ? periodo.id_periodo : 0}:${Date.now()}`,
        to: docente.correo, subject, html,
        remitente: await getRemitente(idDirector, ETIQUETA_DIRECTOR),
    });
};

// ---- 8.5 Horas corregidas por el Director  ➔  Docente ---------------------------
// Solo si el docente ya ve su agenda: mientras sigue "Por Aprobar" no tiene nada que revisar.
const notificarAsignacionesCorregidas = async ({ idDocente, idDirector = null, cantidad = null }) => {
    const periodo = await getPeriodoActivo();
    if (!periodo) return { ok: false, motivo: 'sin_periodo_activo' };
    const visibles = await pool.query(
        `SELECT 1 FROM asignacion_funciones af JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
         WHERE ua.id_usuario = $1 AND af.id_periodo = $2 AND af.estado_agenda <> 'Por Aprobar' LIMIT 1`,
        [idDocente, periodo.id_periodo]
    );
    if (visibles.rows.length === 0) return { ok: false, motivo: 'agenda_aun_oculta' };

    const docente = await getUsuario(idDocente);
    if (!docente) return { ok: false, motivo: 'docente_no_encontrado' };
    const director = idDirector ? await getUsuario(idDirector) : null;
    const quien = director ? director.nombre_completo : 'La dirección de programa';

    await notificacionesApp.crear({
        idUsuario: idDocente,
        tipo: 'asignaciones_corregidas',
        titulo: 'Se corrigieron las horas de tu agenda',
        mensaje: `${quien} ajustó las horas de ${cantidad ? (cantidad === 1 ? '1 actividad' : `${cantidad} actividades`) : 'tu carga académica'} del período ${nombrePeriodo(periodo)}. Revisa tu agenda.`,
        enlace: '/docente/agenda',
        clave: `asignaciones_corregidas:${periodo.id_periodo}`,
    });
    if (!docente.correo) return { ok: false, motivo: 'docente_sin_correo' };

    const { subject, html } = plantillas.plantillaAviso({
        asunto: `Se corrigieron las horas de su agenda — ${nombrePeriodo(periodo)}`,
        titulo: 'Horas de su agenda corregidas',
        nombre: docente.nombre_completo,
        parrafo: 'La dirección del programa corrigió las horas de algunas de sus actividades. Le recomendamos revisar su agenda para confirmar que todo esté correcto.',
        datos: [['Período', nombrePeriodo(periodo)], ['Corregidas por', quien], ['Actividades ajustadas', cantidad]],
        boton: { texto: 'Ver mi agenda', enlace: plantillas.url('/docente/agenda') },
    });
    return enviarYRegistrar({
        tipo: 'asignaciones_corregidas',
        clave: `asignaciones_corregidas:${idDocente}:${periodo.id_periodo}:${Date.now()}`,
        to: docente.correo, subject, html,
        remitente: await getRemitente(idDirector, ETIQUETA_DIRECTOR),
    });
};

// ---- 8.6 Visto bueno de las asignaciones de una función  ➔  Directores -----------
const notificarVistoBuenoAsignacion = async ({ idDocente, idFunciones, idRevisor = null }) => {
    const f = await datosDeFuncion(idFunciones);
    if (!f) return { ok: false, motivo: 'funcion_no_encontrada' };
    const clave = claveVistoAsignacion(idFunciones);
    if (await yaNotificado(clave)) return { ok: false, motivo: 'ya_notificado' };

    const docente = await getUsuario(idDocente);
    if (!docente) return { ok: false, motivo: 'docente_no_encontrado' };
    const revisor = idRevisor ? await getUsuario(idRevisor) : null;
    const directores = (await getDirectoresDePrograma(docente.id_programa)).filter((d) => Number(d.id_usuario) !== Number(idRevisor));
    if (directores.length === 0) return { ok: false, motivo: 'sin_directores' };

    const quien = revisor ? revisor.nombre_completo : 'El revisor de la función';
    const enlace = `/director/agendas/${idDocente}`;

    await notificacionesApp.crearParaVarios(directores.map((d) => d.id_usuario), {
        tipo: 'visto_bueno_asignacion',
        titulo: 'Visto bueno en las asignaciones',
        mensaje: `${quien} dio el visto bueno a «${f.funcion_sustantiva}» de ${docente.nombre_completo}. Falta tu aprobación para liberar la agenda.`,
        enlace,
        clave,
    });

    const resultados = [];
    for (const director of directores) {
        const { subject, html } = plantillas.plantillaAviso({
            asunto: `Visto bueno en las asignaciones — ${docente.nombre_completo}`,
            titulo: 'Visto bueno en las asignaciones',
            nombre: director.nombre_completo,
            parrafo: `${quien} revisó «${f.funcion_sustantiva}» de ${docente.nombre_completo} y le dio el visto bueno. La agenda solo se libera al docente cuando usted aprueba las asignaciones.`,
            datos: [['Docente', docente.nombre_completo], ['Programa', docente.nombre_programa], ['Período', periodoDeFuncion(f)], ['Función', f.funcion_sustantiva]],
            boton: { texto: 'Revisar las asignaciones', enlace: plantillas.url(enlace) },
        });
        resultados.push(await enviarYRegistrar({
            tipo: 'visto_bueno_asignacion', clave, to: director.correo, subject, html,
            remitente: await getRemitente(idRevisor, ETIQUETA_REVISION),
        }));
    }
    return { ok: resultados.some((r) => r.ok), enviados: resultados.length };
};

const reiniciarAvisoVistoAsignacion = (idFunciones) => reiniciarNotificacion(claveVistoAsignacion(idFunciones));

// ---- 8.6b Contrato del docente cambiado por el Director  ➔  Planeación / Admin -------
// El contrato del período lo fija el Director desde "Asignaciones de Planeación" (antes de liberar la agenda).
// Planeación cargó esos datos, así que se entera de qué cambió, quién y por qué importa (las horas se comparan con él).
const getPlaneacion = async () => {
    const r = await pool.query(
        `SELECT DISTINCT u.id_usuario, u.correo, TRIM(u.nombres || ' ' || u.apellidos) AS nombre_completo
         FROM usuarios u
         JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
         JOIN roles r ON r.id_rol = ur.id_rol
         WHERE u.activo = TRUE AND (LOWER(r.nombre_rol) LIKE '%planea%' OR LOWER(r.nombre_rol) LIKE '%admin%')`
    );
    return r.rows;
};

const describirContrato = ({ tipo, horas }) => (Number(horas) > 0 ? `${tipo} (${Number(horas)} h)` : `${tipo} (sin horas fijas)`);

const notificarContratoCambiado = async ({ idDocente, idDirector = null, anterior, nuevo }) => {
    const periodo = await getPeriodoActivo();
    if (!periodo) return { ok: false, motivo: 'sin_periodo_activo' };
    const docente = await getUsuario(idDocente);
    if (!docente) return { ok: false, motivo: 'docente_no_encontrado' };
    const director = idDirector ? await getUsuario(idDirector) : null;
    const quien = director ? director.nombre_completo : 'La dirección de programa';
    const destinatarios = (await getPlaneacion()).filter((p) => Number(p.id_usuario) !== Number(idDirector));
    if (destinatarios.length === 0) return { ok: false, motivo: 'sin_destinatarios' };

    const antes = describirContrato(anterior);
    const despues = describirContrato(nuevo);
    const clave = `contrato_cambiado:${idDocente}:${periodo.id_periodo}:${Date.now()}`;
    const enlace = '/planeacion/periodos';

    await notificacionesApp.crearParaVarios(destinatarios.map((d) => d.id_usuario), {
        tipo: 'contrato_cambiado',
        titulo: `Contrato corregido: ${docente.nombre_completo}`,
        mensaje: `${quien} cambió su contrato del período ${nombrePeriodo(periodo)} de ${antes} a ${despues}.`,
        enlace,
        clave,
    });

    const resultados = [];
    for (const destinatario of destinatarios) {
        const { subject, html } = plantillas.plantillaAviso({
            asunto: `Contrato corregido — ${docente.nombre_completo}`,
            titulo: 'Contrato corregido por la dirección',
            nombre: destinatario.nombre_completo,
            parrafo: `${quien} corrigió el contrato de ${docente.nombre_completo} en el período ${nombrePeriodo(periodo)} antes de liberar su agenda. Las horas de su carga se comparan con este contrato.`,
            datos: [['Docente', docente.nombre_completo], ['Programa', docente.nombre_programa], ['Período', nombrePeriodo(periodo)], ['Contrato anterior', antes], ['Contrato nuevo', despues]],
            boton: { texto: 'Ver el período', enlace: plantillas.url(enlace) },
        });
        resultados.push(await enviarYRegistrar({
            tipo: 'contrato_cambiado', clave: `${clave}:${destinatario.id_usuario}`, to: destinatario.correo, subject, html,
            remitente: await getRemitente(idDirector, ETIQUETA_DIRECTOR),
        }));
    }
    return { ok: resultados.some((r) => r.ok), enviados: resultados.length };
};

// ---- 8.7 Semana habilitada por Planeación  ➔  Docentes con agenda ---------------
// La campana avisa siempre; el correo es masivo, así que solo sale si se pide ({ correo: true }).
const textoVentana = (inicio, fin) => {
    const i = formatearFecha(inicio);
    const f = formatearFecha(fin);
    if (i && f) return `del ${i} al ${f}`;
    if (f) return `hasta el ${f}`;
    return null;
};

const notificarSemanaHabilitada = async ({ semanas = [], idRemitente = null, correo = false }) => {
    const periodo = await getPeriodoActivo();
    if (!periodo) return { ok: false, motivo: 'sin_periodo_activo' };
    const abiertas = semanas.filter((s) => ['0', '8', '16'].includes(String(s.numero_semana)));
    if (abiertas.length === 0) return { ok: false, motivo: 'sin_semanas' };

    const docentes = await getDocentesConAgenda(periodo.id_periodo);
    if (docentes.length === 0) return { ok: false, motivo: 'sin_docentes' };
    const remitente = correo ? await getRemitente(idRemitente, ETIQUETA_PLANEACION) : null;

    let enviados = 0;
    for (const semana of abiertas) {
        const numero = String(semana.numero_semana);
        const esAgenda = numero === '0';
        const etiqueta = esAgenda ? 'el registro de la agenda' : etiquetaCorte(numero, periodo.semestre);
        const ventana = textoVentana(semana.fecha_inicio, semana.fecha_fin);
        const enlace = esAgenda ? '/docente/agenda' : enlaceAvanceDocente(numero);

        await notificacionesApp.crearParaVarios(docentes.map((d) => d.id_usuario), {
            tipo: 'semana_habilitada',
            titulo: esAgenda ? 'Se abrió el registro de tu agenda' : `Se abrió la ${etiqueta}`,
            mensaje: esAgenda
                ? `Ya puedes completar y guardar tu agenda${ventana ? ` ${ventana}` : ''}.`
                : `Ya puedes registrar tu avance y subir tus evidencias${ventana ? ` ${ventana}` : ''}.`,
            enlace,
            clave: `semana_habilitada:${periodo.id_periodo}:${numero}`,
        });
        if (!correo) continue;

        for (const docente of docentes.filter((d) => d.correo)) {
            const clave = `semana_habilitada:${docente.id_usuario}:${periodo.id_periodo}:${numero}`;
            if (await yaNotificado(clave)) continue;
            const { subject, html } = plantillas.plantillaAviso({
                asunto: esAgenda ? `Se abrió el registro de su agenda — ${nombrePeriodo(periodo)}` : `Se abrió la ${etiqueta} — ${nombrePeriodo(periodo)}`,
                titulo: esAgenda ? 'Registro de agenda abierto' : `${etiqueta} abierta`,
                nombre: docente.nombre_completo,
                parrafo: esAgenda
                    ? 'Planeación habilitó el registro de la agenda. Ya puede completarla y enviarla a revisión.'
                    : `Planeación habilitó la ${etiqueta}. Ya puede registrar la ejecución de sus indicadores y subir sus evidencias.`,
                datos: [['Período', nombrePeriodo(periodo)], ['Disponible', ventana]],
                boton: { texto: esAgenda ? 'Ir a mi agenda' : 'Registrar mi avance', enlace: plantillas.url(enlace) },
            });
            const r = await enviarYRegistrar({ tipo: 'semana_habilitada', clave, to: docente.correo, subject, html, remitente });
            if (r.ok) enviados++;
        }
    }
    return { ok: true, docentes: docentes.length, enviados };
};

// ---- 8.8 Corte por cerrar  ➔  Docentes con agenda que aún no registran avance -----
// Avisa de los cortes habilitados cuya fecha de cierre cae en los próximos "dias" días.
const notificarCortesPorCerrar = async ({ dias = 3, idRemitente = null, correo = true } = {}) => {
    const periodo = await getPeriodoActivo();
    if (!periodo) return { ok: false, motivo: 'sin_periodo_activo' };
    const hoy = hoyEnColombia();
    const tope = Math.max(0, parseInt(dias, 10) || 0);

    const cortes = (await pool.query(
        `SELECT numero_semana, fecha_fin
         FROM semana
         WHERE id_periodo = $1 AND habilitada = TRUE AND numero_semana IN ('8', '16')
           AND fecha_fin IS NOT NULL AND fecha_fin >= $2::date AND fecha_fin <= ($2::date + $3::int)`,
        [periodo.id_periodo, hoy, tope]
    )).rows;
    if (cortes.length === 0) return { ok: false, motivo: 'sin_cortes_por_cerrar' };

    const remitente = correo ? await getRemitente(idRemitente, ETIQUETA_PLANEACION) : null;
    let enviados = 0;
    let total = 0;

    for (const corteFila of cortes) {
        const numero = String(corteFila.numero_semana);
        const etiqueta = etiquetaCorte(numero, periodo.semestre);
        const fin = formatearFecha(corteFila.fecha_fin);
        const columna = numero === '8' ? 'ejecucion_8' : 'ejecucion_16';

        // Docentes con agenda liberada que todavía no registran nada en este corte
        const pendientes = (await pool.query(
            `SELECT DISTINCT u.id_usuario, u.correo, TRIM(u.nombres || ' ' || u.apellidos) AS nombre_completo
             FROM usuarios u
             JOIN usuario_asignacion ua ON ua.id_usuario = u.id_usuario
             JOIN asignacion_funciones af ON af.id_funciones = ua.id_funciones
             WHERE af.id_periodo = $1 AND af.estado_agenda <> 'Por Aprobar' AND u.activo = TRUE
               AND NOT EXISTS (
                   SELECT 1
                   FROM usuario_asignacion ua2
                   JOIN asignacion_funciones af2 ON af2.id_funciones = ua2.id_funciones AND af2.id_periodo = $1
                   JOIN asignacion_actividades aa ON aa.id_funciones = af2.id_funciones
                   JOIN descripcion d ON d.id_asignacionact = aa.id_asignacionact
                   JOIN indicadores i ON i.id_descripcion = d.id_descripcion
                   WHERE ua2.id_usuario = u.id_usuario AND d.activo IS NOT FALSE AND i.activo IS NOT FALSE AND COALESCE(i.${columna}, 0) > 0
               )`,
            [periodo.id_periodo]
        )).rows;
        total += pendientes.length;

        await notificacionesApp.crearParaVarios(pendientes.map((d) => d.id_usuario), {
            tipo: 'corte_por_cerrar',
            titulo: `La ${etiqueta} está por cerrar`,
            mensaje: `${fin ? `Cierra el ${fin}. ` : ''}Aún no has registrado avance en este corte.`,
            enlace: enlaceAvanceDocente(numero),
            clave: `corte_por_cerrar:${periodo.id_periodo}:${numero}`,
        });
        if (!correo) continue;

        for (const docente of pendientes.filter((d) => d.correo)) {
            const clave = `corte_por_cerrar:${docente.id_usuario}:${periodo.id_periodo}:${numero}`;
            if (await yaNotificado(clave)) continue;
            const { subject, html } = plantillas.plantillaAviso({
                asunto: `La ${etiqueta} está por cerrar — ${nombrePeriodo(periodo)}`,
                titulo: `La ${etiqueta} está por cerrar`,
                nombre: docente.nombre_completo,
                parrafo: `${fin ? `La ${etiqueta} cierra el ${fin}. ` : ''}Todavía no registra avance en este corte. Cuando cierre, solo podrá consultarlo.`,
                datos: [['Período', nombrePeriodo(periodo)], ['Corte', etiqueta], ['Cierra', fin]],
                boton: { texto: 'Registrar mi avance', enlace: plantillas.url(enlaceAvanceDocente(numero)), color: plantillas.COLORES.naranja },
            });
            const r = await enviarYRegistrar({ tipo: 'corte_por_cerrar', clave, to: docente.correo, subject, html, remitente });
            if (r.ok) enviados++;
        }
    }
    return { ok: true, cortes: cortes.length, total, enviados };
};

// ---- 8.9 El docente corrigió una función devuelta  ➔  Directores del programa ----------
// Es el "ya corregí" del docente: la función vuelve a revisión y la dirección se entera de que es una
// corrección (con lo que ella había pedido), no de un guardado cualquiera.
const notificarCorteCorregido = async ({ idFunciones, semana, idDocente = null }) => {
    const f = await datosDeFuncion(idFunciones);
    if (!f) return { ok: false, motivo: 'funcion_no_encontrada' };
    const docente = await getUsuario(idDocente || f.id_docente);
    if (!docente) return { ok: false, motivo: 'docente_no_encontrado' };
    const directores = (await getDirectoresDePrograma(docente.id_programa)).filter((d) => Number(d.id_usuario) !== Number(docente.id_usuario));
    if (directores.length === 0) return { ok: false, motivo: 'sin_directores' };

    // Lo que la dirección había pedido corregir (queda guardado en la devolución)
    const previo = (await pool.query('SELECT observacion FROM revision_corte WHERE id_funciones = $1 AND semana = $2', [idFunciones, Number(semana)])).rows[0];
    const motivoPrevio = previo?.observacion || null;

    const corte = etiquetaCorte(semana, f.semestre);
    const enlace = `/director/agendas/${f.id_docente}/semana/${Number(semana)}`;

    await notificacionesApp.crearParaVarios(directores.map((d) => d.id_usuario), {
        tipo: 'corte_corregido',
        titulo: `${docente.nombre_completo} corrigió «${f.funcion_sustantiva}»`,
        mensaje: `Envió de nuevo su avance de ${corte} después de tu devolución. Está listo para revisar.`,
        enlace,
        clave: `corte_corregido:${idFunciones}:${Number(semana)}`,
    });

    const resultados = [];
    for (const director of directores) {
        const { subject, html } = plantillas.plantillaAviso({
            asunto: `${docente.nombre_completo} corrigió «${f.funcion_sustantiva}» — ${corte}`,
            titulo: `Corrección enviada en ${corte}`,
            nombre: director.nombre_completo,
            parrafo: `${docente.nombre_completo} corrigió la función «${f.funcion_sustantiva}» que usted había devuelto y la envió de nuevo a revisión.`,
            datos: [['Docente', docente.nombre_completo], ['Programa', docente.nombre_programa], ['Período', periodoDeFuncion(f)], ['Corte', corte], ['Función', f.funcion_sustantiva]],
            recuadro: motivoPrevio ? { titulo: 'Lo que usted había pedido corregir', texto: motivoPrevio, color: plantillas.COLORES.verde } : null,
            boton: { texto: 'Revisar la corrección', enlace: plantillas.url(enlace) },
        });
        resultados.push(await enviarYRegistrar({
            tipo: 'corte_corregido',
            clave: `corte_corregido:${idFunciones}:${Number(semana)}:${Date.now()}`,
            to: director.correo, subject, html,
            remitente: await getRemitente(docente.id_usuario, 'Docente'),
        }));
    }
    return { ok: resultados.some((r) => r.ok), enviados: resultados.length };
};

// ----------------------------------------------------------------
// Versiones "dispara y olvida" para usar dentro de los controladores
// ----------------------------------------------------------------
// Como enSegundoPlano, pero el controlador ESPERA (hasta "limiteMs") antes de responder. Nunca lanza: si algo
// falla o se demora, la acción de negocio ya quedó guardada.
const esperando = (etiqueta, fn, limiteMs = 5000) => async (...args) => {
    let temporizador;
    const limite = new Promise((resolver) => { temporizador = setTimeout(resolver, limiteMs); });
    try {
        await Promise.race([
            Promise.resolve().then(() => fn(...args)).catch((error) => console.error(`[notificaciones] ${etiqueta} falló:`, error.message)),
            limite,
        ]);
    } finally {
        clearTimeout(temporizador);
    }
};

const enSegundoPlanoAPI = {
    agendaEnviada: (idUsuario) =>
        enSegundoPlano('agendaEnviada', () => notificarAgendaEnviada(idUsuario)),

    agendaAprobada: (idUsuario, idDirector) =>
        enSegundoPlano('agendaAprobada', () => notificarAgendaAprobada(idUsuario, idDirector)),

    agendaDevuelta: (idUsuario, idDirector, observaciones) =>
        enSegundoPlano('agendaDevuelta', () => notificarAgendaDevuelta(idUsuario, idDirector, observaciones)),

    observacionDirector: (datos) =>
        enSegundoPlano('observacionDirector', () => notificarObservacionDirector(datos)),

    // Igual, pero el controlador la ESPERA (hasta "limiteMs") antes de responder. En un servidor sin estado
    // como Vercel la tarea "en segundo plano" puede cortarse al enviar la respuesta; esperando, la campana y
    // el correo salen. Nunca lanza: si algo falla o se demora, la observación ya quedó guardada.
    observacionDirectorAhora: async (datos, limiteMs = 5000) => {
        let temporizador;
        const limite = new Promise((resolver) => { temporizador = setTimeout(resolver, limiteMs); });
        try {
            await Promise.race([
                notificarObservacionDirector(datos).catch((error) => console.error('[notificaciones] observacionDirector falló:', error.message)),
                limite,
            ]);
        } finally {
            clearTimeout(temporizador);
        }
    },

    bienvenida: (datos) =>
        enSegundoPlano('bienvenida', () => notificarBienvenida(datos)),

    aperturaPeriodo: (idPeriodo, idRemitente) =>
        enSegundoPlano('aperturaPeriodo', () => notificarAperturaPeriodo(idPeriodo, idRemitente)),

    asignacionesCargadas: (ids, idPeriodo, idRemitente) =>
        enSegundoPlano('asignacionesCargadas', () => notificarAsignacionesCargadas(ids, idPeriodo, idRemitente)),

    // Avisos de revisión de cortes, asignaciones y semanas: el controlador los espera (con tope)
    corteRevisadoAhora: esperando('corteRevisado', notificarCorteRevisado),
    vistoBuenoCorteAhora: esperando('vistoBuenoCorte', notificarVistoBuenoCorte),
    avanceGuardadoAhora: esperando('avanceGuardado', notificarAvanceGuardado),
    asignacionesAprobadasAhora: esperando('asignacionesAprobadas', notificarAsignacionesAprobadas),
    asignacionesCorregidasAhora: esperando('asignacionesCorregidas', notificarAsignacionesCorregidas),
    vistoBuenoAsignacionAhora: esperando('vistoBuenoAsignacion', notificarVistoBuenoAsignacion),
    contratoCambiadoAhora: esperando('contratoCambiado', notificarContratoCambiado),
    semanaHabilitadaAhora: esperando('semanaHabilitada', notificarSemanaHabilitada, 8000),
    corteCorregidoAhora: esperando('corteCorregido', notificarCorteCorregido),
};

module.exports = {
    // Versiones await-ables (útiles para pruebas y endpoints manuales)
    notificarAgendaEnviada,
    notificarAgendaAprobada,
    notificarAgendaDevuelta,
    notificarObservacionDirector,
    notificarBienvenida,
    notificarAperturaPeriodo,
    notificarAsignacionesCargadas,
    notificarRecordatorioPlazo,
    notificarCorteRevisado,
    notificarVistoBuenoCorte,
    reiniciarAvisoVistoCorte,
    notificarAvanceGuardado,
    notificarAsignacionesAprobadas,
    notificarAsignacionesCorregidas,
    notificarVistoBuenoAsignacion,
    notificarContratoCambiado,
    reiniciarAvisoVistoAsignacion,
    notificarSemanaHabilitada,
    notificarCortesPorCerrar,
    notificarCorteCorregido,
    // Versiones en segundo plano
    background: enSegundoPlanoAPI,
    // Auxiliares reutilizables
    nombrePeriodo,
    formatearFecha
};
