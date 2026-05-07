require('dotenv').config();
const express = require('express');
const cors = require('cors');

require('./db/connection');
const usuariosRouter = require('./routes/usuarios');
const agendaRouter = require('./routes/agenda');
const funcionesRouter = require('./routes/funciones');
const authRouter = require('./routes/auth');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/usuarios', usuariosRouter);
app.use('/api/agenda', agendaRouter);
app.use('/api/funciones', funcionesRouter);
app.use('/api/auth', authRouter);

app.get('/api', (req, res) => {
    res.json({
        mensaje: 'Servidor SIGAP funcionando correctamente',
        version: '1.0.0'
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});