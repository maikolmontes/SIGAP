const pool = require('../db/connection');

// Obtener permisos activos asignados a un rol específico
exports.getPermisosByRol = async (req, res) => {
  const { id_rol } = req.params;
  try {
    const permisosRes = await pool.query(`
      SELECT p.id_permisos, p.modulo, p.pagina, p.accion
      FROM rol_permiso rp
      JOIN permisos p ON rp.id_permisos = p.id_permisos
      WHERE rp.id_rol = $1
    `, [id_rol]);

    const paginasVer = new Set();
    const mapaPermisos = {};

    for (const row of permisosRes.rows) {
      if (row.pagina) {
        if (!mapaPermisos[row.pagina]) mapaPermisos[row.pagina] = [];
        mapaPermisos[row.pagina].push(row.accion);
        if (row.accion === 'Ver') {
          paginasVer.add(row.pagina);
        }
      }
    }

    res.json({
      id_rol: Number(id_rol),
      paginasVer: Array.from(paginasVer),
      mapaPermisos,
      permisos: permisosRes.rows
    });
  } catch (error) {
    console.error('Error al consultar permisos del rol:', error);
    res.status(500).json({ error: 'Error al consultar permisos del rol' });
  }
};

// Obtener catálogo completo de la matriz y permisos asignados por rol
exports.getCatalogoYAsignaciones = async (req, res) => {
  try {
    // 1. Roles
    const rolesRes = await pool.query(`
      SELECT id_rol, nombre_rol, descripcion_rol 
      FROM roles 
      ORDER BY id_rol ASC
    `);

    // 2. Todos los permisos ordenados por módulo, página y acción
    const permisosRes = await pool.query(`
      SELECT id_permisos, modulo, pagina, accion, detalle_permiso
      FROM permisos
      WHERE pagina IS NOT NULL
      ORDER BY modulo ASC, pagina ASC, 
        CASE accion 
          WHEN 'Ver' THEN 1 
          WHEN 'Crear' THEN 2 
          WHEN 'Editar' THEN 3 
          WHEN 'Eliminar' THEN 4 
          ELSE 5 
        END ASC
    `);

    // 3. Agrupar permisos en estructura jerárquica por Módulo -> Página -> Acciones
    const modulosMap = new Map();

    for (const p of permisosRes.rows) {
      const modName = p.modulo || 'General';
      const pagName = p.pagina || 'General';

      if (!modulosMap.has(modName)) {
        modulosMap.set(modName, new Map());
      }
      const paginasMap = modulosMap.get(modName);

      if (!paginasMap.has(pagName)) {
        paginasMap.set(pagName, {
          nombre: pagName,
          descripcion: p.detalle_permiso ? p.detalle_permiso.split(':')[1]?.trim() || '' : '',
          acciones: {}
        });
      }

      const paginaObj = paginasMap.get(pagName);
      paginaObj.acciones[p.accion] = p.id_permisos;
    }

    const modulos = [];
    for (const [modName, paginasMap] of modulosMap.entries()) {
      modulos.push({
        modulo: modName,
        paginas: Array.from(paginasMap.values())
      });
    }

    // 4. Asignaciones actuales de rol_permiso
    const rolPermisosRes = await pool.query(`
      SELECT id_rol, id_permisos 
      FROM rol_permiso
    `);

    const asignaciones = {};
    for (const r of rolesRes.rows) {
      asignaciones[r.id_rol] = [];
    }
    for (const rp of rolPermisosRes.rows) {
      if (!asignaciones[rp.id_rol]) {
        asignaciones[rp.id_rol] = [];
      }
      asignaciones[rp.id_rol].push(rp.id_permisos);
    }

    res.json({
      roles: rolesRes.rows,
      modulos,
      asignaciones
    });
  } catch (error) {
    console.error('Error al obtener catálogo de permisos:', error);
    res.status(500).json({ error: 'Error al consultar catálogo de permisos' });
  }
};

// Actualizar permisos asignados a un rol específico
exports.updateRolPermisos = async (req, res) => {
  const { id_rol } = req.params;
  const { permisosIds } = req.body;

  if (!id_rol) {
    return res.status(400).json({ error: 'ID de rol requerido' });
  }

  if (!Array.isArray(permisosIds)) {
    return res.status(400).json({ error: 'permisosIds debe ser un arreglo de identificadores' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Eliminar permisos existentes para el rol
    await client.query('DELETE FROM rol_permiso WHERE id_rol = $1', [id_rol]);

    // 2. Insertar nuevos permisos seleccionados
    if (permisosIds.length > 0) {
      const values = [];
      const placeholders = permisosIds.map((pId, idx) => {
        values.push(id_rol, pId);
        return `($${idx * 2 + 1}, $${idx * 2 + 2}, NOW())`;
      }).join(', ');

      await client.query(`
        INSERT INTO rol_permiso (id_rol, id_permisos, fecha_ingreso)
        VALUES ${placeholders}
        ON CONFLICT (id_rol, id_permisos) DO NOTHING
      `, values);
    }

    await client.query('COMMIT');
    res.json({
      ok: true,
      mensaje: 'Permisos actualizados exitosamente',
      id_rol: Number(id_rol),
      total_asignados: permisosIds.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar permisos del rol:', error);
    res.status(500).json({ error: 'Error al guardar los permisos del rol' });
  } finally {
    client.release();
  }
};

// Clonar / Copiar permisos de un rol de origen a un rol de destino
exports.copiarPermisos = async (req, res) => {
  const { id_rol_origen, id_rol_destino } = req.body;

  if (!id_rol_origen || !id_rol_destino) {
    return res.status(400).json({ error: 'Se requieren id_rol_origen e id_rol_destino' });
  }

  if (Number(id_rol_origen) === Number(id_rol_destino)) {
    return res.status(400).json({ error: 'El rol de origen y destino no pueden ser el mismo' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener los permisos del origen
    const origenPermisosRes = await client.query(`
      SELECT id_permisos FROM rol_permiso WHERE id_rol = $1
    `, [id_rol_origen]);

    const permisosAClonar = origenPermisosRes.rows.map(r => r.id_permisos);

    // 2. Limpiar permisos del destino
    await client.query('DELETE FROM rol_permiso WHERE id_rol = $1', [id_rol_destino]);

    // 3. Insertar los del origen en destino
    if (permisosAClonar.length > 0) {
      const values = [];
      const placeholders = permisosAClonar.map((pId, idx) => {
        values.push(id_rol_destino, pId);
        return `($${idx * 2 + 1}, $${idx * 2 + 2}, NOW())`;
      }).join(', ');

      await client.query(`
        INSERT INTO rol_permiso (id_rol, id_permisos, fecha_ingreso)
        VALUES ${placeholders}
        ON CONFLICT (id_rol, id_permisos) DO NOTHING
      `, values);
    }

    await client.query('COMMIT');
    res.json({
      ok: true,
      mensaje: 'Permisos clonados exitosamente',
      total_copiados: permisosAClonar.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al clonar permisos entre roles:', error);
    res.status(500).json({ error: 'Error al clonar permisos entre roles' });
  } finally {
    client.release();
  }
};
