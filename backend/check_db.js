require('dotenv').config();
const pool = require('./db/connection');
async function check() {
    try {
        const res = await pool.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name IN ('usuario_asignacion', 'asignacion_funciones', 'asignacion_actividades', 'descripcion', 'indicadores');
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
