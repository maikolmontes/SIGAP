-- ================================================================
-- SIGAP — Bitácora de notificaciones por correo electrónico
-- ----------------------------------------------------------------
-- Cumple dos funciones:
--   1. Trazabilidad: deja constancia de cada correo que envió el
--      sistema (útil como evidencia de operación del SIGAP).
--   2. Evitar duplicados: la columna "clave" identifica el evento
--      concreto (por ejemplo la radicación de la agenda de un
--      docente en un período) para no reenviar el mismo aviso.
--
-- El backend crea esta tabla automáticamente si no existe
-- (services/notificacionesService.js), así que ejecutar este script
-- es opcional.
-- ================================================================

CREATE TABLE IF NOT EXISTS notificaciones_log (
    id_notificacion SERIAL PRIMARY KEY,
    tipo            VARCHAR(50)  NOT NULL,
    clave           VARCHAR(160) NOT NULL,
    destinatario    VARCHAR(180) NOT NULL,
    asunto          TEXT,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'enviado',  -- enviado | error
    detalle         TEXT,
    enviado_en      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_log_clave  ON notificaciones_log (clave);
CREATE INDEX IF NOT EXISTS idx_notificaciones_log_tipo   ON notificaciones_log (tipo);
CREATE INDEX IF NOT EXISTS idx_notificaciones_log_fecha  ON notificaciones_log (enviado_en DESC);
