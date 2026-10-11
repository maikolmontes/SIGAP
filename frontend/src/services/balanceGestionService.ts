import api from './api'

// Balance de gestión de un programa en un período: el servidor entrega el documento ya redactado
export type Bloque =
    | { tipo: 'parrafo'; texto: string }
    | { tipo: 'lista'; items: { titulo?: string; texto: string }[] }
    | { tipo: 'tabla'; columnas: string[]; filas: string[][]; numericas?: number[]; nota?: string }

export interface SeccionDocumento {
    nivel: 1 | 2
    titulo: string
    bloques: Bloque[]
}

export interface DocumentoBalance {
    titulo: string
    subtitulo: string
    portada: { programa: string; facultad: string; periodo: string; directores: string[]; generadoEn: string }
    secciones: SeccionDocumento[]
}

export interface BalanceGestion {
    generadoEn: string
    programa: { id: number; nombre: string; facultad: string }
    periodo: { id: number; etiqueta: string; semestre: number; fechaInicio: string | null; fechaFin: string | null; activo: boolean }
    directores: string[]
    documento: DocumentoBalance
    /** Si viene, es el comienzo del nombre del archivo descargado (informes que no son el balance de gestión) */
    archivoBase?: string
}

// Texto que el director escribe y se agrega al final del documento (no se guarda en el servidor)
export interface ValoracionDirector {
    logros: string
    dificultades: string
    conclusiones: string
    recomendaciones: string
}

export const getBalanceGestion = (programa: number, periodo: number) =>
    api.get<BalanceGestion>('/director/balance-gestion', { params: { programa, periodo } })
