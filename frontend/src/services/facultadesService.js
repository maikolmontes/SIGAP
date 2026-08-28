import api from './api'

export const getFacultades = () => {
    return api.get('/facultades')
}

export const createFacultad = (data) => {
    return api.post('/facultades', data)
}

export const updateFacultad = (id, data) => {
    return api.put(`/facultades/${id}`, data)
}

export const toggleActivaFacultad = (id) => {
    return api.patch(`/facultades/${id}/activa`)
}

export const deleteFacultad = (id) => {
    return api.delete(`/facultades/${id}`)
}
