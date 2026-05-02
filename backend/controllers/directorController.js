const pool = require('../db/connection');
const xlsx = require('xlsx');

const parseSemestre = (semestreStr) => {
    if (!semestreStr) return { numero: '1', grupo: 'A' };
    const str = String(semestreStr).trim();
    const match = str.match(/^(\d+)(.*)$/);
    if (match) {
        return { numero: match[1], grupo: match[2]?.trim() || 'A' };
    }
    return { numero: str, grupo: 'A' };
};

const mapFuncionSustantiva = async (client, programaStr) => {
    if (!programaStr) return "Otra Función";
    const str = String(programaStr).trim();
    const strLower = str.toLowerCase();
    
    // Buscar en el catálogo maestro (funciones sin usuario asignado) usando fuzzy
    const catalogRes = await client.query(`
        SELECT DISTINCT funcion_sustantiva FROM asignacion_funciones
        WHERE NOT EXISTS (SELECT 1 FROM usuario_asignacion ua WHERE ua.id_funciones = asignacion_funciones.id_funciones)
    `);
    
    // Mapeo de keywords a funciones del catálogo
    const keywordMap = [
        { keywords: ['investigacion', 'investigación'], funcion: null },
        { keywords: ['admin'], funcion: null },
        { keywords: ['calidad', 'aseguramiento'], funcion: null },
        { keywords: ['indirecta'], funcion: null },
        { keywords: ['vicerrectoria', 'vicerrectoría', 'proyeccion', 'proyección'], funcion: null },
    ];
    
    // Llenar con los nombres reales del catálogo
    for (const catRow of catalogRes.rows) {
        const catLower = catRow.funcion_sustantiva.toLowerCase();
        for (const km of keywordMap) {
            if (km.keywords.some(kw => catLower.includes(kw))) {
                km.funcion = catRow.funcion_sustantiva; // Nombre exacto de la BD
                break;
            }
        }
    }
    
    // Buscar match con el texto del Excel
    for (const km of keywordMap) {
        if (km.funcion && km.keywords.some(kw => strLower.includes(kw))) {
            return km.funcion;
        }
    }
    
    // "Horas indirectas" como texto genérico
    if (strLower.includes('indirecta')) return 'Docencia Indirecta';
    
    // Verificar si es un Programa Académico → Docencia Directa
    const { rows } = await client.query('SELECT nombre_programa FROM programa_academico WHERE LOWER(nombre_programa) = $1', [strLower]);
    if (rows.length > 0) {
        return 'Docencia Directa';
    }
    
    return str;
};

// ================================================================
// Fuzzy Matching mejorado:
// Compara por palabras clave. Si al menos 2 palabras significativas
// del Excel coinciden con las del catálogo, es un match.
// ================================================================
const fuzzyMatch = (excelStr, dbStr) => {
    if (!excelStr || !dbStr) return false;
    
    const normalize = (s) => String(s).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[-_]/g, ' ')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
    
    const excelNorm = normalize(excelStr);
    const dbNorm = normalize(dbStr);
    
    // Match exacto
    if (excelNorm === dbNorm) return true;
    
    // Uno contiene al otro
    if (excelNorm.includes(dbNorm) || dbNorm.includes(excelNorm)) return true;
    
    // Match por palabras clave (ignorar palabras cortas como "de", "la", "el", etc.)
    const stopWords = new Set(['de', 'la', 'el', 'los', 'las', 'del', 'en', 'y', 'a', 'e', 'o', 'u', 'por', 'para', 'con', 'cual']);
    const getKeywords = (s) => s.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    
    const excelWords = getKeywords(excelNorm);
    const dbWords = getKeywords(dbNorm);
    
    if (excelWords.length === 0 || dbWords.length === 0) return false;
    
    // Contar cuántas palabras del Excel aparecen en el texto de la BD
    let matchCount = 0;
    for (const ew of excelWords) {
        for (const dw of dbWords) {
            if (ew.includes(dw) || dw.includes(ew)) {
                matchCount++;
                break;
            }
        }
    }
    
    // Si coinciden al menos 2 palabras, o si coincide más del 50% de las palabras del Excel
    const threshold = Math.min(2, Math.ceil(excelWords.length * 0.5));
    return matchCount >= threshold;
};

// ================================================================
// Calcular score de match para ranking
// ================================================================
const calcFuzzyScore = (excelStr, dbStr) => {
    const exAlpha = String(excelStr).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
    const dbAlpha = String(dbStr).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
    if (exAlpha === dbAlpha) return 1000;
    
    const excelWords = String(excelStr).toLowerCase().split(/\s+/);
    const dbWords = String(dbStr).toLowerCase().split(/\s+/);
    let score = 0;
    for (const ew of excelWords) {
        for (const dw of dbWords) {
            if (ew.length > 2 && dw.length > 2 && (ew.includes(dw) || dw.includes(ew))) {
                score++;
                break;
            }
        }
    }
    return score;
};

// ================================================================
// buscarEnCatalogo:
// Busca el texto del Excel (columna ASIGNATURAS) en el catálogo maestro.
// Flujo:
//   1. Buscar coincidencia con rol_seleccionado (actividad)
//   2. Si no encuentra, buscar en resultado_esperado (descripción)
//      y devolver la actividad padre correspondiente
// Retorna: { rolSeleccionado: string } o null
// ================================================================
const buscarEnCatalogo = async (client, asignaturas, funcionSustantivaStr) => {
    // Obtener la función del catálogo maestro
    const catalogFuncRes = await client.query(`
        SELECT id_funciones FROM asignacion_funciones 
        WHERE funcion_sustantiva = $1 
        AND NOT EXISTS (SELECT 1 FROM usuario_asignacion ua WHERE ua.id_funciones = asignacion_funciones.id_funciones)
        LIMIT 1
    `, [funcionSustantivaStr]);
    
    if (catalogFuncRes.rows.length === 0) return null;
    
    const catalogIdFunc = catalogFuncRes.rows[0].id_funciones;
    
    // Obtener actividades únicas del catálogo
    const catActsRes = await client.query(
        'SELECT DISTINCT rol_seleccionado FROM asignacion_actividades WHERE id_funciones = $1',
        [catalogIdFunc]
    );
    
    // Si solo hay 1 actividad en el catálogo, seleccionarla automáticamente
    if (catActsRes.rows.length === 1) {
        return { rolSeleccionado: catActsRes.rows[0].rol_seleccionado };
    }
    
    if (!asignaturas) return null;
    
    // PASO 1: Buscar coincidencia en actividades (rol_seleccionado)
    let bestMatch = '';
    let bestScore = 0;
    
    for (const ca of catActsRes.rows) {
        const dbRol = ca.rol_seleccionado;
        if (fuzzyMatch(asignaturas, dbRol)) {
            const score = calcFuzzyScore(asignaturas, dbRol);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = dbRol;
            }
        }
    }
    
    if (bestMatch) {
        return { rolSeleccionado: bestMatch };
    }
    
    // PASO 2: Buscar en descripciones (resultado_esperado)
    const catDescRes = await client.query(`
        SELECT aa.rol_seleccionado, d.resultado_esperado
        FROM asignacion_actividades aa
        JOIN descripcion d ON aa.id_asignacionact = d.id_asignacionact
        WHERE aa.id_funciones = $1
    `, [catalogIdFunc]);
    
    bestMatch = '';
    bestScore = 0;
    
    for (const cd of catDescRes.rows) {
        if (fuzzyMatch(asignaturas, cd.resultado_esperado)) {
            const score = calcFuzzyScore(asignaturas, cd.resultado_esperado);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = cd.rol_seleccionado;
            }
        }
    }
    
    if (bestMatch) {
        return { rolSeleccionado: bestMatch };
    }
    
    return null;
};

const importarAsignaciones = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se subió ningún archivo Excel' });
    }

    const normalizeObjectKeys = (obj) => {
        const newObj = {};
        for (let key in obj) {
            const newKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
            newObj[newKey] = obj[key];
        }
        return newObj;
    };

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const records = xlsx.utils.sheet_to_json(sheet);
        
        let procesados = 0;
        let conservados = 0;
        let errores = [];

        const pensulRes = await client.query('SELECT id_pensulaca FROM pensul_academico WHERE activo = true LIMIT 1');
        const idPensulAca = pensulRes.rows.length > 0 ? pensulRes.rows[0].id_pensulaca : 1;

        // ============================================================
        // PASO 1: Identificar docentes del Excel y SOLO limpiar
        //         funciones que NO estén "Aceptado"
        // ============================================================
        const documentosEnExcel = new Set();
        for (let i = 0; i < records.length; i++) {
            const row = normalizeObjectKeys(records[i]);
            const inscripcion = row['inscripcion'];
            if (inscripcion) {
                documentosEnExcel.add(String(inscripcion).trim());
            }
        }

        // Mapa para saber qué funciones ya están aceptadas por cada usuario
        // Clave: `${userId}_${funcionSustantiva}` → id_funciones
        const funcionesAceptadas = new Map();

        for (const docNum of documentosEnExcel) {
            const userRes = await client.query('SELECT id_usuario FROM usuarios WHERE numero_documento = $1', [docNum]);
            if (userRes.rows.length === 0) continue;
            const userId = userRes.rows[0].id_usuario;

            const funcRes = await client.query(`
                SELECT af.id_funciones, af.funcion_sustantiva, af.estado_agenda 
                FROM usuario_asignacion ua
                JOIN asignacion_funciones af ON ua.id_funciones = af.id_funciones
                WHERE ua.id_usuario = $1
            `, [userId]);

            for (const fRow of funcRes.rows) {
                const fid = fRow.id_funciones;

                if (fRow.estado_agenda === 'Aceptado') {
                    // PRESERVAR: esta función ya fue aceptada por el docente
                    const key = `${userId}_${fRow.funcion_sustantiva}`;
                    funcionesAceptadas.set(key, fid);
                    conservados++;
                    continue; // No tocar nada de esta función
                }

                // LIMPIAR: función pendiente, se va a re-importar
                const actIdsRes = await client.query('SELECT id_asignacionact FROM asignacion_actividades WHERE id_funciones = $1', [fid]);
                const actIds = actIdsRes.rows.map(r => r.id_asignacionact);

                if (actIds.length > 0) {
                    await client.query(`
                        DELETE FROM evidencias WHERE id_indicadores IN (
                            SELECT i.id_indicadores FROM indicadores i
                            JOIN descripcion d ON i.id_descripcion = d.id_descripcion
                            WHERE d.id_asignacionact = ANY($1)
                        )
                    `, [actIds]);
                    await client.query(`
                        DELETE FROM indicadores WHERE id_descripcion IN (
                            SELECT id_descripcion FROM descripcion WHERE id_asignacionact = ANY($1)
                        )
                    `, [actIds]);
                    await client.query('DELETE FROM descripcion WHERE id_asignacionact = ANY($1)', [actIds]);
                    await client.query('DELETE FROM actividad_semana WHERE id_asignacionact = ANY($1)', [actIds]);
                    await client.query('DELETE FROM asignacion_actividades WHERE id_funciones = $1', [fid]);
                }

                await client.query('DELETE FROM usuario_asignacion WHERE id_usuario = $1 AND id_funciones = $2', [userId, fid]);
                const otrosRes = await client.query('SELECT COUNT(*) as cnt FROM usuario_asignacion WHERE id_funciones = $1', [fid]);
                if (parseInt(otrosRes.rows[0].cnt) === 0) {
                    const catCheck = await client.query(`
                        SELECT COUNT(*) as cnt FROM asignacion_actividades aa
                        JOIN descripcion d ON aa.id_asignacionact = d.id_asignacionact
                        WHERE aa.id_funciones = $1
                    `, [fid]);
                    if (parseInt(catCheck.rows[0].cnt) === 0) {
                        await client.query('DELETE FROM asignacion_funciones WHERE id_funciones = $1', [fid]);
                    }
                }
            }
        }

        // ============================================================
        // PASO 2: Procesar cada fila del Excel
        //         - Skipear filas cuya función ya está Aceptada
        //         - Insertar normalmente las pendientes/nuevas
        // ============================================================
        for (let i = 0; i < records.length; i++) {
            const row = normalizeObjectKeys(records[i]);
            
            const inscripcion = row['inscripcion'] || row['documento'];
            const asignaturas = row['asignaturas'] || row['espaciosacademicos'] || row['espacioacademico'];
            const semestreRaw = row['semestre'];
            const programasRaw = row['programas'];
            const horasRaw = row['horas'] || row['horassemana'] || row['horassemanales'];
            
            if (String(semestreRaw).toLowerCase() === 'total' || String(programasRaw).toLowerCase() === 'total' || String(row['docentes'] || '').toLowerCase() === 'total') continue;

            if (!inscripcion) {
                if (!programasRaw && !asignaturas) continue;
                errores.push(`Fila ${i+2}: No tiene campo Inscripción.`);
                continue;
            }

            const userRes = await client.query('SELECT id_usuario FROM usuarios WHERE numero_documento = $1', [String(inscripcion)]);
            if (userRes.rows.length === 0) {
                errores.push(`Fila ${i+2}: Docente con documento ${inscripcion} no encontrado.`);
                continue;
            }
            const idUsuario = userRes.rows[0].id_usuario;

            const { numero, grupo } = parseSemestre(semestreRaw);
            
            let idSemestre;
            const semRes = await client.query('SELECT id_semestre FROM semestres WHERE nombre_sem = $1', [numero]);
            if (semRes.rows.length > 0) {
                idSemestre = semRes.rows[0].id_semestre;
            } else {
                const newSem = await client.query('INSERT INTO semestres (id_pensulaca, nombre_sem) VALUES ($1, $2) RETURNING id_semestre', [idPensulAca, numero]);
                idSemestre = newSem.rows[0].id_semestre;
            }

            let idGrupo;
            const gruRes = await client.query('SELECT id_grupos FROM grupos WHERE nombre_grupo = $1', [grupo]);
            if (gruRes.rows.length > 0) {
                idGrupo = gruRes.rows[0].id_grupos;
            } else {
                const newGru = await client.query('INSERT INTO grupos (nombre_grupo, jornada) VALUES ($1, $2) RETURNING id_grupos', [grupo, 'Diurna']);
                idGrupo = newGru.rows[0].id_grupos;
            }

            const sgRes = await client.query('SELECT id_semestregrupo FROM semestres_grupos WHERE id_semestre = $1 AND id_grupos = $2', [idSemestre, idGrupo]);
            if (sgRes.rows.length === 0) {
                await client.query('INSERT INTO semestres_grupos (id_semestre, id_grupos, activo) VALUES ($1, $2, true)', [idSemestre, idGrupo]);
            }

            const funcionSustantivaStr = await mapFuncionSustantiva(client, programasRaw);
            
            // Verificar si esta función ya fue Aceptada por el docente
            const aceptadaKey = `${idUsuario}_${funcionSustantivaStr}`;
            if (funcionesAceptadas.has(aceptadaKey)) {
                // Ya fue aceptada, no tocar. Solo actualizar horas del bloque padre.
                const fidAceptado = funcionesAceptadas.get(aceptadaKey);
                // Las horas se recalculan al final
                continue;
            }

            // Buscar si el usuario ya tiene esta funcion asignada (creada en esta importación)
            let idFunciones;
            const funcAsigRes = await client.query(`
                SELECT af.id_funciones 
                FROM asignacion_funciones af
                JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
                WHERE ua.id_usuario = $1 AND af.funcion_sustantiva = $2
            `, [idUsuario, funcionSustantivaStr]);

            let horasActividad = parseFloat(horasRaw || 0);

            if (funcAsigRes.rows.length > 0) {
                idFunciones = funcAsigRes.rows[0].id_funciones;
                // No sumar horas aquí, se recalculan al final
            } else {
                const newFunc = await client.query(`
                    INSERT INTO asignacion_funciones (funcion_sustantiva, horas_funcion, estado_agenda, observaciones_generales) 
                    VALUES ($1, $2, $3, $4) RETURNING id_funciones
                `, [funcionSustantivaStr, 0, 'Pendiente', 'Asignado automáticamente vía Excel']);
                idFunciones = newFunc.rows[0].id_funciones;
                await client.query('INSERT INTO usuario_asignacion (id_usuario, id_funciones) VALUES ($1, $2)', [idUsuario, idFunciones]);
            }

            // Buscar o crear espacio académico
            let idEspacioAca = null;
            if (funcionSustantivaStr === 'Docencia Directa' && asignaturas) {
                const espRes = await client.query('SELECT id_espacio_aca FROM espacio_academico WHERE LOWER(nombre_espacio) = $1 AND id_semestre = $2 LIMIT 1', [String(asignaturas).toLowerCase().trim(), idSemestre]);
                if (espRes.rows.length > 0) {
                    idEspacioAca = espRes.rows[0].id_espacio_aca;
                } else {
                    const newEsp = await client.query('INSERT INTO espacio_academico (nombre_espacio, id_semestre, activo) VALUES ($1, $2, true) RETURNING id_espacio_aca', [String(asignaturas).trim(), idSemestre]);
                    idEspacioAca = newEsp.rows[0].id_espacio_aca;
                }
            } else if (asignaturas) {
                const espRes = await client.query('SELECT id_espacio_aca FROM espacio_academico WHERE LOWER(nombre_espacio) = $1 LIMIT 1', [String(asignaturas).toLowerCase().trim()]);
                if (espRes.rows.length > 0) {
                    idEspacioAca = espRes.rows[0].id_espacio_aca;
                }
            }

            // Determinar el rol seleccionado (Fuzzy Matching mejorado)
            let rolToInsert = asignaturas || '';
            
            // Fuzzy Matching: buscar en catálogo maestro (actividades Y descripciones)
            const matchResult = await buscarEnCatalogo(client, asignaturas, funcionSustantivaStr);
            console.log(`[IMPORT] Fila ${i+2}: Función="${funcionSustantivaStr}" | Asignatura="${asignaturas}" → Match=${matchResult ? matchResult.rolSeleccionado : 'NINGUNO'}`);
            if (matchResult) {
                rolToInsert = matchResult.rolSeleccionado;
            } else if (funcionSustantivaStr === 'Docencia Directa') {
                rolToInsert = semestreRaw || ''; // Guardamos "6E-N" aquí para mostrarlo en el frontend
            } else {
                // Si tiene catálogo pero no se encontró match, dejar vacío para que el docente elija
                const esFuncionCatalogo = await client.query(`
                    SELECT COUNT(*) as cnt FROM asignacion_funciones 
                    WHERE funcion_sustantiva = $1 
                    AND NOT EXISTS (SELECT 1 FROM usuario_asignacion ua WHERE ua.id_funciones = asignacion_funciones.id_funciones)
                `, [funcionSustantivaStr]);
                if (parseInt(esFuncionCatalogo.rows[0].cnt) > 0) {
                    rolToInsert = ''; // Tiene catálogo pero no hubo match
                }
            }

            await client.query(`
                INSERT INTO asignacion_actividades (id_funciones, id_espacio_aca, rol_seleccionado, horas_rol, orden)
                VALUES ($1, $2, $3, $4, $5)
            `, [idFunciones, idEspacioAca, rolToInsert, horasActividad, procesados + 1]);

            procesados++;
        }

        // Recalcular horas de cada función basado en la suma real de actividades
        await client.query(`
            UPDATE asignacion_funciones af
            SET horas_funcion = COALESCE(sub.total, 0)
            FROM (
                SELECT id_funciones, SUM(horas_rol) as total
                FROM asignacion_actividades
                GROUP BY id_funciones
            ) sub
            WHERE af.id_funciones = sub.id_funciones
            AND af.id_funciones IN (SELECT id_funciones FROM usuario_asignacion)
        `);

        await client.query('COMMIT');
        
        res.status(200).json({ 
            mensaje: 'Importación procesada correctamente',
            resultados: {
                procesados,
                conservados,
                erroresEncontrados: errores.length,
                detallesErrores: errores
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error importando Excel:", error);
        res.status(500).json({ error: 'Ocurrió un error general durante la importación.', detalles: error.message });
    } finally {
        client.release();
    }
};

// ================================================================
// actualizarImportacion:
// Solo AGREGA lo nuevo. No borra absolutamente nada.
// Si la función ya existe para el docente, agrega las actividades
// nuevas. Si no existe, la crea.
// ================================================================
const actualizarImportacion = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se subió ningún archivo Excel' });
    }

    const normalizeObjectKeys = (obj) => {
        const newObj = {};
        for (let key in obj) {
            const newKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            newObj[newKey] = obj[key];
        }
        return newObj;
    };

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const records = xlsx.utils.sheet_to_json(sheet);
        
        let procesados = 0;
        let omitidos = 0;
        let errores = [];

        const pensulRes = await client.query('SELECT id_pensulaca FROM pensul_academico WHERE activo = true LIMIT 1');
        const idPensulAca = pensulRes.rows.length > 0 ? pensulRes.rows[0].id_pensulaca : 1;

        // NO HAY PASO DE LIMPIEZA - Solo agregar

        for (let i = 0; i < records.length; i++) {
            const row = normalizeObjectKeys(records[i]);
            
            const inscripcion = row['inscripcion'] || row['documento'];
            const asignaturas = row['asignaturas'] || row['espaciosacademicos'] || row['espacioacademico'];
            const semestreRaw = row['semestre'];
            const programasRaw = row['programas'];
            const horasRaw = row['horas'] || row['horassemana'] || row['horassemanales'];
            
            if (String(semestreRaw).toLowerCase() === 'total' || String(programasRaw).toLowerCase() === 'total' || String(row['docentes'] || '').toLowerCase() === 'total') continue;

            if (!inscripcion) {
                if (!programasRaw && !asignaturas) continue;
                errores.push(`Fila ${i+2}: No tiene campo Inscripción.`);
                continue;
            }

            const userRes = await client.query('SELECT id_usuario FROM usuarios WHERE numero_documento = $1', [String(inscripcion)]);
            if (userRes.rows.length === 0) {
                errores.push(`Fila ${i+2}: Docente con documento ${inscripcion} no encontrado.`);
                continue;
            }
            const idUsuario = userRes.rows[0].id_usuario;

            // Semestre y Grupo
            const { numero, grupo } = parseSemestre(semestreRaw);
            let idSemestre;
            const semRes = await client.query('SELECT id_semestre FROM semestres WHERE nombre_sem = $1', [numero]);
            if (semRes.rows.length > 0) { idSemestre = semRes.rows[0].id_semestre; }
            else {
                const newSem = await client.query('INSERT INTO semestres (id_pensulaca, nombre_sem) VALUES ($1, $2) RETURNING id_semestre', [idPensulAca, numero]);
                idSemestre = newSem.rows[0].id_semestre;
            }
            let idGrupo;
            const gruRes = await client.query('SELECT id_grupos FROM grupos WHERE nombre_grupo = $1', [grupo]);
            if (gruRes.rows.length > 0) { idGrupo = gruRes.rows[0].id_grupos; }
            else {
                const newGru = await client.query('INSERT INTO grupos (nombre_grupo, jornada) VALUES ($1, $2) RETURNING id_grupos', [grupo, 'Diurna']);
                idGrupo = newGru.rows[0].id_grupos;
            }
            const sgRes = await client.query('SELECT id_semestregrupo FROM semestres_grupos WHERE id_semestre = $1 AND id_grupos = $2', [idSemestre, idGrupo]);
            if (sgRes.rows.length === 0) {
                await client.query('INSERT INTO semestres_grupos (id_semestre, id_grupos, activo) VALUES ($1, $2, true)', [idSemestre, idGrupo]);
            }

            // Función Sustantiva
            const funcionSustantivaStr = await mapFuncionSustantiva(client, programasRaw);

            // Buscar si el usuario ya tiene esta función
            let idFunciones;
            const funcAsigRes = await client.query(`
                SELECT af.id_funciones 
                FROM asignacion_funciones af
                JOIN usuario_asignacion ua ON ua.id_funciones = af.id_funciones
                WHERE ua.id_usuario = $1 AND af.funcion_sustantiva = $2
            `, [idUsuario, funcionSustantivaStr]);

            let horasActividad = parseFloat(horasRaw || 0);

            if (funcAsigRes.rows.length > 0) {
                idFunciones = funcAsigRes.rows[0].id_funciones;
                // No sumar horas aquí, se recalculan al final
            } else {
                // Crear nueva función
                const newFunc = await client.query(`
                    INSERT INTO asignacion_funciones (funcion_sustantiva, horas_funcion, estado_agenda, observaciones_generales) 
                    VALUES ($1, $2, $3, $4) RETURNING id_funciones
                `, [funcionSustantivaStr, 0, 'Pendiente', 'Agregado vía actualización Excel']);
                idFunciones = newFunc.rows[0].id_funciones;
                await client.query('INSERT INTO usuario_asignacion (id_usuario, id_funciones) VALUES ($1, $2)', [idUsuario, idFunciones]);
            }

            // Buscar o crear espacio académico
            let idEspacioAca = null;
            if (funcionSustantivaStr === 'Docencia Directa' && asignaturas) {
                const espRes = await client.query('SELECT id_espacio_aca FROM espacio_academico WHERE LOWER(nombre_espacio) = $1 AND id_semestre = $2 LIMIT 1', [String(asignaturas).toLowerCase().trim(), idSemestre]);
                if (espRes.rows.length > 0) {
                    idEspacioAca = espRes.rows[0].id_espacio_aca;
                } else {
                    const newEsp = await client.query('INSERT INTO espacio_academico (nombre_espacio, id_semestre, activo) VALUES ($1, $2, true) RETURNING id_espacio_aca', [String(asignaturas).trim(), idSemestre]);
                    idEspacioAca = newEsp.rows[0].id_espacio_aca;
                }
            } else if (asignaturas) {
                const espRes = await client.query('SELECT id_espacio_aca FROM espacio_academico WHERE LOWER(nombre_espacio) = $1 LIMIT 1', [String(asignaturas).toLowerCase().trim()]);
                if (espRes.rows.length > 0) {
                    idEspacioAca = espRes.rows[0].id_espacio_aca;
                }
            }

            // Fuzzy Matching: buscar en catálogo maestro (actividades Y descripciones)
            let rolToInsert = asignaturas || '';
            const matchResult = await buscarEnCatalogo(client, asignaturas, funcionSustantivaStr);
            console.log(`[ACTUALIZAR] Fila ${i+2}: Función="${funcionSustantivaStr}" | Asignatura="${asignaturas}" → Match=${matchResult ? matchResult.rolSeleccionado : 'NINGUNO'}`);
            if (matchResult) {
                rolToInsert = matchResult.rolSeleccionado;
            } else if (funcionSustantivaStr === 'Docencia Directa') {
                rolToInsert = semestreRaw || ''; // Guardamos "6E-N" aquí para mostrarlo en el frontend
            } else {
                const esFuncionCatalogo = await client.query(`
                    SELECT COUNT(*) as cnt FROM asignacion_funciones 
                    WHERE funcion_sustantiva = $1 
                    AND NOT EXISTS (SELECT 1 FROM usuario_asignacion ua WHERE ua.id_funciones = asignacion_funciones.id_funciones)
                `, [funcionSustantivaStr]);
                if (parseInt(esFuncionCatalogo.rows[0].cnt) > 0) {
                    rolToInsert = '';
                }
            }

            // Verificar si esta actividad exacta ya existe para no duplicar
            const actExiste = await client.query(`
                SELECT id_asignacionact FROM asignacion_actividades 
                WHERE id_funciones = $1 AND LOWER(COALESCE(rol_seleccionado,'')) = LOWER($2) AND horas_rol = $3
            `, [idFunciones, rolToInsert, horasActividad]);

            if (actExiste.rows.length > 0) {
                omitidos++;
                continue; // Ya existe, no duplicar
            }

            // Insertar actividad nueva
            await client.query(`
                INSERT INTO asignacion_actividades (id_funciones, id_espacio_aca, rol_seleccionado, horas_rol, orden)
                VALUES ($1, $2, $3, $4, $5)
            `, [idFunciones, idEspacioAca, rolToInsert, horasActividad, procesados + 1]);

            procesados++;
        }

        // Recalcular horas de cada función basado en la suma real de actividades
        await client.query(`
            UPDATE asignacion_funciones af
            SET horas_funcion = COALESCE(sub.total, 0)
            FROM (
                SELECT id_funciones, SUM(horas_rol) as total
                FROM asignacion_actividades
                GROUP BY id_funciones
            ) sub
            WHERE af.id_funciones = sub.id_funciones
            AND af.id_funciones IN (SELECT id_funciones FROM usuario_asignacion)
        `);

        await client.query('COMMIT');
        
        res.status(200).json({ 
            mensaje: 'Actualización procesada correctamente',
            resultados: {
                procesados,
                omitidos,
                erroresEncontrados: errores.length,
                detallesErrores: errores
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error actualizando importación:", error);
        res.status(500).json({ error: 'Ocurrió un error durante la actualización.', detalles: error.message });
    } finally {
        client.release();
    }
};

module.exports = { importarAsignaciones, actualizarImportacion };
