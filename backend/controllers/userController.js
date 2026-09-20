const pool = require('../db/connection');

exports.getUserRoles = async (req, res) => {
  try {
    const userId = req.user.id; 

    // Se incluyen las funciones sustantivas que revisa cada rol para que la
    // interfaz sepa a dónde mandar al usuario y qué menú mostrarle sin tener
    // los nombres de los roles quemados en el código (database/rol_funcion.sql).
    const query = `
      SELECT r.id_rol, r.nombre_rol, r.descripcion_rol,
             COALESCE(
               ARRAY_AGG(rf.funcion_sustantiva ORDER BY rf.funcion_sustantiva)
               FILTER (WHERE rf.funcion_sustantiva IS NOT NULL),
               '{}'
             ) AS funciones_revisa
      FROM roles r
      INNER JOIN usuario_rol ur ON r.id_rol = ur.id_rol
      LEFT JOIN rol_funcion rf ON rf.id_rol = r.id_rol
      WHERE ur.id_usuario = $1
      GROUP BY r.id_rol, r.nombre_rol, r.descripcion_rol
      ORDER BY r.id_rol ASC
    `;

    const { rows } = await pool.query(query, [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'El usuario no tiene roles asignados.' });
    }

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener roles:', error);
    res.status(500).json({ message: 'Error del servidor al obtener los roles' });
  }
};
