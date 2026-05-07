const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'PruebaDB',
  password: 'postgres',
  port: 5432,
});

async function run() {
    const client = await pool.connect();
    const keywordMap = [
        { keywords: ['investigacion', 'investigación'], funcion: null },
        { keywords: ['admin'], funcion: null },
        { keywords: ['calidad', 'aseguramiento'], funcion: null },
        { keywords: ['indirecta'], funcion: null },
        { keywords: ['vicerrectoria', 'vicerrectoría', 'proyeccion', 'proyección'], funcion: null },
    ];
    
    const catalogRes = await client.query(`
        SELECT DISTINCT funcion_sustantiva FROM asignacion_funciones
        WHERE NOT EXISTS (SELECT 1 FROM usuario_asignacion ua WHERE ua.id_funciones = asignacion_funciones.id_funciones)
    `);
    
    for (const catRow of catalogRes.rows) {
        const catLower = catRow.funcion_sustantiva.toLowerCase();
        for (const km of keywordMap) {
            if (km.keywords.some(kw => catLower.includes(kw))) {
                km.funcion = catRow.funcion_sustantiva;
                break;
            }
        }
    }
    
    console.log("KeywordMap mapping:", keywordMap.map(k => k.funcion));

    const progStr = 'Horas de Proyeccion institucional';
    const asigStr = 'ACOMPAÑAMIENTO INTEGRAL';
    const combinedLower = `${progStr} ${asigStr}`.toLowerCase();
    
    let res = null;
    for (const km of keywordMap) {
        if (km.funcion && km.keywords.some(kw => combinedLower.includes(kw))) {
            res = km.funcion;
            break;
        }
    }
    console.log("Result:", res);
    
    client.release();
    pool.end();
}
run();
