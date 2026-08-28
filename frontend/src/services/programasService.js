import api from './api'

export const getProgramas = () => {
    return api.get('/programas')
}

export const createPrograma = (data) => {
    return api.post('/programas', data)
}

export const updatePrograma = (id, data) => {
    return api.put(`/programas/${id}`, data)
}

export const toggleActivoPrograma = (id) => {
    return api.patch(`/programas/${id}/activo`)
}

export const deletePrograma = (id) => {
    return api.delete(`/programas/${id}`)
}
