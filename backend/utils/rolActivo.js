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

/**
 * Funciones sustantivas que el rol activo puede REVISAR (database/rol_funcion.sql).
 *
 * La agenda de un docente se reparte entre varios revisores: el Director
 * revisa docencia y lo académico-administrativo de SUS programas, mientras
 * que Investigación revisa su función en toda la institución.
 *
 * Regla, sin roles quemados en el código:
 *   · rol CON filas en rol_funcion  → restringido a esas funciones
 *   · rol SIN filas (Planeación, Consultor) → ve todas
 *   · rol comodín → además, toda función que ningún rol reclame
 *
 * @returns {Promise<{restringido: boolean, funciones: string[]}>}
 *   Si restringido es true y funciones está vacío, el rol no revisa nada.
 */
const alcanceFunciones = async (req) => {
    if (req._alcanceFunciones) return req._alcanceFunciones;

    const rolesActivos = rolesEfectivos(req);
    const pool = require('../db/connection');

    // Se normaliza en JS (no en SQL) para usar exactamente el mismo criterio
    // de acentos y mayúsculas que rolesEfectivos.
    const { rows } = await pool.query(`
        SELECT r.nombre_rol, r.es_comodin, rf.funcion_sustantiva
        FROM roles r
        LEFT JOIN rol_funcion rf ON rf.id_rol = r.id_rol
    `);

    const funciones = new Set();
    let esComodin = false;
    let tieneFunciones = false;

    for (const row of rows) {
        if (!rolesActivos.includes(normalizar(row.nombre_rol))) continue;
        if (row.es_comodin) esComodin = true;
        if (row.funcion_sustantiva) {
            funciones.add(row.funcion_sustantiva);
            tieneFunciones = true;
        }
    }

    let alcance;
    if (!tieneFunciones) {
        alcance = { restringido: false, funciones: [], esComodin: false };
    } else {
        if (esComodin) {
            // La importación de Excel puede inventar funciones nuevas; sin esto
            // quedarían sin revisor y la agenda nunca podría completarse.
            const huerfanas = await pool.query(`
                SELECT DISTINCT af.funcion_sustantiva
                FROM asignacion_funciones af
                WHERE af.funcion_sustantiva IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM rol_funcion rf
                      WHERE rf.funcion_sustantiva = af.funcion_sustantiva
                  )
            `);
            for (const h of huerfanas.rows) funciones.add(h.funcion_sustantiva);
        }
        // esComodin distingue al revisor integral (Director, que valida las 40h
        // del contrato) del revisor de una sola función, que no debe ver el resto.
        alcance = { restringido: true, funciones: [...funciones], esComodin };
    }

    req._alcanceFunciones = alcance;
    return alcance;
};

/**
 * ¿Puede el rol activo revisar esta función sustantiva?
 * Es la validación autoritativa: verifyRole solo comprueba el nombre del rol,
 * así que el permiso real sobre una función se decide aquí.
 */
const funcionEnAlcance = async (req, funcionSustantiva) => {
    const alcance = await alcanceFunciones(req);
    if (!alcance.restringido) return true;
    return alcance.funciones.includes(funcionSustantiva);
};

module.exports = {
    rolesEfectivos,
    calcularAlcance,
    alcanceProgramas,
    docenteEnAlcance,
    alcanceFunciones,
    funcionEnAlcance,
    normalizar,
};
