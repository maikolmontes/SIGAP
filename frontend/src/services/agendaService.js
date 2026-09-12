import api from './api'

export const getAgenda = (id_usuario) => {
    return api.get(`/agenda/${id_usuario}`)
}

export const getFunciones = () => {
    return api.get('/funciones')
}

export const getFuncionesByUsuario = (id_usuario) => {
    return api.get(`/funciones/usuario/${id_usuario}`)
}