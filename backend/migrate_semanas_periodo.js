const pool = require('./db/connection');

async function migrate() {
    try {
        console.log('Migrando tabla semana con id_periodo...');
        
        await pool.query('ALTER TABLE semana ADD COLUMN IF NOT EXISTS id_periodo INT REFERENCES periodo(id_periodo)');
        
        // Asignar el id_periodo activo a las semanas existentes (para no perder datos)
        const activoRes = await pool.query('SELECT id_periodo FROM periodo WHERE activo = TRUE');
        if (activoRes.rows.length > 0) {
            const id = activoRes.rows[0].id_periodo;
            await pool.query('UPDATE semana SET id_periodo = $1 WHERE id_periodo IS NULL', [id]);
        }
        
        console.log('Migración completa.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

migrate();
