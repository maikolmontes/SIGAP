import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/common/Layout'
// @ts-ignore
import { toggleActivo, createBulkUsuarios, deleteUsuario } from '../../services/usuariosService'
import { getPeriodos, getDocentesPeriodo } from '../../services/periodosService'
import { getProgramas } from '../../services/programasService'
import { getFacultades } from '../../services/facultadesService'
import { exportarDocentesExcel } from '../../utils/exportExcelDocentes'
import PanelAgendasTiempoReal from '../../components/planeacion/PanelAgendasTiempoReal'
import { usePermisosPagina } from '../../hooks/usePermisos'
import * as XLSX from 'xlsx'
import { avisar } from '../../components/common/dialogo'
import { 
    Library, 
    GraduationCap, 
    CheckCircle2, 
    XCircle, 
    RefreshCw, 
    Clock, 
    TrendingUp, 
    CheckCircle, 
    AlertCircle,
    Users,
    UserPlus,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Filter,
    ChevronDown
} from 'lucide-react'
import { etiquetaSemestreP } from '../../utils/periodo'

interface Periodo {
    id_periodo: number
    anio: number
    semestre: number
    activo: boolean
    fecha_inicio: string
    fecha_fin: string
}

interface Docente {
    id_usuario: number
    nombres: string
    apellidos: string
    nombre_completo?: string
    correo: string
    tipo_documento?: string
    numero_documento?: string
    activo: boolean
    tipo_contrato?: string
    horas_contrato?: number
    programa?: string
    facultad?: string
    roles?: string
    fecha_asignacion?: string
}



export default function DashboardPlaneacion() {
    const [docentes, setDocentes] = useState<Docente[]>([])
    const [programas, setProgramas] = useState<any[]>([])
    const [facultades, setFacultades] = useState<any[]>([])
    // Permisos dinámicos del rol activo sobre el panel de agendas
    const permisosAgendas = usePermisosPagina('Dashboard Planeación')
    const [busqueda, setBusqueda] = useState('')
    const [filtroFacultad, setFiltroFacultad] = useState<string>('Todas')
    const [filtroPrograma, setFiltroPrograma] = useState<string>('Todos')
    const [filtroEstado, setFiltroEstado] = useState<'Todos' | 'Activos' | 'Inactivos'>('Todos')
    const [mostrarFiltros, setMostrarFiltros] = useState(true)
    const [paginaActual, setPaginaActual] = useState(1)
    const [registrosPorPagina, setRegistrosPorPagina] = useState(10)
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')
    const [toast, setToast] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null)
    const navigate = useNavigate()
    // New state for active period
    const [periodoActivo, setPeriodoActivo] = useState<Periodo | null>(null)
    const [modalImportar, setModalImportar] = useState(false)
    const [archivoImportar, setArchivoImportar] = useState<File | null>(null)
    const [importando, setImportando] = useState(false)
    const [editandoId, setEditandoId] = useState<number | null>(null)
    const [tabActiva, setTabActiva] = useState<'usuarios' | 'agendas'>('usuarios')

    // Modales de Edición y Eliminación
    const [modalEliminarOpen, setModalEliminarOpen] = useState(false)
    const [docenteAEliminar, setDocenteAEliminar] = useState<Docente | null>(null)

    const [eliminando, setEliminando] = useState(false)

    // Editar usa el mismo formulario completo que "Crear docente" (página de Docentes): rol, contrato, programas…
    const handleOpenEditModal = (d: Docente) => {
        navigate('/planeacion/docentes', { state: { editarUsuarioId: d.id_usuario } })
    }

    const handleOpenDeleteModal = (d: Docente) => {
        setDocenteAEliminar(d)
        setModalEliminarOpen(true)
    }

    const handleDeleteConfirm = async () => {
        if (!docenteAEliminar) return
        try {
            setEliminando(true)
            await deleteUsuario(docenteAEliminar.id_usuario)
            setModalEliminarOpen(false)
            setDocenteAEliminar(null)
            await cargarDocentes()
            void avisar({ tipo: 'exito', mensaje: 'Usuario eliminado correctamente' })
        } catch (err: any) {
            console.error('Error al eliminar usuario:', err)
            const errMsg = err.response?.data?.error || 'Ocurrió un error al eliminar el usuario.'
            void avisar({ tipo: 'error', mensaje: errMsg })
        } finally {
            setEliminando(false)
        }
    }

    const cargarDocentes = useCallback(async () => {
        try {
            setCargando(true)
            const [resPeriodos, resProgs, resFacs] = await Promise.all([
                getPeriodos(),
                getProgramas().catch(() => ({ data: [] })),
                getFacultades().catch(() => ({ data: [] }))
            ])
            const activo = resPeriodos.data.find((p: any) => p.activo)
            setPeriodoActivo(activo || null)
            setProgramas(resProgs.data || [])
            setFacultades(resFacs.data || [])

            if (activo) {
                const res = await getDocentesPeriodo(activo.id_periodo)
                setDocentes(res.data || [])
            } else {
                setDocentes([])
            }
        } catch {
            setError('No se pudieron cargar los docentes del período activo')
        } finally {
            setCargando(false)
        }
    }, [])

    useEffect(() => {
        cargarDocentes()
        const interval = setInterval(() => {
            cargarDocentes()
        }, 30000)
        return () => clearInterval(interval)
    }, [cargarDocentes])

    const programasDisponibles = useMemo(() => {
        if (filtroFacultad === 'Todas') {
            return programas
        }
        const facSeleccionada = facultades.find((f: any) => (f.nombre_facultad || '').toLowerCase().trim() === filtroFacultad.toLowerCase().trim())
        if (!facSeleccionada) {
            return programas.filter((p: any) => (p.facultad || '').toLowerCase().trim() === filtroFacultad.toLowerCase().trim())
        }
        return programas.filter((p: any) => 
            p.id_facultad === facSeleccionada.id_facultad || 
            (p.facultad || '').toLowerCase().trim() === filtroFacultad.toLowerCase().trim()
        )
    }, [programas, facultades, filtroFacultad])

    const handleFacultadChange = (nuevaFacultad: string) => {
        setFiltroFacultad(nuevaFacultad)
        setFiltroPrograma('Todos')
    }

    const docentesFiltrados = docentes.filter(d => {
        const textoCompleto = `${d.nombres} ${d.apellidos} ${d.correo} ${d.programa || ''} ${d.facultad || ''} ${d.tipo_contrato || ''}`.toLowerCase()
        const matchBusqueda = textoCompleto.includes(busqueda.toLowerCase())
        
        const matchEstado = filtroEstado === 'Todos' ||
            (filtroEstado === 'Activos' && d.activo) ||
            (filtroEstado === 'Inactivos' && !d.activo)

        const matchFacultad = filtroFacultad === 'Todas' ||
            (d.facultad && d.facultad.toLowerCase().trim() === filtroFacultad.toLowerCase().trim())

        const matchPrograma = filtroPrograma === 'Todos' ||
            (d.programa && d.programa.toLowerCase().trim() === filtroPrograma.toLowerCase().trim())

        return matchBusqueda && matchEstado && matchFacultad && matchPrograma
    }).sort((a, b) => ((a.nombres || '') + ' ' + (a.apellidos || '')).trim().localeCompare(((b.nombres || '') + ' ' + (b.apellidos || '')).trim(), 'es', { sensitivity: 'base' }))

    const totalFiltrosActivos = [
        Boolean(busqueda.trim()),
        filtroFacultad !== 'Todas',
        filtroPrograma !== 'Todos',
        filtroEstado !== 'Todos'
    ].filter(Boolean).length

    const totalRegistros = docentesFiltrados.length
    const totalPaginas = Math.max(1, Math.ceil(totalRegistros / registrosPorPagina))
    const indiceInicio = (paginaActual - 1) * registrosPorPagina
    const indiceFin = Math.min(indiceInicio + registrosPorPagina, totalRegistros)

    const docentesPaginados = useMemo(() => {
        return docentesFiltrados.slice(indiceInicio, indiceFin)
    }, [docentesFiltrados, indiceInicio, indiceFin])

    // Resetear a página 1 cuando cambian los filtros o la cantidad de registros por página
    useEffect(() => {
        setPaginaActual(1)
    }, [busqueda, filtroFacultad, filtroPrograma, filtroEstado, registrosPorPagina])

    // Asegurar que paginaActual no sobrepase el total de páginas
    useEffect(() => {
        if (paginaActual > totalPaginas) {
            setPaginaActual(totalPaginas)
        }
    }, [paginaActual, totalPaginas])

    const handleToggle = async (id: number) => {
        try {
            setEditandoId(id)
            const res = await toggleActivo(id)
            const nuevoEstado = res.data.activo
            setDocentes(prev =>
                prev.map(d => d.id_usuario === id ? { ...d, activo: nuevoEstado } : d)
            )
            const doc = docentes.find(d => d.id_usuario === id);
            setToast({
                tipo: 'exito',
                mensaje: `Usuario ${doc ? `${doc.nombres} ${doc.apellidos}` : ''} ha sido ${nuevoEstado ? 'habilitado' : 'inhabilitado'} exitosamente.`
            })
            setTimeout(() => setToast(null), 4000)
        } catch {
            setError('Error al cambiar el estado del docente')
        } finally {
            setEditandoId(null)
        }
    }

    const handleDownloadTemplate = () => {
        const link = document.createElement('a');
        link.href = '/plantilla_docentes_SIGAP.xlsx';
        link.download = 'plantilla_docentes_SIGAP.xlsx';
        link.click();
    }

    const handleImportSubmit = async () => {
        if (!archivoImportar) {
            setError('Por favor selecciona un archivo primero.')
            return
        }

        try {
            setImportando(true)
            setError('')

            const data = await archivoImportar.arrayBuffer()
            const workbook = XLSX.read(data)
            const worksheet = workbook.Sheets[workbook.SheetNames[0]]
            const jsonData = XLSX.utils.sheet_to_json<any>(worksheet)

            const payload = jsonData.map((row: any) => {
                const userRol = row.Rol || row.rol || 'Docente';
                const isPl = userRol.toLowerCase().includes('plane');
                return {
                    nombres: row.Nombres || row.nombres || '',
                    apellidos: row.Apellidos || row.apellidos || '',
                    correo: row.Correo || row.correo || '',
                    tipo_documento: row['Tipo Documento'] || row.tipo_documento || row.tipoDocumento || 'CC',
                    numero_documento: row['Número Documento'] || row.numero_documento || row.numeroDocumento || '0000000000',
                    programa: isPl ? null : (row['Programa Académico'] || row['Programa Academico'] || row.programa || row.Programa || 'Ingeniería de Sistemas'),
                    facultad: isPl ? null : 'Ingeniería',
                    rol: userRol
                };
            }).filter((u: any) => u.nombres && u.apellidos && u.correo)

            if (payload.length === 0) {
                setError('El Excel no tiene datos válidos. Revisa las columnas (Nombres, Apellidos, Correo, Tipo Documento, Número Documento, Programa Académico, Rol).')
                return
            }

            const res = await createBulkUsuarios(payload)
            setModalImportar(false)
            setArchivoImportar(null)
            await cargarDocentes()
            void avisar({ tipo: 'exito', titulo: 'Importación terminada', mensaje: res.data.mensaje || 'Docentes importados correctamente' })

        } catch (err: any) {
            setError(err.response?.data?.error || 'Falló la importación del Excel.')
        } finally {
            setImportando(false)
        }
    }

    const handleExportar = async () => {
        try {
            await exportarDocentesExcel(
                docentes,
                periodoActivo ? `Período ${periodoActivo.anio} ${etiquetaSemestreP(periodoActivo.semestre)}` : undefined
            )
        } catch (err) {
            console.error('Error al exportar Excel:', err)
            void avisar({ tipo: 'error', mensaje: 'Ocurrió un error al generar el reporte Excel.' })
        }
    }

    return (
        <Layout rol="planeacion" path="Inicio / Dashboard">

            {/* ── Encabezado ── */}
            <div className="bg-[#1a2744] rounded-xl px-6 py-4 mb-5 flex items-center justify-between shadow-sm">
                <div>
                    <h2 className="text-white text-lg font-medium">Bienvenido, Planeación</h2>
                    <p className="text-white/50 text-xs mt-0.5">
                        {periodoActivo ? `Período ${periodoActivo.anio} ${etiquetaSemestreP(periodoActivo.semestre)}` : 'Cargando período...'} · Facultad de Ingeniería
                    </p>
                </div>
            </div>

            {/* ── Toast de Feedback / Notificaciones ── */}
            {toast && (
                <div className={`mb-4 px-4 py-3 rounded-xl border flex items-center justify-between text-sm font-medium transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
                    toast.tipo === 'error'
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-green-50 border-green-200 text-green-700'
                }`}>
                    <div className="flex items-center gap-2">
                        {toast.tipo === 'error' ? (
                            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        ) : (
                            <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        )}
                        <span>{toast.mensaje}</span>
                    </div>
                    <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600 font-bold ml-4">✕</button>
                </div>
            )}

            {/* ── Navegación de Tabs ── */}
            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => setTabActiva('usuarios')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${tabActiva === 'usuarios' 
                        ? 'bg-[#1a2744] text-white shadow-md' 
                        : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                >
                    Docentes del Período Activo
                </button>
                <button
                    onClick={() => setTabActiva('agendas')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${tabActiva === 'agendas' 
                        ? 'bg-[#1a2744] text-white shadow-md' 
                        : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                >
                    Importación de Asignaciones
                </button>
            </div>

            {tabActiva === 'usuarios' ? (
                <>
                    {/* ── Métricas (Cards) del Período ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Total Docentes</p>
                                    <p className="text-2xl font-black text-gray-800">{docentes.length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Activos</p>
                                    <p className="text-2xl font-black text-gray-800">{docentes.filter(d => d.activo).length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-red-50 text-red-600 rounded-lg">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Inactivos</p>
                                    <p className="text-2xl font-black text-gray-800">{docentes.filter(d => !d.activo).length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Período Activo</p>
                                    <p className="text-xl font-black text-gray-800 tracking-tight">{periodoActivo ? `${periodoActivo.anio} ${etiquetaSemestreP(periodoActivo.semestre)}` : 'Cargando...'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* ── Acciones Rápidas ── */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Acciones Rápidas</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                            <button
                                onClick={() => navigate('/planeacion/docentes', { state: { openAddModal: true } })}
                                className="flex flex-col items-center justify-center py-5 px-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md hover:bg-blue-50/50 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                </div>
                                <span className="text-sm font-bold text-gray-800">Crear docente</span>
                                <span className="text-xs text-gray-500 mt-1 text-center">Registrar usuario manual</span>
                            </button>

                            <button
                                onClick={() => navigate('/planeacion/facultades', { state: { openAddModal: true } })}
                                className="flex flex-col items-center justify-center py-5 px-4 bg-white border border-gray-200 rounded-xl hover:border-[#00a896] hover:shadow-md hover:bg-emerald-50/30 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#00a896] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <Library className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-bold text-gray-800">Agregar Facultad</span>
                                <span className="text-xs text-gray-500 mt-1 text-center">Registrar facultad nueva</span>
                            </button>

                            <button
                                onClick={() => navigate('/planeacion/programas', { state: { openAddModal: true } })}
                                className="flex flex-col items-center justify-center py-5 px-4 bg-white border border-gray-200 rounded-xl hover:border-sky-400 hover:shadow-md hover:bg-sky-50/30 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <GraduationCap className="w-6 h-6" />
                                </div>
                                <span className="text-sm font-bold text-gray-800">Agregar Programa</span>
                                <span className="text-xs text-gray-500 mt-1 text-center">Vincular programa académico</span>
                            </button>

                            <button
                                onClick={() => navigate('/planeacion/periodos')}
                                className="flex flex-col items-center justify-center py-5 px-4 bg-white border border-gray-200 rounded-xl hover:border-purple-400 hover:shadow-md hover:bg-purple-50/50 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </div>
                                <span className="text-sm font-bold text-gray-800">Crear período</span>
                                <span className="text-xs text-gray-500 mt-1 text-center">Aperturar un nuevo bloque</span>
                            </button>

                            <button
                                onClick={() => navigate('/planeacion/periodos')}
                                className="flex flex-col items-center justify-center py-5 px-4 bg-white border border-gray-200 rounded-xl hover:border-orange-400 hover:shadow-md hover:bg-orange-50/50 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                </div>
                                <span className="text-sm font-bold text-gray-800">Asignar docentes</span>
                                <span className="text-xs text-gray-500 mt-1 text-center">Vincular docentes al período</span>
                            </button>
                        </div>
                    </div>

                    {/* ── Error ── */}
                    {error && (
                        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex justify-between items-center shadow-sm">
                            {error}
                            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 font-bold ml-4 p-1">✕</button>
                        </div>
                    )}

                    {/* ── Sección de Filtros de Búsqueda (Extensible / Colapsable) ── */}
                    <div className="bg-white border border-gray-200 rounded-xl mb-4 shadow-xs overflow-hidden transition-all">
                        {/* Cabecera para extender/mostrar u ocultar */}
                        <div 
                            onClick={() => setMostrarFiltros(!mostrarFiltros)}
                            className="px-4 py-3 bg-gray-50/70 hover:bg-gray-100/70 flex items-center justify-between cursor-pointer select-none transition-colors"
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                                    <Filter className="w-4 h-4" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                                        Filtros de Búsqueda
                                    </span>
                                    {totalFiltrosActivos > 0 && (
                                        <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full">
                                            {totalFiltrosActivos} aplicado{totalFiltrosActivos > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                                {totalFiltrosActivos > 0 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setBusqueda('')
                                            setFiltroFacultad('Todas')
                                            setFiltroPrograma('Todos')
                                            setFiltroEstado('Todos')
                                        }}
                                        className="text-xs font-semibold text-red-500 hover:text-red-700 hover:underline ml-2"
                                    >
                                        Limpiar filtros
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-blue-600 transition-colors">
                                <span>{mostrarFiltros ? 'Ocultar filtros' : 'Extender y mostrar filtros'}</span>
                                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${mostrarFiltros ? 'rotate-180 text-blue-600' : ''}`} />
                            </div>
                        </div>

                        {/* Contenido de Filtros */}
                        {mostrarFiltros && (
                            <div className="p-4 border-t border-gray-100 bg-white">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    {/* Buscador */}
                                    <div className="relative">
                                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <input
                                            type="text"
                                            placeholder="Buscar docente, correo..."
                                            value={busqueda}
                                            onChange={e => setBusqueda(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                                        />
                                    </div>

                                    {/* Filtro Facultad */}
                                    <div>
                                        <select
                                            value={filtroFacultad}
                                            onChange={e => handleFacultadChange(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                                        >
                                            <option value="Todas">Todas las Facultades</option>
                                            {facultades.map((f: any) => (
                                                <option key={f.id_facultad || f.nombre_facultad} value={f.nombre_facultad}>
                                                    {f.nombre_facultad}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Filtro Programa */}
                                    <div>
                                        <select
                                            value={filtroPrograma}
                                            onChange={e => setFiltroPrograma(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                                        >
                                            <option value="Todos">Todos los Programas</option>
                                            {programasDisponibles.map((p: any) => (
                                                <option key={p.id_programa || p.nombre_programa} value={p.nombre_programa}>
                                                    {p.nombre_programa}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Filtro Estado + Limpiar */}
                                    <div className="flex gap-2">
                                        <select
                                            value={filtroEstado}
                                            onChange={e => setFiltroEstado(e.target.value as any)}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                                        >
                                            <option value="Todos">Todos los Estados</option>
                                            <option value="Activos">Solo Activos</option>
                                            <option value="Inactivos">Solo Inactivos</option>
                                        </select>

                                        {totalFiltrosActivos > 0 && (
                                            <button
                                                onClick={() => {
                                                    setBusqueda('')
                                                    setFiltroFacultad('Todas')
                                                    setFiltroPrograma('Todos')
                                                    setFiltroEstado('Todos')
                                                }}
                                                className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-red-50 border border-gray-200 rounded-lg transition-colors whitespace-nowrap"
                                                title="Restablecer filtros"
                                            >
                                                Limpiar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Tabla de docentes ── */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        {cargando ? (
                            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                                Cargando docentes del período...
                            </div>
                        ) : docentesFiltrados.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                <svg className="w-10 h-10 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <p className="text-sm font-medium text-gray-600">No se encontraron docentes con los criterios seleccionados</p>
                                <p className="text-xs text-gray-400 mt-1 max-w-md text-center">
                                    Intenta cambiando los filtros de facultad, programa, estado o el término de búsqueda.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto overflow-y-auto max-h-[460px]">
                                <table className="w-full text-sm min-w-[850px] relative">
                                    <thead className="sticky top-0 z-10 bg-gray-50 shadow-xs border-b border-gray-200">
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 bg-gray-50">Nombres</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 bg-gray-50">Apellidos</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 bg-gray-50">Correo</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 bg-gray-50">Facultad</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 bg-gray-50">Programa</th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 bg-gray-50">Contrato / Horas</th>
                                            <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 bg-gray-50 w-28">Estado</th>
                                            <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 bg-gray-50 w-20">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {docentesPaginados.map((d) => (
                                            <tr key={d.id_usuario} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-gray-800">{d.nombres}</td>
                                                <td className="px-4 py-3 text-gray-700">{d.apellidos}</td>
                                                <td className="px-4 py-3 text-gray-500 text-xs">{d.correo}</td>
                                                <td className="px-4 py-3 text-xs text-gray-600">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                        {d.facultad || 'Sin facultad'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-600">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                        {d.programa || 'Sin programa'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-600">
                                                    {d.tipo_contrato ? (
                                                        <span>{d.tipo_contrato} · <strong className="text-gray-900">{d.horas_contrato ?? 0}h</strong></span>
                                                    ) : (
                                                        <span className="text-gray-400 italic">No asignado</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                            d.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
                                                        }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${d.activo ? 'bg-green-500' : 'bg-red-400'}`}></span>
                                                            {d.activo ? 'Activo' : 'Inactivo'}
                                                        </span>
                                                        <button
                                                            onClick={() => handleToggle(d.id_usuario)}
                                                            disabled={editandoId === d.id_usuario}
                                                            title={d.activo ? 'Desactivar docente' : 'Activar docente'}
                                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${d.activo ? 'bg-green-500' : 'bg-gray-300'} disabled:opacity-50`}
                                                        >
                                                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${d.activo ? 'translate-x-4' : 'translate-x-1'}`} />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button 
                                                            onClick={() => handleOpenEditModal(d)}
                                                            title="Editar Usuario"
                                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                        </button>
                                                        <button 
                                                            onClick={() => handleOpenDeleteModal(d)}
                                                            title="Eliminar de Raíz"
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {!cargando && docentesFiltrados.length > 0 && (
                            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
                                {/* Selector de registros por página e info */}
                                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-500 font-medium">Mostrar</span>
                                        <select
                                            value={registrosPorPagina}
                                            onChange={(e) => {
                                                setRegistrosPorPagina(Number(e.target.value))
                                                setPaginaActual(1)
                                            }}
                                            className="border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 font-medium shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                        >
                                            <option value={5}>5</option>
                                            <option value={10}>10</option>
                                            <option value={15}>15</option>
                                            <option value={20}>20</option>
                                            <option value={25}>25</option>
                                        </select>
                                        <span className="text-gray-500 font-medium">por pág.</span>
                                    </div>
                                    
                                    <div className="text-gray-500">
                                        Mostrando <span className="font-semibold text-gray-800">{totalRegistros === 0 ? 0 : indiceInicio + 1}</span> a <span className="font-semibold text-gray-800">{indiceFin}</span> de <span className="font-semibold text-gray-800">{totalRegistros}</span> docentes
                                    </div>
                                </div>

                                {/* Botones de paginación */}
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setPaginaActual(1)}
                                        disabled={paginaActual === 1}
                                        title="Primera página"
                                        className="p-1.5 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronsLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))}
                                        disabled={paginaActual === 1}
                                        title="Página anterior"
                                        className="px-2.5 py-1 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 font-medium"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Anterior</span>
                                    </button>

                                    {/* Números de página */}
                                    <div className="flex items-center gap-1 mx-1">
                                        {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                                            .filter(p => {
                                                if (totalPaginas <= 7) return true
                                                if (p === 1 || p === totalPaginas) return true
                                                return Math.abs(p - paginaActual) <= 1
                                            })
                                            .map((p, idx, arr) => {
                                                const prev = arr[idx - 1]
                                                const showEllipsis = prev && p - prev > 1

                                                return (
                                                    <div key={p} className="flex items-center">
                                                        {showEllipsis && (
                                                            <span className="px-1 text-gray-400 select-none">...</span>
                                                        )}
                                                        <button
                                                            onClick={() => setPaginaActual(p)}
                                                            className={`w-7 h-7 rounded-md font-semibold text-xs transition-colors ${
                                                                paginaActual === p
                                                                    ? 'bg-blue-600 text-white shadow-xs'
                                                                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                                                            }`}
                                                        >
                                                            {p}
                                                        </button>
                                                    </div>
                                                )
                                            })}
                                    </div>

                                    <button
                                        onClick={() => setPaginaActual(prev => Math.min(prev + 1, totalPaginas))}
                                        disabled={paginaActual === totalPaginas}
                                        title="Página siguiente"
                                        className="px-2.5 py-1 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 font-medium"
                                    >
                                        <span className="hidden sm:inline">Siguiente</span>
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => setPaginaActual(totalPaginas)}
                                        disabled={paginaActual === totalPaginas}
                                        title="Última página"
                                        className="p-1.5 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronsRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <PanelAgendasTiempoReal
                    puedeCrear={permisosAgendas.puedeCrear}
                    puedeEditar={permisosAgendas.puedeEditar}
                    puedeEliminar={permisosAgendas.puedeEliminar}
                />
            )}



            {/* ══════════ MODAL IMPORTAR EXCEL ══════════ */}
            {modalImportar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-[#1a2744] px-6 py-4 flex items-center justify-between">
                            <h3 className="text-white font-medium">Importar desde Excel</h3>
                            <button onClick={() => setModalImportar(false)} className="text-white/50 hover:text-white transition-colors">✕</button>
                        </div>
                        <div className="px-6 py-5 space-y-4 text-center">
                            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 hover:border-blue-500 transition-colors cursor-pointer group" onClick={() => document.getElementById('file-import')?.click()}>
                                <svg className="w-12 h-12 text-gray-300 group-hover:text-blue-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <p className="text-sm font-medium text-gray-600">{archivoImportar ? archivoImportar.name : 'Selecciona un archivo .xlsx'}</p>
                                <input type="file" id="file-import" className="hidden" accept=".xlsx" onChange={e => setArchivoImportar(e.target.files ? e.target.files[0] : null)} />
                            </div>
                            <button onClick={handleDownloadTemplate} className="text-xs text-blue-600 font-bold hover:underline">Descargar plantilla oficial ↓</button>
                            <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-4 py-3 rounded-lg text-left mt-2">
                                <p className="font-semibold mb-1">💡 Información Importante:</p>
                                <p className="text-[11px] leading-relaxed text-gray-700">
                                    El archivo debe contener las columnas: <strong>Nombres</strong>, <strong>Apellidos</strong>, <strong>Correo</strong>, <strong>Tipo Documento</strong>, <strong>Número Documento</strong>, <strong>Programa Académico</strong> y <strong>Rol</strong>. Las contraseñas se gestionan al primer ingreso/Google OAuth y el tipo de contrato se asigna automáticamente.
                                </p>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                            <button onClick={() => setModalImportar(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">Cancelar</button>
                            <button
                                onClick={handleImportSubmit}
                                disabled={importando || !archivoImportar}
                                className="px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                                {importando ? 'Importando...' : 'Comenzar Importación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════ MODAL ELIMINAR USUARIO ══════════ */}
            {modalEliminarOpen && docenteAEliminar && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex justify-center items-center p-4 animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-gray-100 flex flex-col animate-scaleUp">
                        
                        {/* Encabezado */}
                        <div className="bg-red-700 text-white px-6 py-4 flex justify-between items-center">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-white">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                ¿Eliminar Usuario?
                            </h3>
                            <button 
                                type="button"
                                onClick={() => setModalEliminarOpen(false)} 
                                className="p-1.5 bg-white/10 hover:bg-white/15 rounded-lg transition-colors text-white"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Contenido */}
                        <div className="p-6 flex flex-col gap-4 text-center">
                            <div className="p-4 bg-red-50 text-red-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </div>
                            <div>
                                <h4 className="text-base font-bold text-gray-800 mb-1">Confirmación de Eliminación Física</h4>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    ¿Está completamente seguro de eliminar a <strong className="text-gray-900 font-extrabold">{docenteAEliminar.nombres} {docenteAEliminar.apellidos}</strong>?
                                </p>
                                <p className="text-xs text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200 text-left mt-3 leading-relaxed">
                                    ⚠️ <strong>¡Atención!</strong> Esta acción es irreversible. Se eliminarán sus vinculaciones a períodos académicos, roles, y asignaciones de agendas de manera definitiva para mantener la integridad de la base de datos.
                                </p>
                            </div>
                        </div>

                        {/* Botones */}
                        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                            <button 
                                type="button"
                                onClick={() => setModalEliminarOpen(false)} 
                                className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteConfirm}
                                disabled={eliminando}
                                className="px-5 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {eliminando ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Eliminando...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        Eliminar de Raíz
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}