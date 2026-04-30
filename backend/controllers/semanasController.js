const pool = require('../db/connection');

const getAll = async (req, res) => {
    try {
        const periodoActivoRes = await pool.query('SELECT id_periodo, anio, semestre FROM periodo WHERE activo = TRUE');
        if (periodoActivoRes.rows.length === 0) {
             return res.json([]); // No hay periodo activo
        }
        
        const id_periodo = periodoActivoRes.rows[0].id_periodo;
        const anio = periodoActivoRes.rows[0].anio;
        const sem = periodoActivoRes.rows[0].semestre === 1 ? 'I' : 'II';
        const etiquetaSuffix = `- ${anio} ${sem}`;

        let result = await pool.query('SELECT * FROM semana WHERE id_periodo = $1 ORDER BY numero_semana::int ASC', [id_periodo]);
        
        // Si no existen semanas para este periodo activo, las creamos automáticamente
        if (result.rows.length === 0) {
             await pool.query(`INSERT INTO semana (numero_semana, etiqueta, habilitada, id_periodo) VALUES ('0', 'Semana 0 (Planeación) ${etiquetaSuffix}', false, $1)`, [id_periodo]);
             await pool.query(`INSERT INTO semana (numero_semana, etiqueta, habilitada, id_periodo) VALUES ('8', 'Semana 8 ${etiquetaSuffix}', false, $1)`, [id_periodo]);
             await pool.query(`INSERT INTO semana (numero_semana, etiqueta, habilitada, id_periodo) VALUES ('16', 'Semana 16 ${etiquetaSuffix}', false, $1)`, [id_periodo]);
             
             result = await pool.query('SELECT * FROM semana WHERE id_periodo = $1 ORDER BY numero_semana::int ASC', [id_periodo]);
        }
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener semanas:', error);
        res.status(500).json({ error: 'Error interno.' });
    }
};

const updateSemanas = async (req, res) => {
    const { semanas } = req.body;
    try {
        for (const s of semanas) {
            await pool.query(
                'UPDATE semana SET habilitada = $1, fecha_inicio = $2, fecha_fin = $3 WHERE id_semana = $4', 
                [s.habilitada, s.fecha_inicio || null, s.fecha_fin || null, s.id_semana]
            );
        }
        res.json({ message: 'Semanas actualizadas correctamente.' });
    } catch (error) {
        console.error('Error al actualizar semanas:', error);
        res.status(500).json({ error: 'Error interno.' });
    }
};

module.exports = { getAll, updateSemanas };
