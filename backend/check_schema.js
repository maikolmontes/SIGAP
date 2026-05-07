const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkSchema() {
    try {
        const tables = ['usuario_asignacion', 'indicadores', 'asignacion_funciones', 'asignacion_actividades', 'descripcion'];
        for (const t of tables) {
            const r = await pool.query(
                `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${t}'`
            );
            console.log(`\n== ${t} ==`);
            r.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));
        }

        // Verificar si hay usuarios en la BD
        const u = await pool.query('SELECT id_usuario, nombres FROM usuarios LIMIT 3');
        console.log('\n== usuarios (muestra) ==');
        u.rows.forEach(row => console.log(`  id: ${row.id_usuario}, nombre: ${row.nombres}`));

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        pool.end();
    }
}

checkSchema();
