const pool = require('../db/connection');

const getFunciones = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id_funciones,
                funcion_sustantiva,
                horas_funcion,
                estado_agenda,
                observaciones_generales
            FROM asignacion_funciones
            WHERE estado_agenda = 'Activo'
            ORDER BY id_funciones
        `);

        res.json(result.rows);

    } catch (error) {
        console.error('Error en getFunciones:', error.message);
        res.status(500).json({ error: 'Error al obtener funciones' });
    }
};

const getFuncionesByUsuario = async (req, res) => {
    const { id_usuario } = req.params;

    try {
        const result = await pool.query(`
            SELECT
                af.id_funciones,
                af.funcion_sustantiva,
                af.horas_funcion,
                af.estado_agenda,
                af.observaciones_generales
            FROM usuario_asignacion ua
            JOIN asignacion_funciones af ON ua.id_funciones = af.id_funciones
            WHERE ua.id_usuario = $1
            ORDER BY af.id_funciones
        `, [id_usuario]);

        res.json(result.rows);

    } catch (error) {
        console.error('Error en getFuncionesByUsuario:', error.message);
        res.status(500).json({ error: 'Error al obtener funciones del usuario' });
    }
};

const asignarFuncion = async (req, res) => {
    const { id_usuario, id_funciones } = req.body;

    try {
        const existe = await pool.query(`
            SELECT id_usuarioasig
            FROM usuario_asignacion
            WHERE id_usuario = $1 AND id_funciones = $2
        `, [id_usuario, id_funciones]);

        if (existe.rows.length > 0) {
            return res.status(400).json({ error: 'El docente ya tiene esa función asignada' });
        }

        const result = await pool.query(`
            INSERT INTO usuario_asignacion (id_usuario, id_funciones)
            VALUES ($1, $2)
            RETURNING id_usuarioasig, id_usuario, id_funciones
        `, [id_usuario, id_funciones]);

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error('Error en asignarFuncion:', error.message);
        res.status(500).json({ error: 'Error al asignar función' });
    }
};

const getCatalogoJerarquico = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                af.id_funciones, af.funcion_sustantiva,
                aa.id_asignacionact, aa.rol_seleccionado,
                d.id_descripcion, d.resultado_esperado, d.meta,
                i.id_indicadores as id_indicador, i.nombre_indicador
            FROM asignacion_funciones af
            LEFT JOIN asignacion_actividades aa ON af.id_funciones = aa.id_funciones
            LEFT JOIN descripcion d ON aa.id_asignacionact = d.id_asignacionact
            LEFT JOIN indicadores i ON d.id_descripcion = i.id_descripcion
            WHERE NOT EXISTS (
                SELECT 1 FROM usuario_asignacion ua WHERE ua.id_funciones = af.id_funciones
            )
            ORDER BY af.id_funciones, aa.id_asignacionact, d.id_descripcion, i.id_indicadores
        `);

        // Procesar rows para armar el JSON anidado
        const catalogo = [];
        const funcionesMap = new Map();
        const actsMap = new Map();
        const descMap = new Map();

        result.rows.forEach(row => {
            if (!funcionesMap.has(row.id_funciones)) {
                const f = {
                    id_funciones: row.id_funciones,
                    funcion_sustantiva: row.funcion_sustantiva,
                    actividades: []
                };
                funcionesMap.set(row.id_funciones, f);
                catalogo.push(f);
            }
            const f = funcionesMap.get(row.id_funciones);

            if (row.id_asignacionact && row.rol_seleccionado) {
                if (!actsMap.has(row.id_asignacionact)) {
                    const a = {
                        id_asignacionact: row.id_asignacionact,
                        rol_seleccionado: row.rol_seleccionado,
                        descripciones: []
                    };
                    actsMap.set(row.id_asignacionact, a);
                    f.actividades.push(a);
                }
                const a = actsMap.get(row.id_asignacionact);

                if (row.id_descripcion) {
                    if (!descMap.has(row.id_descripcion)) {
                        const d = {
                            id_descripcion: row.id_descripcion,
                            resultado_esperado: row.resultado_esperado,
                            meta: row.meta,
                            indicadores: []
                        };
                        descMap.set(row.id_descripcion, d);
                        a.descripciones.push(d);
                    }
                    const d = descMap.get(row.id_descripcion);

                    if (row.id_indicador) {
                        d.indicadores.push({
                            id_indicador: row.id_indicador,
                            nombre_indicador: row.nombre_indicador
                        });
                    }
                }
            }
        });

        res.json(catalogo);
    } catch (error) {
        console.error('Error en getCatalogoJerarquico:', error.message);
        res.status(500).json({ error: 'Error al obtener el catálogo' });
    }
};

module.exports = {
    getFunciones,
    getFuncionesByUsuario,
    asignarFuncion,
    getCatalogoJerarquico
};