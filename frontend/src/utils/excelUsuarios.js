// Lectura del Excel de carga masiva de usuarios/docentes.
//
// Entiende la plantilla oficial (plantilla_docentes_SIGAP.xlsx): el banner ocupa las
// primeras filas y los encabezados están más abajo ("Nombres *", "Correo Institucional *"…),
// pero también acepta un archivo simple con los encabezados en la primera fila.
//
// NO inventa valores: si falta un dato (documento, programa…) se envía vacío y el servidor
// informa el error de esa fila. Antes se rellenaba con '0000000000' o con un programa fijo.

/** Minúsculas, sin tildes, sin asteriscos ni signos: "Número Documento *" -> "numero documento". */
export const normalizarEncabezado = (valor) =>
    String(valor ?? '')
        .normalize('NFD')
        .split('')
        .filter((c) => c.charCodeAt(0) < 0x300 || c.charCodeAt(0) > 0x36f) // quita las tildes
        .join('')
        .toLowerCase()
        .replace(/[*_():]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .join(' ');

// Nombre interno -> variantes aceptadas del encabezado (ya normalizadas)
const ALIAS = {
    nombres: ['nombres', 'nombre', 'nombres completos'],
    apellidos: ['apellidos', 'apellido'],
    tipo_documento: ['tipo documento', 'tipo de documento', 'tipodocumento', 'tipo doc'],
    numero_documento: ['numero documento', 'numero de documento', 'documento', 'identificacion', 'numero identificacion', 'cedula', 'no documento', 'nro documento'],
    correo: ['correo institucional', 'correo', 'email', 'correo electronico', 'e mail'],
    roles: ['roles', 'rol', 'roles de acceso'],
    programa: ['programa academico', 'programa', 'programa de formacion'],
    tipo_contrato: ['tipo contrato', 'tipo de contrato', 'vinculacion', 'dedicacion'],
};

const CAMPOS_CLAVE = ['nombres', 'apellidos', 'correo'];

const campoDeEncabezado = (texto) => {
    const norm = normalizarEncabezado(texto);
    if (!norm) return null;
    for (const [campo, variantes] of Object.entries(ALIAS)) {
        if (variantes.includes(norm)) return campo;
    }
    return null;
};

const aTexto = (celda) => {
    if (celda === null || celda === undefined) return '';
    if (typeof celda === 'number') return Number.isInteger(celda) ? String(celda) : String(celda).trim();
    return String(celda).trim();
};

const esFilaDeEjemplo = (texto) => {
    const t = texto.toLowerCase();
    return t.startsWith('ej:') || t.startsWith('ej.') || t.startsWith('ejemplo');
};

/**
 * @param {any[][]} matriz  hoja como matriz de filas (XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }))
 * @returns {{ filas: object[], encabezadoEncontrado: boolean, filaEncabezado: number|null, ignoradas: number }}
 */
export const leerFilasUsuarios = (matriz) => {
    // 1) Localizar la fila de encabezados (en las primeras 40 filas): la que contiene nombres, apellidos y correo
    let idxEncabezado = -1;
    let columnas = {};
    for (let i = 0; i < Math.min(matriz.length, 40); i++) {
        const mapa = {};
        (matriz[i] || []).forEach((celda, col) => {
            const campo = campoDeEncabezado(celda);
            if (campo && mapa[campo] === undefined) mapa[campo] = col;
        });
        if (CAMPOS_CLAVE.every((c) => mapa[c] !== undefined)) {
            idxEncabezado = i;
            columnas = mapa;
            break;
        }
    }
    if (idxEncabezado === -1) {
        return { filas: [], encabezadoEncontrado: false, filaEncabezado: null, ignoradas: 0 };
    }

    // 2) Leer las filas siguientes
    const filas = [];
    let ignoradas = 0;
    for (let i = idxEncabezado + 1; i < matriz.length; i++) {
        const fila = matriz[i] || [];
        const registro = { fila: i + 1 }; // número de fila tal como lo ve el usuario en Excel
        for (const [campo, col] of Object.entries(columnas)) registro[campo] = aTexto(fila[col]);

        const valores = Object.entries(registro).filter(([k]) => k !== 'fila').map(([, v]) => v);
        if (valores.every((v) => v === '')) continue; // fila vacía
        if (valores.some(esFilaDeEjemplo)) { ignoradas++; continue; } // fila guía de la plantilla

        filas.push(registro);
    }
    return { filas, encabezadoEncontrado: true, filaEncabezado: idxEncabezado + 1, ignoradas };
};
