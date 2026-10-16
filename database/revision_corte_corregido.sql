-- Marca cuándo el docente corrigió y envió de nuevo una función que el director había devuelto en un corte.
-- Idempotente. El backend también la crea sola si falta.
ALTER TABLE revision_corte ADD COLUMN IF NOT EXISTS corregido_en TIMESTAMP;
