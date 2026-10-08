const pool = require('../db/connection');
const { alcanceProgramas, docenteEnAlcance } = require('../utils/rolActivo');
const notificaciones = require('../services/notificacionesService');
const { respaldarAgendas } = require('../services/respaldoAgendasService');
const auditoria = require('../services/auditoriaService');
const { condicionCatalogo, asegurarEsquemaCatalogo } = require('../utils/catalogo');
const { perfilAgenda, revisarIndirecta } = require('../utils/perfilAgenda');
const {
    leerListado, clasificarFila, clasificarVinculacion, revisarCarga, normalizar, TIPO_CONTRATO_POR_SIGLA,
} = require('../utils/listadoAgenda');

const parseSemestre = (semestreStr) => {
    if (!semestreStr) return { numero: '1', grupo: 'A' };
    const str = String(semestreStr).trim();
    const match = str.match(/^(\d+)(.*)$/);
    if (match) {
        // "11-M" trae el guion como separador, no como parte del grupo: "-M" → "M".
        // Los grupos con letra ("1B-M", "9E-N") quedan igual ("B-M", "E-N").
        let grupo = (match[2] || '').trim();
        while (grupo.startsWith('-')) grupo = grupo.slice(1).trim();
        return { numero: match[1], grupo: grupo || 'A' };
    }
    return { numero: str, grupo: 'A' };
};

// ================================================================
// Importación del listado de asignación académica
// ----------------------------------------------------------------
// Un solo motor para los dos botones de Planeación:
//   - importar:   reemplaza lo precargado de los docentes del listado,
//                 pero conserva las funciones que el docente o el
//                 Director ya trabajaron;
//   - actualizar: solo agrega o actualiza actividades, no borra nada.
// Con ?simular=true hace todo dentro de la transacción y la revierte:
// devuelve el mismo informe sin guardar nada (vista previa).
// Leer y clasificar las filas es trabajo de utils/listadoAgenda.js.
// ================================================================

// Una función en estos estados ya fue trabajada: importar no la toca
const ESTADOS_TRABAJADOS = ['Aceptado', 'Aprobada', 'Devuelta'];

const SIGLA_POR_CONTRATO = { 'tiempo completo': 'TC', 'medio tiempo': 'MT', 'hora catedra': 'HC' };

const cargarContextoListado = async (client) => {
    const programas = (await client.query('SELECT id_programa, nombre_programa FROM programa_academico')).rows;

    const catalogo = new Map();
    const cat = await client.query(`
        SELECT af.funcion_sustantiva, aa.rol_seleccionado
        FROM asignacion_funciones af
        JOIN asignacion_actividades aa ON aa.id_funciones = af.id_funciones AND aa.activo IS NOT FALSE
        WHERE ${condicionCatalogo('af')}
        ORDER BY af.id_funciones, aa.id_asignacionact
    `);
    for (const r of cat.rows) {
        if (!r.rol_seleccionado) continue;
        if (!catalogo.has(r.funcion_sustantiva)) catalogo.set(r.funcion_sustantiva, []);
        const roles = catalogo.get(r.funcion_sustantiva);
        if (!roles.includes(r.rol_seleccionado)) roles.push(r.rol_seleccionado);
    }

    const contratos = (await client.query('SELECT id_contrato, tipo, horas_contrato FROM tipo_contrato')).rows;
    const contratoPorSigla = {};
    for (const [sigla, nombre] of Object.entries(TIPO_CONTRATO_POR_SIGLA)) {
        const c = contratos.find((x) => normalizar(x.tipo) === nombre);
        if (c) contratoPorSigla[sigla] = c;
    }

    const pensul = await client.query('SELECT id_pensulaca FROM pensul_academico WHERE activo = true LIMIT 1');
    return {
        programas,
        catalogo,
        contratoPorSigla,
        idPensulAca: pensul.rows[0]?.id_pensulaca || 1,
        // Cachés de la transacción; se vacían si se revierte un docente
        semestres: new Map(),
        grupos: new Map(),
        semestresGrupos: new Set(),
        espacios: null, // se carga la primera vez que hace falta (ver obtenerEspacios)
    };
};

// Asignaturas existentes, indexadas por semestre y nombre sin tildes, mayúsculas ni espacios de más:
// "INTRODUCCIÓN A LA  INGENIERÍA" y "Introduccion a la ingenieria" son la misma asignatura.
const obtenerEspacios = async (client, ctx) => {
    if (!ctx.espacios) {
        ctx.espacios = new Map();
        const filas = await client.query('SELECT id_espacio_aca, id_semestre, nombre_espacio FROM espacio_academico ORDER BY id_espacio_aca');
        for (const f of filas.rows) {
            const clave = `${f.id_semestre}|${normalizar(f.nombre_espacio)}`;
            if (!ctx.espacios.has(clave)) ctx.espacios.set(clave, f.id_espacio_aca); // si ya había repetidas, se usa la más antigua
        }
    }
    return ctx.espacios;
};

const obtenerSemestreGrupo = async (client, ctx, semestreRaw) => {
    const { numero, grupo } = parseSemestre(semestreRaw);

    let idSemestre = ctx.semestres.get(numero);
    if (!idSemestre) {
        const r = await client.query('SELECT id_semestre FROM semestres WHERE nombre_sem = $1 ORDER BY id_semestre LIMIT 1', [numero]);
        idSemestre = r.rows[0]?.id_semestre || (await client.query(
            'INSERT INTO semestres (id_pensulaca, nombre_sem) VALUES ($1, $2) RETURNING id_semestre',
            [ctx.idPensulAca, numero]
        )).rows[0].id_semestre;
        ctx.semestres.set(numero, idSemestre);
    }

    let idGrupo = ctx.grupos.get(grupo);
    if (!idGrupo) {
        const r = await client.query('SELECT id_grupos FROM grupos WHERE nombre_grupo = $1 ORDER BY id_grupos LIMIT 1', [grupo]);
        idGrupo = r.rows[0]?.id_grupos || (await client.query(
            'INSERT INTO grupos (nombre_grupo, jornada) VALUES ($1, $2) RETURNING id_grupos',
            [grupo, 'Diurna']
        )).rows[0].id_grupos;
        ctx.grupos.set(grupo, idGrupo);
    }

    const claveSG = `${idSemestre}-${idGrupo}`;
    if (!ctx.semestresGrupos.has(claveSG)) {
        const sg = await client.query('SELECT 1 FROM semestres_grupos WHERE id_semestre = $1 AND id_grupos = $2', [idSemestre, idGrupo]);
        if (sg.rows.length === 0) {
            await client.query('INSERT INTO semestres_grupos (id_semestre, id_grupos, activo) VALUES ($1, $2, true)', [idSemestre, idGrupo]);
        }
        ctx.semestresGrupos.add(claveSG);
    }
    return { idSemestre, idGrupo };
};

/**
 * Importar desde cero: borra las funciones precargadas del docente en el período
 * que nadie ha trabajado todavía. Devuelve los nombres de las funciones conservadas.
 */
const limpiarCargaPrecargada = async (client, idUsuario, idPeriodo) => {
    const funcs = await client.query(`
        SELECT af.id_funciones, af.funcion_sustantiva, af.estado_agenda,
               EXISTS (
                   SELECT 1 FROM asignacion_actividades aa
                   JOIN descripcion d ON d.id_asignacionact = aa.id_asignacionact
                   WHERE aa.id_funciones = af.id_funciones
               ) AS diligenciada
        FROM usuario_asignacion ua
        JOIN asignacion_funciones af ON af.id_funciones = ua.id_funciones
        WHERE ua.id_usuario = $1 AND af.id_periodo = $2
    `, [idUsuario, idPeriodo]);

    const conservadas = new Set();
    const aBorrar = [];
    for (const f of funcs.rows) {
        if (ESTADOS_TRABAJADOS.includes(f.estado_agenda) || f.diligenciada) conservadas.add(f.funcion_sustantiva);
        else aBorrar.push(f.id_funciones);
    }
    if (aBorrar.length > 0) {
        await client.query('DELETE FROM actividad_semana WHERE id_asignacionact IN (SELECT id_asignacionact FROM asignacion_actividades WHERE id_funciones = ANY($1))', [aBorrar]);
        await client.query('DELETE FROM asignacion_actividades WHERE id_funciones = ANY($1)', [aBorrar]);
        await client.query('DELETE FROM usuario_asignacion WHERE id_usuario = $1 AND id_funciones = ANY($2)', [idUsuario, aBorrar]);
        await client.query(`
            DELETE FROM asignacion_funciones af
            WHERE af.id_funciones = ANY($1)
              AND NOT EXISTS (SELECT 1 FROM usuario_asignacion ua WHERE ua.id_funciones = af.id_funciones)
        `, [aBorrar]);
    }
    return conservadas;
};

/**
 * Guarda una fila clasificada en la agenda del docente.
 * En modo actualizar reutiliza la actividad equivalente si ya existe
 * (misma materia y grupo, o el mismo rol) y solo actualiza sus horas.
 * @returns {'nueva'|'actualizada'}
 */
const registrarFila = async (client, ctx, d) => {
    const { idUsuario, idPeriodo, fila, clas, modo, funcionesDocente, actividadesUsadas, observacion } = d;

    let idFunciones = funcionesDocente.get(clas.funcion);
    if (!idFunciones) {
        const ex = await client.query(`
            SELECT af.id_funciones
            FROM asignacion_funciones af
            JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
            WHERE ua.id_usuario = $1 AND af.funcion_sustantiva = $2 AND af.id_periodo = $3
            ORDER BY af.id_funciones LIMIT 1
        `, [idUsuario, clas.funcion, idPeriodo]);
        idFunciones = ex.rows[0]?.id_funciones;
        if (!idFunciones) {
            idFunciones = (await client.query(`
                INSERT INTO asignacion_funciones (funcion_sustantiva, horas_funcion, estado_agenda, observaciones_generales, id_periodo)
                VALUES ($1, 0, 'Por Aprobar', $2, $3) RETURNING id_funciones
            `, [clas.funcion, observacion, idPeriodo])).rows[0].id_funciones;
            await client.query('INSERT INTO usuario_asignacion (id_usuario, id_funciones) VALUES ($1, $2)', [idUsuario, idFunciones]);
        }
        funcionesDocente.set(clas.funcion, idFunciones);
    }

    // Las clases llevan espacio académico, semestre y grupo; las demás funciones no
    let idEspacioAca = null;
    let idGrupo = null;
    if (clas.esClase) {
        const sg = await obtenerSemestreGrupo(client, ctx, fila.semestre);
        idGrupo = sg.idGrupo;
        if (clas.rol) {
            const espacios = await obtenerEspacios(client, ctx);
            const clave = `${sg.idSemestre}|${normalizar(clas.rol)}`;
            idEspacioAca = espacios.get(clave);
            if (!idEspacioAca) {
                idEspacioAca = (await client.query(
                    'INSERT INTO espacio_academico (nombre_espacio, id_semestre, activo) VALUES ($1, $2, true) RETURNING id_espacio_aca',
                    [clas.rol, sg.idSemestre]
                )).rows[0].id_espacio_aca;
                espacios.set(clave, idEspacioAca);
            }
        }
    }

    if (modo === 'actualizar') {
        // La enésima fila igual del listado corresponde a la enésima actividad igual
        // (dos filas de Calidad con el mismo rol no se pisan entre sí)
        const existentes = idEspacioAca
            ? await client.query(
                'SELECT id_asignacionact FROM asignacion_actividades WHERE id_funciones = $1 AND id_espacio_aca = $2 AND id_grupos = $3 ORDER BY id_asignacionact',
                [idFunciones, idEspacioAca, idGrupo])
            : await client.query(
                "SELECT id_asignacionact FROM asignacion_actividades WHERE id_funciones = $1 AND LOWER(COALESCE(rol_seleccionado, '')) = LOWER($2) ORDER BY id_asignacionact",
                [idFunciones, clas.rol]);
        const libre = existentes.rows.find((r) => !actividadesUsadas.has(r.id_asignacionact));
        if (libre) {
            actividadesUsadas.add(libre.id_asignacionact);
            await client.query('UPDATE asignacion_actividades SET horas_rol = $1 WHERE id_asignacionact = $2', [fila.horas, libre.id_asignacionact]);
            return 'actualizada';
        }
    }

    const orden = (await client.query('SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM asignacion_actividades WHERE id_funciones = $1', [idFunciones])).rows[0].n;
    const nueva = await client.query(`
        INSERT INTO asignacion_actividades (id_funciones, id_espacio_aca, id_grupos, rol_seleccionado, horas_rol, orden)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_asignacionact
    `, [idFunciones, idEspacioAca, idGrupo, clas.rol, fila.horas, orden]);
    actividadesUsadas.add(nueva.rows[0].id_asignacionact);
    return 'nueva';
};

const procesarListado = async (req, res, modo) => {
    const accion = modo === 'importar' ? 'importar' : 'actualizar';
    const simular = String(req.query?.simular ?? req.body?.simular ?? '').toLowerCase() === 'true';

    if (!req.file) {
        return res.status(400).json({ error: 'No se subió ningún archivo Excel' });
    }
    const idPrograma = parseInt(req.body?.id_programa);
    if (!idPrograma) {
        return res.status(400).json({ error: `Debe seleccionar un programa académico antes de ${accion}.` });
    }

    let listado;
    try {
        listado = leerListado(req.file.buffer);
    } catch {
        return res.status(400).json({ error: 'No se pudo leer el archivo. Verifique que sea un Excel (.xlsx o .xls).' });
    }
    if (!listado.encabezadoEncontrado) {
        return res.status(400).json({
            error: 'No se encontró la fila de encabezados del listado. Debe tener las columnas INSCRIPCIÓN, DOCENTES, PROGRAMAS, ASIGNATURAS, SEMESTRE, VIN y HORAS.'
        });
    }

    await asegurarEsquemaCatalogo();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const progRes = await client.query('SELECT nombre_programa FROM programa_academico WHERE id_programa = $1', [idPrograma]);
        if (progRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'El programa académico seleccionado no existe.' });
        }
        const nombrePrograma = progRes.rows[0].nombre_programa;

        const periodoRes = await client.query('SELECT id_periodo FROM periodo WHERE activo = true LIMIT 1');
        if (periodoRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No hay un período académico activo para asignar las funciones.' });
        }
        const idPeriodo = periodoRes.rows[0].id_periodo;

        const ctx = await cargarContextoListado(client);
        const observacion = modo === 'importar' ? 'Asignado automáticamente vía Excel' : 'Agregado vía actualización Excel';

        // Agrupar las filas por docente, en el orden del listado
        const errores = [];
        const porDocente = new Map();
        for (const fila of listado.filas) {
            if (!fila.documento) {
                errores.push(`Fila ${fila.fila}: no tiene número de documento (INSCRIPCIÓN).`);
                continue;
            }
            if (!porDocente.has(fila.documento)) porDocente.set(fila.documento, []);
            porDocente.get(fila.documento).push(fila);
        }

        const totales = { procesados: 0, actualizados: 0, conservados: 0, omitidos: 0, docentesProcesados: 0, contratosActualizados: 0 };
        const alertas = [];
        const docentesNoEncontrados = [];
        const docentesAfectados = new Set();
        const clasesOtrosProgramas = new Map();

        for (const [documento, filas] of porDocente) {
            const nombreExcel = filas.find((f) => f.nombre)?.nombre || null;
            const u = (await client.query(`
                SELECT u.id_usuario, u.nombres, u.apellidos, u.id_programa, u.id_contrato,
                       pa.nombre_programa, tc.tipo AS tipo_contrato, tc.horas_contrato
                FROM usuarios u
                LEFT JOIN programa_academico pa ON pa.id_programa = u.id_programa
                LEFT JOIN tipo_contrato tc ON tc.id_contrato = u.id_contrato
                WHERE u.numero_documento = $1
                ORDER BY u.id_usuario LIMIT 1
            `, [documento])).rows[0];

            if (!u || u.id_programa !== idPrograma) {
                docentesNoEncontrados.push({
                    fila: filas[0].fila,
                    documento,
                    nombre: nombreExcel,
                    programa: filas[0].programa || null,
                    motivo: !u
                        ? 'No encontrado en el sistema'
                        : `Pertenece a ${u.nombre_programa || 'otro programa'}: su carga se importa con el listado de ese programa`
                });
                totales.omitidos += filas.length;
                continue;
            }

            const docente = `${u.nombres} ${u.apellidos}`.trim();
            const alertar = (mensaje, nivel = 'advertencia') => alertas.push({ documento, docente, nivel, mensaje });
            const savepoint = `docente_${u.id_usuario}`;
            await client.query(`SAVEPOINT ${savepoint}`);

            try {
                // 1. Vinculación (columna VIN) → tipo de contrato del docente
                let sigla = SIGLA_POR_CONTRATO[normalizar(u.tipo_contrato)] || null;
                let horasContrato = Number(u.horas_contrato) || 0;
                const vinculaciones = [...new Set(filas.map((f) => f.vinculacion).filter(Boolean))];
                const siglas = [...new Set(vinculaciones.map(clasificarVinculacion))];
                if (siglas.length > 1) {
                    alertar(`El listado trae vinculaciones distintas (${vinculaciones.join(', ')}); se conserva el contrato registrado (${u.tipo_contrato || 'sin contrato'}).`);
                } else if (siglas.length === 1) {
                    const contrato = ctx.contratoPorSigla[siglas[0]];
                    if (contrato) {
                        sigla = siglas[0];
                        horasContrato = Number(contrato.horas_contrato) || 0;
                        if (contrato.id_contrato !== u.id_contrato) {
                            await client.query('UPDATE usuarios SET id_contrato = $1 WHERE id_usuario = $2', [contrato.id_contrato, u.id_usuario]);
                            totales.contratosActualizados++;
                        }
                    } else if (siglas[0] === 'ADM') {
                        sigla = 'ADM';
                        alertar(`Vinculación ADM (personal administrativo): se conserva el contrato registrado (${u.tipo_contrato || 'sin contrato'}).`, 'info');
                    } else {
                        alertar(`Vinculación "${vinculaciones[0]}" no reconocida; se conserva el contrato registrado (${u.tipo_contrato || 'sin contrato'}).`);
                    }
                } else {
                    alertar(`El listado no trae la vinculación (VIN); se conserva el contrato registrado (${u.tipo_contrato || 'sin contrato'}).`, 'info');
                }

                // El tablero solo muestra a los docentes vinculados al período
                await client.query(
                    'INSERT INTO docente_periodo (id_usuario, id_periodo) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [u.id_usuario, idPeriodo]
                );

                // 2. Importar desde cero: quitar solo lo precargado que nadie ha trabajado
                const conservadas = modo === 'importar'
                    ? await limpiarCargaPrecargada(client, u.id_usuario, idPeriodo)
                    : new Set();

                // 3. Filas del docente
                const funcionesDocente = new Map();
                const actividadesUsadas = new Set();
                const clasificadas = [];
                let nuevas = 0, actualizadas = 0, filasConservadas = 0;

                for (const fila of filas) {
                    const clas = clasificarFila(fila, ctx);
                    if (!clas.funcion) {
                        errores.push(`Fila ${fila.fila} (${docente}): no se reconoce la función "${fila.programa}"; la fila no se cargó.`);
                        continue;
                    }
                    clasificadas.push({ funcion: clas.funcion, horas: fila.horas });

                    if (clas.esClase && !clas.idProgramaClase && clas.programaClase) {
                        clasesOtrosProgramas.set(clas.programaClase, (clasesOtrosProgramas.get(clas.programaClase) || 0) + 1);
                    }
                    if (clas.como === 'otro') {
                        alertar(`Fila ${fila.fila}: "${fila.asignatura}" no tiene una actividad equivalente en ${clas.funcion}; se cargó como "${clas.rol}".`, 'info');
                    } else if (clas.como === 'ambiguo') {
                        alertar(`Fila ${fila.fila}: "${fila.asignatura}" puede ser ${clas.opciones.join(' o ')}; el docente debe elegir la actividad.`);
                    } else if (clas.como === 'sin_equivalencia') {
                        alertar(`Fila ${fila.fila}: "${fila.asignatura}" no coincide con ninguna actividad de ${clas.funcion}; el docente debe elegirla.`);
                    }

                    if (conservadas.has(clas.funcion)) {
                        filasConservadas++;
                        continue;
                    }
                    const r = await registrarFila(client, ctx, {
                        idUsuario: u.id_usuario, idPeriodo, fila, clas, modo,
                        funcionesDocente, actividadesUsadas, observacion
                    });
                    if (r === 'nueva') nuevas++; else actualizadas++;
                }

                if (conservadas.size > 0) {
                    alertar(`Se conservaron sin cambios las funciones que ya estaban diligenciadas o revisadas: ${[...conservadas].join(', ')}.`, 'info');
                }

                // 4. Revisión de la carga: horas vs. contrato y regla del 30 % (no bloquea)
                revisarCarga({ filas: clasificadas, sigla, horasContrato }).alertas.forEach((m) => alertar(m));

                await client.query(`RELEASE SAVEPOINT ${savepoint}`);
                totales.procesados += nuevas;
                totales.actualizados += actualizadas;
                totales.conservados += filasConservadas;
                totales.docentesProcesados++;
                docentesAfectados.add(u.id_usuario);
            } catch (err) {
                await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
                // Lo que se insertó para este docente ya no existe: las cachés tampoco valen
                ctx.semestres.clear();
                ctx.grupos.clear();
                ctx.semestresGrupos.clear();
                ctx.espacios = null;
                console.error(`Error procesando docente ${documento}:`, err);
                errores.push(`No se pudo cargar la agenda de ${docente} (${documento}): ${err.message}`);
                totales.omitidos += filas.length;
            }
        }

        // Horas de cada función = suma de sus actividades (funciones de docentes del período)
        await client.query(`
            UPDATE asignacion_funciones af
            SET horas_funcion = sub.total
            FROM (
                SELECT id_funciones, COALESCE(SUM(horas_rol), 0) AS total
                FROM asignacion_actividades
                GROUP BY id_funciones
            ) sub
            WHERE af.id_funciones = sub.id_funciones
              AND af.id_periodo = $1
              AND af.id_funciones IN (SELECT id_funciones FROM usuario_asignacion)
        `, [idPeriodo]);

        await client.query(simular ? 'ROLLBACK' : 'COMMIT');

        // Aviso a los docentes de que ya tienen carga académica. Es un correo
        // masivo: solo sale si está habilitado (EMAIL_AVISO_ASIGNACIONES=true)
        // o si se pide con ?notificar=true, y nunca en una vista previa.
        const notificarCarga = !simular && (
            String(process.env.EMAIL_AVISO_ASIGNACIONES).toLowerCase() === 'true' ||
            String(req.query?.notificar ?? req.body?.notificar).toLowerCase() === 'true'
        );
        if (notificarCarga && docentesAfectados.size > 0) {
            notificaciones.background.asignacionesCargadas([...docentesAfectados], null, req.user?.id);
        }

        if (!simular) {
            await auditoria.registrar(req, {
                accion: modo === 'importar' ? 'importar_asignaciones' : 'actualizar_asignaciones',
                entidad: 'programa',
                detalle: { id_programa: idPrograma, programa: nombrePrograma, id_periodo: idPeriodo, archivo: req.file.originalname, ...totales }
            });
        }

        const docentesConAlertas = new Set(alertas.filter((a) => a.nivel === 'advertencia').map((a) => a.documento)).size;
        res.status(200).json({
            mensaje: simular
                ? 'Vista previa: no se guardó ningún cambio'
                : modo === 'importar' ? 'Importación procesada correctamente' : 'Actualización procesada correctamente',
            simulacion: simular,
            resultados: {
                ...totales,
                filasLeidas: listado.filas.length,
                erroresEncontrados: errores.length,
                detallesErrores: errores,
                docentesNoEncontrados,
                totalNoEncontrados: docentesNoEncontrados.length,
                alertas,
                docentesConAlertas,
                clasesOtrosProgramas: [...clasesOtrosProgramas].map(([programa, filas]) => ({ programa, filas })),
                docentesNotificados: notificarCarga ? docentesAfectados.size : 0
            }
        });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(`Error en ${accion} asignaciones:`, error);
        res.status(500).json({ error: `Ocurrió un error durante la ${modo === 'importar' ? 'importación' : 'actualización'}.`, detalles: error.message });
    } finally {
        client.release();
    }
};

const importarAsignaciones = (req, res) => procesarListado(req, res, 'importar');

// Solo AGREGA o actualiza: no borra nada de lo que ya tienen los docentes
const actualizarImportacion = (req, res) => procesarListado(req, res, 'actualizar');

const getDashboardDirector = async (req, res) => {
    try {
        // 1. Periodo activo
        const periodoRes = await pool.query(`
            SELECT id_periodo, anio, semestre, fecha_inicio, fecha_fin, activo
            FROM periodo WHERE activo = true LIMIT 1
        `);
        const periodo = periodoRes.rows[0] || null;
        const idPeriodo = periodo?.id_periodo || null;

        // 2. Docentes del periodo activo con estado de agenda
        let docentes = [];
        let metricas = { total: 0, aceptadas: 0, pendientes: 0, total_horas: 0 };
        let distribucion = [];
        let importacionRealizada = false;
        let programasImportados = [];
        if (idPeriodo) {

            let docentesQuery = `
                SELECT
                    u.id_usuario,
                    u.nombres || ' ' || u.apellidos AS nombre,
                    u.correo,
                    pa.id_programa,
                    pa.nombre_programa,
                    f.id_facultad,
                    f.nombre_facultad,
                    tc.tipo AS tipo_contrato,
                    tc.horas_contrato,
                    COUNT(af.id_funciones) AS total_funciones,
                    COUNT(CASE WHEN af.estado_agenda = 'Aceptado' THEN af.id_funciones END) AS funciones_aceptadas,
                    -- Una función aprobada por el Director también está diligenciada:
                    -- sin estos conteos, aprobar una agenda la devolvía a "Pendiente".
                    COUNT(CASE WHEN af.estado_agenda = 'Aprobada' THEN af.id_funciones END) AS funciones_aprobadas,
                    COUNT(CASE WHEN af.estado_agenda = 'Devuelta' THEN af.id_funciones END) AS funciones_devueltas,
                    COALESCE(SUM(af.horas_funcion), 0) AS horas_asignadas,
                    COALESCE(SUM(CASE WHEN af.funcion_sustantiva = 'Docencia Directa' THEN af.horas_funcion ELSE 0 END), 0) AS horas_directas,
                    COALESCE(SUM(CASE WHEN af.funcion_sustantiva = 'Investigación' THEN af.horas_funcion ELSE 0 END), 0) AS horas_investigacion,
                    COALESCE(SUM(CASE WHEN af.funcion_sustantiva = 'Docencia Indirecta' THEN af.horas_funcion ELSE 0 END), 0) AS horas_indirectas
                FROM usuarios u
                JOIN docente_periodo dp ON dp.id_usuario = u.id_usuario AND dp.id_periodo = $1
                JOIN programa_academico pa ON pa.id_programa = u.id_programa
                JOIN facultad f ON f.id_facultad = pa.id_facultad
                JOIN tipo_contrato tc ON tc.id_contrato = u.id_contrato
                JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
                JOIN roles r ON r.id_rol = ur.id_rol AND LOWER(r.nombre_rol) = 'docente'
                LEFT JOIN usuario_asignacion ua ON ua.id_usuario = u.id_usuario
                LEFT JOIN asignacion_funciones af ON af.id_funciones = ua.id_funciones AND af.id_periodo = $1
                WHERE u.activo = TRUE
            `;
            const docParams = [idPeriodo];

            // Un director solo ve los docentes de sus programas
            const alcance = await alcanceProgramas(req);
            if (alcance.restringido) {
                docentesQuery += ' AND u.id_programa = ANY($2::int[])';
                docParams.push(alcance.ids);
            }

            docentesQuery += `
                GROUP BY u.id_usuario, u.nombres, u.apellidos, u.correo,
                         pa.id_programa, pa.nombre_programa, f.id_facultad, f.nombre_facultad,
                         tc.tipo, tc.horas_contrato
                ORDER BY u.nombres, u.apellidos
            `;

            const docentesRes = await pool.query(docentesQuery, docParams);
            docentes = docentesRes.rows.map(d => {
                // La indirecta se muestra como fue asignada; el 30 % solo se compara
                const indirecta = revisarIndirecta(d.horas_directas, d.horas_indirectas);
                return {
                    ...d,
                    docencia_indirecta: indirecta.asignada,
                    docencia_indirecta_esperada: indirecta.esperada,
                    indirecta_cumple_ac030: indirecta.cumple,
                    perfil_docente: perfilAgenda(d.horas_asignadas, d.horas_contrato)
                };
            });

            // Check if import was done for this period
            // Programas que ya tienen carga en el período. Se cuenta por programa:
            // contar cualquier función del período bloqueaba "Importar" para el
            // segundo programa (y los restos de agendas sin docente también contaban).
            const importCheck = await pool.query(`
                SELECT DISTINCT u.id_programa
                FROM asignacion_funciones af
                JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
                JOIN usuarios u ON u.id_usuario = ua.id_usuario
                WHERE af.id_periodo = $1 AND u.id_programa IS NOT NULL
            `, [idPeriodo]);
            programasImportados = importCheck.rows.map(r => r.id_programa);
            importacionRealizada = programasImportados.length > 0;

            // Metricas — "diligenciada" incluye tanto Aceptado (docente la llenó)
            // como Aprobada (el Director ya le dio el visto bueno).
            const diligenciadas = (d) => parseInt(d.funciones_aceptadas) + parseInt(d.funciones_aprobadas);

            metricas.total = docentes.length;
            metricas.aceptadas = docentes.filter(d =>
                parseInt(d.total_funciones) > 0 && diligenciadas(d) >= parseInt(d.total_funciones)
            ).length;
            metricas.pendientes = docentes.filter(d =>
                parseInt(d.total_funciones) > 0 && diligenciadas(d) < parseInt(d.total_funciones)
            ).length;
            metricas.aprobadas = docentes.filter(d =>
                parseInt(d.total_funciones) > 0 && parseInt(d.funciones_aprobadas) >= parseInt(d.total_funciones)
            ).length;
            metricas.devueltas = docentes.filter(d => parseInt(d.funciones_devueltas) > 0).length;
            metricas.total_horas = docentes.reduce((sum, d) =>
                sum + parseFloat(d.horas_asignadas || 0), 0
            );

            // Distribución de horas por función sustantiva
            let distQuery = `
                SELECT
                    af.funcion_sustantiva,
                    COALESCE(SUM(af.horas_funcion), 0) AS horas
                FROM asignacion_funciones af
                JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
                JOIN usuarios u ON u.id_usuario = ua.id_usuario AND u.activo = TRUE
                JOIN docente_periodo dp ON dp.id_usuario = u.id_usuario AND dp.id_periodo = $1
                JOIN programa_academico pa ON pa.id_programa = u.id_programa
                WHERE af.id_periodo = $1
            `;
            const distParams = [idPeriodo];
            if (alcance.restringido) {
                distQuery += ' AND u.id_programa = ANY($2::int[])';
                distParams.push(alcance.ids);
            }
            distQuery += `
                GROUP BY af.funcion_sustantiva
                ORDER BY horas DESC
            `;

            const distRes = await pool.query(distQuery, distParams);
            distribucion = distRes.rows;
        }

        res.json({
            periodo,
            docentes,
            metricas,
            distribucion,
            importacionRealizada,
            programasImportados
        });
    } catch (error) {
        console.error('Error en getDashboardDirector:', error);
        res.status(500).json({ error: 'Error al obtener el dashboard del director.', detalles: error.message });
    }
};

// ================================================================
// GET /director/docente/:id/distribucion
// Retorna la distribución de horas por función sustantiva
// de UN docente específico en el periodo activo.
// ================================================================
const getDistribucionDocente = async (req, res) => {
    try {
        const { id } = req.params;
        const idUsuario = parseInt(id, 10);
        if (isNaN(idUsuario)) return res.status(400).json({ error: 'ID de usuario inválido.' });

        if (!(await docenteEnAlcance(req, idUsuario))) {
            return res.status(403).json({ error: 'Este docente no pertenece a los programas que gestionas.' });
        }

        // Periodo activo
        const periodoRes = await pool.query('SELECT id_periodo FROM periodo WHERE activo = true LIMIT 1');
        const periodo = periodoRes.rows[0];
        if (!periodo) return res.status(404).json({ error: 'No hay período activo.' });
        const idPeriodo = periodo.id_periodo;

        // Distribución de horas por función sustantiva del docente
        const distRes = await pool.query(`
            SELECT
                af.funcion_sustantiva,
                COALESCE(SUM(af.horas_funcion), 0) AS horas
            FROM asignacion_funciones af
            JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
            WHERE ua.id_usuario = $1 AND af.id_periodo = $2
            GROUP BY af.funcion_sustantiva
            ORDER BY horas DESC
        `, [idUsuario, idPeriodo]);

        // Datos adicionales del docente
        const docenteRes = await pool.query(`
            SELECT
                u.nombres || ' ' || u.apellidos AS nombre,
                u.correo,
                tc.tipo AS tipo_contrato,
                tc.horas_contrato,
                COALESCE(SUM(af.horas_funcion), 0) AS horas_asignadas
            FROM usuarios u
            JOIN tipo_contrato tc ON tc.id_contrato = u.id_contrato
            LEFT JOIN usuario_asignacion ua ON ua.id_usuario = u.id_usuario
            LEFT JOIN asignacion_funciones af ON af.id_funciones = ua.id_funciones AND af.id_periodo = $2
            WHERE u.id_usuario = $1
            GROUP BY u.nombres, u.apellidos, u.correo, tc.tipo, tc.horas_contrato
        `, [idUsuario, idPeriodo]);

        const docente = docenteRes.rows[0] || null;
        const distribucion = distRes.rows;

        res.json({ docente, distribucion });
    } catch (error) {
        console.error('Error en getDistribucionDocente:', error);
        res.status(500).json({ error: 'Error al obtener distribución del docente.', detalles: error.message });
    }
};

const eliminarAgendas = async (req, res) => {
    // id_programa obligatorio
    const idPrograma = parseInt(req.body?.id_programa);
    if (!idPrograma) {
        return res.status(400).json({ error: 'Debe seleccionar un programa académico antes de eliminar agendas.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Borrar TODAS las agendas de un programa exige escribir su nombre: evita el
        // clic accidental sobre una acción que no se puede deshacer.
        const progRes = await client.query('SELECT nombre_programa FROM programa_academico WHERE id_programa = $1', [idPrograma]);
        if (progRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'El programa académico seleccionado no existe.' });
        }
        const nombrePrograma = progRes.rows[0].nombre_programa;
        const confirmacion = String(req.body?.confirmacion || '').trim().toLowerCase();
        if (confirmacion !== String(nombrePrograma).trim().toLowerCase()) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: `Para eliminar escribe exactamente el nombre del programa: "${nombrePrograma}".`,
                requiere_confirmacion: true,
                nombre_programa: nombrePrograma
            });
        }

        // 1. Obtener el periodo activo
        const periodoRes = await client.query('SELECT id_periodo FROM periodo WHERE activo = true LIMIT 1');
        if (periodoRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No hay un período académico activo.' });
        }
        const idPeriodoActivo = periodoRes.rows[0].id_periodo;

        // 2. Obtener funciones de los docentes del programa seleccionado en este periodo
        const funcRes = await client.query(`
            SELECT DISTINCT af.id_funciones
            FROM asignacion_funciones af
            JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
            JOIN usuarios u ON u.id_usuario = ua.id_usuario
            WHERE af.id_periodo = $1 AND u.id_programa = $2
        `, [idPeriodoActivo, idPrograma]);
        const funcIds = funcRes.rows.map(r => r.id_funciones);

        // Copia de seguridad ANTES de borrar; si falla, la transacción se cancela
        let respaldo = null;
        if (funcIds.length > 0) {
            respaldo = await respaldarAgendas(client, funcIds, { motivo: `programa-${nombrePrograma}`, periodo: idPeriodoActivo });

            // Obtener todas las actividades asociadas a estas funciones
            const actIdsRes = await client.query('SELECT id_asignacionact FROM asignacion_actividades WHERE id_funciones = ANY($1)', [funcIds]);
            const actIds = actIdsRes.rows.map(r => r.id_asignacionact);

            if (actIds.length > 0) {
                // Eliminar evidencias
                await client.query(`
                    DELETE FROM evidencias WHERE id_indicadores IN (
                        SELECT i.id_indicadores FROM indicadores i
                        JOIN descripcion d ON i.id_descripcion = d.id_descripcion
                        WHERE d.id_asignacionact = ANY($1)
                    )
                `, [actIds]);

                // Eliminar indicadores
                await client.query(`
                    DELETE FROM indicadores WHERE id_descripcion IN (
                        SELECT id_descripcion FROM descripcion WHERE id_asignacionact = ANY($1)
                    )
                `, [actIds]);

                // Eliminar descripciones
                await client.query('DELETE FROM descripcion WHERE id_asignacionact = ANY($1)', [actIds]);

                // Eliminar actividades_semana
                await client.query('DELETE FROM actividad_semana WHERE id_asignacionact = ANY($1)', [actIds]);

                // Eliminar asignacion_actividades
                await client.query('DELETE FROM asignacion_actividades WHERE id_funciones = ANY($1)', [funcIds]);
            }

            // Eliminar usuario_asignacion
            await client.query('DELETE FROM usuario_asignacion WHERE id_funciones = ANY($1)', [funcIds]);

            // Eliminar asignacion_funciones
            // Solo las del programa: filtrar por período borraba (o chocaba con) las de otros programas
            await client.query('DELETE FROM asignacion_funciones WHERE id_funciones = ANY($1)', [funcIds]);
        }

        await client.query('COMMIT');

        await auditoria.registrar(req, {
            accion: 'eliminar_agendas_programa',
            entidad: 'programa',
            detalle: { id_programa: idPrograma, programa: nombrePrograma, id_periodo: idPeriodoActivo, respaldo }
        });

        res.status(200).json({
            mensaje: 'Todas las agendas del programa en el período activo fueron eliminadas correctamente.',
            respaldo
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error eliminando agendas:", error);
        res.status(500).json({ error: 'Ocurrió un error al intentar eliminar las agendas.', detalles: error.message });
    } finally {
        client.release();
    }
};

// ================================================================
// DELETE /director/eliminar-agendas-docentes
// Body: { ids: [id_usuario1, id_usuario2, ...] }
// Elimina SOLO las agendas de los docentes indicados en el
// periodo activo, con cascada completa.
// ================================================================
const eliminarAgendasDocentes = async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Debes proporcionar al menos un docente.' });
    }
    const idsNum = ids.map(Number).filter(n => !isNaN(n));
    if (idsNum.length === 0) {
        return res.status(400).json({ error: 'IDs de docentes inválidos.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Periodo activo
        const periodoRes = await client.query('SELECT id_periodo FROM periodo WHERE activo = true LIMIT 1');
        if (periodoRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No hay un período académico activo.' });
        }
        const idPeriodoActivo = periodoRes.rows[0].id_periodo;

        // Obtener las funciones de los docentes seleccionados en el periodo activo
        const funcRes = await client.query(`
            SELECT DISTINCT af.id_funciones
            FROM asignacion_funciones af
            JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
            WHERE af.id_periodo = $1 AND ua.id_usuario = ANY($2)
        `, [idPeriodoActivo, idsNum]);

        const funcIds = funcRes.rows.map(r => r.id_funciones);

        // Copia de seguridad ANTES de borrar; si falla, la transacción se cancela
        let respaldo = null;
        if (funcIds.length > 0) {
            respaldo = await respaldarAgendas(client, funcIds, { motivo: `docentes-${idsNum.length}`, periodo: idPeriodoActivo });

            // Actividades
            const actIdsRes = await client.query(
                'SELECT id_asignacionact FROM asignacion_actividades WHERE id_funciones = ANY($1)',
                [funcIds]
            );
            const actIds = actIdsRes.rows.map(r => r.id_asignacionact);

            if (actIds.length > 0) {
                // Evidencias
                await client.query(`
                    DELETE FROM evidencias WHERE id_indicadores IN (
                        SELECT i.id_indicadores FROM indicadores i
                        JOIN descripcion d ON i.id_descripcion = d.id_descripcion
                        WHERE d.id_asignacionact = ANY($1)
                    )
                `, [actIds]);
                // Indicadores
                await client.query(`
                    DELETE FROM indicadores WHERE id_descripcion IN (
                        SELECT id_descripcion FROM descripcion WHERE id_asignacionact = ANY($1)
                    )
                `, [actIds]);
                // Descripciones
                await client.query('DELETE FROM descripcion WHERE id_asignacionact = ANY($1)', [actIds]);
                // Actividades semana
                await client.query('DELETE FROM actividad_semana WHERE id_asignacionact = ANY($1)', [actIds]);
                // Asignacion actividades
                await client.query('DELETE FROM asignacion_actividades WHERE id_funciones = ANY($1)', [funcIds]);
            }

            // Usuario asignacion
            await client.query('DELETE FROM usuario_asignacion WHERE id_funciones = ANY($1)', [funcIds]);
            // Asignacion funciones
            await client.query('DELETE FROM asignacion_funciones WHERE id_funciones = ANY($1)', [funcIds]);
        }

        await client.query('COMMIT');

        await auditoria.registrar(req, {
            accion: 'eliminar_agendas_docentes',
            entidad: 'docente',
            detalle: { ids_docentes: idsNum, id_periodo: idPeriodoActivo, respaldo }
        });

        res.status(200).json({
            mensaje: `Agendas de ${idsNum.length} docente(s) eliminadas correctamente.`,
            eliminados: idsNum.length,
            respaldo
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error eliminando agendas de docentes:', error);
        res.status(500).json({ error: 'Error al eliminar las agendas.', detalles: error.message });
    } finally {
        client.release();
    }
};

module.exports = { importarAsignaciones, actualizarImportacion, getDashboardDirector, getDistribucionDocente, eliminarAgendas, eliminarAgendasDocentes, parseSemestre };

