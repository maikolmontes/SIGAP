import api from './api'

export const getPeriodos = () => api.get('/periodos')
export const getPeriodoById = (id: string | number) => api.get(`/periodos/${id}`)
export const createPeriodo = (data: any) => api.post('/periodos', data)
export const cerrarPeriodo = (id: string | number) => api.put(`/periodos/${id}/cerrar`)
export const habilitarPeriodo = (id: string | number) => api.put(`/periodos/${id}/habilitar`)
export const getDocentesPeriodo = (id: string | number) => api.get(`/periodos/${id}/docentes`)
export const asignarDocentesPeriodo = (id: string | number, docentes: any) => api.post(`/periodos/${id}/docentes`, { docentes })
export const desasignarDocentePeriodo = (idPeriodo: string | number, idUsuario: string | number) => api.delete(`/periodos/${idPeriodo}/docentes/${idUsuario}`)
export const getPeriodoActivo = () => api.get('/periodos/activo')
