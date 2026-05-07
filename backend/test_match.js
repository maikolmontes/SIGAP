const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'PruebaDB',
  password: 'postgres',
  port: 5432,
});

const normalizeString = (s) => String(s || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const fuzzyMatch = (excelStr, dbStr) => {
    const excelNorm = normalizeString(excelStr);
    const dbNorm = normalizeString(dbStr);
    
    if (excelNorm === dbNorm) return true;
    if (excelNorm.includes(dbNorm) || dbNorm.includes(excelNorm)) return true;
    
    const stopWords = new Set(['de', 'la', 'el', 'los', 'las', 'del', 'en', 'y', 'a', 'e', 'o', 'u', 'por', 'para', 'con', 'cual']);
    const getKeywords = (s) => s.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    
    const excelWords = getKeywords(excelNorm);
    const dbWords = getKeywords(dbNorm);
    
    if (excelWords.length === 0 || dbWords.length === 0) return false;
    
    let matchCount = 0;
    for (const ew of excelWords) {
        for (const dw of dbWords) {
            if (ew.includes(dw) || dw.includes(ew)) {
                matchCount++;
                break;
            }
        }
    }
    
    const threshold = Math.min(2, Math.ceil(excelWords.length * 0.5));
    return matchCount >= threshold;
};

const calcFuzzyScore = (excelStr, dbStr) => {
    const stopWords = new Set(['de', 'la', 'el', 'los', 'las', 'del', 'en', 'y', 'a', 'e', 'o', 'u', 'por', 'para', 'con', 'cual']);
    const getKeywords = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    
    const excelWords = getKeywords(excelStr);
    const dbWords = getKeywords(dbStr);
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

async function run() {
    const client = await pool.connect();
    const catalogIdFunc = 1; // Assuming Investigación has some ID
    const catActsRes = await client.query(
        "SELECT DISTINCT rol_seleccionado FROM asignacion_actividades WHERE id_funciones = (SELECT id_funciones FROM asignacion_funciones WHERE funcion_sustantiva = 'Investigación' AND NOT EXISTS (SELECT 1 FROM usuario_asignacion ua WHERE ua.id_funciones = asignacion_funciones.id_funciones) LIMIT 1)"
    );
    
    const asignaturas = 'CO-INVESTIGADOR';
    let bestMatch = '';
    let bestScore = 0;
    
    for (const ca of catActsRes.rows) {
        const dbRol = ca.rol_seleccionado;
        if (fuzzyMatch(asignaturas, dbRol)) {
            const score = calcFuzzyScore(asignaturas, dbRol);
            console.log(`Matched: ${dbRol} | Score: ${score}`);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = dbRol;
            }
        }
    }
    console.log("BEST MATCH:", bestMatch);
    client.release();
    pool.end();
}
run();
