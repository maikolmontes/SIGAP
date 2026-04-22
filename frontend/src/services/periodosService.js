import api from './api'

export const getPeriodos = () => api.get('/periodos')
export const getPeriodoById = (id) => api.get(`/periodos/${id}`)
export const createPeriodo = (data) => api.post('/periodos', data)
export const cerrarPeriodo = (id) => api.put(`/periodos/${id}/cerrar`)
export const getDocentesPeriodo = (id) => api.get(`/periodos/${id}/docentes`)
export const asignarDocentesPeriodo = (id, docentes) => api.post(`/periodos/${id}/docentes`, { docentes })
export const desasignarDocentePeriodo = (idPeriodo, idUsuario) => api.delete(`/periodos/${idPeriodo}/docentes/${idUsuario}`)
