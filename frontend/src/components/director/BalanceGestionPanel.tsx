import { useEffect, useState } from 'react'
import { AlertCircle, FileText, FileType2, Loader2, ScrollText } from 'lucide-react'
import api from '../../services/api'
import { getBalanceGestion } from '../../services/balanceGestionService'
import type { BalanceGestion, Bloque, ValoracionDirector } from '../../services/balanceGestionService'
import { etiquetaPeriodo } from '../../utils/periodo'
import { SECCIONES_VALORACION } from '../../utils/balanceDocumento'

interface ProgramaOpcion { id_programa: number; nombre_programa: string; nombre_facultad: string | null }
interface PeriodoOpcion { id_periodo: number; anio: number; semestre: number; activo: boolean }

const VALORACION_VACIA: ValoracionDirector = { logros: '', dificultades: '', conclusiones: '', recomendaciones: '' }
const MAX_VALORACION = 3000
const FILAS_EN_VISTA_PREVIA = 8

const mensajeDeError = (e: unknown, porDefecto: string): string =>
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error || porDefecto

function BloqueVista({ bloque }: { bloque: Bloque }) {
    if (bloque.tipo === 'parrafo') {
        return <p className="text-sm text-gray-700 leading-relaxed">{bloque.texto}</p>
    }
    if (bloque.tipo === 'lista') {
        return (
            <ul className="space-y-2.5">
                {bloque.items.map((item, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-gray-700 leading-relaxed">
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" aria-hidden="true" />
                        <span>{item.titulo && <strong className="text-[#1a2744]">{item.titulo}. </strong>}{item.texto}</span>
                    </li>
                ))}
            </ul>
        )
    }
    const visibles = bloque.filas.slice(0, FILAS_EN_VISTA_PREVIA)
    const numericas = bloque.numericas || []
    return (
        <div>
            <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider">
                        <tr>{bloque.columnas.map((c, i) => <th key={c + i} className={`px-3 py-2 font-bold whitespace-nowrap ${numericas.includes(i) ? 'text-right' : 'text-left'}`}>{c}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {visibles.map((f, r) => (
                            <tr key={r}>{f.map((celda, i) => <td key={i} className={`px-3 py-2 align-top text-gray-700 ${numericas.includes(i) ? 'text-right tabular-nums whitespace-nowrap' : ''}`}>{celda}</td>)}</tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {bloque.filas.length > visibles.length && (
                <p className="text-xs text-gray-400 mt-1.5">Aquí se muestran {visibles.length} de {bloque.filas.length} filas; el documento descargado trae todas.</p>
            )}
            {bloque.nota && <p className="text-xs text-gray-400 mt-1.5">{bloque.nota}</p>}
        </div>
    )
}

// Balance de gestión de un programa en un período: un documento redactado que se descarga en Word o PDF
export default function BalanceGestionPanel() {
    const [programas, setProgramas] = useState<ProgramaOpcion[]>([])
    const [periodos, setPeriodos] = useState<PeriodoOpcion[]>([])
    const [idPrograma, setIdPrograma] = useState<number | ''>('')
    const [idPeriodo, setIdPeriodo] = useState<number | ''>('')
    const [cargandoOpciones, setCargandoOpciones] = useState(true)
    const [errorOpciones, setErrorOpciones] = useState('')

    const [balance, setBalance] = useState<BalanceGestion | null>(null)
    const [generando, setGenerando] = useState(false)
    const [error, setError] = useState('')
    const [valoracion, setValoracion] = useState<ValoracionDirector>(VALORACION_VACIA)
    const [descargando, setDescargando] = useState<'docx' | 'pdf' | null>(null)

    useEffect(() => {
        let vigente = true
        Promise.all([api.get('/director/mis-programas'), api.get('/periodos')])
            .then(([resProg, resPer]) => {
                if (!vigente) return
                const progs: ProgramaOpcion[] = resProg.data?.programas || []
                const pers: PeriodoOpcion[] = resPer.data || []
                setProgramas(progs)
                setPeriodos(pers)
                if (progs.length > 0) setIdPrograma(progs[0].id_programa)
                const preferido = pers.find(p => p.activo) || pers[0]
                if (preferido) setIdPeriodo(preferido.id_periodo)
            })
            .catch(() => { if (vigente) setErrorOpciones('No se pudieron cargar los programas y períodos.') })
            .finally(() => { if (vigente) setCargandoOpciones(false) })
        return () => { vigente = false }
    }, [])

    // Si cambia el programa o el período, el documento mostrado ya no corresponde
    useEffect(() => { setBalance(null); setError('') }, [idPrograma, idPeriodo])

    const generar = async () => {
        if (!idPrograma || !idPeriodo) return
        setGenerando(true)
        setError('')
        try {
            setBalance((await getBalanceGestion(Number(idPrograma), Number(idPeriodo))).data)
        } catch (e) {
            setBalance(null)
            setError(mensajeDeError(e, 'No se pudo armar el documento. Intenta de nuevo.'))
        } finally {
            setGenerando(false)
        }
    }

    const descargar = async (formato: 'docx' | 'pdf') => {
        if (!balance) return
        setDescargando(formato)
        setError('')
        try {
            if (formato === 'docx') {
                const { descargarBalanceWord } = await import('../../utils/balanceWord')
                await descargarBalanceWord(balance, valoracion)
            } else {
                const { descargarBalancePdf } = await import('../../utils/balancePdf')
                await descargarBalancePdf(balance, valoracion)
            }
        } catch (e) {
            console.error('Error al generar el archivo del balance:', e)
            setError('No se pudo generar el archivo. Intenta de nuevo.')
        } finally {
            setDescargando(null)
        }
    }

    const selector = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400'

    return (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-7 overflow-hidden" aria-labelledby="titulo-balance">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[#1a2744] to-[#24365f] text-white">
                <h2 id="titulo-balance" className="text-base font-bold flex items-center gap-2">
                    <ScrollText className="w-5 h-5 text-teal-300" /> Balance de gestión del período
                </h2>
                <p className="text-xs text-white/70 mt-0.5">
                    Un documento redactado con todo lo que se hizo en el período en un programa: agendas, avance por corte, cada actividad con su descripción, evidencias y observaciones.
                </p>
            </div>

            <div className="p-6">
                {cargandoOpciones ? (
                    <p className="flex items-center gap-2 text-sm text-gray-500" role="status"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p>
                ) : errorOpciones ? (
                    <p role="alert" className="text-sm text-red-600">{errorOpciones}</p>
                ) : programas.length === 0 ? (
                    <p className="text-sm text-gray-500">No tienes programas asignados, por eso no hay documento que generar. Pídele a Planeación que te asigne tus programas.</p>
                ) : periodos.length === 0 ? (
                    <p className="text-sm text-gray-500">Todavía no hay períodos creados.</p>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_16rem_auto] gap-3 items-end">
                            <div>
                                <label htmlFor="bal-programa" className="block text-xs font-medium text-gray-600 mb-1">Programa</label>
                                <select id="bal-programa" className={selector} value={idPrograma} onChange={e => setIdPrograma(Number(e.target.value))}>
                                    {programas.map(p => <option key={p.id_programa} value={p.id_programa}>{p.nombre_programa}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="bal-periodo" className="block text-xs font-medium text-gray-600 mb-1">Período</label>
                                <select id="bal-periodo" className={selector} value={idPeriodo} onChange={e => setIdPeriodo(Number(e.target.value))}>
                                    {periodos.map(p => <option key={p.id_periodo} value={p.id_periodo}>{etiquetaPeriodo(p)}{p.activo ? ' (activo)' : ''}</option>)}
                                </select>
                            </div>
                            <button
                                type="button"
                                onClick={generar}
                                disabled={generando || !idPrograma || !idPeriodo}
                                className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-[#1a2744] hover:bg-[#24365f] text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {generando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScrollText className="w-4 h-4" />}
                                {generando ? 'Redactando…' : balance ? 'Volver a generar' : 'Generar documento'}
                            </button>
                        </div>

                        {error && (
                            <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
                            </p>
                        )}
                    </>
                )}

                {balance && (
                    <div className="mt-6 space-y-6">
                        {/* Descargas arriba: es lo que se busca al generar */}
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={() => descargar('docx')}
                                disabled={descargando !== null}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1a2744] hover:bg-[#24365f] text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {descargando === 'docx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileType2 className="w-4 h-4" />} Descargar Word
                            </button>
                            <button
                                type="button"
                                onClick={() => descargar('pdf')}
                                disabled={descargando !== null}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {descargando === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Descargar PDF
                            </button>
                            <span className="text-xs text-gray-400">Con los datos de SIGAP al momento de generarlo.</span>
                        </div>

                        {/* Vista previa del documento */}
                        <article className="rounded-xl border border-gray-100 bg-gray-50/40 px-5 py-5 space-y-6" aria-label="Vista previa del documento">
                            <header className="border-b border-teal-500/40 pb-3">
                                <p className="text-[11px] font-bold tracking-widest text-teal-600 uppercase">Universidad CESMAG · SIGAP</p>
                                <h3 className="text-xl font-black text-[#1a2744] mt-1">{balance.documento.titulo}</h3>
                                <p className="text-sm text-teal-700 font-semibold">{balance.documento.subtitulo}</p>
                            </header>
                            {balance.documento.secciones.map((s, i) => (
                                <section key={s.titulo + i} className="space-y-3">
                                    {s.nivel === 1
                                        ? <h4 className="text-base font-bold text-[#1a2744]">{s.titulo}</h4>
                                        : <h5 className="text-sm font-bold text-teal-700 pl-3 border-l-2 border-teal-400">{s.titulo}</h5>}
                                    {s.bloques.map((b, j) => <BloqueVista key={j} bloque={b} />)}
                                </section>
                            ))}
                        </article>

                        {/* Valoración del director: se agrega al documento, no se guarda */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-800">Valoración del director <span className="font-normal text-gray-400">(opcional)</span></h3>
                            <p className="text-xs text-gray-500 mt-0.5">Lo que escribas aquí se agrega al Word y al PDF. No se guarda: si cierras la página, se pierde.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                {SECCIONES_VALORACION.map(s => (
                                    <div key={s.clave}>
                                        <label htmlFor={`bal-${s.clave}`} className="block text-xs font-semibold text-gray-600 mb-1">{s.titulo}</label>
                                        <textarea
                                            id={`bal-${s.clave}`}
                                            rows={4}
                                            maxLength={MAX_VALORACION}
                                            value={valoracion[s.clave]}
                                            onChange={e => setValoracion(prev => ({ ...prev, [s.clave]: e.target.value }))}
                                            placeholder={s.ayuda}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
}
