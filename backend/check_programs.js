const pool = require('./db/connection');

async function check() {
    try {
        const progs = await pool.query('SELECT * FROM programa_academico');
        console.log('PROGRAMAS ACADEMICOS:');
        console.log(progs.rows);

        const facs = await pool.query('SELECT * FROM facultad');
        console.log('FACULTADES:');
        console.log(facs.rows);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

check();
