import { useEffect, useState, useMemo } from 'react'
import Layout from '../../components/common/Layout'
import ModalDocentesPeriodo from '../../components/planeacion/ModalDocentesPeriodo'
import { 
    Filter, 
    ChevronDown, 
    ChevronLeft, 
    ChevronRight, 
    ChevronsLeft, 
    ChevronsRight, 
    Search, 
    X 
} from 'lucide-react'
// @ts-ignore
import { getPeriodos, createPeriodo, cerrarPeriodo, habilitarPeriodo, getDocentesPeriodo, asignarDocentesPeriodo, desasignarDocentePeriodo } from '../../services/periodosService'
// @ts-ignore
import { getUsuarios } from '../../services/usuariosService'
import { SEMESTRES, etiquetaCorte, etiquetaSemestre } from '../../utils/periodo'

interface Periodo {
    id_periodo: number
    anio: number
    semestre: number
    fecha_inicio: string
    fecha_fin: string
    activo: boolean
    creado_en: string
    total_docentes: string
}

interface Docente {
    id_usuario: number
    nombres: string
    apellidos: string
    correo: string
    activo: boolean
    fecha_asignacion?: string
    programa?: string
    tipo_documento?: string
    numero_documento?: string
}

export default function Periodos() {
    const [periodos, setPeriodos] = useState<Periodo[]>([])
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')
    const [exito, setExito] = useState('')
    const [busquedaHistorial, setBusquedaHistorial] = useState('')
    const [mostrarFiltrosHistorial, setMostrarFiltrosHistorial] = useState(true)

    // Paginación de Historial
    const [paginaHistorial, setPaginaHistorial] = useState(1)
    const [registrosPorPaginaHistorial, setRegistrosPorPaginaHistorial] = useState(5)

    // Filtros de búsqueda en modales
    const [busquedaDocenteReporte, setBusquedaDocenteReporte] = useState('')

    // Modal crear período
    const [modalCrear, setModalCrear] = useState(false)
    const [creando, setCreando] = useState(false)
    const [formPeriodo, setFormPeriodo] = useState({
        anio: new Date().getFullYear(),
        semestre: 1,
        fecha_inicio: '',
        fecha_fin: ''
    })

    // Modal asignar docentes
    const [modalAsignar, setModalAsignar] = useState(false)
    const [periodoSeleccionado, setPeriodoSeleccionado] = useState<Periodo | null>(null)
    const [docentesDisponibles, setDocentesDisponibles] = useState<Docente[]>([])
    const [docentesAsignados, setDocentesAsignados] = useState<Docente[]>([])
    const [seleccionados, setSeleccionados] = useState<number[]>([])
    const [cargandoDocentes, setCargandoDocentes] = useState(false)
    const [asignando, setAsignando] = useState(false)

    // Confirmación de cerrar/habilitar
    const [modalCerrar, setModalCerrar] = useState(false)
    const [periodoCerrar, setPeriodoCerrar] = useState<Periodo | null>(null)
    const [cerrando, setCerrando] = useState(false)
    
    const [modalHabilitar, setModalHabilitar] = useState(false)
    const [periodoHabilitar, setPeriodoHabilitar] = useState<Periodo | null>(null)
    const [habilitando, setHabilitando] = useState(false)

    // Modal de reportes
    const [modalReportes, setModalReportes] = useState(false)
    const [periodoReporte, setPeriodoReporte] = useState<Periodo | null>(null)
    const [docentesReporte, setDocentesReporte] = useState<Docente[]>([])
    const [cargandoReporte, setCargandoReporte] = useState(false)
    const [docenteSeleccionadoReporte, setDocenteSeleccionadoReporte] = useState<Docente | null>(null)

    useEffect(() => { cargarPeriodos() }, [])

    const cargarPeriodos = async () => {
        try {
            setCargando(true)
            const res = await getPeriodos()
            setPeriodos(res.data)
        } catch {
            setError('No se pudieron cargar los períodos.')
        } finally {
            setCargando(false)
        }
    }

    const periodoActivo = periodos.find(p => p.activo)
    const periodosInactivos = periodos.filter(p => !p.activo)
    const periodosInactivosFiltrados = useMemo(() => {
        return periodosInactivos.filter(p => {
            if (!busquedaHistorial.trim()) return true
            const q = busquedaHistorial.toLowerCase()
            const etiqueta = etiquetaPeriodo(p).toLowerCase()
            const anioStr = String(p.anio)
            return etiqueta.includes(q) || anioStr.includes(q)
        })
    }, [periodosInactivos, busquedaHistorial])

    // Reset de página al cambiar búsqueda o registros por página
    useEffect(() => {
        setPaginaHistorial(1)
    }, [busquedaHistorial, registrosPorPaginaHistorial])

    const totalPaginasHistorial = Math.ceil(periodosInactivosFiltrados.length / registrosPorPaginaHistorial) || 1
    const indiceInicioHistorial = (paginaHistorial - 1) * registrosPorPaginaHistorial
    const indiceFinHistorial = Math.min(indiceInicioHistorial + registrosPorPaginaHistorial, periodosInactivosFiltrados.length)

    const periodosInactivosPaginados = useMemo(() => {
        return periodosInactivosFiltrados.slice(indiceInicioHistorial, indiceFinHistorial)
    }, [periodosInactivosFiltrados, indiceInicioHistorial, indiceFinHistorial])

    // Docentes en modal reportes filtrados
    const docentesReporteFiltrados = useMemo(() => {
        if (!busquedaDocenteReporte.trim()) return docentesReporte
        const q = busquedaDocenteReporte.toLowerCase()
        return docentesReporte.filter(d => 
            `${d.nombres} ${d.apellidos}`.toLowerCase().includes(q) ||
            d.correo.toLowerCase().includes(q)
        )
    }, [docentesReporte, busquedaDocenteReporte])

    const handleCrear = async () => {
        if (!formPeriodo.fecha_inicio || !formPeriodo.fecha_fin) {
            setError('Selecciona las fechas de inicio y fin.')
            return
        }
        if (new Date(formPeriodo.fecha_fin) <= new Date(formPeriodo.fecha_inicio)) {
            setError('La fecha fin debe ser posterior a la fecha de inicio.')
            return
        }
        try {
            setCreando(true)
            setError('')
            await createPeriodo(formPeriodo)
            setModalCrear(false)
            setFormPeriodo({ anio: new Date().getFullYear(), semestre: 1, fecha_inicio: '', fecha_fin: '' })
            setExito('¡Período creado exitosamente!')
            setTimeout(() => setExito(''), 4000)
            await cargarPeriodos()
        } catch (err: any) {
            setError(err.response?.data?.error || 'Error al crear el período.')
        } finally {
            setCreando(false)
        }
    }

    const handleCerrar = async () => {
        if (!periodoCerrar) return
        try {
            setCerrando(true)
            setError('')
            await cerrarPeriodo(periodoCerrar.id_periodo)
            setModalCerrar(false)
            setPeriodoCerrar(null)
            setExito('Período cerrado correctamente.')
            setTimeout(() => setExito(''), 4000)
            await cargarPeriodos()
        } catch (err: any) {
            setError(err.response?.data?.error || 'Error al cerrar el período.')
        } finally {
            setCerrando(false)
        }
    }

    const handleHabilitar = async () => {
        if (!periodoHabilitar) return
        try {
            setHabilitando(true)
            setError('')
            await habilitarPeriodo(periodoHabilitar.id_periodo)
            setModalHabilitar(false)
            setPeriodoHabilitar(null)
            setExito('Período habilitado correctamente.')
            setTimeout(() => setExito(''), 4000)
            await cargarPeriodos()
        } catch (err: any) {
            setError(err.response?.data?.error || 'Error al habilitar el período.')
        } finally {
            setHabilitando(false)
        }
    }

    // silencioso = true al refrescar después de asignar/remover: no vacía la lista ni la selección pendiente
    const abrirModalAsignar = async (periodo: Periodo, silencioso = false) => {
        setPeriodoSeleccionado(periodo)
        setModalAsignar(true)
        if (!silencioso) {
            setCargandoDocentes(true)
            setSeleccionados([])
            setError('')
        }
        try {
            const [resUsuarios, resAsignados] = await Promise.all([
                getUsuarios(),
                getDocentesPeriodo(periodo.id_periodo)
            ])
            const todosDocentes: Docente[] = resUsuarios.data
            const asignados: Docente[] = resAsignados.data
            const sortDocentes = (lista: Docente[]) => [...lista].sort((a, b) =>
                ((a.nombres || '') + ' ' + (a.apellidos || '')).trim().localeCompare(((b.nombres || '') + ' ' + (b.apellidos || '')).trim(), 'es', { sensitivity: 'base' })
            );
            // Los asignados llegan con pocos datos: se completan (programa, documento) con la lista general de usuarios
            const porId = new Map<number, Docente>(todosDocentes.map(d => [d.id_usuario, d]))
            setDocentesAsignados(sortDocentes(asignados.map((a: Docente) => ({ ...(porId.get(a.id_usuario) || {}), ...a }))));

            // Filtrar: solo activos y que no estén ya asignados
            const idsAsignados = new Set(asignados.map((d: Docente) => d.id_usuario));
            setDocentesDisponibles(sortDocentes(todosDocentes.filter(d => d.activo && !idsAsignados.has(d.id_usuario))));
        } catch {
            setError('Error al cargar los docentes.')
        } finally {
            setCargandoDocentes(false)
        }
    }

    const toggleSeleccion = (id: number) => {
        setSeleccionados(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const seleccionarVarios = (ids: number[], marcar: boolean) => {
        setSeleccionados(prev => marcar ? Array.from(new Set([...prev, ...ids])) : prev.filter(id => !ids.includes(id)))
    }

    const handleAsignar = async () => {
        if (!periodoSeleccionado || seleccionados.length === 0) return
        try {
            setAsignando(true)
            setError('')
            const res = await asignarDocentesPeriodo(periodoSeleccionado.id_periodo, seleccionados)
            setExito(res.data.mensaje)
            setTimeout(() => setExito(''), 4000)
            // Recargar la lista dentro del modal
            await abrirModalAsignar(periodoSeleccionado, true)
            setSeleccionados([])
            await cargarPeriodos()
        } catch (err: any) {
            setError(err.response?.data?.error || 'Error al asignar los docentes.')
        } finally {
            setAsignando(false)
        }
    }

    const handleDesasignar = async (idUsuario: number) => {
        if (!periodoSeleccionado) return
        try {
            setError('')
            await desasignarDocentePeriodo(periodoSeleccionado.id_periodo, idUsuario)
            await abrirModalAsignar(periodoSeleccionado, true)
            await cargarPeriodos()
        } catch {
            setError('Error al remover el docente.')
        }
    }

    const formatFecha = (f: string) => {
        if (!f) return '—'
        return new Date(f).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
    }

    const etiquetaPeriodo = (p: Periodo) => `${p.anio}-${etiquetaSemestre(p.semestre)}`

    const abrirModalReportes = async (periodo: Periodo) => {
        setPeriodoReporte(periodo)
        setModalReportes(true)
        setCargandoReporte(true)
        setDocenteSeleccionadoReporte(null)
        try {
            const res = await getDocentesPeriodo(periodo.id_periodo)
            const listaReporte = (res.data || []).sort((a: Docente, b: Docente) =>
                ((a.nombres || '') + ' ' + (a.apellidos || '')).trim().localeCompare(((b.nombres || '') + ' ' + (b.apellidos || '')).trim(), 'es', { sensitivity: 'base' })
            );
            setDocentesReporte(listaReporte)
        } catch {
            setError('Error al cargar los docentes del período.')
        } finally {
            setCargandoReporte(false)
        }
    }

    return (
        <Layout rol="planeacion" path="Inicio / Períodos">

            {/* ── Encabezado ── */}
            <div className="bg-[#1a2744] rounded-xl px-6 py-4 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div>
                    <h2 className="text-white text-lg font-medium">Gestión de Períodos</h2>
                    <p className="text-white/50 text-xs mt-0.5">
                        Administre los ciclos académicos y vincule docentes
                    </p>
                </div>
                <button
                    onClick={() => {
                        if (periodoActivo) {
                            setError('Debe cerrar el período activo antes de crear uno nuevo.')
                            return
                        }
                        setError('')
                        setModalCrear(true)
                    }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors font-medium ${periodoActivo
                        ? 'bg-white/10 text-white/40 cursor-not-allowed'
                        : 'bg-white text-[#1a2744] hover:bg-gray-100'
                        }`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Crear nuevo período
                </button>
            </div>

            {/* ── Mensajes ── */}
            {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex justify-between items-center shadow-sm">
                    {error}
                    <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 font-bold ml-4 p-1">✕</button>
                </div>
            )}
            {exito && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg flex justify-between items-center shadow-sm">
                    {exito}
                    <button onClick={() => setExito('')} className="text-green-400 hover:text-green-600 font-bold ml-4 p-1">✕</button>
                </div>
            )}

            {cargando ? (
                <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Cargando períodos...</div>
            ) : (
                <>
                    {/* ══════ PERÍODO ACTIVO ══════ */}
                    {periodoActivo ? (
                        <div className="mb-6">
                            <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Período Activo</h3>
                            <div className="bg-white border-2 border-green-200 rounded-xl p-5 sm:p-6 shadow-sm">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-black text-gray-900">{etiquetaPeriodo(periodoActivo)}</h4>
                                            <p className="text-sm text-gray-500 mt-0.5">
                                                {formatFecha(periodoActivo.fecha_inicio)} — {formatFecha(periodoActivo.fecha_fin)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                        {/* Stats */}
                                        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg">
                                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            <span className="text-sm font-bold text-blue-700">{periodoActivo.total_docentes} docentes</span>
                                        </div>

                                        {/* Botón vincular */}
                                        <button
                                            onClick={() => abrirModalAsignar(periodoActivo)}
                                            className="flex items-center justify-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                            Vincular docentes
                                        </button>

                                        {/* Botón cerrar */}
                                        <button
                                            onClick={() => { setPeriodoCerrar(periodoActivo); setModalCerrar(true) }}
                                            className="flex items-center justify-center gap-2 px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                            Cerrar período
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-3 text-xs text-gray-400">
                                    Creado: {formatFecha(periodoActivo.creado_en)}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                            <svg className="w-10 h-10 text-amber-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                            <p className="font-bold text-amber-800 mb-1">No hay un período activo</p>
                            <p className="text-sm text-amber-600">Cree un nuevo período para comenzar a trabajar.</p>
                        </div>
                    )}

                    {/* ══════ HISTORIAL DE PERÍODOS ══════ */}
                    {periodosInactivos.length > 0 && (
                        <div className="mt-8">
                            {/* Filtros colapsables del Historial */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 overflow-hidden transition-all">
                                <div 
                                    onClick={() => setMostrarFiltrosHistorial(!mostrarFiltrosHistorial)}
                                    className="flex items-center justify-between px-5 py-3.5 bg-gray-50/70 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <Filter className="w-4 h-4 text-purple-600" />
                                        <span className="text-sm font-bold text-gray-700">Filtros de Historial ({periodosInactivos.length})</span>
                                        {busquedaHistorial && (
                                            <span className="px-2 py-0.5 text-xs font-bold bg-purple-100 text-purple-700 rounded-full">
                                                1 activo
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 font-medium">
                                            {mostrarFiltrosHistorial ? 'Ocultar filtros' : 'Mostrar filtros'}
                                        </span>
                                        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${mostrarFiltrosHistorial ? 'rotate-180' : ''}`} />
                                    </div>
                                </div>

                                {mostrarFiltrosHistorial && (
                                    <div className="p-4 sm:p-5 border-t border-gray-100 bg-white">
                                        <div className="flex flex-col sm:flex-row gap-4 items-end">
                                            <div className="flex-1 w-full">
                                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                                                    Buscar período en historial
                                                </label>
                                                <div className="relative">
                                                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                    <input
                                                        type="text"
                                                        placeholder="Buscar por año o semestre (ej: 2024 o 2025-I)..."
                                                        value={busquedaHistorial}
                                                        onChange={(e) => setBusquedaHistorial(e.target.value)}
                                                        className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                                    />
                                                    {busquedaHistorial && (
                                                        <button 
                                                            onClick={() => setBusquedaHistorial('')} 
                                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {busquedaHistorial && (
                                                <button
                                                    type="button"
                                                    onClick={() => setBusquedaHistorial('')}
                                                    className="px-3 py-2 text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors"
                                                >
                                                    Limpiar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {periodosInactivosFiltrados.length === 0 ? (
                                <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
                                    <p className="text-sm">No se encontraron períodos que coincidan con "{busquedaHistorial}"</p>
                                    <button onClick={() => setBusquedaHistorial('')} className="text-purple-600 text-xs mt-2 hover:underline font-semibold">Limpiar búsqueda</button>
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                                    {/* Contenedor de tarjetas con scroll vertical interno */}
                                    <div className="p-4 space-y-3 max-h-[460px] overflow-y-auto">
                                        {periodosInactivosPaginados.map(p => (
                                            <div key={p.id_periodo} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-shadow">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                    <div className="flex items-center gap-4">
                                                        <div className="p-2.5 bg-gray-100 text-gray-500 rounded-lg">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-base font-black text-gray-800">{etiquetaPeriodo(p)}</h4>
                                                            <p className="text-xs text-gray-500 mt-0.5">
                                                                {formatFecha(p.fecha_inicio)} — {formatFecha(p.fecha_fin)}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg">
                                                            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                            <span className="text-xs font-bold text-blue-700">{p.total_docentes} docentes</span>
                                                        </div>
                                                        <span className="bg-gray-100 text-gray-500 px-2.5 py-1 rounded-md text-xs font-semibold">Cerrado</span>
                                                        <button
                                                            onClick={() => abrirModalAsignar(p)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                            Docentes
                                                        </button>
                                                        <button
                                                            onClick={() => abrirModalReportes(p)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white border border-emerald-300 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors font-medium"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                            Ver reportes
                                                        </button>
                                                        <button
                                                            onClick={() => { setPeriodoHabilitar(p); setModalHabilitar(true) }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 border border-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-sm ml-auto"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                            Habilitar
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Footer de Paginación para Historial */}
                                    <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <span>Mostrar</span>
                                            <select
                                                value={registrosPorPaginaHistorial}
                                                onChange={(e) => setRegistrosPorPaginaHistorial(Number(e.target.value))}
                                                className="border border-gray-300 rounded px-2 py-1 font-semibold text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                                            >
                                                <option value={5}>5</option>
                                                <option value={10}>10</option>
                                                <option value={15}>15</option>
                                                <option value={20}>20</option>
                                                <option value={25}>25</option>
                                            </select>
                                            <span>períodos por página</span>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <span>
                                                Mostrando {periodosInactivosFiltrados.length === 0 ? 0 : indiceInicioHistorial + 1} - {indiceFinHistorial} de {periodosInactivosFiltrados.length}
                                            </span>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => setPaginaHistorial(1)}
                                                    disabled={paginaHistorial === 1 || periodosInactivosFiltrados.length === 0}
                                                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 transition-colors"
                                                    title="Primera página"
                                                >
                                                    <ChevronsLeft className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setPaginaHistorial(prev => Math.max(prev - 1, 1))}
                                                    disabled={paginaHistorial === 1 || periodosInactivosFiltrados.length === 0}
                                                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 transition-colors"
                                                    title="Página anterior"
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                </button>

                                                <span className="px-2 font-bold text-gray-800">
                                                    {paginaHistorial} / {totalPaginasHistorial}
                                                </span>

                                                <button
                                                    onClick={() => setPaginaHistorial(prev => Math.min(prev + 1, totalPaginasHistorial))}
                                                    disabled={paginaHistorial === totalPaginasHistorial || periodosInactivosFiltrados.length === 0}
                                                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 transition-colors"
                                                    title="Página siguiente"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setPaginaHistorial(totalPaginasHistorial)}
                                                    disabled={paginaHistorial === totalPaginasHistorial || periodosInactivosFiltrados.length === 0}
                                                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 transition-colors"
                                                    title="Última página"
                                                >
                                                    <ChevronsRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {periodos.length === 0 && (
                        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center text-gray-400">
                            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <p className="text-sm font-medium">No hay períodos registrados</p>
                            <p className="text-xs mt-1">Crea tu primer período académico para comenzar.</p>
                        </div>
                    )}
                </>
            )}

            {/* ══════════ MODAL CREAR PERÍODO ══════════ */}
            {modalCrear && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="bg-purple-700 px-6 py-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-white font-medium text-sm">Crear nuevo período</h3>
                                <p className="text-white/70 text-xs mt-0.5">Complete los datos del ciclo académico</p>
                            </div>
                            <button onClick={() => { setModalCrear(false); setError('') }} className="text-white/50 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-lg">{error}</div>
                            )}

                            {/* Preview de etiqueta */}
                            <div className="bg-purple-50 border border-purple-100 rounded-lg px-4 py-3 text-center">
                                <p className="text-xs text-purple-500 font-semibold uppercase tracking-wider mb-1">Período resultante</p>
                                <p className="text-2xl font-black text-purple-800">{formPeriodo.anio}-{etiquetaSemestre(formPeriodo.semestre)}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Año</label>
                                    <input
                                        type="number"
                                        min={2020}
                                        max={2050}
                                        value={formPeriodo.anio}
                                        onChange={e => setFormPeriodo(p => ({ ...p, anio: parseInt(e.target.value) }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Semestre</label>
                                    <select
                                        value={formPeriodo.semestre}
                                        onChange={e => setFormPeriodo(p => ({ ...p, semestre: parseInt(e.target.value) }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 bg-white"
                                    >
                                        {SEMESTRES.map(o => (
                                            <option key={o.valor} value={o.valor}>
                                                {o.valor <= 2 ? `${o.romano} (${o.nombre})` : o.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio</label>
                                    <input
                                        type="date"
                                        value={formPeriodo.fecha_inicio}
                                        onChange={e => setFormPeriodo(p => ({ ...p, fecha_inicio: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin</label>
                                    <input
                                        type="date"
                                        value={formPeriodo.fecha_fin}
                                        onChange={e => setFormPeriodo(p => ({ ...p, fecha_fin: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                                    />
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700">
                                El nuevo período se creará como <strong>activo</strong> automáticamente. Solo puede existir un período activo a la vez.
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => { setModalCrear(false); setError('') }}
                                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCrear}
                                disabled={creando}
                                className="px-5 py-2 text-sm bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {creando ? (
                                    <>
                                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        Creando...
                                    </>
                                ) : 'Crear período'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════ MODAL CERRAR PERÍODO ══════════ */}
            {modalCerrar && periodoCerrar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
                        <div className="px-6 py-8 text-center">
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">¿Cerrar período {etiquetaPeriodo(periodoCerrar)}?</h3>
                            <p className="text-sm text-gray-500">
                                Esta acción marcará el período como inactivo. Los datos del período se conservarán en el historial.
                            </p>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-center gap-3">
                            <button
                                onClick={() => { setModalCerrar(false); setPeriodoCerrar(null) }}
                                className="px-5 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCerrar}
                                disabled={cerrando}
                                className="px-5 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {cerrando ? 'Cerrando...' : 'Sí, cerrar período'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════ MODAL HABILITAR PERÍODO ══════════ */}
            {modalHabilitar && periodoHabilitar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
                        <div className="px-6 py-8 text-center">
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">¿Habilitar período {etiquetaPeriodo(periodoHabilitar)}?</h3>
                            <p className="text-sm text-gray-500">
                                Esta acción volverá a establecer el período como activo. Al hacerlo, las ventanas de semanas y reportes estarán vinculadas a este ciclo.
                            </p>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-center gap-3">
                            <button
                                onClick={() => { setModalHabilitar(false); setPeriodoHabilitar(null) }}
                                className="px-5 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleHabilitar}
                                disabled={habilitando}
                                className="px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {habilitando ? 'Habilitando...' : 'Sí, habilitar período'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════ MODAL VINCULAR DOCENTES ══════════ */}
            {modalAsignar && periodoSeleccionado && (
                <ModalDocentesPeriodo
                    etiqueta={etiquetaPeriodo(periodoSeleccionado)}
                    periodoActivo={periodoSeleccionado.activo}
                    asignados={docentesAsignados}
                    disponibles={docentesDisponibles}
                    seleccionados={seleccionados}
                    cargando={cargandoDocentes}
                    asignando={asignando}
                    error={error}
                    onToggle={toggleSeleccion}
                    onSeleccionar={seleccionarVarios}
                    onLimpiarSeleccion={() => setSeleccionados([])}
                    onAsignar={handleAsignar}
                    onRemover={handleDesasignar}
                    onCerrar={() => { setModalAsignar(false); setError('') }}
                />
            )}

            {/* ══════════ MODAL REPORTES POR DOCENTE ══════════ */}
            {modalReportes && periodoReporte && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="bg-emerald-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
                            <div>
                                <h3 className="text-white font-medium text-sm">Reportes del período {etiquetaPeriodo(periodoReporte)}</h3>
                                <p className="text-white/70 text-xs mt-0.5">
                                    {formatFecha(periodoReporte.fecha_inicio)} — {formatFecha(periodoReporte.fecha_fin)} · {docentesReporte.length} docentes
                                </p>
                            </div>
                            <button onClick={() => { setModalReportes(false); setDocenteSeleccionadoReporte(null) }} className="text-white/50 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {cargandoReporte ? (
                                <div className="text-center text-gray-400 py-16 text-sm">Cargando docentes...</div>
                            ) : docentesReporte.length === 0 ? (
                                <div className="text-center text-gray-400 py-16">
                                    <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    <p className="text-sm">No hay docentes vinculados a este período.</p>
                                </div>
                            ) : !docenteSeleccionadoReporte ? (
                                /* ── Lista de Docentes para elegir ── */
                                <div className="p-5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                                            Seleccione un docente ({docentesReporteFiltrados.length}{docentesReporteFiltrados.length !== docentesReporte.length ? ` de ${docentesReporte.length}` : ''})
                                        </p>
                                    </div>

                                    {/* Buscador de docentes en reportes */}
                                    <div className="relative mb-3">
                                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            placeholder="Buscar docente por nombre o correo..."
                                            value={busquedaDocenteReporte}
                                            onChange={(e) => setBusquedaDocenteReporte(e.target.value)}
                                            className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        />
                                        {busquedaDocenteReporte && (
                                            <button 
                                                onClick={() => setBusquedaDocenteReporte('')}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>

                                    {docentesReporteFiltrados.length === 0 ? (
                                        <div className="text-center text-gray-400 text-xs py-8 bg-gray-50 rounded-lg border border-gray-100">
                                            No se encontraron docentes con "{busquedaDocenteReporte}"
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                                            {docentesReporteFiltrados.map(d => (
                                                <button
                                                    key={d.id_usuario}
                                                    onClick={() => setDocenteSeleccionadoReporte(d)}
                                                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg hover:border-emerald-300 hover:bg-emerald-50/50 transition-all text-left group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                                                            {d.nombres.charAt(0)}{d.apellidos.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-800">{d.nombres} {d.apellidos}</p>
                                                            <p className="text-xs text-gray-500">{d.correo}</p>
                                                        </div>
                                                    </div>
                                                    <svg className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* ── Vista de Reporte del Docente Seleccionado ── */
                                <div className="p-5">
                                    {/* Botón volver */}
                                    <button
                                        onClick={() => setDocenteSeleccionadoReporte(null)}
                                        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 font-medium transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                        Volver a la lista
                                    </button>

                                    {/* Info del docente */}
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-5 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-emerald-200 text-emerald-700 flex items-center justify-center text-lg font-bold flex-shrink-0">
                                            {docenteSeleccionadoReporte.nombres.charAt(0)}{docenteSeleccionadoReporte.apellidos.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">{docenteSeleccionadoReporte.nombres} {docenteSeleccionadoReporte.apellidos}</p>
                                            <p className="text-xs text-gray-500">{docenteSeleccionadoReporte.correo}</p>
                                        </div>
                                    </div>

                                    {/* Semanas */}
                                    <div className="space-y-4">
                                        {/* Semana 8 */}
                                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                            <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex items-center gap-2">
                                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                <h5 className="text-sm font-bold text-blue-800">{etiquetaCorte(8, periodoReporte?.semestre)}</h5>
                                            </div>
                                            <div className="p-4 text-center text-gray-400">
                                                <div className="py-6">
                                                    <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                    <p className="text-sm font-medium text-gray-500">Sin funciones registradas</p>
                                                    <p className="text-xs text-gray-400 mt-1">Las funciones y evidencias aparecerán una vez que el docente las registre desde su panel.</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Semana 16 */}
                                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                            <div className="bg-purple-50 px-4 py-3 border-b border-purple-100 flex items-center gap-2">
                                                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                <h5 className="text-sm font-bold text-purple-800">{etiquetaCorte(16, periodoReporte?.semestre)}</h5>
                                            </div>
                                            <div className="p-4 text-center text-gray-400">
                                                <div className="py-6">
                                                    <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                    <p className="text-sm font-medium text-gray-500">Sin funciones registradas</p>
                                                    <p className="text-xs text-gray-400 mt-1">Las funciones y evidencias aparecerán una vez que el docente las registre desde su panel.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-xs text-amber-700">
                                        <strong>Nota:</strong> Los reportes se poblarán automáticamente cuando el módulo de docentes esté implementado. Cada docente podrá registrar sus funciones y subir evidencias en las semanas 8 y 16.
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end flex-shrink-0">
                            <button
                                onClick={() => { setModalReportes(false); setDocenteSeleccionadoReporte(null) }}
                                className="px-5 py-2 text-sm bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </Layout>
    )
}
