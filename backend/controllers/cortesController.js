/**
 * Revisión de los cortes (semana 8 y 16) — dos etapas.
 *
 * Por cada FUNCIÓN sustantiva y cada corte:
 *
 *   1. El docente guarda su avance            → 'Pendiente'
 *   2. El revisor de esa función da el visto  → 'Visto bueno'
 *   3. El Director cierra el corte            → 'Aprobado'
 *      (o lo devuelve al docente              → 'Devuelto')
 *
 * La regla que ordena todo: el Director NO puede aprobar una función que
 * revisa otro rol mientras no tenga su visto bueno. Las funciones que el
 * propio Director revisa pasan de 'Pendiente' a 'Aprobado' sin escala.
 */
const pool = require('../db/connection');
const { alcanceFunciones, docenteEnAlcance } = require('../utils/rolActivo');

/**
 * Resuelve quién puede hacer qué sobre una función concreta.
 * Devuelve null si la función no existe o no es del alcance del usuario.
 */
const resolverPermisos = async (req, idFunciones) => {
    const info = await pool.query(`
        SELECT af.id_funciones, af.funcion_sustantiva, af.id_periodo,
               ua.id_usuario AS id_docente
        FROM asignacion_funciones af
        JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
        WHERE af.id_funciones = $1
        LIMIT 1
    `, [idFunciones]);

    if (info.rows.length === 0) return null;
    const fila = info.rows[0];

    if (!(await docenteEnAlcance(req, fila.id_docente))) return { ...fila, fueraDeAlcance: true };

    const alcance = await alcanceFunciones(req);
    const esComodin = !alcance.restringido || !!alcance.esComodin;
    const revisaEsta = !alcance.restringido || alcance.funciones.includes(fila.funcion_sustantiva);

    // ¿Otro rol (no el Director) es el responsable de esta función?
    const dueno = await pool.query(`
        SELECT r.nombre_rol
        FROM rol_funcion rf
        JOIN roles r ON r.id_rol = rf.id_rol
        WHERE rf.funcion_sustantiva = $1 AND r.es_comodin = FALSE
        LIMIT 1
    `, [fila.funcion_sustantiva]);

    return {
        ...fila,
        esComodin,
        revisaEsta,
        // Si nadie distinto del Director la revisa, no hace falta visto bueno previo
        revisorPropio: dueno.rows[0]?.nombre_rol || null,
    };
};

/**
 * ¿El docente ya reportó ejecución en este corte?
 *
 * Es esto —y no la existencia de la fila en revision_corte— lo que abre la
 * revisión: los avances guardados antes de que existiera la tabla no tienen
 * fila, y aun así hay que poder revisarlos. La fila se crea al marcar.
 */
const tieneReporte = async (idFunciones, semana) => {
    const { rows } = await pool.query(`
        SELECT EXISTS (
            SELECT 1 FROM revision_corte WHERE id_funciones = $1 AND semana = $2
        ) OR EXISTS (
            SELECT 1
            FROM asignacion_actividades aa
            JOIN descripcion d ON d.id_asignacionact = aa.id_asignacionact AND d.activo IS NOT FALSE
            JOIN indicadores i ON i.id_descripcion = d.id_descripcion AND i.activo IS NOT FALSE
            WHERE aa.id_funciones = $1
              AND COALESCE(CASE WHEN $2::int = 8 THEN i.ejecucion_8 ELSE i.ejecucion_16 END, 0) > 0
        ) AS hay
    `, [idFunciones, semana]);
    return rows[0].hay;
};

/** Estado guardado del corte, o 'Pendiente' si todavía no tiene fila. */
const estadoActual = async (idFunciones, semana) => {
    const { rows } = await pool.query(
        'SELECT estado FROM revision_corte WHERE id_funciones = $1 AND semana = $2',
        [idFunciones, semana]
    );
    return rows[0]?.estado || 'Pendiente';
};

const upsertEstado = async (client, idFunciones, semana, campos) => {
    const cols = Object.keys(campos);
    const sets = cols.map((c, i) => `${c} = $${i + 3}`).join(', ');
    const vals = cols.map(c => campos[c]);

    await client.query(`
        INSERT INTO revision_corte (id_funciones, semana, ${cols.join(', ')}, actualizado_en)
        VALUES ($1, $2, ${cols.map((_, i) => `$${i + 3}`).join(', ')}, NOW())
        ON CONFLICT (id_funciones, semana)
        DO UPDATE SET ${sets}, actualizado_en = NOW()
    `, [idFunciones, semana, ...vals]);
};

// ================================================================
// PUT /api/director/cortes/:id_funciones/:semana/visto
// Etapa 1 — el revisor de la función da su visto bueno.
// ================================================================
const darVistoBueno = async (req, res) => {
    const idFunciones = parseInt(req.params.id_funciones, 10);
    const semana = parseInt(req.params.semana, 10);
    if (isNaN(idFunciones) || ![8, 16].includes(semana)) {
        return res.status(400).json({ error: 'Función o semana inválida.' });
    }

    try {
        const p = await resolverPermisos(req, idFunciones);
        if (!p) return res.status(404).json({ error: 'Función no encontrada.' });
        if (p.fueraDeAlcance) return res.status(403).json({ error: 'Este docente no pertenece a los programas que gestionas.' });
        if (!p.revisaEsta) return res.status(403).json({ error: `Tu rol no revisa la función "${p.funcion_sustantiva}".` });

        if (!(await tieneReporte(idFunciones, semana))) {
            return res.status(409).json({ error: 'El docente todavía no ha reportado este corte.' });
        }
        if (await estadoActual(idFunciones, semana) === 'Aprobado') {
            return res.status(409).json({ error: 'El Director ya cerró este corte.' });
        }

        // El botón alterna: volver a pulsarlo retira la marca. Es la única
        // salida si se marcó por error, ya que no hay acción de devolver.
        const quitar = req.body?.revisado === false;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await upsertEstado(client, idFunciones, semana, {
                estado: quitar ? 'Pendiente' : 'Visto bueno',
                visto_bueno_por: quitar ? null : req.user.id,
                visto_bueno_en: quitar ? null : new Date(),
                observacion: null,
            });
            await client.query('COMMIT');
        } finally {
            client.release();
        }

        res.json({
            mensaje: quitar
                ? `Se retiró la marca de revisado en "${p.funcion_sustantiva}". Vuelve a quedar pendiente.`
                : `"${p.funcion_sustantiva}" quedó marcada como revisada. Ahora pasa al Director.`,
            estado: quitar ? 'Pendiente' : 'Visto bueno'
        });

    } catch (error) {
        console.error('Error en darVistoBueno:', error);
        res.status(500).json({ error: 'Error al registrar el visto bueno.', detalles: error.message });
    }
};

// ================================================================
// PUT /api/director/cortes/:id_funciones/:semana/aprobar
// Etapa 2 — el Director cierra el corte de esa función.
// ================================================================
const aprobarCorte = async (req, res) => {
    const idFunciones = parseInt(req.params.id_funciones, 10);
    const semana = parseInt(req.params.semana, 10);
    if (isNaN(idFunciones) || ![8, 16].includes(semana)) {
        return res.status(400).json({ error: 'Función o semana inválida.' });
    }

    try {
        const p = await resolverPermisos(req, idFunciones);
        if (!p) return res.status(404).json({ error: 'Función no encontrada.' });
        if (p.fueraDeAlcance) return res.status(403).json({ error: 'Este docente no pertenece a los programas que gestionas.' });
        if (!p.esComodin) {
            return res.status(403).json({ error: 'Solo el Director de programa puede cerrar un corte.' });
        }

        if (!(await tieneReporte(idFunciones, semana))) {
            return res.status(409).json({ error: 'El docente todavía no ha reportado este corte.' });
        }

        // La regla de las dos etapas: si la función tiene su propio revisor,
        // el Director espera su visto bueno.
        if (p.revisorPropio && await estadoActual(idFunciones, semana) === 'Pendiente') {
            return res.status(409).json({
                error: `"${p.funcion_sustantiva}" debe pasar primero por la revisión de ${p.revisorPropio}. Aún no tiene visto bueno.`,
                requiere_visto_bueno_de: p.revisorPropio
            });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await upsertEstado(client, idFunciones, semana, {
                estado: 'Aprobado',
                aprobado_por: req.user.id,
                aprobado_en: new Date(),
                observacion: null,
            });
            await client.query('COMMIT');
        } finally {
            client.release();
        }

        res.json({ mensaje: `Corte de "${p.funcion_sustantiva}" aprobado.`, estado: 'Aprobado' });

    } catch (error) {
        console.error('Error en aprobarCorte:', error);
        res.status(500).json({ error: 'Error al aprobar el corte.', detalles: error.message });
    }
};

// ================================================================
// PUT /api/director/cortes/:id_funciones/:semana/devolver
// Devuelve el corte al docente con un motivo obligatorio.
// Puede hacerlo el revisor de la función o el Director.
// Body: { observacion }
// ================================================================
const devolverCorte = async (req, res) => {
    const idFunciones = parseInt(req.params.id_funciones, 10);
    const semana = parseInt(req.params.semana, 10);
    const { observacion } = req.body || {};

    if (isNaN(idFunciones) || ![8, 16].includes(semana)) {
        return res.status(400).json({ error: 'Función o semana inválida.' });
    }
    if (!observacion || !observacion.trim()) {
        return res.status(400).json({ error: 'Debes indicar por qué devuelves el corte.' });
    }

    try {
        const p = await resolverPermisos(req, idFunciones);
        if (!p) return res.status(404).json({ error: 'Función no encontrada.' });
        if (p.fueraDeAlcance) return res.status(403).json({ error: 'Este docente no pertenece a los programas que gestionas.' });
        if (!p.revisaEsta && !p.esComodin) {
            return res.status(403).json({ error: `Tu rol no revisa la función "${p.funcion_sustantiva}".` });
        }

        if (!(await tieneReporte(idFunciones, semana))) {
            return res.status(409).json({ error: 'El docente todavía no ha reportado este corte.' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await upsertEstado(client, idFunciones, semana, {
                estado: 'Devuelto',
                observacion: observacion.trim(),
                visto_bueno_por: null,
                visto_bueno_en: null,
            });
            await client.query('COMMIT');
        } finally {
            client.release();
        }

        res.json({
            mensaje: `Corte de "${p.funcion_sustantiva}" devuelto al docente.`,
            estado: 'Devuelto'
        });

    } catch (error) {
        console.error('Error en devolverCorte:', error);
        res.status(500).json({ error: 'Error al devolver el corte.', detalles: error.message });
    }
};

module.exports = { darVistoBueno, aprobarCorte, devolverCorte };
