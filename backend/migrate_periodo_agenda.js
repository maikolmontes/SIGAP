const pool = require('./db/connection');

async function migrate() {
    try {
        console.log('Iniciando migración de id_periodo en asignacion_funciones...');
        
        // 1. Verificar si la columna ya existe
        const checkCol = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='asignacion_funciones' AND column_name='id_periodo'
        `);
        
        if (checkCol.rows.length === 0) {
            console.log('Añadiendo columna id_periodo...');
            await pool.query('ALTER TABLE asignacion_funciones ADD COLUMN id_periodo INT REFERENCES periodo(id_periodo)');
            
            // 2. Obtener el periodo activo actual para asignar a los registros existentes
            const periodoRes = await pool.query('SELECT id_periodo FROM periodo WHERE activo = true LIMIT 1');
            if (periodoRes.rows.length > 0) {
                const idPeriodoActivo = periodoRes.rows[0].id_periodo;
                console.log(`Asignando id_periodo = ${idPeriodoActivo} a los registros existentes...`);
                await pool.query('UPDATE asignacion_funciones SET id_periodo = $1 WHERE id_periodo IS NULL', [idPeriodoActivo]);
            } else {
                console.log('No hay periodo activo, buscando el último periodo creado...');
                const lastPeriodoRes = await pool.query('SELECT id_periodo FROM periodo ORDER BY id_periodo DESC LIMIT 1');
                if (lastPeriodoRes.rows.length > 0) {
                    const idPeriodo = lastPeriodoRes.rows[0].id_periodo;
                    console.log(`Asignando id_periodo = ${idPeriodo} a los registros existentes...`);
                    await pool.query('UPDATE asignacion_funciones SET id_periodo = $1 WHERE id_periodo IS NULL', [idPeriodo]);
                }
            }
            console.log('Migración completada exitosamente.');
        } else {
            console.log('La columna id_periodo ya existe en asignacion_funciones.');
        }
    } catch (error) {
        console.error('Error en migración:', error);
    } finally {
        process.exit();
    }
}

migrate();
