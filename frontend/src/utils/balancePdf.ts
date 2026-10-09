import type { BalanceGestion, ValoracionDirector } from '../services/balanceGestionService'
import { conValoracion, fmtFechaLarga, nombreArchivo } from './balanceDocumento'

const AZUL: [number, number, number] = [26, 39, 68]
const TURQUESA: [number, number, number] = [0, 168, 150]
const GRIS: [number, number, number] = [100, 116, 139]
const TEXTO: [number, number, number] = [30, 41, 59]

/** Genera y descarga el balance de gestión en PDF (vertical, A4). */
export async function descargarBalancePdf(b: BalanceGestion, valoracion: ValoracionDirector): Promise<void> {
    // Se cargan al pedirlo: no pesan en el resto de la aplicación
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    const documento = conValoracion(b.documento, valoracion)

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const ancho = doc.internal.pageSize.getWidth()
    const alto = doc.internal.pageSize.getHeight()
    const margen = 48
    const util = ancho - margen * 2
    const limiteY = alto - 56
    let y = 0

    const ultimoY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
    const asegurar = (necesario: number) => { if (y + necesario > limiteY) { doc.addPage(); y = margen } }

    const texto = (t: string, opciones: { x?: number; ancho?: number; tam?: number; negrita?: boolean; color?: [number, number, number]; interlineado?: number } = {}) => {
        const { x = margen, ancho: a = util, tam = 10, negrita = false, color = TEXTO, interlineado = 1.35 } = opciones
        doc.setFont('helvetica', negrita ? 'bold' : 'normal')
        doc.setFontSize(tam)
        doc.setTextColor(...color)
        const lineas: string[] = doc.splitTextToSize(t, a)
        for (const l of lineas) {
            asegurar(tam * interlineado)
            doc.text(l, x, y + tam)
            y += tam * interlineado
        }
    }

    // ---- Portada ----
    doc.setFillColor(...AZUL)
    doc.rect(0, 0, ancho, 118, 'F')
    doc.setFillColor(...TURQUESA)
    doc.rect(0, 118, ancho, 4, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('UNIVERSIDAD CESMAG  ·  SIGAP', margen, 34)
    doc.setFontSize(21)
    doc.text(doc.splitTextToSize(documento.titulo, util), margen, 64)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(13)
    doc.text(documento.subtitulo, margen, 98)

    y = 142
    const fechas = b.periodo.fechaInicio && b.periodo.fechaFin ? ` (${fmtFechaLarga(b.periodo.fechaInicio)} al ${fmtFechaLarga(b.periodo.fechaFin)})` : ''
    const ficha = [
        b.programa.facultad && `Facultad: ${b.programa.facultad}`,
        `Período: ${b.periodo.etiqueta}${fechas}`,
        b.directores.length > 0 && `Director(es): ${b.directores.join(', ')}`,
        `Generado el ${fmtFechaLarga(b.generadoEn)}`,
    ].filter(Boolean) as string[]
    for (const l of ficha) texto(l, { tam: 10, color: GRIS, interlineado: 1.5 })
    y += 10

    // ---- Secciones ----
    for (const s of documento.secciones) {
        asegurar(s.nivel === 1 ? 70 : 54)
        y += s.nivel === 1 ? 14 : 8
        texto(s.titulo, { tam: s.nivel === 1 ? 15 : 12, negrita: true, color: s.nivel === 1 ? AZUL : TURQUESA, interlineado: 1.3 })
        if (s.nivel === 1) {
            doc.setDrawColor(...TURQUESA)
            doc.setLineWidth(1)
            doc.line(margen, y + 1, margen + 46, y + 1)
        }
        y += 7

        for (const bloque of s.bloques) {
            if (bloque.tipo === 'parrafo') {
                texto(bloque.texto, { tam: 10 })
                y += 5
            } else if (bloque.tipo === 'lista') {
                for (const item of bloque.items) {
                    asegurar(34)
                    doc.setFillColor(...TURQUESA)
                    doc.circle(margen + 4, y + 6, 1.8, 'F')
                    if (item.titulo) texto(item.titulo, { x: margen + 14, ancho: util - 14, tam: 10, negrita: true, color: AZUL })
                    texto(item.texto, { x: margen + 14, ancho: util - 14, tam: 9.5 })
                    y += 5
                }
            } else {
                asegurar(60)
                autoTable(doc, {
                    startY: y,
                    head: [bloque.columnas],
                    body: bloque.filas,
                    margin: { left: margen, right: margen, bottom: 56 },
                    theme: 'grid',
                    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 3, lineColor: [226, 232, 240], lineWidth: 0.5, textColor: TEXTO, overflow: 'linebreak' },
                    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', halign: 'center' },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                    columnStyles: Object.fromEntries((bloque.numericas || []).map(i => [i, { halign: 'right' as const }])),
                })
                y = ultimoY() + 6
                if (bloque.nota) texto(bloque.nota, { tam: 8.5, color: GRIS })
                y += 6
            }
        }
    }

    // ---- Pie de página con numeración ----
    const paginas = doc.getNumberOfPages()
    for (let p = 1; p <= paginas; p++) {
        doc.setPage(p)
        doc.setDrawColor(226, 232, 240)
        doc.line(margen, alto - 34, ancho - margen, alto - 34)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...GRIS)
        doc.text(`SIGAP · Universidad CESMAG · ${b.programa.nombre} · ${b.periodo.etiqueta}`, margen, alto - 20)
        doc.text(`Página ${p} de ${paginas}`, ancho - margen, alto - 20, { align: 'right' })
    }

    doc.save(nombreArchivo(b, 'pdf'))
}
