-- Descripción breve de cada evidencia (qué contiene el archivo o el enlace). Opcional.
-- El backend ejecuta lo mismo al subir o consultar evidencias; este script sirve para aplicarlo a mano.
ALTER TABLE evidencias ADD COLUMN IF NOT EXISTS descripcion VARCHAR(300);
