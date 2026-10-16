-- Los cortes de un intersemestral también se llaman "Semana 8" y "Semana 16" (antes "Semana X" y "Semana X (final)").
-- Corrige las etiquetas ya guardadas en la tabla semana. Idempotente: se puede correr más de una vez.
-- Aplicar junto con el despliegue del código que ya no usa "Semana X".
UPDATE semana
   SET etiqueta = REPLACE(REPLACE(etiqueta, 'Semana X (final)', 'Semana 16'), 'Semana X', 'Semana 8')
 WHERE etiqueta LIKE 'Semana X%';
