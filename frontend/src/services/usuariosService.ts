import api from './api'

export const getUsuarios = () => {
    return api.get('/usuarios')
}

export const getUsuarioById = (id: string | number) => {
    return api.get(`/usuarios/${id}`)
}

export const createUsuario = (data: any) => {
    return api.post('/usuarios', data)
}

export const createBulkUsuarios = (data: any) => {
    return api.post('/usuarios/bulk', data)
}

export const toggleActivo = (id: string | number) => {
    return api.patch(`/usuarios/${id}/activo`)
}
