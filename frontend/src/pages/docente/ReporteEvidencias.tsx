import { useEffect, useState } from 'react'
import { AlertCircle, FileText, FileType2, Loader2, ScrollText } from 'lucide-react'
import Layout from '../../components/common/Layout'
import { BloqueVista } from '../../components/director/BalanceGestionPanel'
import api from '../../services/api'
import { getReporteEvidencias } from '../../services/reporteDocenteService'
import type { BalanceGestion, ValoracionDirector } from '../../services/balanceGestionService'
import { etiquetaPeriodo } from '../../utils/periodo'

interface PeriodoOpcion { id_periodo: number; anio: number; semestre: number; activo: boolean }

// El informe del docente no lleva "valoración del director": se reutilizan el Word y el PDF del balance con ese bloque vacío
const SIN_VALORACION: ValoracionDirector = { logros: '', dificultades: '', conclusiones: '', recomendaciones: '' }

const mensajeDeError = (e: unknown, porDefecto: string): string =>
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error || porDefecto

export default function ReporteEvidencias() {
    const [periodos, setPeriodos] = useState<PeriodoOpcion[]>([])
    const [idPeriodo, setIdPeriodo] = useState<number | ''>('')
    const [cargandoOpciones, setCargandoOpciones] = useState(true)
    const [errorOpciones, setErrorOpciones] = useState('')

    const [informe, setInforme] = useState<BalanceGestion | null>(null)
    const [generando, setGenerando] = useState(false)
    const [error, setError] = useState('')
    const [descargando, setDescargando] = useState<'docx' | 'pdf' | null>(null)

    useEffect(() => {
        let vigente = true
        api.get('/periodos')
            .then((res) => {
                if (!vigente) return
                const lista: PeriodoOpcion[] = res.data || []
                setPeriodos(lista)
                const preferido = lista.find(p => p.activo) || lista[0]
                if (preferido) setIdPeriodo(preferido.id_periodo)
            })
            .catch(() => { if (vigente) setErrorOpciones('No se pudieron cargar los períodos.') })
            .finally(() => { if (vigente) setCargandoOpciones(false) })
        return () => { vigente = false }
    }, [])

    // Si cambia el período, el informe mostrado ya no corresponde
    useEffect(() => { setInforme(null); setError('') }, [idPeriodo])

    const generar = async () => {
        if (!idPeriodo) return
        setGenerando(true)
        setError('')
        try {
            setInforme((await getReporteEvidencias(Number(idPeriodo))).data)
        } catch (e) {
            setInforme(null)
            setError(mensajeDeError(e, 'No se pudo armar el informe. Intenta de nuevo.'))
        } finally {
            setGenerando(false)
        }
    }

    const descargar = async (formato: 'docx' | 'pdf') => {
        if (!informe) return
        setDescargando(formato)
        setError('')
        try {
            if (formato === 'docx') {
                const { descargarBalanceWord } = await import('../../utils/balanceWord')
                await descargarBalanceWord(informe, SIN_VALORACION)
            } else {
                const { descargarBalancePdf } = await import('../../utils/balancePdf')
                await descargarBalancePdf(informe, SIN_VALORACION)
            }
        } catch (e) {
            console.error('Error al generar el archivo del informe:', e)
            setError('No se pudo generar el archivo. Intenta de nuevo.')
        } finally {
            setDescargando(null)
        }
    }

    const selector = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400'

    return (
        <Layout rol="docente" path="Registro de Actividades / Reportes">
            <div className="bg-[#1a2744] rounded-xl px-6 py-6 mb-6 shadow-sm">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <ScrollText className="w-6 h-6 text-blue-400" />
                    Reportes
                </h1>
                <p className="text-blue-100 text-sm mt-1">
                    Descarga un informe de tus evidencias: por cada función y actividad, la meta de cada indicador, lo que ejecutaste y las evidencias (archivos y enlaces) que subiste.
                </p>
            </div>

            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" aria-labelledby="titulo-informe-evidencias">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h2 id="titulo-informe-evidencias" className="text-base font-bold text-gray-900">Informe de evidencias</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Se arma con tus datos al momento de generarlo y se puede descargar en Word o en PDF.</p>
                </div>

                <div className="p-6">
                    {cargandoOpciones ? (
                        <p className="flex items-center gap-2 text-sm text-gray-500" role="status"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p>
                    ) : errorOpciones ? (
                        <p role="alert" className="text-sm text-red-600">{errorOpciones}</p>
                    ) : periodos.length === 0 ? (
                        <p className="text-sm text-gray-500">Todavía no hay períodos creados.</p>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-[16rem_auto] gap-3 items-end">
                                <div>
                                    <label htmlFor="inf-periodo" className="block text-xs font-medium text-gray-600 mb-1">Período</label>
                                    <select id="inf-periodo" className={selector} value={idPeriodo} onChange={e => setIdPeriodo(Number(e.target.value))}>
                                        {periodos.map(p => <option key={p.id_periodo} value={p.id_periodo}>{etiquetaPeriodo(p)}{p.activo ? ' (activo)' : ''}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <button
                                        type="button"
                                        onClick={generar}
                                        disabled={generando || !idPeriodo}
                                        className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-[#1a2744] hover:bg-[#24365f] text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {generando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScrollText className="w-4 h-4" />}
                                        {generando ? 'Armando…' : informe ? 'Volver a generar' : 'Generar informe'}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
                                </p>
                            )}
                        </>
                    )}

                    {informe && (
                        <div className="mt-6 space-y-6">
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
                                <span className="text-xs text-gray-400">Con tus datos de SIGAP al momento de generarlo.</span>
                            </div>

                            <article className="rounded-xl border border-gray-100 bg-gray-50/40 px-5 py-5 space-y-6" aria-label="Vista previa del informe">
                                <header className="border-b border-teal-500/40 pb-3">
                                    <p className="text-[11px] font-bold tracking-widest text-teal-600 uppercase">Universidad CESMAG · SIGAP</p>
                                    <h3 className="text-xl font-black text-[#1a2744] mt-1">{informe.documento.titulo}</h3>
                                    <p className="text-sm text-teal-700 font-semibold">{informe.documento.subtitulo}</p>
                                </header>
                                {informe.documento.secciones.map((s, i) => (
                                    <section key={s.titulo + i} className="space-y-3">
                                        {s.nivel === 1
                                            ? <h4 className="text-base font-bold text-[#1a2744]">{s.titulo}</h4>
                                            : <h5 className="text-sm font-bold text-teal-700 pl-3 border-l-2 border-teal-400">{s.titulo}</h5>}
                                        {s.bloques.map((b, j) => <BloqueVista key={j} bloque={b} />)}
                                    </section>
                                ))}
                            </article>
                        </div>
                    )}
                </div>
            </section>
        </Layout>
    )
}
