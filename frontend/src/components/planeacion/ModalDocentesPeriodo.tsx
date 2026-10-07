import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Lock, Search, UserMinus, UserPlus, Users, X } from 'lucide-react'

export interface DocenteModal {
    id_usuario: number
    nombres: string
    apellidos: string
    correo: string
    activo?: boolean
    programa?: string
    tipo_documento?: string
    numero_documento?: string
}

interface Props {
    etiqueta: string
    periodoActivo: boolean
    asignados: DocenteModal[]
    disponibles: DocenteModal[]
    seleccionados: number[]
    cargando: boolean
    asignando: boolean
    error: string
    onToggle: (id: number) => void
    onSeleccionar: (ids: number[], marcar: boolean) => void
    onLimpiarSeleccion: () => void
    onAsignar: () => void
    onRemover: (id: number) => Promise<void>
    onCerrar: () => void
}

// ---------- utilidades de presentación ----------
const PALETA_AVATAR = [
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-violet-100 text-violet-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
]

const iniciales = (d: DocenteModal) =>
    `${(d.nombres || '?').trim()[0] || '?'}${(d.apellidos || '').trim()[0] || ''}`.toUpperCase()

const nombreCompleto = (d: DocenteModal) => `${d.nombres || ''} ${d.apellidos || ''}`.trim()

/** Minúsculas y sin tildes, para buscar "jose" y encontrar "José". */
const normalizar = (v: string) =>
    (v || '')
        .normalize('NFD')
        .split('')
        .filter(c => c.charCodeAt(0) < 0x300 || c.charCodeAt(0) > 0x36f)
        .join('')
        .toLowerCase()

const soloLetrasYNumeros = (v: string) =>
    normalizar(v).split('').filter(c => (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')).join('')

const coincide = (d: DocenteModal, consulta: string) => {
    const q = normalizar(consulta).trim()
    if (!q) return true
    const documento = `${d.tipo_documento || ''} ${d.numero_documento || ''}`
    const qNum = soloLetrasYNumeros(consulta)
    return (
        normalizar(nombreCompleto(d)).includes(q) ||
        normalizar(d.correo).includes(q) ||
        normalizar(d.programa || '').includes(q) ||
        normalizar(documento).includes(q) ||
        (qNum !== '' && soloLetrasYNumeros(documento).includes(qNum))
    )
}

function Avatar({ d }: { d: DocenteModal }) {
    return (
        <div
            aria-hidden="true"
            className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${PALETA_AVATAR[d.id_usuario % PALETA_AVATAR.length]}`}
        >
            {iniciales(d)}
        </div>
    )
}

function Detalle({ d }: { d: DocenteModal }) {
    return (
        <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-800 truncate">{nombreCompleto(d)}</p>
            <p className="text-xs text-gray-500 truncate">{d.correo}</p>
            {(d.programa || d.numero_documento) && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                    {d.programa && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 truncate max-w-[14rem]">
                            {d.programa}
                        </span>
                    )}
                    {d.numero_documento && (
                        <span className="text-[10px] text-gray-400 tabular-nums">
                            {(d.tipo_documento || 'CC').toUpperCase()} {d.numero_documento}
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}

function Buscador({
    valor, onCambio, placeholder, etiqueta,
}: { valor: string; onCambio: (v: string) => void; placeholder: string; etiqueta: string }) {
    return (
        <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
                type="text"
                value={valor}
                onChange={e => onCambio(e.target.value)}
                placeholder={placeholder}
                aria-label={etiqueta}
                className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
            {valor && (
                <button
                    type="button"
                    onClick={() => onCambio('')}
                    aria-label="Borrar búsqueda"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    )
}

function Vacio({ icono, titulo, detalle }: { icono: React.ReactNode; titulo: string; detalle?: string }) {
    return (
        <div className="flex flex-col items-center justify-center text-center px-6 py-10 text-gray-400">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">{icono}</div>
            <p className="text-sm font-semibold text-gray-600">{titulo}</p>
            {detalle && <p className="text-xs mt-1 max-w-xs">{detalle}</p>}
        </div>
    )
}

function Esqueleto() {
    return (
        <div className="divide-y divide-gray-100" aria-hidden="true">
            {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                        <div className="h-2.5 bg-gray-100 rounded w-2/3" />
                    </div>
                </div>
            ))}
        </div>
    )
}

export default function ModalDocentesPeriodo(p: Props) {
    const [busquedaAsignados, setBusquedaAsignados] = useState('')
    const [busquedaDisponibles, setBusquedaDisponibles] = useState('')
    const [vista, setVista] = useState<'asignados' | 'disponibles'>('asignados') // solo se usa en pantallas pequeñas
    const [confirmando, setConfirmando] = useState<number | null>(null)
    const [quitando, setQuitando] = useState<number | null>(null)

    const asignadosFiltrados = useMemo(() => p.asignados.filter(d => coincide(d, busquedaAsignados)), [p.asignados, busquedaAsignados])
    const disponiblesFiltrados = useMemo(() => p.disponibles.filter(d => coincide(d, busquedaDisponibles)), [p.disponibles, busquedaDisponibles])

    const todosMarcados = disponiblesFiltrados.length > 0 && disponiblesFiltrados.every(d => p.seleccionados.includes(d.id_usuario))

    // Escape: primero cancela una confirmación abierta; si no, cierra la ventana
    useEffect(() => {
        const alTeclear = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return
            if (confirmando !== null) setConfirmando(null)
            else p.onCerrar()
        }
        window.addEventListener('keydown', alTeclear)
        return () => window.removeEventListener('keydown', alTeclear)
    }, [confirmando, p])

    const remover = async (id: number) => {
        setQuitando(id)
        try {
            await p.onRemover(id)
        } finally {
            setQuitando(null)
            setConfirmando(null)
        }
    }

    const mostrarDisponibles = p.periodoActivo

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-4"
            onClick={p.onCerrar}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="titulo-docentes-periodo"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* ───── Encabezado ───── */}
                <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-6 py-5 flex items-start justify-between gap-4 shrink-0">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h3 id="titulo-docentes-periodo" className="text-white font-bold text-lg">
                                Docentes del período {p.etiqueta}
                            </h3>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                p.periodoActivo
                                    ? 'bg-emerald-400/20 text-emerald-100 border-emerald-300/40'
                                    : 'bg-white/10 text-white/80 border-white/20'
                            }`}>
                                {p.periodoActivo ? 'Activo' : 'Cerrado'}
                            </span>
                        </div>
                        <p className="text-blue-100 text-sm mt-1">
                            {p.periodoActivo
                                ? 'Vincule docentes al período o remuévalos. Solo aparecen docentes activos.'
                                : 'Período cerrado: solo puede consultar los docentes que participaron.'}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/15 text-white px-2.5 py-1 rounded-full">
                                <CheckCircle2 className="w-3.5 h-3.5" /> {p.asignados.length} asignados
                            </span>
                            {mostrarDisponibles && (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/15 text-white px-2.5 py-1 rounded-full">
                                    <UserPlus className="w-3.5 h-3.5" /> {p.disponibles.length} disponibles
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={p.onCerrar}
                        aria-label="Cerrar"
                        className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-colors shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {p.error && (
                    <div role="alert" className="flex items-start gap-2 bg-red-50 border-b border-red-100 text-red-700 text-sm px-6 py-2.5">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        {p.error}
                    </div>
                )}

                {/* ───── Pestañas (solo en pantallas pequeñas) ───── */}
                {mostrarDisponibles && (
                    <div className="md:hidden flex border-b border-gray-200 shrink-0" role="tablist">
                        {(['asignados', 'disponibles'] as const).map(v => (
                            <button
                                key={v}
                                type="button"
                                role="tab"
                                aria-selected={vista === v}
                                onClick={() => setVista(v)}
                                className={`flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                                    vista === v ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'
                                }`}
                            >
                                {v === 'asignados' ? `Asignados (${p.asignados.length})` : `Disponibles (${p.disponibles.length})`}
                            </button>
                        ))}
                    </div>
                )}

                {/* ───── Cuerpo: dos paneles ───── */}
                <div className={`flex-1 min-h-0 grid grid-cols-1 ${mostrarDisponibles ? 'md:grid-cols-2 md:divide-x divide-gray-200' : ''}`}>
                    {/* Panel: asignados */}
                    <section
                        className={`${!mostrarDisponibles || vista === 'asignados' ? 'flex' : 'hidden'} md:flex flex-col min-h-0 min-w-0`}
                        aria-label="Docentes asignados"
                    >
                        <div className="px-5 pt-4 pb-3 space-y-3 shrink-0">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5" /> Asignados al período
                                </h4>
                                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full tabular-nums">
                                    {busquedaAsignados.trim() ? `${asignadosFiltrados.length} de ${p.asignados.length}` : p.asignados.length}
                                </span>
                            </div>
                            <Buscador
                                valor={busquedaAsignados}
                                onCambio={setBusquedaAsignados}
                                placeholder="Buscar asignado por nombre, correo, programa o documento…"
                                etiqueta="Buscar entre los docentes asignados"
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto border-t border-gray-100 max-h-[52vh] md:max-h-[56vh]">
                            {p.cargando ? <Esqueleto /> : p.asignados.length === 0 ? (
                                <Vacio icono={<Users className="w-6 h-6" />} titulo="Aún no hay docentes asignados" detalle={p.periodoActivo ? 'Seleccione docentes en la lista de disponibles y asígnelos.' : undefined} />
                            ) : asignadosFiltrados.length === 0 ? (
                                <Vacio icono={<Search className="w-6 h-6" />} titulo="Sin resultados" detalle={`Ningún asignado coincide con "${busquedaAsignados}".`} />
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {asignadosFiltrados.map(d => (
                                        <li key={d.id_usuario} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/80 transition-colors">
                                            <Avatar d={d} />
                                            <Detalle d={d} />
                                            {p.periodoActivo && (
                                                confirmando === d.id_usuario ? (
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => remover(d.id_usuario)}
                                                            disabled={quitando === d.id_usuario}
                                                            className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 px-2.5 py-1.5 rounded-lg"
                                                        >
                                                            {quitando === d.id_usuario ? 'Quitando…' : 'Sí, remover'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfirmando(null)}
                                                            disabled={quitando === d.id_usuario}
                                                            className="text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg"
                                                        >
                                                            No
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmando(d.id_usuario)}
                                                        title="Remover del período"
                                                        aria-label={`Remover a ${nombreCompleto(d)} del período`}
                                                        className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-100 px-2 py-1.5 rounded-lg transition-colors"
                                                    >
                                                        <UserMinus className="w-3.5 h-3.5" /> Remover
                                                    </button>
                                                )
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </section>

                    {/* Panel: disponibles */}
                    {mostrarDisponibles ? (
                        <section
                            className={`${vista === 'disponibles' ? 'flex' : 'hidden'} md:flex flex-col min-h-0 min-w-0 bg-slate-50/50`}
                            aria-label="Docentes disponibles"
                        >
                            <div className="px-5 pt-4 pb-3 space-y-3 shrink-0">
                                <div className="flex items-center justify-between gap-2">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <UserPlus className="w-3.5 h-3.5" /> Disponibles para vincular
                                    </h4>
                                    {disponiblesFiltrados.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => p.onSeleccionar(disponiblesFiltrados.map(d => d.id_usuario), !todosMarcados)}
                                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                                        >
                                            {todosMarcados ? 'Deseleccionar mostrados' : `Seleccionar mostrados (${disponiblesFiltrados.length})`}
                                        </button>
                                    )}
                                </div>
                                <Buscador
                                    valor={busquedaDisponibles}
                                    onCambio={setBusquedaDisponibles}
                                    placeholder="Buscar disponible por nombre, correo, programa o documento…"
                                    etiqueta="Buscar entre los docentes disponibles"
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto border-t border-gray-100 max-h-[52vh] md:max-h-[56vh]">
                                {p.cargando ? <Esqueleto /> : p.disponibles.length === 0 ? (
                                    <Vacio icono={<CheckCircle2 className="w-6 h-6 text-emerald-500" />} titulo="Todo al día" detalle="Todos los docentes activos ya están asignados a este período." />
                                ) : disponiblesFiltrados.length === 0 ? (
                                    <Vacio icono={<Search className="w-6 h-6" />} titulo="Sin resultados" detalle={`Ningún docente disponible coincide con "${busquedaDisponibles}".`} />
                                ) : (
                                    <ul className="divide-y divide-gray-100">
                                        {disponiblesFiltrados.map(d => {
                                            const marcado = p.seleccionados.includes(d.id_usuario)
                                            return (
                                                <li key={d.id_usuario}>
                                                    <label className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${marcado ? 'bg-blue-50' : 'hover:bg-white'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={marcado}
                                                            onChange={() => p.onToggle(d.id_usuario)}
                                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 shrink-0"
                                                        />
                                                        <Avatar d={d} />
                                                        <Detalle d={d} />
                                                    </label>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                )}
                            </div>
                        </section>
                    ) : (
                        <div className="hidden" />
                    )}
                </div>

                {!p.periodoActivo && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-100 px-6 py-2.5 shrink-0">
                        <Lock className="w-3.5 h-3.5" /> Para vincular o remover docentes, el período debe estar activo.
                    </div>
                )}

                {/* ───── Pie ───── */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="text-sm text-gray-600 min-h-[1.25rem]">
                        {p.seleccionados.length > 0 && (
                            <span className="inline-flex items-center gap-2">
                                <strong className="text-blue-700">{p.seleccionados.length}</strong> seleccionado(s)
                                <button type="button" onClick={p.onLimpiarSeleccion} className="text-xs text-gray-500 hover:text-gray-700 underline">
                                    Limpiar selección
                                </button>
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={p.onCerrar}
                            className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            Cerrar
                        </button>
                        {p.periodoActivo && p.seleccionados.length > 0 && (
                            <button
                                type="button"
                                onClick={p.onAsignar}
                                disabled={p.asignando}
                                className="px-5 py-2 text-sm font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                {p.asignando ? 'Asignando…' : (<><UserPlus className="w-4 h-4" /> Asignar {p.seleccionados.length} docente(s)</>)}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
