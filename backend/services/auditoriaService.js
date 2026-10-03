// ================================================================
// SIGAP — Auditoría de acciones sensibles
// ----------------------------------------------------------------
// Deja constancia de QUIÉN hizo QUÉ y CUÁNDO en las acciones que no se
// pueden deshacer (eliminar agendas, etc.). Es evidencia de trazabilidad
// para los procesos de aseguramiento de la calidad.
//
// Regla: registrar jamás debe romper la acción de negocio. Si la tabla o
// el insert fallan, se avisa en consola y el flujo sigue.
// ================================================================
const pool = require('../db/connection');

let tablaLista = false;

const asegurarTabla = async () => {
    if (tablaLista) return true;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS auditoria (
                id_auditoria   SERIAL PRIMARY KEY,
                accion         VARCHAR(60)  NOT NULL,
                entidad        VARCHAR(60),
                id_usuario     INTEGER,
                correo_usuario VARCHAR(180),
                rol_activo     VARCHAR(60),
                ip             VARCHAR(60),
                detalle        JSONB,
                creado_en      TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_auditoria_accion ON auditoria (accion, creado_en DESC)');
        tablaLista = true;
        return true;
    } catch (error) {
        console.warn('[auditoria] No se pudo preparar la tabla:', error.message);
        return false;
    }
};

/**
 * @param {import('express').Request} req   quien ejecuta la acción
 * @param {{accion: string, entidad?: string, detalle?: object}} datos
 */
const registrar = async (req, { accion, entidad = null, detalle = {} }) => {
    try {
        if (!(await asegurarTabla())) return;
        await pool.query(
            `INSERT INTO auditoria (accion, entidad, id_usuario, correo_usuario, rol_activo, ip, detalle)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                accion,
                entidad,
                req?.user?.id ?? null,
                req?.user?.correo ?? null,
                req?.headers?.['x-rol-activo'] ?? null,
                req?.ip ?? null,
                JSON.stringify(detalle),
            ]
        );
    } catch (error) {
        console.warn('[auditoria] No se pudo registrar la acción:', error.message);
    }
};

module.exports = { registrar };
