-- ================================================================
-- SIGAP — Revisión de agendas repartida por función sustantiva
-- ----------------------------------------------------------------
-- Antes: el Director revisaba la agenda COMPLETA de sus docentes.
-- Ahora: la agenda de un docente se reparte entre varios revisores y
-- cada uno aprueba únicamente su función sustantiva.
--
--   Director      → Docencia Directa, Docencia Indirecta,
--                   Académico-Administrativo, Aseguramiento de Calidad,
--                   Vicerrectoría        (restringido a SUS programas)
--   Investigación → Investigación        (institucional, todos los programas)
--
-- El alcance de programas sigue resolviéndose con director_programa;
-- este archivo solo agrega el alcance por FUNCIÓN.
--
-- Es idempotente: se puede ejecutar varias veces sin duplicar nada.
-- ================================================================

BEGIN;

-- ----------------------------------------------------------------
-- 1. Qué funciones sustantivas revisa cada rol (N:N)
--
-- Se usa una tabla y no el nombre del rol por convención porque:
--   · un rol revisa varias funciones (el Director revisa cinco),
--   · renombrar un rol no debe romper la revisión,
--   · crear un revisor nuevo debe ser un INSERT, no tocar código.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rol_funcion (
    id_rol             INTEGER      NOT NULL REFERENCES roles(id_rol) ON DELETE CASCADE,
    funcion_sustantiva VARCHAR(150) NOT NULL,
    PRIMARY KEY (id_rol, funcion_sustantiva)
);

CREATE INDEX IF NOT EXISTS idx_rol_funcion_funcion ON rol_funcion (funcion_sustantiva);

-- ----------------------------------------------------------------
-- 2. Rol comodín
--
-- La importación de Excel puede crear funciones sustantivas nuevas
-- (mapFuncionSustantiva devuelve el texto tal cual si no lo reconoce).
-- Sin esto, una función que ningún rol reclame quedaría huérfana y la
-- agenda de ese docente nunca podría completarse.
-- El rol comodín revisa además TODA función que nadie más tenga asignada.
-- ----------------------------------------------------------------
ALTER TABLE roles ADD COLUMN IF NOT EXISTS es_comodin BOOLEAN NOT NULL DEFAULT FALSE;

-- ----------------------------------------------------------------
-- 3. Rol de Investigación
-- ----------------------------------------------------------------
INSERT INTO roles (nombre_rol, descripcion_rol)
SELECT 'Investigacion',
       'Revisa la función sustantiva de Investigación de todos los programas: aprueba, devuelve y deja observaciones'
WHERE NOT EXISTS (
    SELECT 1 FROM roles WHERE LOWER(nombre_rol) IN ('investigacion', 'investigación')
);

-- ----------------------------------------------------------------
-- 4. Asignación de funciones a cada rol
-- ----------------------------------------------------------------

-- Director: todo lo que no es Investigación. Es el comodín por ahora.
INSERT INTO rol_funcion (id_rol, funcion_sustantiva)
SELECT r.id_rol, f.funcion
FROM roles r
CROSS JOIN (VALUES
    ('Docencia Directa'),
    ('Docencia Indirecta'),
    ('Académico-Administrativo'),
    ('Aseguramiento de Calidad'),
    ('Vicerrectoría')
) AS f(funcion)
WHERE LOWER(r.nombre_rol) = 'director'
ON CONFLICT DO NOTHING;

UPDATE roles SET es_comodin = TRUE  WHERE LOWER(nombre_rol) = 'director';
UPDATE roles SET es_comodin = FALSE WHERE LOWER(nombre_rol) <> 'director';

-- Investigación: solo su función.
INSERT INTO rol_funcion (id_rol, funcion_sustantiva)
SELECT r.id_rol, 'Investigación'
FROM roles r
WHERE LOWER(r.nombre_rol) IN ('investigacion', 'investigación')
ON CONFLICT DO NOTHING;

COMMIT;

-- ----------------------------------------------------------------
-- Verificación: qué revisa cada rol y cuántas funciones quedan huérfanas
-- ----------------------------------------------------------------
-- SELECT r.nombre_rol, r.es_comodin, STRING_AGG(rf.funcion_sustantiva, ', ' ORDER BY rf.funcion_sustantiva) AS revisa
-- FROM roles r LEFT JOIN rol_funcion rf ON rf.id_rol = r.id_rol
-- GROUP BY r.id_rol, r.nombre_rol, r.es_comodin ORDER BY r.id_rol;
--
-- SELECT DISTINCT af.funcion_sustantiva AS sin_revisor
-- FROM asignacion_funciones af
-- WHERE NOT EXISTS (SELECT 1 FROM rol_funcion rf WHERE rf.funcion_sustantiva = af.funcion_sustantiva);
