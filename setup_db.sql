TRUNCATE periodo CASCADE;
TRUNCATE semana CASCADE;

ALTER TABLE semana ADD COLUMN IF NOT EXISTS id_periodo INT REFERENCES periodo(id_periodo) ON DELETE CASCADE;
ALTER TABLE semana ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
ALTER TABLE semana ADD COLUMN IF NOT EXISTS fecha_fin DATE;

INSERT INTO periodo (anio, semestre, fecha_inicio, fecha_fin, activo, creado_en)
VALUES (2025, 1, '2025-02-01', '2025-06-30', TRUE, NOW());
