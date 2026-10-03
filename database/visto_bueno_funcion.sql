-- ================================================================
-- SIGAP — Visto bueno por función sustantiva
-- ----------------------------------------------------------------
-- Son dos actos distintos y no hay que confundirlos:
--
--   1. VISTO BUENO (por función) — lo da el revisor de esa función
--      (Investigación la suya) o el Director. Es una marca informativa:
--      deja constancia de que alguien ya revisó esa parte. NO libera nada.
--
--   2. APROBAR ASIGNACIONES (toda la agenda) — solo el Director.
--      Es lo único que pone la agenda a la vista del docente.
--
-- Por eso el visto bueno vive en columnas propias y no toca estado_agenda.
-- Es idempotente.
-- ================================================================

BEGIN;

ALTER TABLE asignacion_funciones
    ADD COLUMN IF NOT EXISTS visto_bueno_por INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

ALTER TABLE asignacion_funciones
    ADD COLUMN IF NOT EXISTS visto_bueno_en TIMESTAMP;

COMMIT;

-- Verificación
-- SELECT funcion_sustantiva, COUNT(*) FILTER (WHERE visto_bueno_en IS NOT NULL) AS con_visto
-- FROM asignacion_funciones GROUP BY 1;
