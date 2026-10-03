// ================================================================
// SIGAP — Datos de demostración para el panel de analítica
// ----------------------------------------------------------------
// Genera docentes ficticios con agendas completas para que el panel
// de analítica tenga material que mostrar (gráficos, filtro por
// facultad/programa e interpretación de Gemini).
//
// Todos los registros creados quedan marcados por el dominio del
// correo: @demo.cesmag.edu.co. Ese es el único criterio que se usa
// para borrarlos, así que nunca toca datos reales.
//
//   node db/seed_demo_analitica.js              (vista previa)
//   node db/seed_demo_analitica.js --aplicar    (crea los datos)
//   node db/seed_demo_analitica.js --limpiar    (los elimina)
//
// Por defecto trabaja contra la base del .env (local). Para apuntar
// a otra, pasar la cadena de conexión como último argumento.
// ================================================================

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Client } = require('pg');

const MARCADOR = '@demo.cesmag.edu.co';

const argv = process.argv.slice(2);
const APLICAR = argv.includes('--aplicar');
const LIMPIAR = argv.includes('--limpiar');
const urlExplicita = argv.find((a) => a.startsWith('postgres'));

// ----------------------------------------------------------------
// Generador pseudoaleatorio con semilla: el resultado es reproducible.
// ----------------------------------------------------------------
let semilla = 20260919;
const azar = () => {
    semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
    return semilla / 0x7fffffff;
};
const entre = (min, max) => min + Math.floor(azar() * (max - min + 1));
const elegir = (arr) => arr[Math.floor(azar() * arr.length)];

// ----------------------------------------------------------------
// Catálogo de contenidos verosímiles
// ----------------------------------------------------------------
const NOMBRES = ['Laura', 'Andrés', 'Carolina', 'Julián', 'Paola', 'Mauricio', 'Diana', 'Felipe',
    'Claudia', 'Óscar', 'Natalia', 'Ricardo', 'Mónica', 'Sebastián', 'Ángela', 'Camilo',
    'Patricia', 'Hernán', 'Lucía', 'Álvaro'];
const APELLIDOS = ['Benavides', 'Rosero', 'Chamorro', 'Guerrero', 'Insuasty', 'Narváez', 'Bastidas',
    'Cabrera', 'Erazo', 'Zambrano', 'Muñoz', 'Delgado', 'Portilla', 'Jojoa', 'Mora',
    'Solarte', 'Timaná', 'Burbano'];

const ESPACIOS = ['Estructuras de Datos', 'Bases de Datos', 'Ingeniería de Software', 'Redes de Computadores',
    'Cálculo Diferencial', 'Física Mecánica', 'Circuitos Eléctricos', 'Investigación de Operaciones',
    'Gestión de la Calidad', 'Programación Web', 'Inteligencia Artificial', 'Control Automático',
    'Costos y Presupuestos', 'Estadística Aplicada'];

const RESULTADOS = {
    'Docencia Directa': ['Desarrollo de espacio académico', 'Registro de calificaciones', 'Diseño de guías de práctica'],
    'Docencia Indirecta': ['Asesoría a estudiantes', 'Preparación de material didáctico'],
    'Investigación': ['Artículo sometido a revista indexada', 'Ponencia en evento académico', 'Dirección de trabajo de grado'],
    'Académico-Administrativo': ['Informe de gestión del programa', 'Participación en comités', 'Seguimiento a egresados'],
    'Aseguramiento de Calidad': ['Documento de autoevaluación', 'Plan de mejoramiento'],
    'Vicerrectoría': ['Apoyo a procesos institucionales']
};

const INDICADORES_TXT = {
    'Docencia Directa': ['Semanas de clase desarrolladas', 'Cortes de notas registrados', 'Guías entregadas'],
    'Docencia Indirecta': ['Sesiones de asesoría realizadas', 'Materiales publicados en el aula virtual'],
    'Investigación': ['Productos de investigación radicados', 'Ponencias presentadas', 'Trabajos de grado dirigidos'],
    'Académico-Administrativo': ['Informes entregados', 'Reuniones de comité asistidas', 'Egresados contactados'],
    'Aseguramiento de Calidad': ['Documentos elaborados', 'Acciones de mejora ejecutadas'],
    'Vicerrectoría': ['Actividades de apoyo realizadas']
};

// Reparto de horas por tipo de contrato. Suma exacta a las horas contratadas.
const PERFILES = {
    40: [
        { f: 'Docencia Directa', h: 16 }, { f: 'Docencia Indirecta', h: 5 },
        { f: 'Investigación', h: 10 }, { f: 'Académico-Administrativo', h: 9 }
    ],
    20: [
        { f: 'Docencia Directa', h: 10 }, { f: 'Docencia Indirecta', h: 3 },
        { f: 'Académico-Administrativo', h: 7 }
    ],
    0: [
        { f: 'Docencia Directa', h: 8 }, { f: 'Docencia Indirecta', h: 2 }
    ]
};

// Cómo se comporta cada estado de agenda frente a la ejecución
const ESTADOS = [
    { estado: 'Aprobada', peso: 7, avance8: [0.4, 0.6], avance16: [0.3, 0.4] },
    { estado: 'Aceptado', peso: 5, avance8: [0.3, 0.5], avance16: [0.0, 0.2] },
    { estado: 'Devuelta', peso: 3, avance8: [0.0, 0.2], avance16: [0.0, 0.0] },
    { estado: 'Pendiente', peso: 3, avance8: [0.0, 0.0], avance16: [0.0, 0.0] }
];

const estadoAleatorio = () => {
    const total = ESTADOS.reduce((a, e) => a + e.peso, 0);
    let r = azar() * total;
    for (const e of ESTADOS) { r -= e.peso; if (r <= 0) return e; }
    return ESTADOS[0];
};

// 18 docentes repartidos en 4 programas de la facultad de Ingeniería
const PLANTILLA = [
    { programa: 1, contrato: 1, n: 5 }, // Ing. de Sistemas — tiempo completo
    { programa: 1, contrato: 2, n: 2 }, // Ing. de Sistemas — medio tiempo
    { programa: 2, contrato: 1, n: 3 }, // Ing. Electrónica
    { programa: 2, contrato: 2, n: 1 },
    { programa: 3, contrato: 1, n: 3 }, // Ing. Industrial
    { programa: 3, contrato: 3, n: 1 }, // hora cátedra: caso sin parámetro contractual
    { programa: 6, contrato: 1, n: 2 }, // Ing. Financiera
    { programa: 6, contrato: 2, n: 1 }
];

// ----------------------------------------------------------------

const conectar = () => {
    if (urlExplicita) {
        return new Client({
            connectionString: urlExplicita,
            ssl: urlExplicita.includes('localhost') ? false : { rejectUnauthorized: false }
        });
    }
    return new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: String(process.env.DB_PASSWORD || ''),
        ssl: false
    });
};

const limpiar = async (c) => {
    console.log(`Eliminando todo lo marcado con ${MARCADOR} ...\n`);
    await c.query('BEGIN');

    const ids = (await c.query(
        'SELECT id_usuario FROM usuarios WHERE correo LIKE $1', [`%${MARCADOR}`]
    )).rows.map((r) => r.id_usuario);

    if (ids.length === 0) {
        await c.query('ROLLBACK');
        console.log('No hay datos de demostración que eliminar.');
        return;
    }

    // De las hojas hacia la raíz, respetando las llaves foráneas
    const funciones = (await c.query(
        'SELECT id_funciones FROM usuario_asignacion WHERE id_usuario = ANY($1)', [ids]
    )).rows.map((r) => r.id_funciones);

    const borrar = async (etiqueta, sql, params) => {
        const r = await c.query(sql, params);
        if (r.rowCount > 0) console.log(`  ${etiqueta.padEnd(24)} ${r.rowCount}`);
    };

    if (funciones.length > 0) {
        const acts = (await c.query(
            'SELECT id_asignacionact FROM asignacion_actividades WHERE id_funciones = ANY($1)', [funciones]
        )).rows.map((r) => r.id_asignacionact);

        if (acts.length > 0) {
            const descs = (await c.query(
                'SELECT id_descripcion FROM descripcion WHERE id_asignacionact = ANY($1)', [acts]
            )).rows.map((r) => r.id_descripcion);

            if (descs.length > 0) {
                const inds = (await c.query(
                    'SELECT id_indicadores FROM indicadores WHERE id_descripcion = ANY($1)', [descs]
                )).rows.map((r) => r.id_indicadores);

                if (inds.length > 0) {
                    await borrar('evidencias', 'DELETE FROM evidencias WHERE id_indicadores = ANY($1)', [inds]);
                    await borrar('indicadores', 'DELETE FROM indicadores WHERE id_indicadores = ANY($1)', [inds]);
                }
                await borrar('descripcion', 'DELETE FROM descripcion WHERE id_descripcion = ANY($1)', [descs]);
            }
            await borrar('observaciones_director', 'DELETE FROM observaciones_director WHERE id_asignacionact = ANY($1)', [acts]);
            await borrar('asignacion_actividades', 'DELETE FROM asignacion_actividades WHERE id_asignacionact = ANY($1)', [acts]);
        }
        await borrar('usuario_asignacion', 'DELETE FROM usuario_asignacion WHERE id_funciones = ANY($1)', [funciones]);
        await borrar('asignacion_funciones', 'DELETE FROM asignacion_funciones WHERE id_funciones = ANY($1)', [funciones]);
    }

    await borrar('docente_periodo', 'DELETE FROM docente_periodo WHERE id_usuario = ANY($1)', [ids]);
    await borrar('usuario_rol', 'DELETE FROM usuario_rol WHERE id_usuario = ANY($1)', [ids]);
    await borrar('usuarios', 'DELETE FROM usuarios WHERE id_usuario = ANY($1)', [ids]);

    await c.query('COMMIT');
    console.log(`\nListo: ${ids.length} docente(s) de demostración eliminados.`);
};

const sembrar = async (c) => {
    const periodo = (await c.query('SELECT id_periodo, anio, semestre FROM periodo WHERE activo = TRUE LIMIT 1')).rows[0];
    if (!periodo) throw new Error('No hay período activo. Habilite uno antes de sembrar.');

    const yaHay = (await c.query('SELECT COUNT(*)::int n FROM usuarios WHERE correo LIKE $1', [`%${MARCADOR}`])).rows[0].n;
    if (yaHay > 0) {
        throw new Error(`Ya existen ${yaHay} docentes de demostración. Ejecute --limpiar antes de volver a sembrar.`);
    }

    const rolDocente = (await c.query("SELECT id_rol FROM roles WHERE LOWER(nombre_rol) = 'docente' LIMIT 1")).rows[0];
    if (!rolDocente) throw new Error('No existe el rol Docente.');

    const contratos = {};
    for (const r of (await c.query('SELECT id_contrato, horas_contrato FROM tipo_contrato')).rows) {
        contratos[r.id_contrato] = Number(r.horas_contrato) || 0;
    }

    // Un director real para firmar las observaciones de las agendas devueltas
    const director = (await c.query(`
        SELECT u.id_usuario FROM usuarios u
        JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
        JOIN roles r ON r.id_rol = ur.id_rol
        WHERE LOWER(r.nombre_rol) = 'director' AND u.activo LIMIT 1`)).rows[0];

    const resumen = { docentes: 0, funciones: 0, actividades: 0, descripciones: 0, indicadores: 0, evidencias: 0, observaciones: 0 };
    const porEstado = {};
    let doc = 1;

    await c.query('BEGIN');

    for (const grupo of PLANTILLA) {
        for (let i = 0; i < grupo.n; i++) {
            const nombres = elegir(NOMBRES);
            const apellidos = `${elegir(APELLIDOS)} ${elegir(APELLIDOS)}`;
            const documento = String(90000000 + doc);
            const correo = `demo.docente${String(doc).padStart(2, '0')}${MARCADOR}`;
            doc++;

            const usuario = (await c.query(`
                INSERT INTO usuarios (nombres, apellidos, tipo_documento, numero_documento,
                                      correo, id_contrato, id_programa, activo, creado_en)
                VALUES ($1, $2, 'CC', $3, $4, $5, $6, TRUE, NOW())
                RETURNING id_usuario`,
                [nombres, apellidos, documento, correo, grupo.contrato, grupo.programa]
            )).rows[0];
            resumen.docentes++;

            await c.query('INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)', [usuario.id_usuario, rolDocente.id_rol]);
            await c.query('INSERT INTO docente_periodo (id_usuario, id_periodo) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [usuario.id_usuario, periodo.id_periodo]);

            const perfil = PERFILES[contratos[grupo.contrato]] || PERFILES[0];
            const cfg = estadoAleatorio();
            porEstado[cfg.estado] = (porEstado[cfg.estado] || 0) + 1;

            for (const { f, h } of perfil) {
                const funcion = (await c.query(`
                    INSERT INTO asignacion_funciones (funcion_sustantiva, horas_funcion, estado_agenda,
                                                      id_periodo, creado_en, revisado_por, fecha_revision,
                                                      observaciones_generales)
                    VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7)
                    RETURNING id_funciones`,
                    [f, h, cfg.estado, periodo.id_periodo,
                     ['Aprobada', 'Devuelta'].includes(cfg.estado) ? director?.id_usuario || null : null,
                     ['Aprobada', 'Devuelta'].includes(cfg.estado) ? new Date() : null,
                     cfg.estado === 'Devuelta' ? 'Ajustar la meta del indicador de investigación: no es medible en los términos planteados.' : null]
                )).rows[0];
                resumen.funciones++;

                await c.query('INSERT INTO usuario_asignacion (id_usuario, id_funciones) VALUES ($1, $2)',
                    [usuario.id_usuario, funcion.id_funciones]);

                // Entre 1 y 3 actividades que reparten exactamente las horas
                const nActs = f === 'Docencia Directa' ? entre(2, 3) : entre(1, 2);
                let restantes = h;
                for (let a = 0; a < nActs; a++) {
                    const ultima = a === nActs - 1;
                    const horas = ultima ? restantes : Math.max(1, Math.floor(restantes / (nActs - a)));
                    restantes -= horas;

                    const actividad = (await c.query(`
                        INSERT INTO asignacion_actividades (id_funciones, rol_seleccionado, horas_rol, orden, creado_en)
                        VALUES ($1, $2, $3, $4, NOW()) RETURNING id_asignacionact`,
                        [funcion.id_funciones, f === 'Docencia Directa' ? elegir(ESPACIOS) : f, horas, a + 1]
                    )).rows[0];
                    resumen.actividades++;

                    const descripcion = (await c.query(`
                        INSERT INTO descripcion (id_asignacionact, resultado_esperado, meta, activo)
                        VALUES ($1, $2, $3, TRUE) RETURNING id_descripcion`,
                        [actividad.id_asignacionact, elegir(RESULTADOS[f] || ['Actividad programada']),
                         f === 'Docencia Directa' ? 16 : entre(1, 6)]
                    )).rows[0];
                    resumen.descripciones++;

                    const meta = Number((await c.query('SELECT meta FROM descripcion WHERE id_descripcion = $1',
                        [descripcion.id_descripcion])).rows[0].meta);

                    const frac8 = cfg.avance8[0] + azar() * (cfg.avance8[1] - cfg.avance8[0]);
                    const frac16 = cfg.avance16[0] + azar() * (cfg.avance16[1] - cfg.avance16[0]);
                    const ejec8 = Math.round(meta * frac8 * 100) / 100;
                    const ejec16 = Math.min(Math.round(meta * frac16 * 100) / 100, Math.max(0, meta - ejec8));

                    const indicador = (await c.query(`
                        INSERT INTO indicadores (id_descripcion, nombre_indicador, activo, ejecucion_8, ejecucion_16)
                        VALUES ($1, $2, TRUE, $3, $4) RETURNING id_indicadores`,
                        [descripcion.id_descripcion, elegir(INDICADORES_TXT[f] || ['Actividades realizadas']), ejec8, ejec16]
                    )).rows[0];
                    resumen.indicadores++;

                    // Evidencias solo donde hubo ejecución real
                    if (ejec8 > 0 && azar() < 0.55) {
                        const semana = ejec16 > 0 && azar() < 0.5 ? '16' : '8';
                        await c.query(`
                            INSERT INTO evidencias (id_indicadores, nombre_archivo, ruta_archivo, tipo_archivo,
                                                    tamanio_archivo_kb, semana, fecha_carga)
                            VALUES ($1, $2, $3, 'application/pdf', $4, $5, NOW())`,
                            [indicador.id_indicadores,
                             `evidencia_demo_${indicador.id_indicadores}_s${semana}.pdf`,
                             `/uploads/demo/evidencia_${indicador.id_indicadores}.pdf`,
                             entre(80, 2400), semana]);
                        resumen.evidencias++;
                    }

                    // Retroalimentación del director en las agendas devueltas
                    if (cfg.estado === 'Devuelta' && director && azar() < 0.5) {
                        await c.query(`
                            INSERT INTO observaciones_director (id_asignacionact, director_id, semana, texto)
                            VALUES ($1, $2, $3, $4)`,
                            [actividad.id_asignacionact, director.id_usuario, elegir([8, 16]),
                             elegir([
                                 'La meta declarada no es verificable con la evidencia aportada. Precise la unidad de medida.',
                                 'Ajuste el resultado esperado para que refleje un producto concreto del período.',
                                 'Falta soporte documental del avance reportado en este corte.'
                             ])]);
                        resumen.observaciones++;
                    }
                }
            }
        }
    }

    if (!APLICAR) {
        await c.query('ROLLBACK');
        console.log('VISTA PREVIA (no se guardó nada). Se crearían:\n');
    } else {
        await c.query('COMMIT');
        console.log('DATOS CREADOS:\n');
    }

    console.table(resumen);
    console.log('Distribución de estados de agenda:');
    console.table(porEstado);
    console.log(`Período: ${periodo.anio}-${Number(periodo.semestre) === 1 ? 'I' : 'II'}`);
    if (!APLICAR) console.log('\nEjecute de nuevo con --aplicar para guardarlos.');
};

(async () => {
    const c = conectar();
    await c.connect();
    console.log(`Base: ${urlExplicita ? 'indicada por argumento' : `${process.env.DB_NAME}@${process.env.DB_HOST}`}\n`);

    try {
        if (LIMPIAR) await limpiar(c);
        else await sembrar(c);
    } catch (e) {
        try { await c.query('ROLLBACK'); } catch { /* ignorar */ }
        console.error('FALLO:', e.message);
        process.exitCode = 1;
    } finally {
        await c.end();
    }
})();
