const pool = require('./db/connection');

async function checkNullability() {
    try {
        const res = await pool.query(
            "SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'usuarios'"
        );
        console.log('COLUMNS OF usuarios:');
        console.log(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkNullability();
