const pool = require('./db/connection');

async function migrate() {
    try {
        console.log('Migrando tabla semana...');
        
        await pool.query('ALTER TABLE semana ADD COLUMN IF NOT EXISTS fecha_inicio DATE');
        await pool.query('ALTER TABLE semana ADD COLUMN IF NOT EXISTS fecha_fin DATE');
        
        const res = await pool.query("SELECT * FROM semana WHERE numero_semana = '0'");
        if (res.rows.length === 0) {
            await pool.query("INSERT INTO semana (numero_semana, etiqueta, habilitada) VALUES ('0', 'Semana 0 (Planeación)', false)");
        }
        
        console.log('Migración completa.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

migrate();
