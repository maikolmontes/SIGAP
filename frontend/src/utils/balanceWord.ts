import JSZip from 'jszip'
import type { BalanceGestion, Bloque, DocumentoBalance, ValoracionDirector } from '../services/balanceGestionService'
import { anchosAutomaticos, conValoracion, fmtFechaLarga, nombreArchivo } from './balanceDocumento'

// ================================================================
// Balance de gestión en Word (.docx), armado desde cero con el documento que redacta el servidor.
// Un .docx es un zip de XML: aquí se escriben a mano las pocas partes que hacen falta
// (documento, estilos, viñetas y pie de página con numeración).
// ================================================================

const AZUL = '1A2744'
const TURQUESA = '00A896'
const GRIS = '595959'
const ANCHO_UTIL = 9936 // carta con márgenes de 0,8" (1152), en veinteavos de punto

const esc = (t: string): string =>
    String(t ?? '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')

interface OpcionesRun { negrita?: boolean; cursiva?: boolean; color?: string; tam?: number }

const run = (texto: string, o: OpcionesRun = {}): string => {
    const rpr = `${o.negrita ? '<w:b/><w:bCs/>' : ''}${o.cursiva ? '<w:i/><w:iCs/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}${o.tam ? `<w:sz w:val="${o.tam}"/><w:szCs w:val="${o.tam}"/>` : ''}`
    return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(texto)}</w:t></w:r>`
}

const parrafo = (runs: string, estilo?: string, extra = ''): string =>
    `<w:p><w:pPr>${estilo ? `<w:pStyle w:val="${estilo}"/>` : ''}${extra}</w:pPr>${runs}</w:p>`

function tabla(columnas: string[], filas: string[][], numericas: number[] = [], nota?: string): string {
    const anchos = anchosAutomaticos(columnas, filas, numericas, ANCHO_UTIL)
    const borde = (c: string) => `<w:top w:val="single" w:sz="4" w:space="0" w:color="${c}"/><w:left w:val="single" w:sz="4" w:space="0" w:color="${c}"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="${c}"/><w:right w:val="single" w:sz="4" w:space="0" w:color="${c}"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="${c}"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="${c}"/>`
    const celda = (texto: string, ancho: number, cab: boolean, derecha: boolean, sombreado: boolean) =>
        `<w:tc><w:tcPr><w:tcW w:w="${ancho}" w:type="dxa"/>${cab ? `<w:shd w:val="clear" w:color="auto" w:fill="${AZUL}"/>` : sombreado ? '<w:shd w:val="clear" w:color="auto" w:fill="F3F5F9"/>' : ''}<w:vAlign w:val="${cab ? 'center' : 'top'}"/></w:tcPr>`
        + `<w:p><w:pPr><w:pStyle w:val="Celda"/><w:jc w:val="${cab ? 'center' : derecha ? 'right' : 'left'}"/></w:pPr>${run(texto, { negrita: cab, color: cab ? 'FFFFFF' : undefined })}</w:p></w:tc>`
    const cab = `<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>${columnas.map((c, i) => celda(c, anchos[i], true, false, false)).join('')}</w:tr>`
    const cuerpo = filas.map((f, r) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${columnas.map((_, i) => celda(String(f[i] ?? ''), anchos[i], false, numericas.includes(i), r % 2 === 1)).join('')}</w:tr>`).join('')
    const t = `<w:tbl><w:tblPr><w:tblW w:w="${ANCHO_UTIL}" w:type="dxa"/><w:tblBorders>${borde('BFC5D2')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>${anchos.map(a => `<w:gridCol w:w="${a}"/>`).join('')}</w:tblGrid>${cab}${cuerpo}</w:tbl>`
    // Word exige un párrafo después de una tabla
    return t + parrafo(nota ? run(nota, { cursiva: true, color: GRIS, tam: 18 }) : '', 'Nota')
}

function bloqueXml(b: Bloque): string {
    if (b.tipo === 'parrafo') return parrafo(run(b.texto))
    if (b.tipo === 'lista') {
        return b.items.map(i => parrafo(
            (i.titulo ? run(i.titulo + '. ', { negrita: true, color: AZUL }) : '') + run(i.texto),
            'Vineta', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')).join('')
    }
    return tabla(b.columnas, b.filas, b.numericas, b.nota)
}

function cuerpoDocumento(doc: DocumentoBalance, b: BalanceGestion): string {
    const dirs = b.directores.length > 0 ? b.directores.join(', ') : ''
    const fechas = b.periodo.fechaInicio && b.periodo.fechaFin ? `${fmtFechaLarga(b.periodo.fechaInicio)} al ${fmtFechaLarga(b.periodo.fechaFin)}` : ''
    let x = parrafo(run('UNIVERSIDAD CESMAG · SIGAP', { negrita: true, color: TURQUESA, tam: 20 }))
    x += parrafo(run(doc.titulo), 'Title')
    x += parrafo(run(doc.subtitulo), 'Subtitle')
    const ficha = [
        b.programa.facultad && `Facultad: ${b.programa.facultad}`,
        `Período: ${b.periodo.etiqueta}${fechas ? ` (${fechas})` : ''}`,
        dirs && `Director(es): ${dirs}`,
        `Generado el ${fmtFechaLarga(b.generadoEn)}`,
    ].filter(Boolean) as string[]
    x += ficha.map(l => parrafo(run(l, { color: GRIS, tam: 20 }), 'Ficha')).join('')

    for (const s of doc.secciones) {
        x += parrafo(run(s.titulo), s.nivel === 1 ? 'Heading1' : 'Heading2')
        x += s.bloques.map(bloqueXml).join('')
    }
    return x
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${NS}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="es-CO" w:eastAsia="es-CO" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="both"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="120" w:after="60" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${AZUL}"/><w:sz w:val="52"/><w:szCs w:val="52"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="6" w:color="${TURQUESA}"/></w:pBdr><w:spacing w:after="160"/><w:jc w:val="left"/></w:pPr><w:rPr><w:color w:val="${TURQUESA}"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Ficha"><w:name w:val="Ficha"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="20"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="360" w:after="120"/><w:jc w:val="left"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${AZUL}"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="240" w:after="80"/><w:jc w:val="left"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="${TURQUESA}"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Vineta"><w:name w:val="Viñeta"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="80"/><w:ind w:left="360" w:hanging="360"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Celda"><w:name w:val="Celda"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="30" w:after="30" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Nota"><w:name w:val="Nota"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="40" w:after="160"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Pie"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="BFC5D2"/></w:pBdr><w:spacing w:after="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:color w:val="${GRIS}"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>
</w:styles>`

const NUMERACION = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering ${NS}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="${TURQUESA}"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`

const AJUSTES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings ${NS}><w:zoom w:percent="100"/><w:defaultTabStop w:val="708"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`

const campo = (instruccion: string) =>
    `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${instruccion} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`

const pie = (texto: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Pie"/></w:pPr>${run(texto + ' · Página ')}${campo('PAGE')}${run(' de ')}${campo('NUMPAGES')}</w:p></w:ftr>`

const TIPOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`

const RELS_RAIZ = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`

const RELS_DOC = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`

/** Arma el archivo .docx del balance. */
export async function generarDocx(b: BalanceGestion, valoracion: ValoracionDirector): Promise<Blob> {
    const doc = conValoracion(b.documento, valoracion)
    const documentoXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}><w:body>${cuerpoDocumento(doc, b)}<w:sectPr><w:footerReference w:type="default" r:id="rId4"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1152" w:right="1152" w:bottom="1152" w:left="1152" w:header="708" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`

    const zip = new JSZip()
    zip.file('[Content_Types].xml', TIPOS)
    zip.file('_rels/.rels', RELS_RAIZ)
    zip.file('word/document.xml', documentoXml)
    zip.file('word/styles.xml', ESTILOS)
    zip.file('word/numbering.xml', NUMERACION)
    zip.file('word/settings.xml', AJUSTES)
    zip.file('word/footer1.xml', pie(`SIGAP · Universidad CESMAG · ${b.programa.nombre} · ${b.periodo.etiqueta}`))
    zip.file('word/_rels/document.xml.rels', RELS_DOC)
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' })
}

/** Genera el Word y lo descarga. */
export async function descargarBalanceWord(b: BalanceGestion, valoracion: ValoracionDirector): Promise<void> {
    const blob = await generarDocx(b, valoracion)
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = nombreArchivo(b, 'docx')
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
    URL.revokeObjectURL(url)
}
