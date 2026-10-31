require('dotenv').config();
const express = require('express');
const path = require('path');
const seguridad = require('./middleware/seguridad');

require('./db/connection');

// Verifica las credenciales SMTP al arrancar (no bloquea el servidor)
require('./services/emailService').verificarConexion();

const usuariosRouter = require('./routes/usuarios');
const agendaRouter = require('./routes/agenda');
const funcionesRouter = require('./routes/funciones');
const authRouter = require('./routes/auth');
const periodosRouter = require('./routes/periodos');
const docenteRouter = require('./routes/docente');
const userRouter = require('./routes/user');
const facultadesRouter = require('./routes/facultades');
const programasRouter = require('./routes/programas');

const app = express();

// Seguridad (middleware/seguridad.js): proxy de Vercel, sin X-Powered-By, Helmet, CORS con lista blanca (CORS_ORIGINS) y JSON de hasta 1 MB
const ORIGENES_PERMITIDOS = seguridad.aplicarSeguridad(app, express);

// Límite de intentos del login con Google. Va antes que todo lo demás de /api (incluida la preparación de la base).
app.post('/api/auth/google', seguridad.crearLimitadorLoginGoogle());

// Contrato por período: columnas, rastro y trigger (idempotente; solo cuesta la primera petición)
app.use('/api', require('./utils/contratoPeriodo').esperarEsquemaContrato);

app.use('/api/usuarios', usuariosRouter);
app.use('/api/agenda', agendaRouter);
app.use('/api/funciones', funcionesRouter);
app.use('/api/auth', authRouter);
app.use('/api/periodos', periodosRouter);
app.use('/api/docente', docenteRouter);
app.use('/api/user', userRouter);
app.use('/api/facultades', facultadesRouter);
app.use('/api/programas', programasRouter);
app.use('/api/director', require('./routes/director'));
app.use('/api/semanas', require('./routes/semanas'));
app.use('/api/evidencias', require('./routes/evidencias'));
app.use('/api/observaciones', require('./routes/observaciones'));
app.use('/api/permisos', require('./routes/permisos'));
app.use('/api/notificaciones', require('./routes/notificaciones'));
app.use('/api/analitica', require('./routes/analitica'));
app.use('/api/parametros', require('./routes/parametros'));
app.use('/api/mis-notificaciones', require('./routes/misNotificaciones'));

// Evidencias: ya no son una carpeta pública. Pasan por token + permiso por docente.
const { verifyTokenFlexible, servirArchivo } = require('./middleware/accesoEvidencias');
// frame-ancestors: solo el frontend de SIGAP puede mostrar la evidencia en un <iframe> (no hay X-Frame-Options en esta ruta)
app.get('/uploads/evidencias/:archivo', seguridad.crearFrameAncestors(ORIGENES_PERMITIDOS), verifyTokenFlexible, servirArchivo);

app.get('/api', (req, res) => {
    res.json({
        mensaje: 'Servidor SIGAP funcionando correctamente',
        version: '1.0.0'
    });
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
        // Recordatorios automáticos de plazo (desactivados salvo EMAIL_RECORDATORIOS_AUTO=true)
        require('./services/programadorTareas').iniciar();
    });
}

module.exports = app;