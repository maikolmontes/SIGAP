-- ================================================================
-- SIGAP — Varias observaciones por actividad y corte
-- ----------------------------------------------------------------
-- observaciones_director tenía UNIQUE (id_asignacionact, semana, director_id),
-- que obligaba a UNA observación por director/actividad/semana: cada vez que
-- el director escribía, reemplazaba la anterior y se perdía el historial.
--
-- El seguimiento necesita poder dejar varias a lo largo del corte, así que
-- se retira la restricción y se indexa para que la consulta siga siendo ágil.
--
-- Es idempotente.
-- ================================================================

BEGIN;

ALTER TABLE observaciones_director
    DROP CONSTRAINT IF EXISTS observaciones_director_id_asignacionact_semana_director_id_key;

CREATE INDEX IF NOT EXISTS idx_observaciones_director_actividad_semana
    ON observaciones_director (id_asignacionact, semana);

COMMIT;
