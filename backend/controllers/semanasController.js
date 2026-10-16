const pool = require('../db/connection');
const { etiquetaSemestre, etiquetaCorte } = require('../utils/periodo');
const { estadoDeSemana, diasHasta } = require('../utils/semanaAbierta');
const notificaciones = require('../services/notificacionesService');

// El correo a todos los docentes es masivo: solo sale con EMAIL_AVISO_SEMANAS=true o si Planeación lo pide con { notificar: true }.
// La campana avisa siempre.
const debeAvisarPorCorreo = (req) =>
    String(process.env.EMAIL_AVISO_SEMANAS).toLowerCase() === 'true' || (req.body && req.body.notificar === true);

const getAll = async (req, res) => {
    try {
        const periodoActivoRes = await pool.query('SELECT id_periodo, anio, semestre FROM periodo WHERE activo = TRUE');
        if (periodoActivoRes.rows.length === 0) {
             return res.json([]); // No hay periodo activo
        }
        
        const id_periodo = periodoActivoRes.rows[0].id_periodo;
        const anio = periodoActivoRes.rows[0].anio;
        const semestre = periodoActivoRes.rows[0].semestre;
        const sem = etiquetaSemestre(semestre);
        const etiquetaSuffix = `- ${anio} ${sem}`;

        let result = await pool.query('SELECT * FROM semana WHERE id_periodo = $1 ORDER BY numero_semana::int ASC', [id_periodo]);
        
        // Si no existen semanas para este periodo activo, las creamos automáticamente
        if (result.rows.length === 0) {
             await pool.query(`INSERT INTO semana (numero_semana, etiqueta, habilitada, id_periodo) VALUES ('0', 'Semana 0 (Planeación) ${etiquetaSuffix}', false, $1)`, [id_periodo]);
             await pool.query(`INSERT INTO semana (numero_semana, etiqueta, habilitada, id_periodo) VALUES ('8', '${etiquetaCorte(8, semestre)} ${etiquetaSuffix}', false, $1)`, [id_periodo]);
             await pool.query(`INSERT INTO semana (numero_semana, etiqueta, habilitada, id_periodo) VALUES ('16', '${etiquetaCorte(16, semestre)} ${etiquetaSuffix}', false, $1)`, [id_periodo]);
             
             result = await pool.query('SELECT * FROM semana WHERE id_periodo = $1 ORDER BY numero_semana::int ASC', [id_periodo]);
        }
        
        // Cada semana indica si está abierta HOY (habilitada y dentro de sus fechas) y, si no, por qué.
        // Es la misma regla que aplica el servidor al guardar: las pantallas solo la muestran.
        res.json(result.rows.map((fila) => {
            const estado = estadoDeSemana(fila, { semestre });
            // cierra_el ("AAAA-MM-DD") y dias_para_cierre (0 = cierra hoy) le dicen al docente cuánto tiempo le queda
            return {
                ...fila,
                abierta: estado.abierta,
                motivo_cierre: estado.motivo,
                mensaje_cierre: estado.mensaje,
                cierra_el: estado.fecha_fin || null,
                dias_para_cierre: estado.fecha_fin ? diasHasta(estado.fecha_fin) : null,
            };
        }));
    } catch (error) {
        console.error('Error al obtener semanas:', error);
        res.status(500).json({ error: 'Error interno.' });
    }
};

const updateSemanas = async (req, res) => {
    const { semanas } = req.body;
    try {
        // Qué semanas del período activo estaban cerradas antes de este guardado: las que pasen a habilitadas se avisan
        const ids = (semanas || []).map((s) => Number(s.id_semana)).filter((n) => Number.isInteger(n));
        const antes = ids.length === 0 ? { rows: [] } : await pool.query(
            `SELECT s.id_semana, s.habilitada FROM semana s JOIN periodo p ON p.id_periodo = s.id_periodo
             WHERE p.activo = TRUE AND s.id_semana = ANY($1::int[])`, [ids]);
        const estabaCerrada = new Map(antes.rows.map((r) => [Number(r.id_semana), !r.habilitada]));

        for (const s of semanas) {
            await pool.query(
                'UPDATE semana SET habilitada = $1, fecha_inicio = $2, fecha_fin = $3 WHERE id_semana = $4', 
                [s.habilitada, s.fecha_inicio || null, s.fecha_fin || null, s.id_semana]
            );
        }
        const recienHabilitadas = semanas.filter((s) => s.habilitada === true && estabaCerrada.get(Number(s.id_semana)) === true);
        if (recienHabilitadas.length > 0) {
            await notificaciones.background.semanaHabilitadaAhora({
                semanas: recienHabilitadas, idRemitente: req.user?.id, correo: debeAvisarPorCorreo(req),
            });
        }

        res.json({ message: 'Semanas actualizadas correctamente.' });
    } catch (error) {
        console.error('Error al actualizar semanas:', error);
        res.status(500).json({ error: 'Error interno.' });
    }
};

module.exports = { getAll, updateSemanas };
