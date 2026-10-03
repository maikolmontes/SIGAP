// ================================================================
// SIGAP — Servicio de interpretación descriptiva (Gemini)
// ----------------------------------------------------------------
// Reglas no negociables de esta integración:
//
//  · Gemini NO se conecta a la base de datos, no conoce el esquema
//    y no genera SQL. Recibe únicamente el JSON agregado que ya
//    calculó el backend.
//  · El payload se sanitiza antes de salir: nada de cédulas, correos,
//    nombres propios, tokens ni credenciales. Solo cifras agregadas.
//  · Es una capa opcional. Si falta la API key, si la cuota se agota
//    o si Google responde con error, la analítica numérica sigue
//    funcionando y la interfaz muestra un aviso discreto.
// ================================================================

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { GoogleGenAI } = require('@google/genai');

const crypto = require('crypto');

const {
    GEMINI_API_KEY,
    // gemini-2.5-flash quedó cerrado para cuentas nuevas (404 NOT_FOUND).
    GEMINI_MODEL = 'gemini-3.6-flash',
    // El nivel gratuito permite ~20 peticiones AL DÍA por modelo, así que el
    // tope por minuto se deja bajo a propósito. La caché de abajo es lo que
    // realmente evita quemar la cuota.
    ANALYTICS_AI_RATE_LIMIT = '5',
    ANALYTICS_AI_CACHE_MIN = '120'
} = process.env;

const habilitado = !!GEMINI_API_KEY;

let cliente = null;
const getCliente = () => {
    if (!habilitado) return null;
    if (!cliente) cliente = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    return cliente;
};

// ----------------------------------------------------------------
// Control de tasa por usuario: ventana deslizante de 1 minuto.
// Protege la cuota (que cuesta dinero), no el rendimiento.
// ----------------------------------------------------------------
const LIMITE = Math.max(1, parseInt(ANALYTICS_AI_RATE_LIMIT, 10) || 10);
const VENTANA_MS = 60 * 1000;
const golpes = new Map(); // idUsuario -> number[] (marcas de tiempo)

const dentroDelLimite = (idUsuario) => {
    const ahora = Date.now();
    const previos = (golpes.get(idUsuario) || []).filter((t) => ahora - t < VENTANA_MS);

    if (previos.length >= LIMITE) {
        golpes.set(idUsuario, previos);
        return { ok: false, restantes: 0, esperaSeg: Math.ceil((VENTANA_MS - (ahora - previos[0])) / 1000) };
    }

    previos.push(ahora);
    golpes.set(idUsuario, previos);

    // Limpieza oportunista para que el Map no crezca sin límite
    if (golpes.size > 500) {
        for (const [k, v] of golpes) {
            if (v.every((t) => ahora - t >= VENTANA_MS)) golpes.delete(k);
        }
    }

    return { ok: true, restantes: LIMITE - previos.length };
};

// ----------------------------------------------------------------
// Caché de interpretaciones.
//
// El panel pide una lectura cada vez que se carga o se cambia el filtro.
// Con una cuota gratuita de ~20 peticiones diarias, una sesión normal de
// uso la agotaría en minutos. Como las mismas cifras siempre producen la
// misma descripción, se cachea por huella del payload: repetir una vista
// ya consultada no cuesta cuota ni espera.
// ----------------------------------------------------------------
const TTL_MS = Math.max(1, parseInt(ANALYTICS_AI_CACHE_MIN, 10) || 120) * 60 * 1000;
const cache = new Map(); // huella -> { resultado, expira }

const huella = (payload) =>
    crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');

const leerCache = (clave) => {
    const item = cache.get(clave);
    if (!item) return null;
    if (Date.now() > item.expira) { cache.delete(clave); return null; }
    return item.resultado;
};

const guardarCache = (clave, resultado) => {
    cache.set(clave, { resultado, expira: Date.now() + TTL_MS });
    if (cache.size > 200) {
        const ahora = Date.now();
        for (const [k, v] of cache) if (ahora > v.expira) cache.delete(k);
    }
};

// ----------------------------------------------------------------
// Sanitización: se queda solo con cifras y etiquetas de categoría.
// Cualquier campo ajeno al contrato se descarta de forma explícita.
// ----------------------------------------------------------------
const sanitizarMetrica = (m) => ({
    indicador: m.indicadorId,
    titulo: m.titulo,
    unidadPrincipal: m.series?.[0]?.unidad || null,
    categorias: Array.isArray(m.categorias) ? m.categorias.map(String) : [],
    series: Array.isArray(m.series)
        ? m.series.map((s) => ({
            nombre: s.nombre,
            unidad: s.unidad || null,
            datos: Array.isArray(s.datos) ? s.datos.map((d) => Number(d) || 0) : []
        }))
        : [],
    resumen: {
        total: Number(m.resumenNumerico?.total) || 0,
        promedio: Number(m.resumenNumerico?.promedio) || 0,
        porcentajeGlobal: Number(m.resumenNumerico?.porcentajeGlobal) || 0
    }
});

// La tabla de docentes (IND-04) lleva nombres y correos: nunca sale.
const ES_SENSIBLE = new Set(['IND-04']);

const construirPayload = (indicadores = [], periodo) => ({
    periodo: periodo || null,
    indicadores: indicadores
        .filter((m) => m && m.indicadorId && !ES_SENSIBLE.has(m.indicadorId))
        .map(sanitizarMetrica)
});

// ----------------------------------------------------------------
const PROMPT_SISTEMA = `Actúa como analista descriptivo de datos académicos de la Universidad CESMAG.
Interpretas de forma neutral, técnica y descriptiva un resumen numérico de indicadores de actividad docente.

Reglas estrictas:
1. Basa tu análisis EXCLUSIVAMENTE en las cifras del JSON que recibes.
2. NO inventes datos, porcentajes, causas ni nombres de personas.
3. NO emitas recomendaciones estratégicas, juicios sobre contratación ni cambios de política.
4. Limítate a describir: proporciones, funciones con mayor y menor carga, variaciones entre la semana 8 y la semana 16, y niveles de cumplimiento.
5. Si un indicador viene en cero o vacío, dilo como un hecho ("no hay ejecución registrada"), sin especular por qué.
6. Escribe en español de Colombia, en tercera persona, sin adjetivos valorativos.`;

const ESQUEMA_RESPUESTA = {
    type: 'object',
    properties: {
        resumen: { type: 'string', description: 'Síntesis de una o dos oraciones del estado general.' },
        hallazgos: { type: 'array', items: { type: 'string' }, description: 'Hechos descriptivos cuantitativos.' },
        observaciones: { type: 'array', items: { type: 'string' }, description: 'Variaciones notables o datos ausentes.' }
    },
    required: ['resumen', 'hallazgos', 'observaciones']
};

/**
 * Genera la interpretación descriptiva de un conjunto de métricas.
 * Nunca lanza: siempre devuelve un objeto con `disponible`.
 */
const interpretarMetricas = async ({ indicadores, periodo, idUsuario }) => {
    const base = {
        periodo: periodo || null,
        resumen: '',
        hallazgos: [],
        observaciones: [],
        generadoEn: new Date().toISOString(),
        disponible: false
    };

    if (!habilitado) {
        return { ...base, motivo: 'no_configurado' };
    }

    const payload = construirPayload(indicadores, periodo);
    if (payload.indicadores.length === 0) {
        return { ...base, motivo: 'sin_datos' };
    }

    // La caché se consulta ANTES del límite: repetir una vista ya
    // interpretada no debe gastar cuota ni chocar contra el tope.
    const clave = huella(payload);
    const enCache = leerCache(clave);
    if (enCache) return { ...enCache, deCache: true };

    const cuota = dentroDelLimite(idUsuario || 'anonimo');
    if (!cuota.ok) {
        return { ...base, motivo: 'limite_alcanzado', esperaSeg: cuota.esperaSeg };
    }

    try {
        const respuesta = await getCliente().models.generateContent({
            model: GEMINI_MODEL,
            contents: `${PROMPT_SISTEMA}\n\nDatos del período:\n${JSON.stringify(payload)}`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: ESQUEMA_RESPUESTA,
                temperature: 0.2,
                // Gemini 3 razona antes de responder y ese "thinking" consume
                // presupuesto de salida: con un tope bajo el JSON llegaba
                // truncado. Esta tarea es descriptiva, no requiere razonar.
                thinkingConfig: { thinkingBudget: 0 },
                maxOutputTokens: 2048
            }
        });

        const texto = respuesta.text;
        if (!texto) {
            const motivoCorte = respuesta?.candidates?.[0]?.finishReason;
            console.warn('[gemini] Respuesta sin texto. finishReason:', motivoCorte || 'desconocido');
            return { ...base, motivo: 'respuesta_vacia' };
        }

        let datos;
        try {
            datos = JSON.parse(texto);
        } catch {
            // Si el modelo corta la salida, el JSON queda inválido. Se registra
            // el motivo real del corte para poder diagnosticarlo.
            const motivoCorte = respuesta?.candidates?.[0]?.finishReason;
            console.warn(`[gemini] JSON inválido (finishReason: ${motivoCorte || 'desconocido'}, ${texto.length} caracteres).`);
            return { ...base, motivo: 'respuesta_incompleta' };
        }
        const resultado = {
            ...base,
            resumen: String(datos.resumen || '').trim(),
            hallazgos: Array.isArray(datos.hallazgos) ? datos.hallazgos.map(String) : [],
            observaciones: Array.isArray(datos.observaciones) ? datos.observaciones.map(String) : [],
            disponible: true
        };

        guardarCache(clave, resultado);
        return resultado;
    } catch (error) {
        // La cuota gratuita (429 RESOURCE_EXHAUSTED) se distingue del resto:
        // no es una falla del servicio sino un tope diario alcanzado.
        const esCuota = /429|RESOURCE_EXHAUSTED|quota/i.test(error.message || '');
        console.error(`[gemini] No se pudo generar la interpretación${esCuota ? ' (cuota agotada)' : ''}:`, error.message);
        return { ...base, motivo: esCuota ? 'cuota_agotada' : 'error_proveedor' };
    }
};

module.exports = {
    interpretarMetricas,
    construirPayload,
    estaHabilitado: () => habilitado,
    limitePorMinuto: () => LIMITE
};
