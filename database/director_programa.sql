-- ================================================================
-- SIGAP — Directores con uno o varios programas (relación N:N)
-- ----------------------------------------------------------------
-- Antes: un Director estaba atado a UN programa (usuarios.id_programa).
-- Ahora: un Director puede gestionar varios programas (p. ej. Ingeniería
-- Mecánica + Ingeniería Financiera) y un programa puede tener varios
-- directores. usuarios.id_programa se conserva: para un docente sigue
-- siendo su programa; para un director es su programa principal.
--
-- Es idempotente: se puede ejecutar más de una vez sin duplicar filas.
-- ================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS director_programa (
    id_usuario  INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_programa INTEGER NOT NULL REFERENCES programa_academico(id_programa) ON DELETE CASCADE,
    PRIMARY KEY (id_usuario, id_programa)
);

CREATE INDEX IF NOT EXISTS idx_director_programa_programa ON director_programa (id_programa);

-- Migrar lo existente: cada director conserva el programa que ya tenía.
INSERT INTO director_programa (id_usuario, id_programa)
SELECT DISTINCT u.id_usuario, u.id_programa
FROM usuarios u
JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
JOIN roles r ON r.id_rol = ur.id_rol AND LOWER(r.nombre_rol) = 'director'
WHERE u.id_programa IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
