// Las tarjetas de "Agendas completas" cuentan las agendas con TODAS sus funciones diligenciadas
// (Aceptado por el docente + Aprobada por el director). La lista de docentes, en cambio, rotula cada una como
// "Completa" (falta la aprobación) o "Aprobada". Este texto desglosa la tarjeta para que cuadre con la lista.

/** "1 completa · 1 aprobada" */
export const desgloseCompletas = (aceptadas: number, aprobadas: number): string => {
  const total = Number(aceptadas) || 0
  const aprob = Math.min(Number(aprobadas) || 0, total)
  const completas = total - aprob
  return `${completas} ${completas === 1 ? 'completa' : 'completas'} · ${aprob} ${aprob === 1 ? 'aprobada' : 'aprobadas'}`
}
