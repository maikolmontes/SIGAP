import api from './api'

export const getUsuarios = () => {
    return api.get('/usuarios')
}

export const getUsuarioById = (id) => {
    return api.get(`/usuarios/${id}`)
}

export const createUsuario = (data) => {
    return api.post('/usuarios', data)
}

export const toggleActivo = (id) => {
    return api.patch(`/usuarios/${id}/activo`)
}