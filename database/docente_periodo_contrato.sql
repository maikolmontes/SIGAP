-- ================================================================
-- Contrato del docente POR PERÍODO
-- ----------------------------------------------------------------
-- Un docente puede ser Medio Tiempo en un semestre y Tiempo Completo en el siguiente, así que el contrato
-- (y sus horas) viven en docente_periodo. usuarios.id_contrato queda como el contrato por defecto.
--
-- El backend aplica este mismo script solo (utils/contratoPeriodo.js) la primera vez que arranca; es idempotente
-- y se puede correr a mano en Neon sin riesgo.
-- ================================================================

ALTER TABLE docente_periodo ADD COLUMN IF NOT EXISTS id_contrato INTEGER REFERENCES tipo_contrato(id_contrato);
ALTER TABLE docente_periodo ADD COLUMN IF NOT EXISTS horas_contrato NUMERIC(5,1);

-- Rastro de los cambios que hace el Director desde "Asignaciones de Planeación"
CREATE TABLE IF NOT EXISTS contrato_periodo_log (
    id_log            SERIAL PRIMARY KEY,
    id_periodo        INTEGER NOT NULL REFERENCES periodo(id_periodo),
    id_usuario        INTEGER NOT NULL REFERENCES usuarios(id_usuario),
    id_contrato_antes INTEGER REFERENCES tipo_contrato(id_contrato),
    horas_antes       NUMERIC(5,1),
    id_contrato_nuevo INTEGER REFERENCES tipo_contrato(id_contrato),
    horas_nuevas      NUMERIC(5,1),
    cambiado_por      INTEGER REFERENCES usuarios(id_usuario),
    cambiado_en       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Cada vínculo nuevo (docente <-> período) copia el contrato del perfil
CREATE OR REPLACE FUNCTION docente_periodo_copiar_contrato() RETURNS trigger AS $f$
BEGIN
    IF NEW.id_contrato IS NULL THEN
        SELECT u.id_contrato, tc.horas_contrato INTO NEW.id_contrato, NEW.horas_contrato
        FROM usuarios u LEFT JOIN tipo_contrato tc ON tc.id_contrato = u.id_contrato
        WHERE u.id_usuario = NEW.id_usuario;
    END IF;
    RETURN NEW;
END;
$f$ LANGUAGE plpgsql;

DO $d$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_docente_periodo_contrato' AND tgrelid = 'docente_periodo'::regclass) THEN
        CREATE TRIGGER trg_docente_periodo_contrato BEFORE INSERT ON docente_periodo
        FOR EACH ROW EXECUTE FUNCTION docente_periodo_copiar_contrato();
    END IF;
END $d$;

-- Los períodos que ya existían conservan el contrato actual de cada docente
UPDATE docente_periodo dp
SET id_contrato = u.id_contrato, horas_contrato = tc.horas_contrato
FROM usuarios u
LEFT JOIN tipo_contrato tc ON tc.id_contrato = u.id_contrato
WHERE dp.id_usuario = u.id_usuario AND dp.id_contrato IS NULL;
