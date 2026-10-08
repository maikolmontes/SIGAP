-- Notificaciones dentro de la aplicación (la campana de la barra superior).
-- El backend crea la tabla sola si no existe (services/notificacionesApp.js);
-- este script es la referencia y sirve para crearla a mano.
CREATE TABLE IF NOT EXISTS notificaciones_app (
    id_notificacion SERIAL PRIMARY KEY,
    id_usuario      INTEGER      NOT NULL,
    tipo            VARCHAR(40)  NOT NULL,   -- agenda_enviada, agenda_aprobada, agenda_devuelta, bienvenida,
                                             -- apertura_periodo, asignaciones_cargadas, recordatorio_plazo
    titulo          VARCHAR(200) NOT NULL,
    mensaje         TEXT,
    enlace          VARCHAR(300),            -- ruta interna a la que lleva al hacer clic
    clave           VARCHAR(200),            -- evita repetir un aviso mientras haya uno sin leer
    leida           BOOLEAN      NOT NULL DEFAULT FALSE,
    creado_en       TIMESTAMP    NOT NULL DEFAULT NOW(),
    leida_en        TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notif_app_usuario ON notificaciones_app (id_usuario, leida, creado_en DESC);
