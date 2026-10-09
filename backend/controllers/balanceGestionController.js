// GET /api/director/balance-gestion?programa=<id>&periodo=<id>
// Balance de gestión de un programa en un período: devuelve el documento ya redactado. Un Director solo puede pedir
// los programas que gestiona; Planeación, Admin y Consultor, cualquiera.
const pool = require('../db/connection');
const { alcanceProgramas } = require('../utils/rolActivo');
const { construirBalance, BalanceError } = require('../services/balanceGestion');
const { construirDocumento } = require('../services/balanceDocumento');

const entero = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
};

const getBalanceGestion = async (req, res) => {
    try {
        const idPrograma = entero(req.query.programa);
        const idPeriodo = entero(req.query.periodo);
        if (!idPrograma || !idPeriodo) {
            return res.status(400).json({ error: 'Indica el programa y el período del balance.' });
        }

        const alcance = await alcanceProgramas(req);
        if (alcance.restringido && !alcance.ids.includes(idPrograma)) {
            return res.status(403).json({ error: 'No tienes acceso a este programa.' });
        }

        const balance = await construirBalance(pool, { idPrograma, idPeriodo });
        res.json({
            generadoEn: balance.generadoEn,
            programa: balance.programa,
            periodo: balance.periodo,
            directores: balance.directores,
            documento: construirDocumento(balance),
        });
    } catch (error) {
        if (error instanceof BalanceError) return res.status(error.estado).json({ error: error.message });
        console.error('Error al armar el balance de gestión:', error);
        res.status(500).json({ error: 'No se pudo armar el balance de gestión.' });
    }
};

module.exports = { getBalanceGestion };
