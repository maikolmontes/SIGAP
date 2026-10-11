// Columna "descripcion" de las evidencias: qué contiene lo que el docente subió (texto breve, opcional).
// Se crea sola si no existe (idempotente) para que desplegar no dependa de correr un script a mano;
// el mismo cambio está en database/evidencias_descripcion.sql.
const pool = require('../db/connection');

const MAX_DESCRIPCION = 300;
let lista = false;

const asegurarDescripcionEvidencias = async (db = pool) => {
    if (lista) return;
    await db.query(`ALTER TABLE evidencias ADD COLUMN IF NOT EXISTS descripcion VARCHAR(${MAX_DESCRIPCION})`);
    lista = true;
};

/** Texto limpio para guardar: espacios normalizados y recortado al máximo. Vacío → null. */
const limpiarDescripcion = (valor) => {
    const texto = String(valor ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_DESCRIPCION);
    return texto || null;
};

module.exports = { asegurarDescripcionEvidencias, limpiarDescripcion, MAX_DESCRIPCION };
