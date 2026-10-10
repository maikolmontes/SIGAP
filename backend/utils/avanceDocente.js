// Avance general del docente en el período: Σ ejecución / Σ meta, como el "% de logro" del formato institucional.
// Promediar el % de cada función daba el mismo peso a una función de 1 h que a una de 20 h.

const num = (v) => Number(v) || 0;

/**
 * @param porFuncion [{ meta, ejec8, ejec16 }] una fila por función sustantiva
 * @returns { metaTotal, ejecucionCumplida, avanceGeneral }
 *   · La ejecución de cada función cuenta hasta su meta (no se pasa de ahí).
 *   · avanceGeneral llega a 100 SOLO cuando todas las metas están cumplidas: un 99,6 % se
 *     muestra como 99 y no como 100, para que "100 %" signifique "todo completo".
 */
const calcularAvanceGeneral = (porFuncion = []) => {
    const metaTotal = porFuncion.reduce((s, f) => s + num(f.meta), 0);
    const ejecucionCumplida = porFuncion.reduce((s, f) => s + Math.min(num(f.ejec8) + num(f.ejec16), num(f.meta)), 0);

    let avanceGeneral = 0;
    if (metaTotal > 0) {
        avanceGeneral = ejecucionCumplida >= metaTotal ? 100 : Math.min(99, Math.round((ejecucionCumplida / metaTotal) * 100));
    }
    return { metaTotal, ejecucionCumplida, avanceGeneral };
};

module.exports = { calcularAvanceGeneral };
