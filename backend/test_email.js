// ================================================================
// SIGAP — Script de diagnóstico del servicio de correo
// ----------------------------------------------------------------
// Uso:
//   node test_email.js                      -> solo verifica la conexión SMTP
//   node test_email.js correo@dominio.com   -> verifica y envía un correo de prueba
//   node test_email.js correo@dominio.com todas
//        -> envía una muestra de TODAS las plantillas (revisión de diseño)
// ================================================================

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { sendEmail, verificarConexion, estaHabilitado } = require('./services/emailService');
const plantillas = require('./utils/emailTemplates');

const destino = process.argv[2];
const modo = (process.argv[3] || '').toLowerCase();

const muestras = () => [
    plantillas.plantillaPrueba({ solicitante: 'test_email.js' }),
    plantillas.plantillaAgendaEnviada({
        director: 'Carlos Ramírez',
        docente: 'Ana María López',
        programa: 'Ingeniería de Sistemas',
        periodo: '2026-I',
        totalFunciones: 5
    }),
    plantillas.plantillaAgendaAprobada({
        docente: 'Ana María López',
        director: 'Carlos Ramírez',
        periodo: '2026-I',
        programa: 'Ingeniería de Sistemas',
        totalHoras: 40
    }),
    plantillas.plantillaAgendaDevuelta({
        docente: 'Ana María López',
        director: 'Carlos Ramírez',
        periodo: '2026-I',
        fechaLimite: '30 de junio de 2026',
        observaciones:
            'Las metas de la función de Investigación no son medibles.\nAjuste el indicador 2 y vuelva a radicar la agenda.'
    }),
    plantillas.plantillaBienvenida({
        usuario: 'Ana María López',
        correo: 'ana.lopez@cesmag.edu.co',
        roles: 'Docente',
        programa: 'Ingeniería de Sistemas'
    }),
    plantillas.plantillaPeriodoAperturado({
        nombre: 'Ana María López',
        periodo: '2026-I',
        fechaInicio: '02 de febrero de 2026',
        fechaFin: '12 de junio de 2026'
    }),
    plantillas.plantillaRecordatorioPlazo({
        docente: 'Ana María López',
        periodo: '2026-I',
        estadoAgenda: 'Borrador / sin radicar',
        fechaLimite: '12 de junio de 2026',
        diasRestantes: 2
    }),
    plantillas.plantillaAsignacionesCargadas({
        docente: 'Ana María López',
        periodo: '2026-I',
        totalEspacios: 6
    })
];

(async () => {
    console.log('--- Diagnóstico de correo SIGAP ---');
    console.log('Servicio habilitado :', estaHabilitado());
    console.log('Host                :', process.env.EMAIL_HOST || 'smtp.gmail.com');
    console.log('Puerto              :', process.env.EMAIL_PORT || '465');
    console.log('Remitente           :', process.env.EMAIL_USER || '(sin configurar)');
    console.log('FRONTEND_URL        :', process.env.FRONTEND_URL || 'http://localhost:5173');
    console.log('-----------------------------------');

    const conectado = await verificarConexion();
    if (!conectado) {
        console.error('\nNo se pudo conectar al servidor SMTP. Revise EMAIL_USER / EMAIL_PASS en el .env.');
        process.exit(1);
    }

    if (!destino) {
        console.log('\nConexión correcta. Para enviar un correo de prueba ejecute:');
        console.log('   node test_email.js su.correo@cesmag.edu.co');
        process.exit(0);
    }

    const aEnviar = modo === 'todas' ? muestras() : [plantillas.plantillaPrueba({ solicitante: 'test_email.js' })];

    for (const { subject, html } of aEnviar) {
        const r = await sendEmail({ to: destino, subject, html });
        console.log(r.ok ? `OK   -> ${subject}` : `FALLO -> ${subject} (${r.motivo})`);
    }

    console.log('\nListo. Revise la bandeja de entrada (y la carpeta de spam) de', destino);
    process.exit(0);
})();
