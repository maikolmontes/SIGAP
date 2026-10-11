import api from './api'
import type { BalanceGestion } from './balanceGestionService'

// Informe de evidencias del propio docente: el servidor entrega el documento ya redactado (misma forma que el balance de gestión)
export const getReporteEvidencias = (periodo?: number) =>
    api.get<BalanceGestion>('/docente/reporte-evidencias', { params: periodo ? { periodo } : undefined })
