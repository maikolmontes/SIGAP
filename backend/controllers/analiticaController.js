// ================================================================
// SIGAP — Controlador de Analítica Descriptiva
// ----------------------------------------------------------------
// Entrega métricas agregadas bajo el contrato MetricaAnaliticaResponse.
//
// Decisiones tomadas tras la auditoría (Fase 0):
//
//  1. NO se usan las vistas v_analitica_*. Se crearon para Power BI
//     DirectQuery, no aceptan parámetros y arrastran un join cartesiano
//     contra actividad_semana. Aquí todo va parametrizado.
//
//  2. actividad_semana está vacía (0 filas) y resultados quedó huérfana.
//     La fuente canónica de ejecución es indicadores.ejecucion_8/16,
//     con semántica INCREMENTAL: el avance final es ejec8 + ejec16.
//
//  3. Se excluye el catálogo maestro (funciones sin docente) uniendo
//     siempre contra usuario_asignacion. Son plantillas de importación,
//     no agendas reales, y aportaban 32 horas fantasma a los totales.
//
//  4. horas_contrato puede ser 0 ('Hora Cátedra', 'Por Definir'), así
//     que toda división se protege con NULLIF.
//
//  5. RBAC: el alcance sale del JWT vía calcularAlcance(). Un Director
//     jamás ve otro programa, sin importar lo que mande el frontend.
// ================================================================

const pool = require('../db/connection');
const { calcularAlcance, alcanceProgramas } = require('../utils/rolActivo');
const catalogo = require('../config/catalogoAnalitica');
const gemini = require('../services/geminiService');

// ----------------------------------------------------------------
// Utilidades internas
// ----------------------------------------------------------------

const etiquetaPeriodo = (p) =>
    p ? `${p.anio}-${Number(p.semestre) === 1 ? 'I' : 'II'}` : null;

const num = (v) => Number(v) || 0;

const pct = (parte, total) => (num(total) > 0 ? Math.round((num(parte) / num(total)) * 1000) / 10 : 0);

/**
 * Resuelve el período a consultar: el solicitado o, en su defecto, el activo.
 */
const resolverPeriodo = async (req) => {
    const solicitado = parseInt(req.query.periodoId, 10);

    if (Number.isInteger(solicitado)) {
        const r = await pool.query(
            'SELECT id_periodo, anio, semestre, fecha_inicio, fecha_fin, activo FROM periodo WHERE id_periodo = $1',
            [solicitado]
        );
        if (r.rows.length > 0) return r.rows[0];
    }

    const activo = await pool.query(
        'SELECT id_periodo, anio, semestre, fecha_inicio, fecha_fin, activo FROM periodo WHERE activo = TRUE LIMIT 1'
    );
    return activo.rows[0] || null;
};

/**
 * Ámbito de la consulta: institución completa, una facultad o un programa.
 *
 * Reglas de seguridad:
 *  · Un Director queda SIEMPRE dentro de los programas que gestiona
 *    (director_programa, uno o varios). facultadId se ignora para él y
 *    programaId solo se acepta si es uno de los suyos; así no puede usarlos
 *    para espiar otro programa. Sin programaId ve todos los suyos juntos.
 *  · Planeación, Admin y Consultor sí pueden filtrar libremente.
 *
 * `permitidos` (solo Director) es la lista de programas que puede elegir el
 * selector; `forzado` significa que no hay nada que elegir (0 o 1 programa).
 */
const resolverAmbito = async (req) => {
    const alcance = await alcanceProgramas(req);

    if (alcance.restringido) {
        const ids = alcance.ids;
        // Un Director sin programas no ve nada: preferible vacío
        // a mostrarle la institución entera por accidente.
        if (ids.length === 0) {
            return { tipo: 'programa', idPrograma: -1, idFacultad: null, forzado: true, permitidos: [] };
        }

        const pedido = parseInt(req.query.programaId, 10);
        if (Number.isInteger(pedido) && ids.includes(pedido)) {
            return { tipo: 'programa', idPrograma: pedido, idFacultad: null, forzado: ids.length === 1, permitidos: ids };
        }
        if (ids.length === 1) {
            return { tipo: 'programa', idPrograma: ids[0], idFacultad: null, forzado: true, permitidos: ids };
        }
        return { tipo: 'programas', idPrograma: null, idFacultad: null, idsProgramas: ids, forzado: false, permitidos: ids };
    }

    const programaId = parseInt(req.query.programaId, 10);
    if (Number.isInteger(programaId)) {
        return { tipo: 'programa', idPrograma: programaId, idFacultad: null, forzado: false };
    }

    const facultadId = parseInt(req.query.facultadId, 10);
    if (Number.isInteger(facultadId)) {
        return { tipo: 'facultad', idPrograma: null, idFacultad: facultadId, forzado: false };
    }

    return { tipo: 'institucion', idPrograma: null, idFacultad: null, forzado: false };
};

/**
 * Traduce el ámbito a un fragmento SQL parametrizado que se concatena
 * después del $1 del período. Todas las consultas comparten esta forma.
 */
const filtroAmbito = (ambito) => {
    if (ambito.tipo === 'programa') {
        return { filtro: ' AND u.id_programa = $2', extra: [ambito.idPrograma] };
    }
    if (ambito.tipo === 'programas') {
        return { filtro: ' AND u.id_programa = ANY($2::int[])', extra: [ambito.idsProgramas] };
    }
    if (ambito.tipo === 'facultad') {
        return {
            filtro: ' AND u.id_programa IN (SELECT id_programa FROM programa_academico WHERE id_facultad = $2)',
            extra: [ambito.idFacultad]
        };
    }
    return { filtro: '', extra: [] };
};

/** Texto que la interfaz muestra como alcance de las cifras. */
const describirAmbito = async (ambito) => {
    if (ambito.tipo === 'programas') {
        const r = await pool.query(
            'SELECT nombre_programa FROM programa_academico WHERE id_programa = ANY($1::int[]) ORDER BY nombre_programa',
            [ambito.idsProgramas]
        );
        return r.rows.map(f => f.nombre_programa).join(' · ') || 'Programa no identificado';
    }
    if (ambito.tipo === 'programa') {
        if (!ambito.idPrograma || ambito.idPrograma < 0) return 'Programa no identificado';
        const r = await pool.query('SELECT nombre_programa FROM programa_academico WHERE id_programa = $1', [ambito.idPrograma]);
        return r.rows[0]?.nombre_programa || 'Programa no identificado';
    }
    if (ambito.tipo === 'facultad') {
        const r = await pool.query('SELECT nombre_facultad FROM facultad WHERE id_facultad = $1', [ambito.idFacultad]);
        return r.rows[0]?.nombre_facultad ? `Facultad de ${r.rows[0].nombre_facultad}` : 'Facultad no identificada';
    }
    return null; // null = toda la institución
};

// ================================================================
// GET /api/analitica/periodos
// Lista de períodos para el selector del panel.
// ================================================================
const getPeriodos = async (req, res) => {
    try {
        const r = await pool.query(`
            SELECT p.id_periodo, p.anio, p.semestre, p.activo,
                   COUNT(DISTINCT ua.id_usuario) AS docentes_con_agenda
            FROM periodo p
            LEFT JOIN asignacion_funciones af ON af.id_periodo = p.id_periodo
            LEFT JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
            GROUP BY p.id_periodo, p.anio, p.semestre, p.activo
            ORDER BY p.anio DESC, p.semestre DESC
        `);

        res.json(r.rows.map((p) => ({
            id_periodo: p.id_periodo,
            etiqueta: etiquetaPeriodo(p),
            activo: p.activo,
            docentesConAgenda: num(p.docentes_con_agenda)
        })));
    } catch (error) {
        console.error('Error en getPeriodos (analitica):', error);
        res.status(500).json({ error: 'Error al obtener los períodos.', detalles: error.message });
    }
};

// ================================================================
// GET /api/analitica/resumen?periodoId=X
// Entrega el paquete completo de indicadores del panel.
// ================================================================
const getResumen = async (req, res) => {
    const inicio = Date.now();
    try {
        const periodo = await resolverPeriodo(req);
        if (!periodo) {
            return res.status(404).json({ error: 'No hay un período académico disponible.' });
        }

        const ambito = await resolverAmbito(req);
        const { filtro, extra } = filtroAmbito(ambito);
        const params = [periodo.id_periodo, ...extra];
        const etiqueta = etiquetaPeriodo(periodo);
        const programa = await describirAmbito(ambito);

        // --- Base común: solo funciones con docente real asignado ---
        const baseCte = `
            WITH base AS (
                SELECT u.id_usuario,
                       af.id_funciones,
                       af.funcion_sustantiva,
                       COALESCE(af.horas_funcion, 0)::numeric AS horas_funcion,
                       af.estado_agenda
                FROM asignacion_funciones af
                JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
                JOIN usuarios u ON u.id_usuario = ua.id_usuario AND u.activo = TRUE
                WHERE af.id_periodo = $1${filtro}
            )
        `;

        // --- IND-01 / IND-02: estado consolidado por docente ---
        // Precedencia: una función devuelta marca toda la agenda.
        const estados = await pool.query(`
            ${baseCte},
            por_docente AS (
                SELECT id_usuario,
                       BOOL_OR(estado_agenda = 'Devuelta')                      AS alguna_devuelta,
                       BOOL_AND(estado_agenda = 'Aprobada')                     AS todas_aprobadas,
                       BOOL_AND(estado_agenda IN ('Aceptado', 'Aprobada'))      AS todas_diligenciadas
                FROM base GROUP BY id_usuario
            )
            SELECT
                COUNT(*)::int                                                                                       AS total,
                COUNT(*) FILTER (WHERE alguna_devuelta)::int                                                        AS devueltas,
                COUNT(*) FILTER (WHERE NOT alguna_devuelta AND todas_aprobadas)::int                                AS aprobadas,
                COUNT(*) FILTER (WHERE NOT alguna_devuelta AND NOT todas_aprobadas AND todas_diligenciadas)::int    AS en_revision,
                COUNT(*) FILTER (WHERE NOT alguna_devuelta AND NOT todas_diligenciadas)::int                        AS pendientes
            FROM por_docente
        `, params);

        const e = estados.rows[0] || { total: 0, devueltas: 0, aprobadas: 0, en_revision: 0, pendientes: 0 };

        const indAgendas = catalogo.construirMetrica('IND-01', {
            periodo: etiqueta,
            programa,
            categorias: ['Aprobada', 'En revisión', 'Pendiente', 'Devuelta'],
            series: [{
                nombre: 'Docentes',
                clave: 'docentes',
                unidad: 'docentes',
                datos: [num(e.aprobadas), num(e.en_revision), num(e.pendientes), num(e.devueltas)]
            }],
            resumenNumerico: {
                total: num(e.total),
                porcentajeGlobal: pct(e.aprobadas, e.total)
            }
        });

        const indDevolucion = catalogo.construirMetrica('IND-02', {
            periodo: etiqueta,
            programa,
            categorias: ['Devueltas', 'Sin devolución'],
            series: [{
                nombre: 'Docentes',
                clave: 'docentes',
                unidad: 'docentes',
                datos: [num(e.devueltas), num(e.total) - num(e.devueltas)]
            }],
            resumenNumerico: {
                total: num(e.devueltas),
                porcentajeGlobal: pct(e.devueltas, e.total)
            }
        });

        // --- IND-03: distribución de horas por función sustantiva ---
        const horas = await pool.query(`
            ${baseCte}
            SELECT funcion_sustantiva,
                   SUM(horas_funcion)::numeric        AS horas,
                   COUNT(DISTINCT id_usuario)::int    AS docentes
            FROM base
            GROUP BY funcion_sustantiva
            ORDER BY horas DESC
        `, params);

        const totalHoras = horas.rows.reduce((acc, r) => acc + num(r.horas), 0);
        const indHoras = catalogo.construirMetrica('IND-03', {
            periodo: etiqueta,
            programa,
            categorias: horas.rows.map((r) => r.funcion_sustantiva || 'Sin clasificar'),
            series: [
                { nombre: 'Horas asignadas', clave: 'horas', unidad: 'h', datos: horas.rows.map((r) => num(r.horas)) },
                { nombre: 'Participación', clave: 'participacion', unidad: '%', datos: horas.rows.map((r) => pct(r.horas, totalHoras)) },
                { nombre: 'Docentes', clave: 'docentes', unidad: 'docentes', datos: horas.rows.map((r) => num(r.docentes)) }
            ],
            resumenNumerico: {
                total: Math.round(totalHoras * 100) / 100,
                promedio: horas.rows.length ? Math.round((totalHoras / horas.rows.length) * 100) / 100 : 0
            }
        });

        // --- IND-05 / IND-06: avance de metas por corte ---
        // La meta vive en descripcion y se evalúa por indicador, igual que
        // lo hace guardarAvanceDocente al topar ejec8 + ejec16 <= meta.
        const cortes = await pool.query(`
            SELECT af.funcion_sustantiva,
                   COALESCE(SUM(d.meta), 0)::numeric            AS meta,
                   COALESCE(SUM(i.ejecucion_8), 0)::numeric     AS ejec8,
                   COALESCE(SUM(i.ejecucion_16), 0)::numeric    AS ejec16
            FROM asignacion_funciones af
            JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
            JOIN usuarios u ON u.id_usuario = ua.id_usuario AND u.activo = TRUE
            JOIN asignacion_actividades aa ON aa.id_funciones = af.id_funciones
            JOIN descripcion d ON d.id_asignacionact = aa.id_asignacionact AND d.activo IS NOT FALSE
            JOIN indicadores i ON i.id_descripcion = d.id_descripcion AND i.activo IS NOT FALSE
            WHERE af.id_periodo = $1${filtro}
            GROUP BY af.funcion_sustantiva
            ORDER BY af.funcion_sustantiva
        `, params);

        const categoriasCorte = cortes.rows.map((r) => r.funcion_sustantiva || 'Sin clasificar');
        const metaTotal = cortes.rows.reduce((a, r) => a + num(r.meta), 0);
        const e8Total = cortes.rows.reduce((a, r) => a + num(r.ejec8), 0);
        const e16Total = cortes.rows.reduce((a, r) => a + num(r.ejec16), 0);

        const indCorte1 = catalogo.construirMetrica('IND-05', {
            periodo: etiqueta,
            programa,
            categorias: categoriasCorte,
            series: [
                { nombre: 'Meta', clave: 'meta', datos: cortes.rows.map((r) => num(r.meta)) },
                { nombre: 'Ejecutado Semana 8', clave: 'ejecucion8', datos: cortes.rows.map((r) => num(r.ejec8)) },
                { nombre: 'Avance', clave: 'avance8', unidad: '%', datos: cortes.rows.map((r) => pct(r.ejec8, r.meta)) }
            ],
            resumenNumerico: { total: e8Total, porcentajeGlobal: pct(e8Total, metaTotal) }
        });

        const indCorte2 = catalogo.construirMetrica('IND-06', {
            periodo: etiqueta,
            programa,
            categorias: categoriasCorte,
            series: [
                { nombre: 'Meta', clave: 'meta', datos: cortes.rows.map((r) => num(r.meta)) },
                { nombre: 'Semana 8', clave: 'avance8', unidad: '%', datos: cortes.rows.map((r) => pct(r.ejec8, r.meta)) },
                {
                    nombre: 'Acumulado Semana 16',
                    clave: 'avance16',
                    unidad: '%',
                    datos: cortes.rows.map((r) => pct(num(r.ejec8) + num(r.ejec16), r.meta))
                }
            ],
            resumenNumerico: {
                total: e8Total + e16Total,
                porcentajeGlobal: pct(e8Total + e16Total, metaTotal)
            }
        });

        // --- IND-07: evidencias cargadas ---
        const evidencias = await pool.query(`
            SELECT af.funcion_sustantiva,
                   COUNT(DISTINCT ev.id_evidencias)::int AS evidencias,
                   COUNT(DISTINCT i.id_indicadores)::int AS indicadores_con_soporte
            FROM asignacion_funciones af
            JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
            JOIN usuarios u ON u.id_usuario = ua.id_usuario AND u.activo = TRUE
            JOIN asignacion_actividades aa ON aa.id_funciones = af.id_funciones
            JOIN descripcion d ON d.id_asignacionact = aa.id_asignacionact AND d.activo IS NOT FALSE
            JOIN indicadores i ON i.id_descripcion = d.id_descripcion AND i.activo IS NOT FALSE
            JOIN evidencias ev ON ev.id_indicadores = i.id_indicadores
            WHERE af.id_periodo = $1${filtro}
            GROUP BY af.funcion_sustantiva
            ORDER BY evidencias DESC
        `, params);

        const totalEvidencias = evidencias.rows.reduce((a, r) => a + num(r.evidencias), 0);
        const indEvidencias = catalogo.construirMetrica('IND-07', {
            periodo: etiqueta,
            programa,
            categorias: evidencias.rows.map((r) => r.funcion_sustantiva || 'Sin clasificar'),
            series: [
                { nombre: 'Evidencias', clave: 'evidencias', unidad: 'evidencias', datos: evidencias.rows.map((r) => num(r.evidencias)) },
                { nombre: 'Indicadores con soporte', clave: 'indicadores', datos: evidencias.rows.map((r) => num(r.indicadores_con_soporte)) }
            ],
            resumenNumerico: { total: totalEvidencias }
        });

        // --- Filtrado por rol: cada indicador declara quién puede verlo ---
        const { roles } = calcularAlcance(req);
        const indicadores = [indAgendas, indDevolucion, indHoras, indCorte1, indCorte2, indEvidencias]
            .filter((m) => catalogo.puedeVer(m.indicadorId, roles));

        const ms = Date.now() - inicio;
        if (ms > 1000) console.warn(`[analitica] getResumen tardó ${ms} ms (período ${periodo.id_periodo})`);

        res.json({
            periodo: { id_periodo: periodo.id_periodo, etiqueta, activo: periodo.activo },
            programa,
            ambito: {
                tipo: ambito.tipo,
                idPrograma: ambito.idPrograma,
                idsProgramas: ambito.idsProgramas || null,
                idFacultad: ambito.idFacultad,
                // true cuando el rol impone el alcance y la interfaz debe
                // ocultar el selector en lugar de ofrecer opciones inútiles
                bloqueado: ambito.forzado
            },
            generadoEn: new Date().toISOString(),
            indicadores
        });
    } catch (error) {
        console.error('Error en getResumen (analitica):', error);
        res.status(500).json({ error: 'Error al calcular el resumen analítico.', detalles: error.message });
    }
};

// ================================================================
// GET /api/analitica/docentes-detalle?periodoId=X
// IND-04 — Balance contractual docente por docente.
// ================================================================
const getDetalleDocentes = async (req, res) => {
    try {
        const periodo = await resolverPeriodo(req);
        if (!periodo) return res.status(404).json({ error: 'No hay un período académico disponible.' });

        const ambito = await resolverAmbito(req);
        const { filtro, extra } = filtroAmbito(ambito);
        const params = [periodo.id_periodo, ...extra];

        const r = await pool.query(`
            SELECT u.id_usuario,
                   TRIM(u.nombres || ' ' || u.apellidos)        AS docente,
                   u.correo,
                   COALESCE(pa.nombre_programa, 'Sin programa') AS programa,
                   COALESCE(tc.tipo, 'Sin definir')             AS tipo_contrato,
                   COALESCE(tc.horas_contrato, 0)::numeric      AS horas_contrato,
                   SUM(COALESCE(af.horas_funcion, 0))::numeric  AS horas_asignadas,
                   -- NULLIF evita la división por cero de 'Hora Cátedra' y 'Por Definir'
                   ROUND(
                       SUM(COALESCE(af.horas_funcion, 0)) * 100.0
                       / NULLIF(tc.horas_contrato, 0), 1
                   )                                            AS porcentaje_ocupacion,
                   COUNT(DISTINCT af.id_funciones)::int         AS funciones,
                   BOOL_OR(af.estado_agenda = 'Devuelta')       AS alguna_devuelta,
                   BOOL_AND(af.estado_agenda = 'Aprobada')      AS todas_aprobadas,
                   BOOL_AND(af.estado_agenda IN ('Aceptado', 'Aprobada')) AS todas_diligenciadas
            FROM asignacion_funciones af
            JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
            JOIN usuarios u ON u.id_usuario = ua.id_usuario AND u.activo = TRUE
            LEFT JOIN tipo_contrato tc ON tc.id_contrato = u.id_contrato
            LEFT JOIN programa_academico pa ON pa.id_programa = u.id_programa
            WHERE af.id_periodo = $1${filtro}
            GROUP BY u.id_usuario, u.nombres, u.apellidos, u.correo,
                     pa.nombre_programa, tc.tipo, tc.horas_contrato
            ORDER BY docente
        `, params);

        const filas = r.rows.map((d) => {
            const contratadas = num(d.horas_contrato);
            const asignadas = num(d.horas_asignadas);

            let balance;
            if (contratadas <= 0) balance = 'Sin parámetro contractual';
            else if (asignadas === contratadas) balance = 'Balanceada';
            else if (asignadas < contratadas) balance = 'Subcarga';
            else balance = 'Sobrecarga';

            const estado = d.alguna_devuelta ? 'Devuelta'
                : d.todas_aprobadas ? 'Aprobada'
                : d.todas_diligenciadas ? 'En revisión'
                : 'Pendiente';

            return {
                id_usuario: d.id_usuario,
                docente: d.docente,
                correo: d.correo,
                programa: d.programa,
                tipoContrato: d.tipo_contrato,
                horasContrato: contratadas,
                horasAsignadas: asignadas,
                diferencia: Math.round((asignadas - contratadas) * 100) / 100,
                porcentajeOcupacion: d.porcentaje_ocupacion === null ? null : num(d.porcentaje_ocupacion),
                funciones: num(d.funciones),
                balance,
                estadoAgenda: estado
            };
        });

        const metrica = catalogo.construirMetrica('IND-04', {
            periodo: etiquetaPeriodo(periodo),
            programa: await describirAmbito(ambito),
            categorias: filas.map((f) => f.docente),
            series: [
                { nombre: 'Horas asignadas', clave: 'horasAsignadas', unidad: 'h', datos: filas.map((f) => f.horasAsignadas) },
                { nombre: 'Horas contratadas', clave: 'horasContrato', unidad: 'h', datos: filas.map((f) => f.horasContrato) }
            ],
            resumenNumerico: {
                total: filas.length,
                promedio: filas.length
                    ? Math.round((filas.reduce((a, f) => a + f.horasAsignadas, 0) / filas.length) * 100) / 100
                    : 0
            },
            filasTabla: filas
        });

        res.json(metrica);
    } catch (error) {
        console.error('Error en getDetalleDocentes (analitica):', error);
        res.status(500).json({ error: 'Error al calcular el balance contractual.', detalles: error.message });
    }
};

// ================================================================
// GET /api/analitica/evidencias-brecha?periodoId=X
// IND-08 — Indicadores con ejecución reportada y cero evidencias.
// ================================================================
const getBrechaEvidencias = async (req, res) => {
    try {
        const periodo = await resolverPeriodo(req);
        if (!periodo) return res.status(404).json({ error: 'No hay un período académico disponible.' });

        const ambito = await resolverAmbito(req);
        const { filtro, extra } = filtroAmbito(ambito);
        const params = [periodo.id_periodo, ...extra];

        // Tronco común a las dos consultas: indicadores de agendas reales
        const desde = `
            FROM asignacion_funciones af
            JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
            JOIN usuarios u ON u.id_usuario = ua.id_usuario AND u.activo = TRUE
            JOIN asignacion_actividades aa ON aa.id_funciones = af.id_funciones
            JOIN descripcion d ON d.id_asignacionact = aa.id_asignacionact AND d.activo IS NOT FALSE
            JOIN indicadores i ON i.id_descripcion = d.id_descripcion AND i.activo IS NOT FALSE
            LEFT JOIN programa_academico pa ON pa.id_programa = u.id_programa
            WHERE af.id_periodo = $1${filtro}
        `;

        // Universo: cuántos indicadores tienen ejecución y cuántos van sin soporte
        const totales = await pool.query(`
            SELECT
                COUNT(*) FILTER (WHERE COALESCE(i.ejecucion_8,0) + COALESCE(i.ejecucion_16,0) > 0)::int AS con_ejecucion,
                COUNT(*) FILTER (
                    WHERE COALESCE(i.ejecucion_8,0) + COALESCE(i.ejecucion_16,0) > 0
                      AND NOT EXISTS (SELECT 1 FROM evidencias e WHERE e.id_indicadores = i.id_indicadores)
                )::int AS sin_evidencia
            ${desde}`, params);

        const t = totales.rows[0] || { con_ejecucion: 0, sin_evidencia: 0 };

        const detalle = await pool.query(`
            SELECT u.id_usuario,
                   TRIM(u.nombres || ' ' || u.apellidos)        AS docente,
                   COALESCE(pa.nombre_programa, 'Sin programa') AS programa,
                   af.funcion_sustantiva                        AS funcion,
                   COALESCE(aa.rol_seleccionado, 'Actividad')   AS actividad,
                   COALESCE(i.nombre_indicador, 'Indicador')    AS indicador,
                   COALESCE(d.meta, 0)::numeric                 AS meta,
                   (COALESCE(i.ejecucion_8,0) + COALESCE(i.ejecucion_16,0))::numeric AS ejecutado
            ${desde}
              AND COALESCE(i.ejecucion_8,0) + COALESCE(i.ejecucion_16,0) > 0
              AND NOT EXISTS (SELECT 1 FROM evidencias e WHERE e.id_indicadores = i.id_indicadores)
            ORDER BY ejecutado DESC, docente`, params);

        const filas = detalle.rows.map((f) => ({
            id_usuario: f.id_usuario,
            docente: f.docente,
            programa: f.programa,
            funcion: f.funcion,
            actividad: f.actividad,
            indicador: f.indicador,
            meta: num(f.meta),
            ejecutado: num(f.ejecutado),
            avance: pct(f.ejecutado, f.meta)
        }));

        res.json(catalogo.construirMetrica('IND-08', {
            periodo: etiquetaPeriodo(periodo),
            programa: await describirAmbito(ambito),
            categorias: [],
            series: [{
                nombre: 'Indicadores',
                clave: 'indicadores',
                datos: [num(t.sin_evidencia), num(t.con_ejecucion) - num(t.sin_evidencia)]
            }],
            resumenNumerico: {
                total: num(t.sin_evidencia),
                promedio: num(t.con_ejecucion),
                porcentajeGlobal: pct(t.sin_evidencia, t.con_ejecucion)
            },
            filasTabla: filas
        }));
    } catch (error) {
        console.error('Error en getBrechaEvidencias (analitica):', error);
        res.status(500).json({ error: 'Error al calcular la brecha de evidencias.', detalles: error.message });
    }
};

// ================================================================
// GET /api/analitica/consolidado-programas?periodoId=X
// IND-09 — Una fila por programa, para compararlos lado a lado.
// ================================================================
const getConsolidadoProgramas = async (req, res) => {
    try {
        const periodo = await resolverPeriodo(req);
        if (!periodo) return res.status(404).json({ error: 'No hay un período académico disponible.' });

        const ambito = await resolverAmbito(req);
        const { filtro, extra } = filtroAmbito(ambito);
        const params = [periodo.id_periodo, ...extra];

        const r = await pool.query(`
            WITH agendas AS (
                SELECT u.id_programa, u.id_usuario,
                       BOOL_OR(af.estado_agenda = 'Devuelta')                   AS devuelta,
                       BOOL_AND(af.estado_agenda = 'Aprobada')                  AS aprobada,
                       BOOL_AND(af.estado_agenda IN ('Aceptado', 'Aprobada'))   AS diligenciada,
                       SUM(COALESCE(af.horas_funcion, 0))                       AS horas
                FROM asignacion_funciones af
                JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
                JOIN usuarios u ON u.id_usuario = ua.id_usuario AND u.activo = TRUE
                WHERE af.id_periodo = $1${filtro}
                GROUP BY u.id_programa, u.id_usuario
            ),
            avance AS (
                SELECT u.id_programa,
                       SUM(COALESCE(d.meta, 0))                                             AS meta,
                       SUM(COALESCE(i.ejecucion_8, 0))                                      AS ejec8,
                       SUM(COALESCE(i.ejecucion_8, 0) + COALESCE(i.ejecucion_16, 0))        AS acumulado
                FROM asignacion_funciones af
                JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
                JOIN usuarios u ON u.id_usuario = ua.id_usuario AND u.activo = TRUE
                JOIN asignacion_actividades aa ON aa.id_funciones = af.id_funciones
                JOIN descripcion d ON d.id_asignacionact = aa.id_asignacionact AND d.activo IS NOT FALSE
                JOIN indicadores i ON i.id_descripcion = d.id_descripcion AND i.activo IS NOT FALSE
                WHERE af.id_periodo = $1${filtro}
                GROUP BY u.id_programa
            )
            SELECT pa.id_programa,
                   pa.nombre_programa,
                   COALESCE(f.nombre_facultad, 'Sin facultad')                      AS facultad,
                   COUNT(*)::int                                                    AS docentes,
                   COUNT(*) FILTER (WHERE a.aprobada AND NOT a.devuelta)::int       AS aprobadas,
                   COUNT(*) FILTER (WHERE a.devuelta)::int                          AS devueltas,
                   COUNT(*) FILTER (WHERE NOT a.devuelta AND NOT a.aprobada
                                      AND a.diligenciada)::int                      AS en_revision,
                   COUNT(*) FILTER (WHERE NOT a.devuelta AND NOT a.diligenciada)::int AS pendientes,
                   SUM(a.horas)::numeric                                            AS horas,
                   COALESCE(av.meta, 0)::numeric                                    AS meta,
                   COALESCE(av.acumulado, 0)::numeric                               AS acumulado
            FROM agendas a
            JOIN programa_academico pa ON pa.id_programa = a.id_programa
            LEFT JOIN facultad f ON f.id_facultad = pa.id_facultad
            LEFT JOIN avance av ON av.id_programa = a.id_programa
            GROUP BY pa.id_programa, pa.nombre_programa, f.nombre_facultad, av.meta, av.acumulado
            ORDER BY docentes DESC, pa.nombre_programa`, params);

        const filas = r.rows.map((p) => ({
            id_programa: p.id_programa,
            programa: p.nombre_programa,
            facultad: p.facultad,
            docentes: num(p.docentes),
            aprobadas: num(p.aprobadas),
            enRevision: num(p.en_revision),
            pendientes: num(p.pendientes),
            devueltas: num(p.devueltas),
            horas: num(p.horas),
            cumplimiento: pct(p.aprobadas, p.docentes),
            avance: pct(p.acumulado, p.meta)
        }));

        res.json(catalogo.construirMetrica('IND-09', {
            periodo: etiquetaPeriodo(periodo),
            programa: await describirAmbito(ambito),
            categorias: filas.map((f) => f.programa),
            series: [
                { nombre: 'Docentes', clave: 'docentes', unidad: 'docentes', datos: filas.map((f) => f.docentes) },
                { nombre: 'Horas', clave: 'horas', unidad: 'h', datos: filas.map((f) => f.horas) },
                { nombre: 'Agendas aprobadas', clave: 'cumplimiento', unidad: '%', datos: filas.map((f) => f.cumplimiento) },
                { nombre: 'Avance de metas', clave: 'avance', unidad: '%', datos: filas.map((f) => f.avance) }
            ],
            resumenNumerico: {
                total: filas.reduce((a, f) => a + f.docentes, 0),
                promedio: filas.length
                    ? Math.round((filas.reduce((a, f) => a + f.cumplimiento, 0) / filas.length) * 10) / 10
                    : 0
            },
            filasTabla: filas
        }));
    } catch (error) {
        console.error('Error en getConsolidadoProgramas (analitica):', error);
        res.status(500).json({ error: 'Error al calcular el consolidado por programa.', detalles: error.message });
    }
};

// ================================================================
// GET /api/analitica/ambito
// Facultades y programas por los que el usuario puede filtrar.
// Un Director recibe solo sus programas; `bloqueado: true` si tiene uno solo.
// ================================================================
const getAmbito = async (req, res) => {
    try {
        const ambitoActual = await resolverAmbito(req);

        if (ambitoActual.forzado) {
            const r = await pool.query(`
                SELECT pa.id_programa, pa.nombre_programa, f.id_facultad, f.nombre_facultad
                FROM programa_academico pa
                LEFT JOIN facultad f ON f.id_facultad = pa.id_facultad
                WHERE pa.id_programa = $1
            `, [ambitoActual.idPrograma]);

            const p = r.rows[0];
            return res.json({
                bloqueado: true,
                facultades: p ? [{
                    id_facultad: p.id_facultad,
                    nombre_facultad: p.nombre_facultad,
                    programas: [{ id_programa: p.id_programa, nombre_programa: p.nombre_programa, docentesConAgenda: null }]
                }] : []
            });
        }

        // Se cuentan los docentes con agenda en el período consultado para
        // que el selector muestre dónde hay datos y dónde no.
        const periodo = await resolverPeriodo(req);
        const r = await pool.query(`
            SELECT f.id_facultad, f.nombre_facultad,
                   pa.id_programa, pa.nombre_programa,
                   -- El FILTER es imprescindible: sin él se contarían también
                   -- los docentes con agenda en OTROS períodos, porque el
                   -- filtro de período vive en un LEFT JOIN.
                   COUNT(DISTINCT ua.id_usuario) FILTER (WHERE af.id_funciones IS NOT NULL)::int AS docentes_con_agenda
            FROM programa_academico pa
            LEFT JOIN facultad f ON f.id_facultad = pa.id_facultad
            LEFT JOIN usuarios u ON u.id_programa = pa.id_programa AND u.activo = TRUE
            LEFT JOIN usuario_asignacion ua ON ua.id_usuario = u.id_usuario
            LEFT JOIN asignacion_funciones af ON af.id_funciones = ua.id_funciones AND af.id_periodo = $1
            -- Director: solo sus programas · resto ($2 nulo): todos
            WHERE ($2::int[] IS NULL OR pa.id_programa = ANY($2::int[]))
            GROUP BY f.id_facultad, f.nombre_facultad, pa.id_programa, pa.nombre_programa
            ORDER BY f.nombre_facultad NULLS LAST, pa.nombre_programa
        `, [periodo?.id_periodo || -1, ambitoActual.permitidos || null]);

        const porFacultad = new Map();
        for (const fila of r.rows) {
            const clave = fila.id_facultad ?? 0;
            if (!porFacultad.has(clave)) {
                porFacultad.set(clave, {
                    id_facultad: fila.id_facultad,
                    nombre_facultad: fila.nombre_facultad || 'Sin facultad',
                    programas: []
                });
            }
            porFacultad.get(clave).programas.push({
                id_programa: fila.id_programa,
                nombre_programa: fila.nombre_programa,
                docentesConAgenda: num(fila.docentes_con_agenda)
            });
        }

        res.json({ bloqueado: ambitoActual.forzado, facultades: [...porFacultad.values()] });
    } catch (error) {
        console.error('Error en getAmbito (analitica):', error);
        res.status(500).json({ error: 'Error al obtener facultades y programas.', detalles: error.message });
    }
};

// ================================================================
// GET /api/analitica/catalogo
// Metadatos de los indicadores visibles para el rol activo.
// ================================================================
const getCatalogo = async (req, res) => {
    const { roles } = calcularAlcance(req);
    res.json(
        catalogo.listarIndicadores()
            .filter((i) => catalogo.puedeVer(i.id, roles))
            .map(({ id, nombre, descripcion, tipoGrafico, unidad, dimensiones, notaTecnica }) =>
                ({ id, nombre, descripcion, tipoGrafico, unidad, dimensiones, notaTecnica: notaTecnica || null }))
    );
};

// ================================================================
// POST /api/analitica/interpretar
// Body: { indicadores: MetricaAnaliticaResponse[] }
// ----------------------------------------------------------------
// Capa opcional: entrega la lectura descriptiva de Gemini sobre las
// cifras que el frontend ya tiene en pantalla. Responde 200 incluso
// cuando el servicio no está disponible, con `disponible: false`,
// para que la interfaz degrade con elegancia en vez de mostrar error.
// ================================================================
const interpretarMetricas = async (req, res) => {
    try {
        const { indicadores, periodo } = req.body || {};

        if (!Array.isArray(indicadores) || indicadores.length === 0) {
            return res.status(400).json({ error: 'Se requiere un arreglo de indicadores.' });
        }

        // Tope defensivo: el payload a un tercero no crece sin control
        const recortados = indicadores.slice(0, 10);

        const resultado = await gemini.interpretarMetricas({
            indicadores: recortados,
            periodo: periodo || recortados[0]?.periodo || null,
            idUsuario: req.user?.id
        });

        res.json(resultado);
    } catch (error) {
        console.error('Error en interpretarMetricas (analitica):', error);
        // Ni siquiera un fallo inesperado debe romper el panel
        res.json({
            periodo: null,
            resumen: '',
            hallazgos: [],
            observaciones: [],
            generadoEn: new Date().toISOString(),
            disponible: false,
            motivo: 'error_interno'
        });
    }
};

// ================================================================
// GET /api/analitica/ia/estado — diagnóstico de la capa de IA
// ================================================================
const getEstadoIA = async (req, res) => {
    res.json({
        habilitado: gemini.estaHabilitado(),
        modelo: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
        limitePorMinuto: gemini.limitePorMinuto()
    });
};

module.exports = {
    getPeriodos, getAmbito, getResumen, getDetalleDocentes, getCatalogo,
    getBrechaEvidencias, getConsolidadoProgramas,
    interpretarMetricas, getEstadoIA
};
