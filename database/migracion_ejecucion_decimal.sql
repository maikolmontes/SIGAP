-- ================================================================
-- SIGAP — Permitir ejecución con decimales en los indicadores
-- ----------------------------------------------------------------
-- Problema: indicadores.ejecucion_8 y ejecucion_16 estaban como
-- INTEGER, así que registrar un avance de 0.5 fallaba con
-- "la sintaxis de entrada no es válida para tipo integer: «0.5»".
--
-- El resto de columnas relacionadas (descripcion.meta,
-- actividad_semana.ejecucion, resultados.porcentaje_avance) ya eran
-- NUMERIC, así que este cambio solo alinea las dos que faltaban.
--
-- Ninguna vista depende de estas columnas, por lo que el ALTER es
-- directo y conserva los datos existentes.
-- ================================================================

BEGIN;

ALTER TABLE indicadores
    ALTER COLUMN ejecucion_8  TYPE NUMERIC(10, 2) USING ejecucion_8::NUMERIC,
    ALTER COLUMN ejecucion_16 TYPE NUMERIC(10, 2) USING ejecucion_16::NUMERIC;

COMMIT;

-- Verificación
-- SELECT column_name, data_type, numeric_scale
-- FROM information_schema.columns
-- WHERE table_name = 'indicadores' AND column_name LIKE 'ejecucion%';
