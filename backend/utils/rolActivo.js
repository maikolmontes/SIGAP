/**
 * Resolución del rol activo.
 *
 * Un usuario puede tener varios roles (p. ej. "Planeacion, Director, Decano").
 * El JWT los lleva todos, pero la interfaz trabaja con UN rol a la vez —
 * el que se elige en la pantalla de selección de rol.
 *
 * Sin esto, un usuario que además es Decano veía el alcance de Decano
 * (solo su facultad) incluso cuando entraba como Planeación, que debe
 * ver toda la institución.
 *
 * El frontend envía el rol elegido en la cabecera 'X-Rol-Activo'.
 * SIEMPRE se valida contra los roles del JWT: si el usuario no tiene
 * realmente ese rol, la cabecera se ignora. Así la cabecera no sirve
 * para escalar privilegios.
 */

const normalizar = (valor) =>
    String(valor || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim();

/**
 * Devuelve la lista de roles que deben usarse para calcular el alcance
 * de la consulta (facultad / programa / institución).
 *
 * @returns {string[]} roles normalizados, en minúscula y sin tildes
 */
const rolesEfectivos = (req) => {
    const rolesJwt = String(req.user?.roles || '')
        .split(',')
        .map(normalizar)
        .filter(Boolean);

    const solicitado = normalizar(req.headers['x-rol-activo']);

    // Solo se respeta la cabecera si el usuario realmente tiene ese rol
    if (solicitado && rolesJwt.includes(solicitado)) {
        return [solicitado];
    }

    return rolesJwt;
};

/**
 * Calcula el alcance de visibilidad según el rol activo.
 * Decano → su facultad · Director → su programa · resto → toda la institución
 */
const calcularAlcance = (req) => {
    const roles = rolesEfectivos(req);
    const esPlaneacion = roles.includes('planeacion') || roles.includes('admin');
    const esConsultor = roles.includes('consultor');
    const esDecano = roles.includes('decano');
    const esDirector = roles.includes('director');

    // Planeación y Consultor ven todo; si el rol activo es uno de ellos,
    // no se aplica ningún filtro territorial.
    const limitadoPorFacultad = esDecano && !esPlaneacion && !esConsultor;
    const limitadoPorPrograma = esDirector && !esDecano && !esPlaneacion && !esConsultor;

    return { roles, esPlaneacion, esConsultor, esDecano, esDirector, limitadoPorFacultad, limitadoPorPrograma };
};

module.exports = { rolesEfectivos, calcularAlcance, normalizar };
