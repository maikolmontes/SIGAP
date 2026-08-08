import api from './api'

export const getUsuarios = () => {
    return api.get('/usuarios')
}

export const getUsuarioById = (id) => {
    return api.get(`/usuarios/${id}`)
}

export const validarUsuario = (data) => {
    return api.post('/usuarios/validar', data)
}

export const createUsuario = (data) => {
    return api.post('/usuarios', data)
}

export const createBulkUsuarios = (data) => {
    return api.post('/usuarios/bulk', data)
}

export const toggleActivo = (id) => {
    return api.patch(`/usuarios/${id}/activo`)
}

export const updateUsuario = (id, data) => {
    return api.put(`/usuarios/${id}`, data)
}

export const deleteUsuario = (id) => {
    return api.delete(`/usuarios/${id}`)
}