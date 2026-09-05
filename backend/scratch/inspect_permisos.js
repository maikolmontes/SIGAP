require('dotenv').config({ path: __dirname + '/../.env' });
const pool = require('../db/connection');

async function check() {
  // 1. Usuarios con sus roles
  const usuarios = await pool.query(`
    SELECT u.id_usuario, u.nombres, u.apellidos, u.correo, u.activo,
           STRING_AGG(r.nombre_rol, ', ') as roles
    FROM usuarios u
    LEFT JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
    LEFT JOIN roles r ON ur.id_rol = r.id_rol
    GROUP BY u.id_usuario
    ORDER BY u.id_usuario
  `);
  console.log('\n=== USUARIOS Y ROLES ===');
  usuarios.rows.forEach(u =>
    console.log(`[${u.id_usuario}] ${u.nombres} ${u.apellidos} | ${u.correo} | activo:${u.activo} | roles: ${u.roles || 'NINGUNO'}`)
  );

  // 2. Usuarios sin ningún rol
  const sinRol = await pool.query(`
    SELECT u.id_usuario, u.nombres, u.apellidos, u.correo
    FROM usuarios u
    LEFT JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
    WHERE ur.id_rol IS NULL
  `);
  console.log('\n=== USUARIOS SIN ROL ASIGNADO ===');
  if (sinRol.rows.length === 0) console.log('Ninguno ✅');
  else sinRol.rows.forEach(u => console.log(`  ⚠️  [${u.id_usuario}] ${u.nombres} ${u.apellidos} - ${u.correo}`));

  // 3. Revisar endpoint permisos - ver páginas configuradas para cada rol
  const paginasRol = await pool.query(`
    SELECT r.nombre_rol, p.pagina, p.accion
    FROM rol_permiso rp
    JOIN roles r ON r.id_rol = rp.id_rol
    JOIN permisos p ON p.id_permiso = rp.id_permiso
    ORDER BY r.nombre_rol, p.pagina, p.accion
  `);
  console.log('\n=== PÁGINAS CONFIGURADAS POR ROL (primeras 30) ===');
  paginasRol.rows.slice(0, 30).forEach(p =>
    console.log(`  ${p.nombre_rol} → ${p.pagina} [${p.accion}]`)
  );

  // 4. Verificar si hay periodo activo
  const periodo = await pool.query("SELECT * FROM periodos WHERE activo = true");
  console.log('\n=== PERIODO ACTIVO ===');
  if (periodo.rows.length === 0) console.log('⚠️  NO HAY PERIODO ACTIVO');
  else console.log(periodo.rows[0]);

  process.exit(0);
}

check().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
