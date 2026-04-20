const { OAuth2Client } = require('google-auth-library');
const pool = require('../db/connection');
const jwt = require('jsonwebtoken');

// Usaremos el Client ID proveído por el frontend, puede ser pasado por .env también en backend.
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '181220771654-oj95kkh2jqkt0glll07c370cqfjgv0p2.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

const loginGoogle = async (req, res) => {
    const { credential } = req.body;
    
    if (!credential) {
        return res.status(400).json({ error: 'Se requiere el token de credenciales de Google.' });
    }

    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: CLIENT_ID
        });
        
        const payload = ticket.getPayload();
        const correo = payload.email;

        // Verificar si el correo existe en la tabla usuarios y está activo
        const result = await pool.query(`
            SELECT 
                u.id_usuario, u.nombres, u.apellidos, u.correo, u.activo,
                STRING_AGG(DISTINCT r.nombre_rol, ', ') AS roles
            FROM usuarios u
            LEFT JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
            LEFT JOIN roles r ON ur.id_rol = r.id_rol
            WHERE u.correo = $1 AND u.activo = TRUE
            GROUP BY u.id_usuario
        `, [correo]);

        if (result.rows.length === 0) {
            return res.status(401).json({
                error: 'Acceso Denegado: Su correo institucional no está registrado en el SIGAP o se encuentra inactivo. Por favor, comuníquese con planeación.'
            });
        }

        const user = result.rows[0];
        user.roles = user.roles || '';
        user.imagen_perfil = payload.picture || null; // <--- Extraemos la foto

        // Generar JWT propio
        const token = jwt.sign(
            { id: user.id_usuario, correo: user.correo, roles: user.roles, imagen_perfil: user.imagen_perfil },
            process.env.JWT_SECRET || 'jwt_secret_key_sigap_2026',
            { expiresIn: '8h' } // El token expirará en 8 horas
        );

        res.json({ token, user });

    } catch (error) {
        console.error('Error verificando token de Google o en base de datos:', error);
        res.status(500).json({ error: 'Ocurrió un error en el servidor al intentar iniciar sesión. (' + error.message + ')' });
    }
};

module.exports = { loginGoogle };
