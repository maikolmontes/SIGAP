/**
 * Criterio único de "agenda diligenciada".
 *
 * Un docente entra a los paneles de seguimiento solo cuando ya aceptó su
 * agenda. Quedan fuera las que siguen en 'Por Aprobar' (Planeación las cargó
 * pero el Director no las liberó), en 'Pendiente' (liberadas pero vacías) y
 * las 'Devuelta' (el Director las regresó y el docente aún no responde).
 *
 * Vive aparte porque lo usan la semana 0 y los cortes 8 y 16: si cada panel
 * llevara su propia lista, mostrarían docentes distintos para el mismo periodo,
 * que es justo lo que se quiere evitar.
 */
export const ESTADOS_DILIGENCIADA = ['Aceptado', 'Aprobada', 'Parcial'];

export const agendaDiligenciada = (a: { estado_general?: string }) =>
    ESTADOS_DILIGENCIADA.includes(a.estado_general || '');
