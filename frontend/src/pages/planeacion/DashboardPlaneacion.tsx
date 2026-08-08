import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/common/Layout'
import * as XLSX from 'xlsx'
import api from '../../services/api'
// @ts-ignore
import { getUsuarios, createUsuario, toggleActivo, createBulkUsuarios, updateUsuario, deleteUsuario } from '../../services/usuariosService'
import { getPeriodos } from '../../services/periodosService'
import { Library, GraduationCap } from 'lucide-react'

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
    correo: string
    tipo_documento?: string
    numero_documento?: string
    activo: boolean
    tipo_contrato: string
    programa: string
    facultad?: string
    roles: string
}

interface AgendaStat {
    id_usuario: number
    nombre: string
    tipo_contrato: string
    horas_asignadas: number
    horas_contrato: number
    total_funciones: number
    funciones_aceptadas: number
    perfil_docente: string
    docencia_indirecta: number
}



export default function DashboardPlaneacion() {
    const [docentes, setDocentes] = useState<Docente[]>([])
    const [agendaStats, setAgendaStats] = useState<AgendaStat[]>([])
    const [agendaMetricas, setAgendaMetricas] = useState<any>(null)
    const [busqueda, setBusqueda] = useState('')
    const [filtroEstado, setFiltroEstado] = useState<'Todos' | 'Activos' | 'Inactivos'>('Todos')
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')
    const navigate = useNavigate()
    // New state for active period
    const [periodoActivo, setPeriodoActivo] = useState<Periodo | null>(null)
    const [modalImportar, setModalImportar] = useState(false)
    const [archivoImportar, setArchivoImportar] = useState<File | null>(null)
    const [importando, setImportando] = useState(false)
    const [editandoId, setEditandoId] = useState<number | null>(null)
    const [tabActiva, setTabActiva] = useState<'usuarios' | 'agendas'>('usuarios')

    // Modales de Edición y Eliminación
    const [modalEditarOpen, setModalEditarOpen] = useState(false)
    const [docenteAEditar, setDocenteAEditar] = useState<Docente | null>(null)
    const [modalEliminarOpen, setModalEliminarOpen] = useState(false)
    const [docenteAEliminar, setDocenteAEliminar] = useState<Docente | null>(null)

    // Formulario de Edición
    const [editNombres, setEditNombres] = useState('')
    const [editApellidos, setEditApellidos] = useState('')
    const [editTipoDocumento, setEditTipoDocumento] = useState('CC')
    const [editNumeroDocumento, setEditNumeroDocumento] = useState('')
    const [editCorreo, setEditCorreo] = useState('')
    const [editIdPrograma, setEditIdPrograma] = useState(1)
    const [editRolesSeleccionados, setEditRolesSeleccionados] = useState<string[]>(['Docente'])
    const [editError, setEditError] = useState<string | null>(null)
    const [editWarning, setEditWarning] = useState<string | null>(null)
    const [guardando, setGuardando] = useState(false)
    const [eliminando, setEliminando] = useState(false)

    const esSoloConsultorOPlaneacion = (list: string[]) => {
        if (!list || list.length === 0) return false;
        return list.every(r => {
            const low = r.toLowerCase();
            return low.includes('consult') || low.includes('planea');
        });
    }

    const toggleEditRol = (rolName: string) => {
        setEditRolesSeleccionados(prev => {
            if (prev.includes(rolName)) {
                if (prev.length === 1) return prev;
                return prev.filter(r => r !== rolName);
            } else {
                return [...prev, rolName];
            }
        });
    }

    const mapProgramaToId = (progName?: string) => {
        if (!progName) return 1;
        const name = progName.toLowerCase();
        if (name.includes('electrónica') || name.includes('electronica')) return 2;
        if (name.includes('industrial')) return 3;
        if (name.includes('financiera')) return 4;
        return 1;
    }

    const handleOpenEditModal = (d: Docente) => {
        setDocenteAEditar(d)
        setEditNombres(d.nombres)
        setEditApellidos(d.apellidos)
        setEditTipoDocumento(d.tipo_documento || 'CC')
        setEditNumeroDocumento(d.numero_documento || '')
        setEditCorreo(d.correo)
        setEditIdPrograma(mapProgramaToId(d.programa))
        const parsedRoles = (d.roles || 'Docente').split(',').map(r => r.trim()).filter(Boolean)
        setEditRolesSeleccionados(parsedRoles.length > 0 ? parsedRoles : ['Docente'])
        setEditError(null)
        setEditWarning(null)
        setModalEditarOpen(true)
    }

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setEditError(null)
        setEditWarning(null)

        if (!docenteAEditar) return

        if (!editNombres.trim() || !editApellidos.trim() || !editCorreo.trim() || !editNumeroDocumento.trim()) {
            setEditError('Por favor diligencie todos los campos obligatorios.')
            return
        }

        if (editRolesSeleccionados.length === 0) {
            setEditError('Debe seleccionar al menos un rol.')
            return
        }

        const soloConsultaOPl = esSoloConsultorOPlaneacion(editRolesSeleccionados)

        try {
            setGuardando(true)
            const res = await updateUsuario(docenteAEditar.id_usuario, {
                nombres: editNombres.trim(),
                apellidos: editApellidos.trim(),
                tipo_documento: editTipoDocumento,
                numero_documento: editNumeroDocumento.trim(),
                correo: editCorreo.trim().toLowerCase(),
                id_programa: soloConsultaOPl ? null : editIdPrograma,
                roles: editRolesSeleccionados
            })
            setModalEditarOpen(false)
            await cargarDocentes()
            if (res.data?.advertencia) {
                alert(`Usuario actualizado correctamente.\n${res.data.advertencia}`)
            } else {
                alert('Usuario actualizado correctamente')
            }
        } catch (err: any) {
            console.error('Error al editar usuario:', err)
            const errMsg = err.response?.data?.error || 'No se pudo actualizar el usuario. Verifique los datos o si la identificación/correo ya existe.'
            setEditError(errMsg)
        } finally {
            setGuardando(false)
        }
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
            alert('Usuario eliminado correctamente')
        } catch (err: any) {
            console.error('Error al eliminar usuario:', err)
            const errMsg = err.response?.data?.error || 'Ocurrió un error al eliminar el usuario.'
            alert(errMsg)
        } finally {
            setEliminando(false)
        }
    }

    const cargarDocentes = useCallback(async () => {
        try {
            setCargando(true)
            const res = await getUsuarios()
            setDocentes(res.data)
        } catch {
            setError('No se pudieron cargar los docentes')
        } finally {
            setCargando(false)
        }
    }, [])

    const cargarAgendas = useCallback(async () => {
        try {
            const res = await api.get('/director/dashboard')
            setAgendaStats(res.data.docentes || [])
            setAgendaMetricas(res.data.metricas || null)
        } catch { /* silently ignore */ }
    }, [])

    useEffect(() => {
        cargarDocentes()
        cargarAgendas()
        cargarPeriodoActivo()
        const interval = setInterval(() => {
            cargarAgendas()
            cargarPeriodoActivo()
        }, 30000)
        return () => clearInterval(interval)
    }, [cargarDocentes, cargarAgendas])

    const cargarPeriodoActivo = async () => {
        try {
            const res = await getPeriodos()
            const activo = res.data.find((p: any) => p.activo)
            setPeriodoActivo(activo || null)
        } catch (e) {
            console.error('Error loading active period', e)
        }
    }

    const docentesFiltrados = docentes.filter(d => {
        const matchBusqueda = `${d.nombres} ${d.apellidos}`.toLowerCase().includes(busqueda.toLowerCase())
        if (filtroEstado === 'Activos') return matchBusqueda && d.activo
        if (filtroEstado === 'Inactivos') return matchBusqueda && !d.activo
        return matchBusqueda
    })

    const handleToggle = async (id: number) => {
        try {
            setEditandoId(id)
            await toggleActivo(id)
            setDocentes(prev =>
                prev.map(d => d.id_usuario === id ? { ...d, activo: !d.activo } : d)
            )
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

            const payload = jsonData.map(row => {
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
            }).filter(u => u.nombres && u.apellidos && u.correo)

            if (payload.length === 0) {
                setError('El Excel no tiene datos válidos. Revisa las columnas (Nombres, Apellidos, Correo, Tipo Documento, Número Documento, Programa Académico, Rol).')
                return
            }

            const res = await createBulkUsuarios(payload)
            setModalImportar(false)
            setArchivoImportar(null)
            await cargarDocentes()
            alert(res.data.mensaje || 'Docentes importados correctamente')

        } catch (err: any) {
            setError(err.response?.data?.error || 'Falló la importación del Excel.')
        } finally {
            setImportando(false)
        }
    }

    const handleExportar = () => {
        const encabezado = [['Nombres', 'Apellidos', 'Correo', 'Tipo Documento', 'Número Documento', 'Programa Académico', 'Facultad', 'Tipo Contrato', 'Roles', 'Estado']]
        const filas = docentes.map(d => {
            const isPl = d.roles && d.roles.toLowerCase().includes('plane');
            return [
                d.nombres,
                d.apellidos,
                d.correo,
                d.tipo_documento || 'CC',
                d.numero_documento || '0000000000',
                isPl ? 'No aplica' : (d.programa || 'Sin Asignar'),
                isPl ? 'No aplica' : (d.facultad || 'Ingeniería'),
                d.tipo_contrato || 'Hora Cátedra',
                d.roles || 'Docente',
                d.activo ? 'Habilitado' : 'Bloqueado'
            ];
        });
        const ws = XLSX.utils.aoa_to_sheet([...encabezado, ...filas])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Docentes")
        XLSX.writeFile(wb, "docentes_SIGAP.xlsx")
    }

    return (
        <Layout rol="planeacion" path="Inicio / Dashboard">

            {/* ── Encabezado ── */}
            <div className="bg-[#1a2744] rounded-xl px-6 py-4 mb-5 flex items-center justify-between shadow-sm">
                <div>
                    <h2 className="text-white text-lg font-medium">Bienvenido, Planeación</h2>
                    <p className="text-white/50 text-xs mt-0.5">
                        {periodoActivo ? `Período ${periodoActivo.anio} ${periodoActivo.semestre === 1 ? 'IP' : 'IIP'}` : 'Cargando período...'} · Facultad de Ingeniería
                    </p>
                </div>
            </div>

            {/* ── Métricas (Cards) ── */}
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
                            <p className="text-xl font-black text-gray-800 tracking-tight">{periodoActivo ? `${periodoActivo.anio} ${periodoActivo.semestre === 1 ? 'IP' : 'IIP'}` : 'Cargando...'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Navegación de Tabs ── */}
            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => setTabActiva('usuarios')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${tabActiva === 'usuarios' 
                        ? 'bg-[#1a2744] text-white shadow-md' 
                        : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                >
                    Gestión de Usuarios
                </button>
                <button
                    onClick={() => setTabActiva('agendas')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${tabActiva === 'agendas' 
                        ? 'bg-[#1a2744] text-white shadow-md' 
                        : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                >
                    Agendas en Tiempo Real
                </button>
            </div>

            {tabActiva === 'usuarios' ? (
                <>
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

                    {/* ── Barra de acciones ── */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <div className="relative flex-1">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Buscar por nombre o apellido..."
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                            />
                        </div>

                        <div className="flex-shrink-0">
                            <select
                                value={filtroEstado}
                                onChange={e => setFiltroEstado(e.target.value as any)}
                                className="h-full w-full sm:w-auto px-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                            >
                                <option value="Todos">Todos los Estados</option>
                                <option value="Activos">Solo Activos</option>
                                <option value="Inactivos">Solo Inactivos</option>
                            </select>
                        </div>

                        <div className="flex flex-wrap gap-2 flex-shrink-0 w-full sm:w-auto">
                            <button
                                onClick={() => setModalImportar(true)}
                                className="flex items-center gap-2 px-4 py-2 text-sm border border-green-600 text-green-700 rounded-lg hover:bg-green-50 transition-colors font-medium"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                Importar Excel
                            </button>

                            <button
                                onClick={handleExportar}
                                className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Exportar Excel
                            </button>
                        </div>
                    </div>

                    {/* ── Tabla de docentes ── */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        {cargando ? (
                            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                                Cargando docentes...
                            </div>
                        ) : docentesFiltrados.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                <svg className="w-10 h-10 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <p className="text-sm">No se encontraron docentes</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[700px]">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-1/4">Nombres</th>
                                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-1/4">Apellidos</th>
                                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-1/3">Correo</th>
                                            <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 w-20">Estado</th>
                                            <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 w-20">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {docentesFiltrados.map((d) => (
                                            <tr key={d.id_usuario} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-gray-800">{d.nombres}</td>
                                                <td className="px-4 py-3 text-gray-700">{d.apellidos}</td>
                                                <td className="px-4 py-3 text-gray-500 text-xs">{d.correo}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => handleToggle(d.id_usuario)}
                                                        disabled={editandoId === d.id_usuario}
                                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${d.activo ? 'bg-green-500' : 'bg-gray-300'}`}
                                                    >
                                                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${d.activo ? 'translate-x-4' : 'translate-x-1'}`} />
                                                    </button>
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
                            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                                <span>Mostrando {docentesFiltrados.length} docentes</span>
                                <span>{docentes.filter(d => d.activo).length} activos</span>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-gray-800">Estado de Agendas (Tiempo Real)</h2>
                        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium animate-pulse">
                            <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                            Actualización automática
                        </div>
                    </div>

                    {agendaStats.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 italic">
                            No hay agendas registradas en el período actual.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Docente</th>
                                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Contrato</th>
                                        <th className="text-center px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Carga (Horas)</th>
                                        <th className="text-center px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Perfil Docente</th>
                                        <th className="text-center px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Docencia Indirecta</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {agendaStats.map((a) => (
                                        <tr key={a.id_usuario} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-semibold text-gray-800">{a.nombre}</td>
                                            <td className="px-4 py-3 text-gray-600">{a.tipo_contrato}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{a.horas_asignadas} / {a.horas_contrato}h</span>
                                                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full ${a.horas_asignadas === a.horas_contrato ? 'bg-green-500' : 'bg-blue-500'}`} 
                                                            style={{ width: `${Math.min((a.horas_asignadas/a.horas_contrato)*100, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold
                                                    ${a.perfil_docente.includes('INCONSISTENCIAS') 
                                                        ? 'bg-red-100 text-red-700' 
                                                        : 'bg-indigo-100 text-indigo-700'}`}
                                                >
                                                    {a.perfil_docente}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-lg font-black text-blue-600 leading-none">{a.docencia_indirecta}</span>
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Horas (30%)</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
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

            {/* ══════════ MODAL EDITAR USUARIO ══════════ */}
            {modalEditarOpen && docenteAEditar && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex justify-center items-center p-4 animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100 flex flex-col animate-scaleUp">
                        
                        {/* Encabezado */}
                        <div className="bg-[#1a2744] text-white px-6 py-4 flex justify-between items-center">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                Editar Docente / Usuario
                            </h3>
                            <button 
                                type="button"
                                onClick={() => setModalEditarOpen(false)} 
                                className="p-1.5 bg-white/10 hover:bg-white/15 rounded-lg transition-colors text-white"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Formulario */}
                        <form onSubmit={handleEditSubmit} className="p-6 flex flex-col gap-4">
                            {editError && (
                                <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg flex gap-2 items-start text-xs font-semibold">
                                    <svg className="w-4 h-4 shrink-0 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    <div>{editError}</div>
                                </div>
                            )}
                            {editWarning && (
                                <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 p-3 rounded-lg flex gap-2 items-start text-xs font-semibold">
                                    <svg className="w-4 h-4 shrink-0 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    <div>{editWarning}</div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Nombres *</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder="Ej. Juan Carlos"
                                        value={editNombres}
                                        onChange={(e) => setEditNombres(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Apellidos *</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder="Ej. Perez Gomez"
                                        value={editApellidos}
                                        onChange={(e) => setEditApellidos(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Correo Institucional *</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="ejemplo@cesmag.edu.co"
                                    value={editCorreo}
                                    onChange={(e) => setEditCorreo(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Tipo Doc.</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                        value={editTipoDocumento}
                                        onChange={(e) => setEditTipoDocumento(e.target.value)}
                                    >
                                        <option value="CC">C.C.</option>
                                        <option value="CE">C.E.</option>
                                        <option value="PA">Pasaporte</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Número Documento *</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        placeholder="Número de identificación"
                                        value={editNumeroDocumento}
                                        onChange={(e) => setEditNumeroDocumento(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Multiselección de Roles (Checklist) */}
                            <div>
                                <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">
                                    Roles de Acceso (Selecciona uno o varios) *
                                </label>
                                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    {['Docente', 'Director', 'Consultor', 'Planeación'].map((rItem) => {
                                        const isChecked = editRolesSeleccionados.includes(rItem);
                                        return (
                                            <label
                                                key={rItem}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-semibold cursor-pointer transition-all ${
                                                    isChecked
                                                        ? 'bg-blue-50 border-blue-400 text-blue-800'
                                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleEditRol(rItem)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                                />
                                                <span>{rItem}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Facultad y Programa Académico Dinámicos */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Facultad</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={esSoloConsultorOPlaneacion(editRolesSeleccionados) ? 'No aplica' : 'Facultad de Ingeniería'}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-400 font-semibold cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">
                                        Programa Académico {esSoloConsultorOPlaneacion(editRolesSeleccionados) ? '' : '*'}
                                    </label>
                                    <select
                                        disabled={esSoloConsultorOPlaneacion(editRolesSeleccionados)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-gray-700 font-semibold disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                                        value={esSoloConsultorOPlaneacion(editRolesSeleccionados) ? '' : editIdPrograma}
                                        onChange={(e) => setEditIdPrograma(Number(e.target.value))}
                                    >
                                        {esSoloConsultorOPlaneacion(editRolesSeleccionados) ? (
                                            <option value="">Deshabilitado (Sin asignación académica)</option>
                                        ) : (
                                            <>
                                                <option value={1}>Ingeniería de Sistemas</option>
                                                <option value={2}>Ingeniería Electrónica</option>
                                                <option value={3}>Ingeniería Industrial</option>
                                                <option value={4}>Ingeniería Financiera</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>

                            {/* Botones */}
                            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setModalEditarOpen(false)}
                                    className="bg-gray-100 hover:bg-gray-150 text-gray-700 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={guardando}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md transition-colors"
                                >
                                    {guardando ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            Guardar Cambios
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
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