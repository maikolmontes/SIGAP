import api from './api'

export const getUsuarios = () => {
    return api.get('/usuarios')
}

export const getUsuarioById = (id: string | number) => {
    return api.get(`/usuarios/${id}`)
}

export const validarUsuario = (data: any) => {
    return api.post('/usuarios/validar', data)
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

export const updateUsuario = (id: string | number, data: any) => {
    return api.put(`/usuarios/${id}`, data)
}

export const deleteUsuario = (id: string | number) => {
    return api.delete(`/usuarios/${id}`)
}
