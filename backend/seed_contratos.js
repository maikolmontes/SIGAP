require('dotenv').config();
const pool = require('./db/connection');

async function seedContratos() {
    try {
        await pool.query(`
            INSERT INTO tipo_contrato (id_contrato, tipo, horas_contrato, activo) 
            VALUES 
                (1, 'Tiempo Completo', 40, true),
                (2, 'Medio Tiempo', 20, true),
                (3, 'Hora Cátedra', 0, true),
                (4, 'Por Definir', 0, true)
            ON CONFLICT (id_contrato) DO UPDATE 
            SET tipo = EXCLUDED.tipo, horas_contrato = EXCLUDED.horas_contrato;
        `);
        
        // Ajustar secuencia de la tabla si existe
        await pool.query(`SELECT setval(pg_get_serial_sequence('tipo_contrato', 'id_contrato'), (SELECT MAX(id_contrato) FROM tipo_contrato));`);

        const res = await pool.query('SELECT * FROM tipo_contrato ORDER BY id_contrato');
        console.log('✅ tipo_contrato actualizado en PostgreSQL:');
        console.log(res.rows);
    } catch (err) {
        console.error('Error al actualizar tipo_contrato:', err);
    } finally {
        process.exit(0);
    }
}

seedContratos();
