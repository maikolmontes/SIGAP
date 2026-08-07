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
        const tables = ['facultad', 'programa_academico'];
        for (const t of tables) {
            const r = await pool.query(
                `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${t}'`
            );
            console.log(`\n== ${t} ==`);
            r.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));
        }

        const f = await pool.query('SELECT * FROM facultad');
        console.log('\n== facultad (filas) ==');
        console.log(f.rows);

        const p = await pool.query('SELECT * FROM programa_academico');
        console.log('\n== programa_academico (filas) ==');
        console.log(p.rows);

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        pool.end();
    }
}

checkSchema();
