-- ================================================================
-- SIGAP — Eliminar los datos residuales del rol Decano
-- ----------------------------------------------------------------
-- El módulo y el rol de Decano se eliminaron del código, pero las
-- filas siguen en la base de datos, por eso "Decano" continúa
-- apareciendo en la pantalla de selección de roles: el login arma la
-- lista con STRING_AGG sobre usuario_rol, no con una lista fija.
--
-- Estado encontrado en Neon el 16/09/2026:
--   roles          -> 1 fila  (id_rol = 5, 'Decano')
--   usuario_rol    -> 2 filas (usuarios 1 y 31)
--   rol_permiso    -> 14 filas
--
-- Ambos usuarios conservan 4 roles más (Planeacion, Docente,
-- Director, Consultor), así que ninguno queda sin acceso.
--
-- El orden importa: primero las tablas que referencian roles(id_rol)
-- y al final la fila de roles, o la llave foránea bloquea el DELETE.
-- ================================================================

BEGIN;

-- 1. Quitar la asignación del rol a los usuarios
DELETE FROM usuario_rol
WHERE id_rol IN (SELECT id_rol FROM roles WHERE LOWER(nombre_rol) LIKE '%decano%');

-- 2. Quitar los permisos concedidos al rol
DELETE FROM rol_permiso
WHERE id_rol IN (SELECT id_rol FROM roles WHERE LOWER(nombre_rol) LIKE '%decano%');

-- 3. Eliminar el rol
DELETE FROM roles
WHERE LOWER(nombre_rol) LIKE '%decano%';

COMMIT;

-- ================================================================
-- Verificación: deben quedar 4 roles y ningún usuario activo sin rol
-- ================================================================
-- SELECT id_rol, nombre_rol FROM roles ORDER BY id_rol;
--
-- SELECT u.id_usuario, u.nombres || ' ' || u.apellidos AS nombre
-- FROM usuarios u
-- WHERE u.activo = TRUE
--   AND NOT EXISTS (SELECT 1 FROM usuario_rol ur WHERE ur.id_usuario = u.id_usuario);

-- ================================================================
-- Opcional: la columna usuarios.id_facultad quedó huérfana (solo la
-- usaba el Decano). El código ya no la consulta, así que dejarla no
-- causa problemas. Si se desea eliminar del todo:
-- ================================================================
-- ALTER TABLE usuarios DROP COLUMN IF EXISTS id_facultad;
