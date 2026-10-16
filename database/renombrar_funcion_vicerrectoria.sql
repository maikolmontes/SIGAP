-- Renombra la función sustantiva "Vicerrectoría" a "Vicerrectoría para la Evangelización de las Culturas".
-- Idempotente: se puede correr más de una vez. Hay que aplicarlo JUNTO con el despliegue del código que usa el nombre nuevo.
BEGIN;

UPDATE asignacion_funciones
   SET funcion_sustantiva = 'Vicerrectoría para la Evangelización de las Culturas'
 WHERE funcion_sustantiva = 'Vicerrectoría';

-- rol_funcion tiene clave primaria (id_rol, funcion_sustantiva): si ya existe la fila nueva, se descarta la vieja
DELETE FROM rol_funcion v
 WHERE v.funcion_sustantiva = 'Vicerrectoría'
   AND EXISTS (SELECT 1 FROM rol_funcion n WHERE n.id_rol = v.id_rol AND n.funcion_sustantiva = 'Vicerrectoría para la Evangelización de las Culturas');
UPDATE rol_funcion
   SET funcion_sustantiva = 'Vicerrectoría para la Evangelización de las Culturas'
 WHERE funcion_sustantiva = 'Vicerrectoría';

COMMIT;
