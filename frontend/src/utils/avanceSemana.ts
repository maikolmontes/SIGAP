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

/** Huella de lo que hay en pantalla (ejecución de cada indicador): si cambia respecto a la última guardada, hay cambios sin guardar. */
export const firmaDeAvance = (data: FuncionPantalla[]): string =>
  data
    .flatMap((f) => (f.actividades || []).flatMap((a) => (a.indicadores || []).map((i) => `${i.id_indicador}:${num(i.ejecucion_8)}:${num(i.ejecucion_16)}`)))
    .join('|')
