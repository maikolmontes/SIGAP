// Dirección pública del frontend, la que se pone en los enlaces de los correos ("Ir a mi agenda", etc.).
//
//  1. FRONTEND_URL, si está configurada (es lo recomendado: variable del backend en Vercel).
//  2. En Vercel / producción, sin variable (o con una apuntando a localhost por error): la dirección de producción.
//  3. En desarrollo: http://localhost:5173.
// Así un correo enviado desde producción nunca lleva a un localhost.
const URL_PRODUCCION = 'https://sigap-fronted.vercel.app';
const URL_DESARROLLO = 'http://localhost:5173';

const esLocal = (direccion) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(direccion);

const urlFrontend = (entorno = process.env) => {
    const configurada = String(entorno.FRONTEND_URL || '').trim().replace(/\/+$/, '');
    const enProduccion = !!entorno.VERCEL || entorno.NODE_ENV === 'production';

    if (configurada && !(enProduccion && esLocal(configurada))) return configurada;
    return enProduccion ? URL_PRODUCCION : URL_DESARROLLO;
};

module.exports = { urlFrontend, URL_PRODUCCION, URL_DESARROLLO };
