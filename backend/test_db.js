const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'").then(res => {
    console.log("TABLES:", res.rows.map(r => r.table_name).join(', '));
    
    // Check structure of periodos or similar table
    pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name LIKE '%periodo%'").then(res2 => {
        console.log("PERIODO COLUMNS:", res2.rows);
        process.exit(0);
    });
}).catch(err => {
    console.error(err);
    process.exit(1);
});
