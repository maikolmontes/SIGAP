// ¿Está abierta una semana (corte) para que el docente registre algo?
//
// Una semana está ABIERTA solo si Planeación la dejó habilitada Y hoy cae dentro de sus fechas:
//   · habilitada = interruptor de Planeación en "Gestión de Semanas".
//   · fecha_inicio / fecha_fin = rango del corte (los dos días cuentan). Si una fecha está vacía, ese
//     extremo no limita: sin fecha de cierre la semana queda abierta mientras esté habilitada.
// Pasada la fecha de cierre el docente solo puede CONSULTAR: no guarda agenda ni avance, ni sube ni borra evidencias.
//
// "Hoy" se calcula en la hora de Colombia (el servidor de Vercel corre en UTC y de noche ya estaría en el día siguiente).
const pool = require('../db/connection');
const { etiquetaCorte } = require('./periodo');

const ZONA = 'America/Bogota';

/** Fecha de hoy en Colombia como "AAAA-MM-DD". */
const hoyEnColombia = (ahora = new Date()) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);

/** Convierte lo que devuelve pg (Date o texto) en "AAAA-MM-DD"; null si no hay fecha. */
const fechaTexto = (valor) => {
    if (!valor) return null;
    if (valor instanceof Date) {
        const dos = (n) => String(n).padStart(2, '0');
        return `${valor.getFullYear()}-${dos(valor.getMonth() + 1)}-${dos(valor.getDate())}`;
    }
    const texto = String(valor).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : null;
};

const fechaLarga = (aaaammdd) => {
    const [a, m, d] = aaaammdd.split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
};

/**
 * Estado de una fila de la tabla semana.
 * motivo: null (abierta) | 'deshabilitada' | 'no_inicia' | 'cerrada' | 'sin_semana'
 */
const estadoDeSemana = (semana, { hoy = hoyEnColombia(), semestre = null } = {}) => {
    if (!semana) return { abierta: false, motivo: 'sin_semana', mensaje: 'La semana no está configurada para el período activo.' };

    const nombre = etiquetaCorte(semana.numero_semana, semestre);
    const inicio = fechaTexto(semana.fecha_inicio);
    const fin = fechaTexto(semana.fecha_fin);
    const base = { fecha_inicio: inicio, fecha_fin: fin };

    if (!semana.habilitada) return { ...base, abierta: false, motivo: 'deshabilitada', mensaje: `La ${nombre} no está habilitada en este momento.` };
    if (inicio && hoy < inicio) return { ...base, abierta: false, motivo: 'no_inicia', mensaje: `La ${nombre} inicia el ${fechaLarga(inicio)}.` };
    if (fin && hoy > fin) return { ...base, abierta: false, motivo: 'cerrada', mensaje: `La ${nombre} cerró el ${fechaLarga(fin)}. Solo puedes consultarla.` };
    return { ...base, abierta: true, motivo: null, mensaje: null };
};

/**
 * Estado de la semana "numero" ('0', '8' o '16') de un período (por omisión, el activo).
 * Si no hay fila de esa semana, queda cerrada.
 */
const verificarSemana = async (numero, idPeriodo = null, db = pool) => {
    const fila = (await db.query(
        `SELECT s.numero_semana, s.habilitada, s.fecha_inicio, s.fecha_fin, p.semestre
         FROM semana s
         JOIN periodo p ON p.id_periodo = s.id_periodo
         WHERE s.numero_semana = $1
           AND s.id_periodo = COALESCE($2, (SELECT id_periodo FROM periodo WHERE activo = TRUE LIMIT 1))
         LIMIT 1`,
        [String(numero), idPeriodo]
    )).rows[0];
    return estadoDeSemana(fila, { semestre: fila?.semestre });
};

module.exports = { estadoDeSemana, verificarSemana, hoyEnColombia, fechaTexto };
