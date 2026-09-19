/**
 * Resolución del rol activo.
 *
 * Un usuario puede tener varios roles (p. ej. "Planeacion, Director").
 * El JWT los lleva todos, pero la interfaz trabaja con UN rol a la vez —
 * el que se elige en la pantalla de selección de rol.
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
 * Director → su programa · resto → toda la institución
 */
const calcularAlcance = (req) => {
    const roles = rolesEfectivos(req);
    const esPlaneacion = roles.includes('planeacion') || roles.includes('admin');
    const esConsultor = roles.includes('consultor');
    const esDirector = roles.includes('director');

    // Planeación y Consultor ven todo; si el rol activo es uno de ellos,
    // no se aplica ningún filtro territorial.
    const limitadoPorPrograma = esDirector && !esPlaneacion && !esConsultor;

    return { roles, esPlaneacion, esConsultor, esDirector, limitadoPorPrograma, limitadoPorFacultad: false };
};

/**
 * Programas que el usuario puede ver según su rol activo.
 *
 * Un Director gestiona los programas de director_programa (uno o varios).
 * Planeación, Admin y Consultor no tienen restricción.
 *
 * @returns {Promise<{restringido: boolean, ids: number[]}>}
 *   Si restringido es true y ids está vacío, el director no tiene programas
 *   asignados y NO debe ver nada (nunca se cae a "toda la institución").
 */
const alcanceProgramas = async (req) => {
    if (req._alcanceProgramas) return req._alcanceProgramas;

    const { limitadoPorPrograma } = calcularAlcance(req);
    let alcance = { restringido: false, ids: [] };

    if (limitadoPorPrograma) {
        const pool = require('../db/connection');
        const r = await pool.query(
            'SELECT id_programa FROM director_programa WHERE id_usuario = $1 ORDER BY id_programa',
            [req.user?.id]
        );
        alcance = { restringido: true, ids: r.rows.map(f => f.id_programa) };
    }

    req._alcanceProgramas = alcance;
    return alcance;
};

/**
 * ¿Puede el usuario actuar sobre este docente? Un Director solo puede si el
 * docente pertenece a alguno de sus programas.
 */
const docenteEnAlcance = async (req, idDocente) => {
    const alcance = await alcanceProgramas(req);
    if (!alcance.restringido) return true;
    if (alcance.ids.length === 0) return false;

    const pool = require('../db/connection');
    const r = await pool.query(
        'SELECT 1 FROM usuarios WHERE id_usuario = $1 AND id_programa = ANY($2::int[])',
        [idDocente, alcance.ids]
    );
    return r.rows.length > 0;
};

module.exports = { rolesEfectivos, calcularAlcance, alcanceProgramas, docenteEnAlcance, normalizar };
