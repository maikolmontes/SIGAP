-- ================================================================
-- SIGAP — El docente ve su agenda solo después de que la aprueban
-- ----------------------------------------------------------------
-- Antes: Planeación importaba el Excel y las asignaciones quedaban
-- visibles para el docente de inmediato.
--
-- Ahora (semana 0):
--   1. Planeación importa      → estado 'Por Aprobar'  (el docente NO la ve)
--   2. El revisor corrige horas si hace falta, sin pasarse del contrato
--   3. El revisor "Aprueba asignaciones" → 'Pendiente'  (el docente ya la ve)
--   4. El docente diligencia    → 'Aceptado'
--   5. Semana 8/16: revisión repartida → 'Aprobada' / 'Devuelta'
--
-- 'Por Aprobar' se antepone a los estados que ya existían; el resto del
-- ciclo no cambia.
--
-- Es idempotente: se puede ejecutar varias veces.
-- ================================================================

BEGIN;

-- Quién aprobó las asignaciones y cuándo. Es distinto de revisado_por,
-- que registra la revisión de la agenda ya diligenciada.
ALTER TABLE asignacion_funciones
    ADD COLUMN IF NOT EXISTS asignacion_aprobada_por INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

ALTER TABLE asignacion_funciones
    ADD COLUMN IF NOT EXISTS asignacion_aprobada_en TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_asignacion_funciones_estado
    ON asignacion_funciones (id_periodo, estado_agenda);

-- Las asignaciones que YA existen se dan por aprobadas: los docentes
-- llevan tiempo viéndolas y esconderlas ahora sería un retroceso.
-- La compuerta aplica solo a lo que se importe de aquí en adelante.
UPDATE asignacion_funciones
SET asignacion_aprobada_en = COALESCE(asignacion_aprobada_en, creado_en, NOW())
WHERE estado_agenda IS NOT NULL
  AND estado_agenda <> 'Por Aprobar'
  AND asignacion_aprobada_en IS NULL;

COMMIT;

-- ----------------------------------------------------------------
-- Verificación
-- ----------------------------------------------------------------
-- SELECT estado_agenda, COUNT(*) FROM asignacion_funciones GROUP BY estado_agenda;
-- SELECT COUNT(*) AS sin_marca FROM asignacion_funciones WHERE asignacion_aprobada_en IS NULL;
