const { Pool } = require('pg');
require('dotenv').config();

const isLocalhost = !process.env.DB_HOST || process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1';
const useSSL = process.env.DB_SSL === 'true' || (!isLocalhost && process.env.DB_SSL !== 'false');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: useSSL ? { rejectUnauthorized: false } : false
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('Error conectando a PostgreSQL:', err.message);
        return;
    }
    console.log('Conectado a PostgreSQL correctamente');
    release();
});

module.exports = pool;