import api from './api'

// Notificaciones del usuario que inició sesión (la campana de la barra superior)
export interface NotificacionApp {
    id: number
    tipo: string
    titulo: string
    mensaje: string | null
    enlace: string | null
    leida: boolean
    creado_en: string
}

export const getMisNotificaciones = (limite = 20) =>
    api.get<{ notificaciones: NotificacionApp[]; no_leidas: number }>('/mis-notificaciones', { params: { limite } })

export const getContadorNotificaciones = () =>
    api.get<{ no_leidas: number }>('/mis-notificaciones/contador')

export const marcarNotificacionLeida = (id: number) => api.patch(`/mis-notificaciones/${id}/leida`)

export const marcarTodasLasNotificacionesLeidas = () => api.patch('/mis-notificaciones/leidas')

export const eliminarNotificacion = (id: number) => api.delete(`/mis-notificaciones/${id}`)

export const eliminarNotificaciones = (soloLeidas = false) =>
    api.delete('/mis-notificaciones', { params: soloLeidas ? { solo: 'leidas' } : {} })
