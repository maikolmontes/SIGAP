require('dotenv').config();
const pool = require('./db/connection');

async function migrate() {
    try {
        console.log('Iniciando migración de reporte de avance...');
        
        // Agregar columnas a la tabla indicadores
        await pool.query(`
            ALTER TABLE indicadores 
            ADD COLUMN IF NOT EXISTS ejecucion_8 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS ejecucion_16 INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS observaciones TEXT DEFAULT '';
        `);
        
        console.log('Migración completada exitosamente.');
        process.exit(0);
    } catch (error) {
        console.error('Error en la migración:', error);
        process.exit(1);
    }
}

migrate();
