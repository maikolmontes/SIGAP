require('dotenv').config({ path: __dirname + '/../.env' });
const pool = require('./connection');

async function seedDecanoPermisos() {
  const client = await pool.connect();
  try {
    console.log('Asignando permisos por defecto al Rol Decano (id_rol = 5)...');
    await client.query('BEGIN');

    // Obtener id de permisos que le corresponden al Decano
    const permisosTarget = [
      { pagina: 'Agendas por Revisar', accion: 'Ver' },
      { pagina: 'Observaciones Docentes', accion: 'Ver' },
      { pagina: 'Observaciones Docentes', accion: 'Crear' },
      { pagina: 'Observaciones Docentes', accion: 'Editar' },
      { pagina: 'Reportes de Gestión', accion: 'Ver' },
      { pagina: 'Seguimiento y Auditoría', accion: 'Ver' },
      { pagina: 'Observaciones de Control', accion: 'Ver' },
      { pagina: 'Observaciones de Control', accion: 'Crear' },
      { pagina: 'Observaciones de Control', accion: 'Editar' },
      { pagina: 'Analítica Institucional', accion: 'Ver' },
      { pagina: 'Analítica y Reportes', accion: 'Ver' },
      { pagina: 'Docentes y Usuarios', accion: 'Ver' },
      { pagina: 'Perfil de Usuario', accion: 'Ver' },
      { pagina: 'Perfil de Usuario', accion: 'Editar' }
    ];

    let count = 0;
    for (const pt of permisosTarget) {
      const pRes = await client.query(
        'SELECT id_permisos FROM permisos WHERE pagina = $1 AND accion = $2',
        [pt.pagina, pt.accion]
      );
      if (pRes.rows.length > 0) {
        const idPermiso = pRes.rows[0].id_permisos;
        const insertRes = await client.query(`
          INSERT INTO rol_permiso (id_rol, id_permisos, fecha_ingreso)
          VALUES (5, $1, NOW())
          ON CONFLICT (id_rol, id_permisos) DO NOTHING
        `, [idPermiso]);
        if (insertRes.rowCount > 0) count++;
      }
    }

    await client.query('COMMIT');
    console.log(`Permisos asignados al Decano exitosamente (${count} nuevos registros).`);

    // Mostrar todos los permisos actuales del Decano
    const actuales = await client.query(`
      SELECT p.modulo, p.pagina, p.accion
      FROM rol_permiso rp
      JOIN permisos p ON p.id_permisos = rp.id_permisos
      WHERE rp.id_rol = 5
      ORDER BY p.modulo, p.pagina, p.accion
    `);
    console.log('Permisos activos del Decano:', actuales.rows);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al asignar permisos a Decano:', err);
  } finally {
    client.release();
    pool.end();
  }
}

seedDecanoPermisos();
