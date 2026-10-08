import api from './api'

// Catálogo maestro de la agenda: función → actividad → descripción → indicador
export interface IndicadorCatalogo {
    id: number
    nombre: string
    activo: boolean
    en_uso: number
}

export interface DescripcionCatalogo {
    id: number
    texto: string
    meta: number | null
    activo: boolean
    en_uso: number
    indicadores: IndicadorCatalogo[]
}

export interface ActividadCatalogo {
    id: number
    nombre: string
    activo: boolean
    en_uso: number
    protegida: boolean
    descripciones: DescripcionCatalogo[]
}

export interface FuncionCatalogo {
    id: number
    nombre: string
    activo: boolean
    en_uso: number
    protegida: boolean
    /** Solo Docencia Directa lleva meta en el catálogo; en las demás la registra el docente */
    usa_meta: boolean
    /** En Docencia Indirecta el catálogo llega hasta la descripción: el indicador lo registra el docente */
    usa_indicadores: boolean
    actividades: ActividadCatalogo[]
}

// Asignatura (espacio académico) cargada por el importador del listado de Excel
export interface AsignaturaCatalogo {
    id: number
    nombre: string
    codigo: string | null
    creditos: number | null
    horas_semana: number | null
    activo: boolean
    semestre: string | null
    pensum: string | null
    en_agendas: number
}

export interface DatosActividad {
    nombre: string
    descripcion: string
    meta?: number | string
    indicador?: string
}

export type TipoElemento = 'funciones' | 'actividades' | 'descripciones' | 'indicadores'

export const getArbolCatalogo = () => api.get<{ funciones: FuncionCatalogo[] }>('/parametros/arbol')

export const getAsignaturasCargadas = () => api.get<{ asignaturas: AsignaturaCatalogo[] }>('/parametros/asignaturas')

export const crearFuncionCatalogo = (nombre: string, actividad: DatosActividad) =>
    api.post('/parametros/funciones', { nombre, actividad })

export const crearActividadCatalogo = (idFuncion: number, datos: DatosActividad) =>
    api.post(`/parametros/funciones/${idFuncion}/actividades`, datos)

export const crearDescripcionCatalogo = (idActividad: number, datos: { texto: string; meta?: number | string; indicador?: string }) =>
    api.post(`/parametros/actividades/${idActividad}/descripciones`, datos)

export const crearIndicadorCatalogo = (idDescripcion: number, nombre: string) =>
    api.post(`/parametros/descripciones/${idDescripcion}/indicadores`, { nombre })

export const editarFuncionCatalogo = (id: number, nombre: string) => api.put(`/parametros/funciones/${id}`, { nombre })
export const editarActividadCatalogo = (id: number, nombre: string) => api.put(`/parametros/actividades/${id}`, { nombre })
export const editarDescripcionCatalogo = (id: number, texto: string, meta?: number | string) =>
    api.put(`/parametros/descripciones/${id}`, { texto, meta })
export const editarIndicadorCatalogo = (id: number, nombre: string) => api.put(`/parametros/indicadores/${id}`, { nombre })

export const cambiarVisibilidadCatalogo = (tipo: TipoElemento, id: number, activo: boolean) =>
    api.patch(`/parametros/${tipo}/${id}/activo`, { activo })

export const eliminarElementoCatalogo = (tipo: TipoElemento, id: number) => api.delete(`/parametros/${tipo}/${id}`)
