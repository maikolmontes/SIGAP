// ================================================================
// SIGAP — Tareas programadas (recordatorios automáticos de plazo)
// ----------------------------------------------------------------
// Avisa a los docentes con agenda pendiente o devuelta cuando faltan
// ciertos días para el cierre del período activo.
//
// Es un correo MASIVO, así que está desactivado por defecto y se activa en el
// .env, igual que el aviso de apertura de período:
//
//   EMAIL_RECORDATORIOS_AUTO=true     activa la tarea
//   EMAIL_RECORDATORIOS_DIAS=7,3,1    con cuántos días de anticipación avisar
//   EMAIL_RECORDATORIOS_HORA=8        hora local del servidor (0-23)
//
// Un mismo docente recibe como máximo un recordatorio por día: la
// deduplicación vive en notificarRecordatorioPlazo (bitácora), así que
// reiniciar el servidor o ejecutar la tarea dos veces no repite correos.
//
// Solo corre en un servidor de larga duración (no en entornos serverless).
// ================================================================
const pool = require('../db/connection');
const notificaciones = require('./notificacionesService');

const MS_DIA = 1000 * 60 * 60 * 24;
const INTERVALO_REVISION_MS = 30 * 60 * 1000; // revisa cada 30 minutos

// Días enteros que faltan hasta la fecha de fin (0 = termina hoy, negativo = ya cerró)
const diasRestantes = (fechaFin, hoy = new Date()) => {
    if (!fechaFin) return null;
    const fin = new Date(fechaFin);
    if (isNaN(fin.getTime())) return null;
    const inicioDeDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return Math.round((inicioDeDia(fin) - inicioDeDia(hoy)) / MS_DIA);
};

const leerDias = (texto = '7,3,1') =>
    String(texto)
        .split(',')
        .map((d) => parseInt(d.trim(), 10))
        .filter((d) => Number.isInteger(d) && d >= 0);

// ¿Hoy toca avisar? (pura: se prueba sin base de datos)
const debeEnviarHoy = (faltan, dias) => faltan !== null && dias.includes(faltan);

let ultimoDiaEjecutado = null;

const revisar = async (ahora = new Date()) => {
    const hora = parseInt(process.env.EMAIL_RECORDATORIOS_HORA || '8', 10);
    if (ahora.getHours() < hora) return { ejecutado: false, motivo: 'antes_de_la_hora' };

    const hoy = ahora.toISOString().slice(0, 10);
    if (ultimoDiaEjecutado === hoy) return { ejecutado: false, motivo: 'ya_ejecutado_hoy' };

    const periodo = (await pool.query(
        'SELECT id_periodo, fecha_fin FROM periodo WHERE activo = TRUE LIMIT 1'
    )).rows[0];
    if (!periodo) return { ejecutado: false, motivo: 'sin_periodo_activo' };

    const faltan = diasRestantes(periodo.fecha_fin, ahora);
    const dias = leerDias(process.env.EMAIL_RECORDATORIOS_DIAS);
    ultimoDiaEjecutado = hoy; // se marca aunque hoy no toque, para no consultar de nuevo

    if (!debeEnviarHoy(faltan, dias)) return { ejecutado: false, motivo: 'hoy_no_toca', faltan };

    const resultado = await notificaciones.notificarRecordatorioPlazo({});
    console.log(`[programador] Recordatorios (faltan ${faltan} días): ${resultado.enviados || 0} enviados, ${resultado.omitidos || 0} omitidos.`);
    return { ejecutado: true, faltan, resultado };
};

const iniciar = () => {
    if (String(process.env.EMAIL_RECORDATORIOS_AUTO).toLowerCase() !== 'true') return null;
    if (process.env.VERCEL) return null; // serverless: no hay proceso permanente

    console.log(
        `[programador] Recordatorios automáticos ACTIVOS: avisan con ${leerDias(process.env.EMAIL_RECORDATORIOS_DIAS).join(', ')} día(s) ` +
        `de anticipación a partir de las ${process.env.EMAIL_RECORDATORIOS_HORA || 8}:00.`
    );

    const tick = () => revisar().catch((error) =>
        console.error('[programador] La revisión de recordatorios falló:', error.message));

    tick();
    const temporizador = setInterval(tick, INTERVALO_REVISION_MS);
    temporizador.unref(); // no impide que el proceso termine
    return temporizador;
};

module.exports = { iniciar, revisar, diasRestantes, leerDias, debeEnviarHoy };
