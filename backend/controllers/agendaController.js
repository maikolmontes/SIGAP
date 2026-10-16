const pool = require('../db/connection');
const notificaciones = require('../services/notificacionesService');
const { rolesEfectivos } = require('../utils/rolActivo');
const { verificarSemana } = require('../utils/semanaAbierta');
const { asegurarCorregidoEn } = require('../utils/esquemaRevisionCorte');
const { indicadoresSinAvance } = require('../utils/avanceObligatorio');
const { idUsuarioDe, puedeVerDocente } = require('../middleware/accesoEvidencias');

// Meta máxima que puede escribir un docente en una actividad de su agenda
const META_MAXIMA = 20;

const esPlaneacionOAdmin = (req) => rolesEfectivos(req).some((r) => r === 'planeacion' || r === 'admin');

const getAgenda = async (req, res) => {
    const { id_usuario } = req.params;

    try {
        if (!(await puedeVerDocente(req, id_usuario)) && !esPlaneacionOAdmin(req)) {
            return res.status(403).json({ error: 'No tienes permiso para ver esta agenda.' });
        }

        const docente = await pool.query(`
            SELECT
                u.nombres || ' ' || u.apellidos AS nombre_completo,
                u.numero_documento,
                u.correo,
                tc.tipo             AS tipo_contrato,
                tc.horas_contrato,
                pa.nombre_programa,
                na.nombre_titulo    AS nivel_academico,
                per.anio || '-' || CASE per.semestre WHEN 3 THEN 'Intersemestral I' WHEN 4 THEN 'Intersemestral II' ELSE per.semestre::text END AS periodo
            FROM usuarios u
            JOIN tipo_contrato tc       ON u.id_contrato  = tc.id_contrato
            JOIN programa_academico pa  ON u.id_programa  = pa.id_programa
            JOIN usuario_nivel un       ON u.id_usuario   = un.id_usuario
            JOIN nivel_academico na     ON un.id_nivelaca = na.id_nivelaca
            JOIN programa_periodo pp    ON pa.id_programa = pp.id_programa
            JOIN periodo per            ON pp.id_periodo  = per.id_periodo
            WHERE u.id_usuario = $1
            AND per.activo = TRUE
        `, [id_usuario]);

        if (docente.rows.length === 0) {
            return res.status(404).json({ error: 'Docente no encontrado' });
        }

        const funciones = await pool.query(`
            SELECT
                af.id_funciones,
                af.funcion_sustantiva,
                af.horas_funcion,
                af.estado_agenda,
                af.observaciones_generales
            FROM usuario_asignacion ua
            JOIN asignacion_funciones af ON ua.id_funciones = af.id_funciones
            JOIN periodo p ON p.id_periodo = af.id_periodo
            WHERE ua.id_usuario = $1 AND p.activo = true AND af.estado_agenda <> 'Por Aprobar'
            ORDER BY af.id_funciones
        `, [id_usuario]);

        const actividades = await pool.query(`
            WITH descripciones AS (
                SELECT
                    aa.id_asignacionact,
                    aa.id_funciones,
                    aa.rol_seleccionado,
                    aa.horas_rol,
                    ea.codigo_espacio,
                    ea.nombre_espacio,
                    d.id_descripcion,
                    d.resultado_esperado,
                    d.meta,
                    i.nombre_indicador,
                    ROW_NUMBER() OVER(
                        PARTITION BY aa.id_asignacionact
                        ORDER BY d.id_descripcion
                    ) AS fila
                FROM usuario_asignacion ua
                JOIN asignacion_funciones af    ON ua.id_funciones     = af.id_funciones
                JOIN asignacion_actividades aa  ON af.id_funciones     = aa.id_funciones
                LEFT JOIN espacio_academico ea  ON aa.id_espacio_aca   = ea.id_espacio_aca
                JOIN descripcion d              ON aa.id_asignacionact = d.id_asignacionact
                JOIN indicadores i              ON i.id_descripcion    = d.id_descripcion
                JOIN periodo p                  ON p.id_periodo        = af.id_periodo
                WHERE ua.id_usuario = $1 AND p.activo = true AND af.estado_agenda <> 'Por Aprobar'
            ),
            ejecuciones_s8 AS (
                SELECT
                    acs.id_asignacionact,
                    acs.ejecucion         AS ejecucion_s8,
                    acs.estado_aprobacion AS estado_s8,
                    acs.observaciones     AS obs_s8,
                    r.porcentaje_avance   AS avance_s8,
                    ROW_NUMBER() OVER(
                        PARTITION BY acs.id_asignacionact
                        ORDER BY acs.id_actsemana
                    ) AS fila
                FROM actividad_semana acs
                JOIN semana s     ON acs.id_semana     = s.id_semana
                JOIN resultados r ON acs.id_resultados = r.id_resultados
                WHERE s.numero_semana = '8'
            ),
            ejecuciones_s16 AS (
                SELECT
                    acs.id_asignacionact,
                    acs.ejecucion         AS ejecucion_s16,
                    acs.estado_aprobacion AS estado_s16,
                    acs.observaciones     AS obs_s16,
                    r.porcentaje_avance   AS avance_s16,
                    ROW_NUMBER() OVER(
                        PARTITION BY acs.id_asignacionact
                        ORDER BY acs.id_actsemana
                    ) AS fila
                FROM actividad_semana acs
                JOIN semana s     ON acs.id_semana     = s.id_semana
                JOIN resultados r ON acs.id_resultados = r.id_resultados
                WHERE s.numero_semana = '16'
            )
            SELECT
                d.id_asignacionact,
                d.id_funciones,
                d.rol_seleccionado,
                d.horas_rol,
                d.codigo_espacio,
                d.nombre_espacio,
                d.id_descripcion,
                d.resultado_esperado,
                d.meta,
                d.nombre_indicador,
                e8.ejecucion_s8,
                e8.estado_s8,
                e8.obs_s8,
                e8.avance_s8,
                e16.ejecucion_s16,
                e16.estado_s16,
                e16.obs_s16,
                e16.avance_s16
            FROM descripciones d
            JOIN ejecuciones_s8  e8  ON d.id_asignacionact = e8.id_asignacionact
                                    AND d.fila = e8.fila
            JOIN ejecuciones_s16 e16 ON d.id_asignacionact = e16.id_asignacionact
                                    AND d.fila = e16.fila
            ORDER BY d.id_funciones, d.nombre_espacio, d.id_descripcion
        `, [id_usuario]);

        const horas = await pool.query(`
            SELECT
                tc.horas_contrato,
                SUM(af.horas_funcion)                         AS total_asignado,
                tc.horas_contrato - SUM(af.horas_funcion)     AS diferencia,
                CASE
                    WHEN SUM(af.horas_funcion) = tc.horas_contrato THEN 'Completo'
                    WHEN SUM(af.horas_funcion) > tc.horas_contrato THEN 'Excede contrato'
                    ELSE 'Faltan horas'
                END AS estado_carga
            FROM usuario_asignacion ua
            JOIN asignacion_funciones af ON ua.id_funciones = af.id_funciones
            JOIN usuarios u              ON ua.id_usuario   = u.id_usuario
            JOIN tipo_contrato tc        ON u.id_contrato   = tc.id_contrato
            WHERE ua.id_usuario = $1
            GROUP BY tc.horas_contrato
        `, [id_usuario]);

        res.json({
            docente: docente.rows[0],
            funciones: funciones.rows,
            actividades: actividades.rows,
            horas: horas.rows[0] || {}
        });

    } catch (error) {
        console.error('Error en getAgenda:', error.message);
        res.status(500).json({ error: 'Error al obtener la agenda' });
    }
};

const getAgendaBase = async (req, res) => {
    const { id_usuario } = req.params;

    try {
        if (!(await puedeVerDocente(req, id_usuario)) && !esPlaneacionOAdmin(req)) {
            return res.status(403).json({ error: 'No tienes permiso para ver esta agenda.' });
        }

        const funciones = await pool.query(`
            SELECT
                af.id_funciones,
                af.funcion_sustantiva,
                af.horas_funcion,
                af.estado_agenda,
                af.observaciones_generales
            FROM usuario_asignacion ua
            JOIN asignacion_funciones af ON ua.id_funciones = af.id_funciones
            JOIN periodo p ON p.id_periodo = af.id_periodo
            WHERE ua.id_usuario = $1 AND p.activo = true AND af.estado_agenda <> 'Por Aprobar'
            ORDER BY af.id_funciones
        `, [id_usuario]);

        const actividades = await pool.query(`
            SELECT
                aa.id_asignacionact,
                aa.id_funciones,
                aa.rol_seleccionado,
                aa.horas_rol,
                ea.codigo_espacio,
                COALESCE(ea.nombre_espacio, aa.rol_seleccionado) AS nombre_espacio,
                ea.id_espacio_aca,
                s.nombre_sem AS semestre_nombre,
                COALESCE(g.nombre_grupo, '') AS grupo_nombre,

                d.id_descripcion,
                d.resultado_esperado,
                d.meta,
                
                i.id_indicadores as id_indicador,
                i.nombre_indicador,
                i.ejecucion_8,
                i.ejecucion_16,
                i.observaciones,

                (
                    SELECT COALESCE(json_agg(json_build_object(
                        'id_evidencias', ev.id_evidencias,
                        'nombre_archivo', ev.nombre_archivo,
                        'ruta_archivo', ev.ruta_archivo,
                        'tipo_archivo', ev.tipo_archivo,
                        'tamanio_archivo_kb', ev.tamanio_archivo_kb,
                        'fecha_carga', ev.fecha_carga,
                        'semana', ev.semana
                    ) ORDER BY ev.fecha_carga DESC), '[]'::json)
                    FROM evidencias ev
                    WHERE ev.id_indicadores = i.id_indicadores
                ) AS evidencias,

                -- Observaciones que el Director dejó sobre esta actividad.
                -- Viven en observaciones_director (por actividad + semana), no en
                -- indicadores.observaciones, que es una columna sin uso real.
                (
                    SELECT COALESCE(json_agg(json_build_object(
                        'id', od.id,
                        'semana', od.semana,
                        'texto', od.texto,
                        'ultima_edicion', od.ultima_edicion,
                        'director_nombre', COALESCE(ud.nombres || ' ' || ud.apellidos, 'Dirección de Programa')
                    ) ORDER BY od.ultima_edicion DESC), '[]'::json)
                    FROM observaciones_director od
                    LEFT JOIN usuarios ud ON ud.id_usuario = od.director_id
                    WHERE od.id_asignacionact = aa.id_asignacionact
                ) AS observaciones_director

            FROM usuario_asignacion ua
            JOIN asignacion_funciones af    ON ua.id_funciones     = af.id_funciones
            JOIN asignacion_actividades aa  ON af.id_funciones     = aa.id_funciones
            LEFT JOIN espacio_academico ea  ON aa.id_espacio_aca   = ea.id_espacio_aca
            LEFT JOIN semestres s           ON ea.id_semestre      = s.id_semestre
            LEFT JOIN grupos g              ON g.id_grupos         = aa.id_grupos
            LEFT JOIN descripcion d         ON aa.id_asignacionact = d.id_asignacionact
            LEFT JOIN indicadores i         ON i.id_descripcion    = d.id_descripcion
            JOIN periodo p                  ON p.id_periodo        = af.id_periodo
            WHERE ua.id_usuario = $1 AND p.activo = true AND af.estado_agenda <> 'Por Aprobar'
            ORDER BY af.id_funciones, aa.id_asignacionact, d.id_descripcion, i.id_indicadores
        `, [id_usuario]);

        // Estado de revisión de cada corte (semana 8 y 16) por función: así el docente ve cuáles le devolvieron y por qué
        let cortes = [];
        const idsFunciones = funciones.rows.map((fn) => fn.id_funciones);
        if (idsFunciones.length > 0) {
            try {
                await asegurarCorregidoEn();
                cortes = (await pool.query(
                    'SELECT id_funciones, semana, estado, observacion, corregido_en, actualizado_en FROM revision_corte WHERE id_funciones = ANY($1::int[])',
                    [idsFunciones]
                )).rows;
            } catch (error) {
                console.warn('No se pudo leer revision_corte:', error.message);
            }
        }
        const funcionesConCortes = funciones.rows.map((fn) => ({
            ...fn,
            revision_cortes: Object.fromEntries(
                cortes.filter((c) => c.id_funciones === fn.id_funciones)
                    .map((c) => [String(c.semana), { estado: c.estado, observacion: c.observacion, corregido_en: c.corregido_en, actualizado_en: c.actualizado_en }])
            ),
        }));

        res.json({
            funciones: funcionesConCortes,
            actividades: actividades.rows
        });

    } catch (error) {
        console.error('Error en getAgendaBase:', error.message);
        res.status(500).json({ error: 'Error al obtener la agenda base' });
    }
};

// ================================================================
// guardarFuncionDocente:
// Recibe el id_funciones y la lista de actividades con sus detalles
// (rol_seleccionado, resultado_esperado, meta, indicadores).
// Actualiza las actividades existentes y crea descripción/indicadores.
// Marca la función como "Aceptado".
// ================================================================
const guardarFuncionDocente = async (req, res) => {
    const { id_funciones, actividades } = req.body;

    if (!id_funciones || !actividades || !Array.isArray(actividades)) {
        return res.status(400).json({ error: 'Se requiere id_funciones y un arreglo de actividades.' });
    }

    // La agenda solo se edita mientras la Semana 0 de su período está abierta (habilitada y dentro de sus fechas)
    if (!esPlaneacionOAdmin(req)) {
        const periodoFuncion = (await pool.query('SELECT id_periodo FROM asignacion_funciones WHERE id_funciones = $1', [id_funciones])).rows[0];
        const semanaCero = await verificarSemana('0', periodoFuncion?.id_periodo ?? null);
        if (!semanaCero.abierta) {
            return res.status(403).json({ error: semanaCero.mensaje || 'La Semana 0 no está abierta: la agenda ya no se puede modificar.' });
        }
    }

    // Solo se guarda lo propio: la función debe ser del usuario y cada actividad, de esa función
    if (!esPlaneacionOAdmin(req)) {
        const dueno = await pool.query('SELECT 1 FROM usuario_asignacion WHERE id_funciones = $1 AND id_usuario = $2 LIMIT 1', [id_funciones, idUsuarioDe(req)]);
        if (dueno.rows.length === 0) {
            return res.status(403).json({ error: 'Esta función no pertenece a tu agenda.' });
        }
        const idsActividad = actividades.map((a) => a && a.id_asignacionact).filter((id) => id !== undefined && id !== null && id !== '');
        if (idsActividad.length > 0) {
            const propias = await pool.query('SELECT id_asignacionact FROM asignacion_actividades WHERE id_funciones = $1', [id_funciones]);
            const permitidas = new Set(propias.rows.map((r) => String(r.id_asignacionact)));
            if (idsActividad.some((id) => !permitidas.has(String(id)))) {
                return res.status(403).json({ error: 'Alguna actividad no pertenece a esta función.' });
            }
        }
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        for (const act of actividades) {
            const idAct = act.id_asignacionact;
            const rol = act.actividadLibre || '';
            const resultadoEsperado = act.resultadoEsperado || '';
            const meta = act.meta || '';
            const indicadores = act.indicadores || [];

            // Actualizar el rol_seleccionado de la actividad si cambió
            if (idAct && rol) {
                await client.query(
                    'UPDATE asignacion_actividades SET rol_seleccionado = $1 WHERE id_asignacionact = $2',
                    [rol, idAct]
                );
            }

            // Si hay resultado esperado o descripciones fijas, gestionar descripción e indicadores
            if (idAct && (resultadoEsperado || (act.descripciones && act.descripciones.length > 0))) {
                const descsToInsert = act.descripciones && act.descripciones.length > 0
                    ? act.descripciones
                    : [{ resultadoEsperado, meta, indicadores }];

                // Obtener descripciones existentes para esta actividad
                const existingDescsRes = await client.query(
                    'SELECT id_descripcion, resultado_esperado, meta FROM descripcion WHERE id_asignacionact = $1 ORDER BY id_descripcion',
                    [idAct]
                );
                const existingDescs = existingDescsRes.rows;

                for (let idx = 0; idx < descsToInsert.length; idx++) {
                    const descData = descsToInsert[idx];
                    const existingDesc = existingDescs[idx];

                    // La meta es el denominador del porcentaje de avance: en
                    // negativo el cálculo queda sin sentido (y llegó a guardarse
                    // una meta de -7). Se valida aquí, que es donde se escribe.
                    if (descData.meta !== null && descData.meta !== undefined && descData.meta !== '') {
                        const metaNum = parseFloat(String(descData.meta));
                        if (isNaN(metaNum) || metaNum < 0) {
                            await client.query('ROLLBACK');
                            return res.status(400).json({
                                error: `La meta debe ser un número mayor o igual a cero. Se recibió "${descData.meta}".`
                            });
                        }
                        // La meta que escribe el docente llega como máximo a META_MAXIMA (las fijas del catálogo no pasan por aquí)
                        if (!(act.descripciones && act.descripciones.length > 0) && metaNum > META_MAXIMA) {
                            await client.query('ROLLBACK');
                            return res.status(400).json({ error: `La meta no puede ser mayor a ${META_MAXIMA}. Se recibió "${descData.meta}".` });
                        }
                    }

                    let idDescripcion;
                    if (existingDesc) {
                        // Actualizar descripción existente
                        idDescripcion = existingDesc.id_descripcion;
                        await client.query(
                            'UPDATE descripcion SET resultado_esperado = $1, meta = $2 WHERE id_descripcion = $3',
                            [descData.resultadoEsperado, descData.meta || null, idDescripcion]
                        );
                    } else {
                        // Insertar nueva descripción
                        const descRes = await client.query(
                            'INSERT INTO descripcion (id_asignacionact, resultado_esperado, meta, activo) VALUES ($1, $2, $3, TRUE) RETURNING id_descripcion',
                            [idAct, descData.resultadoEsperado, descData.meta || null]
                        );
                        idDescripcion = descRes.rows[0].id_descripcion;
                    }

                    // Gestionar indicadores para esta descripción
                    const existingIndsRes = await client.query(
                        'SELECT id_indicadores, nombre_indicador FROM indicadores WHERE id_descripcion = $1 ORDER BY id_indicadores',
                        [idDescripcion]
                    );
                    const existingInds = existingIndsRes.rows;

                    const incomingInds = descData.indicadores || [];
                    const updatedOrInsertedIds = [];

                    for (let i = 0; i < incomingInds.length; i++) {
                        const indData = incomingInds[i];
                        if (!indData.nombre_indicador || !indData.nombre_indicador.trim()) continue;

                        const numericId = parseInt(indData.id, 10);
                        let matchedInd = null;

                        if (!isNaN(numericId)) {
                            matchedInd = existingInds.find(e => e.id_indicadores === numericId);
                        }

                        if (!matchedInd && existingInds[i]) {
                            matchedInd = existingInds[i];
                        }

                        if (matchedInd) {
                            // Actualizar indicador existente sin alterar ejecuciones o evidencias
                            await client.query(
                                'UPDATE indicadores SET nombre_indicador = $1 WHERE id_indicadores = $2',
                                [indData.nombre_indicador.trim(), matchedInd.id_indicadores]
                            );
                            updatedOrInsertedIds.push(matchedInd.id_indicadores);
                        } else {
                            // Insertar nuevo indicador
                            const indRes = await client.query(
                                'INSERT INTO indicadores (id_descripcion, nombre_indicador, activo) VALUES ($1, $2, TRUE) RETURNING id_indicadores',
                                [idDescripcion, indData.nombre_indicador.trim()]
                            );
                            updatedOrInsertedIds.push(indRes.rows[0].id_indicadores);
                        }
                    }

                    // Eliminar indicadores que ya no estén presentes
                    const idsToDelete = existingInds
                        .map(e => e.id_indicadores)
                        .filter(id => !updatedOrInsertedIds.includes(id));

                    if (idsToDelete.length > 0) {
                        await client.query('DELETE FROM evidencias WHERE id_indicadores = ANY($1)', [idsToDelete]);
                        await client.query('DELETE FROM indicadores WHERE id_indicadores = ANY($1)', [idsToDelete]);
                    }
                }

                // Eliminar descripciones extras si existen
                if (existingDescs.length > descsToInsert.length) {
                    const extraDescs = existingDescs.slice(descsToInsert.length);
                    const extraDescIds = extraDescs.map(d => d.id_descripcion);

                    const extraIndsRes = await client.query(
                        'SELECT id_indicadores FROM indicadores WHERE id_descripcion = ANY($1)',
                        [extraDescIds]
                    );
                    const extraIndIds = extraIndsRes.rows.map(e => e.id_indicadores);

                    if (extraIndIds.length > 0) {
                        await client.query('DELETE FROM evidencias WHERE id_indicadores = ANY($1)', [extraIndIds]);
                        await client.query('DELETE FROM indicadores WHERE id_indicadores = ANY($1)', [extraIndIds]);
                    }
                    await client.query('DELETE FROM descripcion WHERE id_descripcion = ANY($1)', [extraDescIds]);
                }
            }
        }

        // Marcar la función como "Aceptado"
        await client.query(
            "UPDATE asignacion_funciones SET estado_agenda = 'Aceptado' WHERE id_funciones = $1",
            [id_funciones]
        );

        // Docente dueño de la función — se usa para la notificación al director
        const duenioRes = await client.query(
            'SELECT id_usuario FROM usuario_asignacion WHERE id_funciones = $1 LIMIT 1',
            [id_funciones]
        );

        await client.query('COMMIT');

        // Notificación al director: el servicio solo envía el correo cuando
        // TODAS las funciones del docente quedaron diligenciadas, así que
        // llamarlo en cada guardado no genera correos repetidos.
        if (duenioRes.rows.length > 0) {
            notificaciones.background.agendaEnviada(duenioRes.rows[0].id_usuario);
        }

        res.json({ mensaje: 'Función guardada y aceptada correctamente.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en guardarFuncionDocente:', error.message);
        res.status(500).json({ error: 'Error al guardar la función del docente.', detalles: error.message });
    } finally {
        client.release();
    }
};

const guardarAvanceDocente = async (req, res) => {
    const { indicadores } = req.body;

    if (!indicadores || !Array.isArray(indicadores)) {
        return res.status(400).json({ error: 'Se requiere un arreglo de indicadores con su ejecución.' });
    }

    // "semana" dice qué corte se está guardando (8 o 16). Ese corte debe estar abierto y SOLO se escribe su
    // columna: la otra se conserva como está en la base. Sin "semana" (clientes viejos) basta con que alguno esté abierto.
    const corteGuardado = ['8', '16'].includes(String(req.body.semana)) ? String(req.body.semana) : null;
    if (!esPlaneacionOAdmin(req)) {
        if (corteGuardado) {
            const corte = await verificarSemana(corteGuardado);
            if (!corte.abierta) return res.status(403).json({ error: corte.mensaje || `La Semana ${corteGuardado} no está abierta.` });
        } else {
            const [c8, c16] = [await verificarSemana('8'), await verificarSemana('16')];
            if (!c8.abierta && !c16.abierta) return res.status(403).json({ error: c8.mensaje || c16.mensaje || 'Ningún corte está abierto.' });
        }
    }

    // Solo se guarda lo propio: cada indicador debe pertenecer a una función asignada al usuario
    if (!esPlaneacionOAdmin(req)) {
        const ids = [...new Set(indicadores.map((i) => Number(i && i.id_indicador)))];
        if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
            return res.status(400).json({ error: 'Cada indicador debe traer un id_indicador válido.' });
        }
        if (ids.length > 0) {
            const propios = await pool.query(`
                SELECT DISTINCT i.id_indicadores
                FROM indicadores i
                JOIN descripcion d ON d.id_descripcion = i.id_descripcion
                JOIN asignacion_actividades aa ON aa.id_asignacionact = d.id_asignacionact
                JOIN usuario_asignacion ua ON ua.id_funciones = aa.id_funciones
                WHERE ua.id_usuario = $1 AND i.id_indicadores = ANY($2::int[])
            `, [idUsuarioDe(req), ids]);
            if (propios.rows.length !== ids.length) {
                return res.status(403).json({ error: 'Algún indicador no pertenece a tu agenda.' });
            }
        }
    }

    // Avance obligatorio: para guardar un corte, TODOS los indicadores del docente deben quedar en más de 0
    // (basta 0,1). Única excepción: "Evidencia de entrega de notas finales" puede ir en 0 en la semana 8.
    // Se evalúa con lo que quedaría guardado: lo enviado para este corte y, de lo demás, lo que ya hay en la base.
    if (!esPlaneacionOAdmin(req) && corteGuardado) {
        const propios = await pool.query(`
            SELECT i.id_indicadores AS id_indicador, i.nombre_indicador, d.meta, i.ejecucion_8, i.ejecucion_16,
                   af.funcion_sustantiva, aa.rol_seleccionado AS actividad
            FROM indicadores i
            JOIN descripcion d ON d.id_descripcion = i.id_descripcion
            JOIN asignacion_actividades aa ON aa.id_asignacionact = d.id_asignacionact
            JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones
            JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
            JOIN periodo p ON p.id_periodo = af.id_periodo AND p.activo = TRUE
            WHERE ua.id_usuario = $1 AND af.estado_agenda <> 'Por Aprobar'
              AND i.activo IS NOT FALSE AND d.activo IS NOT FALSE
        `, [idUsuarioDe(req)]);
        const columna = `ejecucion_${corteGuardado}`;
        const enviados = new Map(indicadores.map((i) => [Number(i.id_indicador), i]));
        const resultantes = propios.rows.map((r) => {
            const e = enviados.get(Number(r.id_indicador));
            return e ? { ...r, [columna]: e[columna] } : r;
        });
        const faltan = indicadoresSinAvance(resultantes, corteGuardado);
        if (faltan.length > 0) {
            return res.status(400).json({
                error: `Para guardar el avance de la Semana ${corteGuardado} debes registrar un valor mayor que 0 en todos tus indicadores (por ejemplo 0,1). Faltan ${faltan.length}.`,
                faltantes: faltan.map((i) => ({ id_indicador: i.id_indicador, indicador: i.nombre_indicador, funcion: i.funcion_sustantiva, actividad: i.actividad })),
            });
        }
    }

    const client = await pool.connect();
    const advertencias = [];

    try {
        await client.query('BEGIN');

        for (const ind of indicadores) {
            // Parsear valores — usar ?? para que 0 se guarde como 0 (no como null)
            let ejec8 = (ind.ejecucion_8 !== null && ind.ejecucion_8 !== undefined && ind.ejecucion_8 !== '')
                ? parseFloat(String(ind.ejecucion_8)) : 0;
            let ejec16 = (ind.ejecucion_16 !== null && ind.ejecucion_16 !== undefined && ind.ejecucion_16 !== '')
                ? parseFloat(String(ind.ejecucion_16)) : 0;

            // Asegurar que no sean negativos
            if (isNaN(ejec8) || ejec8 < 0) ejec8 = 0;
            if (isNaN(ejec16) || ejec16 < 0) ejec16 = 0;

            // Obtener la meta desde la BD (y lo ya guardado, por si este guardado es de un solo corte)
            const resultMeta = await client.query(`
                SELECT d.meta, i.ejecucion_8 AS guardado_8, i.ejecucion_16 AS guardado_16
                FROM indicadores i
                JOIN descripcion d ON d.id_descripcion = i.id_descripcion
                WHERE i.id_indicadores = $1
            `, [ind.id_indicador]);

            // Un guardado de la Semana 8 no toca la columna de la 16, y al revés
            if (resultMeta.rows.length > 0 && corteGuardado) {
                const num = (v) => { const n = parseFloat(v); return Number.isNaN(n) || n < 0 ? 0 : n; };
                if (corteGuardado === '8') ejec16 = num(resultMeta.rows[0].guardado_16);
                else ejec8 = num(resultMeta.rows[0].guardado_8);
            }

            if (resultMeta.rows.length > 0) {
                const meta = parseFloat(resultMeta.rows[0].meta) || 0;

                if (meta > 0) {
                    // Semana 8 no puede superar la meta
                    if (ejec8 > meta) {
                        advertencias.push(`Indicador ${ind.id_indicador}: Ejecución S8 (${ejec8}) ajustada a la meta (${meta}).`);
                        ejec8 = meta;
                    }

                    // Semana 8 + Semana 16 no pueden superar la meta
                    if ((ejec8 + ejec16) > meta) {
                        const maxEjec16 = Math.max(0, meta - ejec8);
                        advertencias.push(`Indicador ${ind.id_indicador}: Ejecución S16 (${ejec16}) ajustada al máximo permitido (${maxEjec16}).`);
                        ejec16 = maxEjec16;
                    }
                }
            }

            // Solo se manda a revisión lo que de verdad cambió: guardar sin tocar una función no debe deshacer el
            // visto bueno que otro revisor ya le dio ni reabrir lo que ya estaba revisado.
            const aNumero = (v) => { const n = parseFloat(v); return Number.isNaN(n) || n < 0 ? 0 : n; };
            const previo8 = resultMeta.rows.length > 0 ? aNumero(resultMeta.rows[0].guardado_8) : 0;
            const previo16 = resultMeta.rows.length > 0 ? aNumero(resultMeta.rows[0].guardado_16) : 0;
            const cambio8 = Math.abs(ejec8 - previo8) > 1e-9;
            const cambio16 = Math.abs(ejec16 - previo16) > 1e-9;

            // El docente solo registra su ejecución. Las observaciones son del
            // Director y viven en observaciones_director; antes esta consulta
            // escribía indicadores.observaciones con cadena vacía en cada guardado.
            await client.query(`
                UPDATE indicadores
                SET ejecucion_8 = $1,
                    ejecucion_16 = $2
                WHERE id_indicadores = $3
            `, [
                ejec8,
                ejec16,
                ind.id_indicador
            ]);

            // Guardar el avance manda el corte de esa función a revisión.
            // Si el Director ya lo cerró no se reabre solo, y si lo DEVOLVIÓ sigue devuelto hasta que el docente
            // envíe la corrección (PUT /agenda/cortes/:id/:semana/corregido): guardar otra cosa no la borra.
            const funcRes = await client.query(`
                SELECT af.id_funciones
                FROM indicadores i
                JOIN descripcion d ON d.id_descripcion = i.id_descripcion
                JOIN asignacion_actividades aa ON aa.id_asignacionact = d.id_asignacionact
                JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones
                WHERE i.id_indicadores = $1
                LIMIT 1
            `, [ind.id_indicador]);

            if (funcRes.rows.length > 0) {
                const idFunciones = funcRes.rows[0].id_funciones;
                for (const [semanaCorte, valor, cambio] of [[8, ejec8, cambio8], [16, ejec16, cambio16]]) {
                    if (valor <= 0) continue;
                    if (!cambio) {
                        // Sin cambios en este corte: solo se crea la fila si no existía; si ya está revisada, se deja como está
                        await client.query(`
                            INSERT INTO revision_corte (id_funciones, semana, estado, actualizado_en)
                            VALUES ($1, $2, 'Pendiente', NOW())
                            ON CONFLICT (id_funciones, semana) DO NOTHING
                        `, [idFunciones, semanaCorte]);
                        continue;
                    }
                    await client.query(`
                        INSERT INTO revision_corte (id_funciones, semana, estado, actualizado_en)
                        VALUES ($1, $2, 'Pendiente', NOW())
                        ON CONFLICT (id_funciones, semana) DO UPDATE
                        SET estado = CASE WHEN revision_corte.estado IN ('Aprobado', 'Devuelto')
                                          THEN revision_corte.estado ELSE 'Pendiente' END,
                            actualizado_en = NOW()
                    `, [idFunciones, semanaCorte]);
                }
            }
        }

        await client.query('COMMIT');

        // Aviso a la dirección (campana y correo) de que hay un avance para revisar: una vez por docente y corte,
        // y solo si el corte guardado trae algo registrado.
        // Si todavía tiene funciones devueltas en este corte, el aviso a la dirección sale al enviar la corrección
        let hayDevuelta = false;
        if (corteGuardado) {
            try {
                hayDevuelta = (await pool.query(
                    `SELECT 1 FROM revision_corte rc JOIN usuario_asignacion ua ON ua.id_funciones = rc.id_funciones
                     WHERE ua.id_usuario = $1 AND rc.semana = $2 AND rc.estado = 'Devuelto' LIMIT 1`,
                    [idUsuarioDe(req), Number(corteGuardado)]
                )).rows.length > 0;
            } catch { /* sin la tabla: se avisa como siempre */ }
        }
        if (corteGuardado && !hayDevuelta && indicadores.some((i) => parseFloat(i && i[`ejecucion_${corteGuardado}`]) > 0)) {
            await notificaciones.background.avanceGuardadoAhora({ idDocente: idUsuarioDe(req), semana: Number(corteGuardado) });
        }

        const respuesta = { mensaje: 'Avance guardado correctamente.' };
        if (advertencias.length > 0) {
            respuesta.advertencias = advertencias;
            respuesta.mensaje = 'Avance guardado. Algunos valores fueron ajustados para no superar la meta.';
        }
        res.json(respuesta);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en guardarAvanceDocente:', error.message);
        res.status(500).json({ error: 'Error al guardar el avance.', detalles: error.message });
    } finally {
        client.release();
    }
};

// PUT /api/agenda/cortes/:id_funciones/:semana/corregido
// El docente avisa que ya corrigió una función que el director devolvió: vuelve a 'Pendiente' (revisión) y se
// conserva el motivo para que la dirección compare. Solo el dueño de la función y solo mientras el corte esté abierto.
const corregirCorte = async (req, res) => {
    const idFunciones = parseInt(req.params.id_funciones, 10);
    const semana = parseInt(req.params.semana, 10);
    if (isNaN(idFunciones) || ![8, 16].includes(semana)) {
        return res.status(400).json({ error: 'Función o semana inválida.' });
    }

    try {
        const dueno = await pool.query('SELECT 1 FROM usuario_asignacion WHERE id_funciones = $1 AND id_usuario = $2', [idFunciones, idUsuarioDe(req)]);
        if (dueno.rows.length === 0) {
            return res.status(403).json({ error: 'Esta función no es de tu agenda.' });
        }
        if (!esPlaneacionOAdmin(req)) {
            const corte = await verificarSemana(String(semana));
            if (!corte.abierta) return res.status(403).json({ error: corte.mensaje || `La Semana ${semana} no está abierta.` });
        }

        await asegurarCorregidoEn();
        const r = await pool.query(
            `UPDATE revision_corte
                SET estado = 'Pendiente', corregido_en = NOW(), actualizado_en = NOW()
              WHERE id_funciones = $1 AND semana = $2 AND estado = 'Devuelto'`,
            [idFunciones, semana]
        );
        if (r.rowCount === 0) {
            return res.status(409).json({ error: 'Esta función no está devuelta en este corte.' });
        }

        await notificaciones.background.corteCorregidoAhora({ idFunciones, semana, idDocente: idUsuarioDe(req) });
        res.json({ mensaje: 'Corrección enviada: la función volvió a revisión de tu director.', estado: 'Pendiente' });
    } catch (error) {
        console.error('Error en corregirCorte:', error.message);
        res.status(500).json({ error: 'Error al enviar la corrección.' });
    }
};

module.exports = { getAgenda, getAgendaBase, guardarFuncionDocente, guardarAvanceDocente, corregirCorte };