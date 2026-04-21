const pool = require('../db/connection');

exports.getUserRoles = async (req, res) => {
  try {
    const userId = req.user.id; 

    const query = `
      SELECT r.id_rol, r.nombre_rol, r.descripcion_rol
      FROM roles r
      INNER JOIN usuario_rol ur ON r.id_rol = ur.id_rol
      WHERE ur.id_usuario = $1
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
