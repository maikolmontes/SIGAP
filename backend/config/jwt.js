// ================================================================
// SIGAP — Secreto de firma de los JWT (un solo lugar)
// ----------------------------------------------------------------
// Antes cada archivo traía su propio valor por defecto escrito en el
// código: quien leyera el repositorio podía firmar tokens válidos.
//
//   · Con JWT_SECRET definido            → se usa ese.
//   · Sin JWT_SECRET en desarrollo       → se usa un valor de respaldo y se
//     avisa en consola (así no se rompe el entorno local).
//   · Sin JWT_SECRET en producción       → el servidor NO arranca.
//   · Sin JWT_SECRET en Vercel           → arranca con aviso (no tumbar el despliegue).
// ================================================================

// Carga el .env aquí mismo: si este módulo se importara antes que dotenv, el
// secreto real no estaría disponible y se usaría el de respaldo sin avisar.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// Valor histórico: se conserva solo para no invalidar sesiones en desarrollo.
const SECRETO_DESARROLLO = 'jwt_secret_key_sigap_2026';

const resolverSecreto = () => {
    const configurado = process.env.JWT_SECRET;
    if (configurado && configurado.trim().length >= 16) return configurado.trim();

    // Despliegue en Vercel: no se aborta el arranque (eso dejaría la aplicación
    // caída si la variable aún no está cargada allí). Se conserva el secreto
    // que ya estuviera configurado, aunque sea corto, y se avisa en el log.
    if (process.env.VERCEL) {
        if (configurado && configurado.trim()) {
            console.warn('[seguridad] JWT_SECRET tiene menos de 16 caracteres: conviene reemplazarlo por uno más largo.');
            return configurado.trim();
        }
        console.warn(
            '[seguridad] JWT_SECRET NO está definido en Vercel: se usa el secreto por defecto del código. ' +
            'Defínelo en Vercel > Settings > Environment Variables (mínimo 16 caracteres).'
        );
        return SECRETO_DESARROLLO;
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            'JWT_SECRET no está definido (o tiene menos de 16 caracteres). ' +
            'Defínelo en las variables de entorno antes de iniciar en producción.'
        );
    }

    console.warn(
        '[seguridad] JWT_SECRET no está definido: se usa un secreto de desarrollo. ' +
        'Defínelo en backend/.env (mínimo 16 caracteres) antes de desplegar.'
    );
    return SECRETO_DESARROLLO;
};

module.exports = { JWT_SECRET: resolverSecreto() };
