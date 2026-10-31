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
//   · Sin JWT_SECRET en Vercel           → el servidor NO arranca, con un error claro en el log.
//     Jamás se firma con el secreto por defecto del código: está en el repositorio y
//     cualquiera podría fabricar tokens válidos.
// ================================================================

// Carga el .env aquí mismo: si este módulo se importara antes que dotenv, el
// secreto real no estaría disponible y se usaría el de respaldo sin avisar.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// Valor histórico: se conserva solo para no invalidar sesiones en desarrollo.
const SECRETO_DESARROLLO = 'jwt_secret_key_sigap_2026';

const resolverSecreto = () => {
    const configurado = process.env.JWT_SECRET;
    if (configurado && configurado.trim().length >= 16) return configurado.trim();

    // Despliegue en Vercel: sin secreto NO se arranca (la función falla y el log dice por qué).
    // Un secreto ya configurado se respeta aunque sea corto —no se tumba un despliegue que hoy
    // funciona— pero se avisa en el log para que se reemplace por uno más largo.
    if (process.env.VERCEL) {
        if (configurado && configurado.trim()) {
            console.warn('[seguridad] JWT_SECRET tiene menos de 16 caracteres: conviene reemplazarlo por uno más largo.');
            return configurado.trim();
        }
        throw new Error(
            'JWT_SECRET no está definido en Vercel: el servidor no arranca para no firmar con el secreto por defecto. ' +
            'Defínelo en Vercel > Settings > Environment Variables (mínimo 16 caracteres) y vuelve a desplegar.'
        );
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
