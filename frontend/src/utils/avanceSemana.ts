// Resumen del avance de un docente en los reportes de semana 8 y 16: cuánto lleva respecto a sus metas, dónde le falta
// y si lo que ve en pantalla ya está guardado. Funciones puras sobre los datos de la pantalla.

interface IndicadorPantalla {
  id_indicador: number
  nombre_indicador: string
  meta?: string | number | null
  ejecucion_8?: string | number | null
  ejecucion_16?: string | number | null
}
interface ActividadPantalla {
  rol_seleccionado?: string
  grupo_nombre?: string
  meta?: string | number | null
  indicadores?: IndicadorPantalla[]
}
interface FuncionPantalla {
  funcion_sustantiva: string
  actividades?: ActividadPantalla[]
}

export interface Faltante {
  funcion: number
  actividad: number
  /** id del indicador, para resaltarlo en la tabla */
  idIndicador: number
  indicador: string
  rutaFuncion: string
  rutaActividad: string
  meta: number
  ejecutado: number
  falta: number
}

export interface ResumenAvance {
  /** Suma de las metas de todos los indicadores con meta */
  metaTotal: number
  /** Lo cumplido de esas metas (cada indicador cuenta hasta su meta) */
  cumplido: number
  /** 0–100. Solo es 100 cuando TODAS las metas están cumplidas (un 99,6 % se muestra como 99) */
  porcentaje: number
  completo: boolean
  /** Indicadores que todavía no llegan a su meta, en el orden de la pantalla */
  faltantes: Faltante[]
}

const num = (v: string | number | null | undefined) => {
  const n = parseFloat(String(v ?? ''))
  return Number.isNaN(n) || n < 0 ? 0 : n
}

/** Texto para mostrar una cantidad: sin decimales si es entera, con coma si no. */
export const fmtCantidad = (n: number): string => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace('.', ','))

export function resumenAvance(data: FuncionPantalla[]): ResumenAvance {
  let metaTotal = 0
  let cumplido = 0
  const faltantes: Faltante[] = []

  data.forEach((funcion, f) => {
    (funcion.actividades || []).forEach((actividad, a) => {
      (actividad.indicadores || []).forEach((indicador) => {
        const meta = num(indicador.meta) || num(actividad.meta)
        if (meta <= 0) return // sin meta no hay nada que completar
        const ejecutado = num(indicador.ejecucion_8) + num(indicador.ejecucion_16)
        metaTotal += meta
        cumplido += Math.min(ejecutado, meta)
        if (ejecutado < meta) {
          faltantes.push({
            funcion: f,
            actividad: a,
            idIndicador: indicador.id_indicador,
            indicador: indicador.nombre_indicador,
            rutaFuncion: funcion.funcion_sustantiva,
            rutaActividad: [actividad.rol_seleccionado || 'Actividad', actividad.grupo_nombre && `Grupo ${actividad.grupo_nombre}`].filter(Boolean).join(' · '),
            meta,
            ejecutado,
            falta: meta - ejecutado,
          })
        }
      })
    })
  })

  const completo = metaTotal > 0 && faltantes.length === 0
  const porcentaje = metaTotal <= 0 ? 0 : completo ? 100 : Math.min(99, Math.round((cumplido / metaTotal) * 100))
  return { metaTotal, cumplido, porcentaje, completo, faltantes }
}

const INDICADOR_EXENTO_SEMANA_8 = 'evidencia de entrega de notas finales'
const normalizar = (t?: string | null) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

export interface SinAvance {
  funcion: number
  actividad: number
  idIndicador: number
  indicador: string
  rutaFuncion: string
  rutaActividad: string
}

/**
 * Avance semanal obligatorio: para guardar un corte todos los indicadores deben quedar en más de 0 (basta 0,1).
 * Única excepción: "Evidencia de entrega de notas finales" puede quedar en 0 en la semana 8. En la semana 16, si la meta
 * ya se cumplió en la 8 no queda nada por registrar. El servidor aplica la misma regla; esto avisa antes de enviar.
 */
export function indicadoresSinAvance(data: FuncionPantalla[], corte: '8' | '16'): SinAvance[] {
  const faltan: SinAvance[] = []
  data.forEach((funcion, f) => {
    (funcion.actividades || []).forEach((actividad, a) => {
      (actividad.indicadores || []).forEach((indicador) => {
        const meta = num(indicador.meta) || num(actividad.meta)
        if (meta <= 0) return
        if (corte === '8' && normalizar(indicador.nombre_indicador) === INDICADOR_EXENTO_SEMANA_8) return
        const sinValor = corte === '8'
          ? num(indicador.ejecucion_8) <= 0
          : meta - num(indicador.ejecucion_8) > 0 && num(indicador.ejecucion_16) <= 0
        if (!sinValor) return
        faltan.push({
          funcion: f,
          actividad: a,
          idIndicador: indicador.id_indicador,
          indicador: indicador.nombre_indicador,
          rutaFuncion: funcion.funcion_sustantiva,
          rutaActividad: [actividad.rol_seleccionado || 'Actividad', actividad.grupo_nombre && `Grupo ${actividad.grupo_nombre}`].filter(Boolean).join(' · '),
        })
      })
    })
  })
  return faltan
}

/** Huella de lo que hay en pantalla (ejecución de cada indicador): si cambia respecto a la última guardada, hay cambios sin guardar. */
export const firmaDeAvance = (data: FuncionPantalla[]): string =>
  data
    .flatMap((f) => (f.actividades || []).flatMap((a) => (a.indicadores || []).map((i) => `${i.id_indicador}:${num(i.ejecucion_8)}:${num(i.ejecucion_16)}`)))
    .join('|')
