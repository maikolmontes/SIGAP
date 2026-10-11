import type { BalanceGestion, DocumentoBalance, SeccionDocumento, ValoracionDirector } from '../services/balanceGestionService'

// Utilidades comunes del balance de gestión: la vista previa, el Word y el PDF parten del mismo documento.

export const SECCIONES_VALORACION: { clave: keyof ValoracionDirector; titulo: string; ayuda: string }[] = [
    { clave: 'logros', titulo: 'Logros destacados', ayuda: 'Lo más importante que se alcanzó en el período.' },
    { clave: 'dificultades', titulo: 'Dificultades', ayuda: 'Qué obstaculizó el cumplimiento de las agendas.' },
    { clave: 'conclusiones', titulo: 'Conclusiones', ayuda: 'Lectura general de la gestión del período.' },
    { clave: 'recomendaciones', titulo: 'Recomendaciones', ayuda: 'Qué se propone para el siguiente período.' },
]

/** Agrega, antes del anexo, la valoración que escribió el director (solo lo que tiene texto). */
export function conValoracion(doc: DocumentoBalance, valoracion: ValoracionDirector): DocumentoBalance {
    const items = SECCIONES_VALORACION
        .filter(s => valoracion[s.clave].trim())
        .map(s => ({ titulo: s.titulo, texto: valoracion[s.clave].trim() }))
    if (items.length === 0) return doc

    const seccion: SeccionDocumento = { nivel: 1, titulo: 'Valoración del director', bloques: [{ tipo: 'lista', items }] }
    const iAnexo = doc.secciones.findIndex(s => s.titulo.startsWith('Anexo'))
    const secciones = [...doc.secciones]
    secciones.splice(iAnexo >= 0 ? iAnexo : secciones.length, 0, seccion)
    return { ...doc, secciones }
}

export const fmtFechaLarga = (valor: string | null | undefined): string => {
    if (!valor) return ''
    const d = new Date(valor)
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export const nombreArchivo = (b: BalanceGestion, extension: 'pdf' | 'docx'): string => {
    const limpio = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    if (b.archivoBase) return `${limpio(b.archivoBase)}_${limpio(b.periodo.etiqueta)}.${extension}`
    return `Balance_de_gestion_${limpio(b.programa.nombre)}_${limpio(b.periodo.etiqueta)}.${extension}`
}

/** Anchos de columna (suman `total`) según lo largo del contenido, para tablas de Word. */
export function anchosAutomaticos(columnas: string[], filas: string[][], numericas: number[] = [], total = 9936): number[] {
    const pesos = columnas.map((c, i) => {
        const largos = filas.slice(0, 200).map(f => String(f[i] ?? '').length).sort((a, b) => a - b)
        const tipico = largos.length ? largos[Math.floor(largos.length * 0.8)] : 0
        const base = Math.max(c.length * 0.75, Math.min(tipico, 48))
        return Math.max(numericas.includes(i) ? 6 : 8, base)
    })
    const suma = pesos.reduce((a, b) => a + b, 0)
    const anchos = pesos.map(p => Math.max(500, Math.round((p / suma) * total)))
    // ajuste final para que sumen exactamente el total
    const dif = total - anchos.reduce((a, b) => a + b, 0)
    anchos[anchos.indexOf(Math.max(...anchos))] += dif
    return anchos
}
