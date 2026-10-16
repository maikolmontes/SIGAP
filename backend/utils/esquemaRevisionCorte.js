// Columna "corregido_en" de revision_corte: cuándo el docente envió de nuevo una función que el director devolvió.
// Se crea sola si no existe (idempotente); el mismo cambio está en database/revision_corte_corregido.sql.
const pool = require('../db/connection');

let lista = false;

const asegurarCorregidoEn = async (db = pool) => {
    if (lista) return;
    await db.query('ALTER TABLE revision_corte ADD COLUMN IF NOT EXISTS corregido_en TIMESTAMP');
    lista = true;
};

module.exports = { asegurarCorregidoEn };
