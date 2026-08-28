import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Layout from '../../components/common/Layout'
import { 
    GraduationCap, 
    Library, 
    Plus, 
    Edit, 
    Trash2, 
    AlertCircle, 
    CheckCircle2, 
    X,
    Search,
    Filter,
    Info
} from 'lucide-react'
import { 
    getProgramas, 
    createPrograma, 
    updatePrograma, 
    toggleActivoPrograma, 
    deletePrograma 
} from '../../services/programasService'
import { getFacultades } from '../../services/facultadesService'

interface Facultad {
    id_facultad: number
    nombre_facultad: string
    activa: boolean
}

interface Programa {
    id_programa: number
    id_facultad: number
    nombre_programa: string
    activo: boolean
    creado_en: string
    facultad?: string
}

export default function Programas() {
    const [programas, setProgramas] = useState<Programa[]>([])
    const [facultades, setFacultades] = useState<Facultad[]>([])
    const [cargando, setCargando] = useState<boolean>(true)
    const [error, setError] = useState<string>('')
    const [success, setSuccess] = useState<string>('')

    // Filtros
    const [busqueda, setBusqueda] = useState<string>('')
    const [facultadFiltro, setFacultadFiltro] = useState<string>('Todas')

    // Modales
    const [modalCrearOpen, setModalCrearOpen] = useState<boolean>(false)
    const [modalEditarOpen, setModalEditarOpen] = useState<boolean>(false)
    const [modalEliminarOpen, setModalEliminarOpen] = useState<boolean>(false)

    // Datos de Formularios
    const [programaAEditar, setProgramaAEditar] = useState<Programa | null>(null)
    const [programaAEliminar, setProgramaAEliminar] = useState<Programa | null>(null)
    const [nombrePrograma, setNombrePrograma] = useState<string>('')
    const [idFacultadSeleccionada, setIdFacultadSeleccionada] = useState<number>(0)
    const [activo, setActivo] = useState<boolean>(true)

    // Estado de procesamiento
    const [procesando, setProcesando] = useState<boolean>(false)

    const cargarDatos = async () => {
        setCargando(true)
        try {
            const [resProg, resFac] = await Promise.all([
                getProgramas(),
                getFacultades()
            ])
            setProgramas(resProg.data)
            
            // Cargar solo facultades activas para los formularios de creación/edición, pero conservar todas
            setFacultades(resFac.data)
            setError('')
        } catch (err: any) {
            console.error('Error al cargar datos:', err)
            setError('Error de conexión con el servidor. Revisa tu backend.')
        } finally {
            setCargando(false)
        }
    }

    useEffect(() => {
        cargarDatos()
    }, [])

    const location = useLocation()

    useEffect(() => {
        if (location.state?.openAddModal && facultades.length > 0) {
            limpiarFormulario()
            setModalCrearOpen(true)
            window.history.replaceState({}, document.title)
        }
    }, [location.state, facultades])

    // Notificaciones automáticas que desaparecen
    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(''), 4000)
            return () => clearTimeout(timer)
        }
    }, [success])

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(''), 5000)
            return () => clearTimeout(timer)
        }
    }, [error])

    // Crear Programa
    const handleCrearPrograma = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!nombrePrograma.trim()) {
            setError('El nombre del programa académico es requerido')
            return
        }
        if (!idFacultadSeleccionada || idFacultadSeleccionada === 0) {
            setError('Debes asociar el programa a una facultad')
            return
        }

        setProcesando(true)
        try {
            await createPrograma({
                nombre_programa: nombrePrograma,
                id_facultad: idFacultadSeleccionada,
                activo: activo
            })
            setSuccess('¡Programa académico agregado correctamente!')
            setModalCrearOpen(false)
            limpiarFormulario()
            cargarDatos()
        } catch (err: any) {
            console.error(err)
            setError(err.response?.data?.error || 'Error al crear el programa académico')
        } finally {
            setProcesando(false)
        }
    }

    // Preparar edición
    const abrirEditarModal = (p: Programa) => {
        setProgramaAEditar(p)
        setNombrePrograma(p.nombre_programa)
        setIdFacultadSeleccionada(p.id_facultad)
        setActivo(p.activo)
        setModalEditarOpen(true)
    }

    // Editar Programa
    const handleEditarPrograma = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!programaAEditar) return
        if (!nombrePrograma.trim()) {
            setError('El nombre del programa es requerido')
            return
        }
        if (!idFacultadSeleccionada || idFacultadSeleccionada === 0) {
            setError('Debes asociar el programa a una facultad')
            return
        }

        setProcesando(true)
        try {
            await updatePrograma(programaAEditar.id_programa, {
                nombre_programa: nombrePrograma,
                id_facultad: idFacultadSeleccionada,
                activo: activo
            })
            setSuccess('¡Programa académico actualizado correctamente!')
            setModalEditarOpen(false)
            limpiarFormulario()
            cargarDatos()
        } catch (err: any) {
            console.error(err)
            setError(err.response?.data?.error || 'Error al actualizar el programa académico')
        } finally {
            setProcesando(false)
        }
    }

    // Toggle de estado
    const handleToggleEstado = async (id: number, nombreProg: string) => {
        try {
            // Optimistic UI update
            setProgramas(prev => prev.map(p => p.id_programa === id ? { ...p, activo: !p.activo } : p))
            
            await toggleActivoPrograma(id)
            setSuccess(`Estado del programa "${nombreProg}" modificado correctamente`)
        } catch (err: any) {
            console.error(err)
            // Rollback on error
            setProgramas(prev => prev.map(p => p.id_programa === id ? { ...p, activo: !p.activo } : p))
            setError(err.response?.data?.error || 'Error al modificar el estado del programa')
        }
    }

    // Preparar eliminación
    const abrirEliminarModal = (p: Programa) => {
        setProgramaAEliminar(p)
        setModalEliminarOpen(true)
    }

    // Eliminar Programa
    const handleEliminarPrograma = async () => {
        if (!programaAEliminar) return
        setProcesando(true)
        try {
            await deletePrograma(programaAEliminar.id_programa)
            setSuccess('¡Programa académico eliminado correctamente!')
            setModalEliminarOpen(false)
            setProgramaAEliminar(null)
            cargarDatos()
        } catch (err: any) {
            console.error(err)
            setError(err.response?.data?.error || 'No se pudo eliminar el programa académico')
            setModalEliminarOpen(false)
        } finally {
            setProcesando(false)
        }
    }

    const limpiarFormulario = () => {
        setNombrePrograma('')
        // Buscar la primera facultad activa por defecto si existe
        const activaFac = facultades.find(f => f.activa)
        setIdFacultadSeleccionada(activaFac ? activaFac.id_facultad : 0)
        setActivo(true)
        setProgramaAEditar(null)
    }

    // Filtrar Programas dinámicamente en la vista
    const programasFiltrados = programas.filter(p => {
        const matchesBusqueda = p.nombre_programa.toLowerCase().includes(busqueda.toLowerCase())
        const matchesFacultad = facultadFiltro === 'Todas' || p.facultad === facultadFiltro
        return matchesBusqueda && matchesFacultad
    })

    return (
        <Layout rol="planeacion" path="/planeacion/programas">
            <div className="space-y-6 max-w-7xl mx-auto pb-10">
                {/* Alertas */}
                {success && (
                    <div className="fixed bottom-5 right-5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 animate-bounce">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <span className="text-sm font-medium">{success}</span>
                    </div>
                )}

                {error && (
                    <div className="fixed bottom-5 right-5 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 animate-pulse">
                        <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )}

                {/* Encabezado */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div>
                        <h1 className="text-xl font-bold text-[#063759] flex items-center gap-2">
                            <GraduationCap className="w-6 h-6 text-[#00a896]" />
                            Gestión de Programas Académicos
                        </h1>
                        <p className="text-gray-500 text-xs mt-1">
                            Administra los programas académicos vinculados a cada facultad de UNICESMAG.
                        </p>
                    </div>
                    <button
                        onClick={() => { limpiarFormulario(); setModalCrearOpen(true); }}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-[#00a896] hover:bg-[#029081] text-white rounded-xl shadow-sm text-sm font-medium transition-all transform hover:scale-[1.02]"
                    >
                        <Plus className="w-4 h-4" />
                        Agregar Programa
                    </button>
                </div>

                {/* Filtros e interacciones */}
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                    {/* Búsqueda */}
                    <div className="w-full md:w-96 relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <Search className="w-4 h-4" />
                        </span>
                        <input
                            type="text"
                            placeholder="Buscar programa académico..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#00a896] transition-colors bg-gray-50/50 focus:bg-white"
                        />
                    </div>

                    {/* Selector de Facultades */}
                    <div className="w-full md:w-72 flex items-center gap-2">
                        <span className="text-gray-400 flex-shrink-0">
                            <Filter className="w-4 h-4" />
                        </span>
                        <select
                            value={facultadFiltro}
                            onChange={(e) => setFacultadFiltro(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#00a896] transition-colors bg-gray-50/50 font-medium text-gray-700 cursor-pointer"
                        >
                            <option value="Todas">Filtrar por Facultad (Todas)</option>
                            {facultades.map(f => (
                                <option key={f.id_facultad} value={f.nombre_facultad}>
                                    {f.nombre_facultad}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Tabla de Programas */}
                {cargando ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00a896]"></div>
                        <p className="text-gray-400 text-sm mt-3 font-medium">Cargando programas académicos...</p>
                    </div>
                ) : programasFiltrados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm text-center px-4">
                        <GraduationCap className="w-16 h-16 text-gray-200" />
                        <h3 className="text-lg font-bold text-gray-700 mt-4">No se encontraron programas</h3>
                        <p className="text-gray-400 text-sm mt-1 max-w-md">
                            Intenta modificando tu término de búsqueda o seleccionando una facultad diferente.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                                        <th className="px-6 py-4">Programa Académico</th>
                                        <th className="px-6 py-4">Facultad</th>
                                        <th className="px-6 py-4 text-center">Estado</th>
                                        <th className="px-6 py-4 text-center">Activo</th>
                                        <th className="px-6 py-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                                    {programasFiltrados.map((p) => (
                                        <tr key={p.id_programa} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 font-semibold text-[#063759]">
                                                {p.nombre_programa}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-medium text-gray-500">
                                                {p.facultad || 'Sin facultad asignada'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider ${
                                                    p.activo 
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                                        : 'bg-gray-100 text-gray-400 border border-gray-200'
                                                }`}>
                                                    {p.activo ? 'ACTIVO' : 'INACTIVO'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center">
                                                    <button
                                                        onClick={() => handleToggleEstado(p.id_programa, p.nombre_programa)}
                                                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                            p.activo ? 'bg-[#00a896]' : 'bg-gray-300'
                                                        }`}
                                                        title={p.activo ? 'Inactivar programa' : 'Activar programa'}
                                                    >
                                                        <span
                                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                                p.activo ? 'translate-x-5' : 'translate-x-0'
                                                            }`}
                                                        />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => abrirEditarModal(p)}
                                                        className="p-1.5 hover:bg-sky-50 text-[#063759] hover:text-sky-600 rounded-lg transition-colors"
                                                        title="Editar Programa"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => abrirEliminarModal(p)}
                                                        className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded-lg transition-colors"
                                                        title="Eliminar Programa"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL: CREAR PROGRAMA */}
            {modalCrearOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden transform transition-all">
                        {/* Cabecera Modal */}
                        <div className="px-6 py-4 border-b border-gray-100 bg-[#063759] text-white flex justify-between items-center">
                            <h2 className="font-bold text-base flex items-center gap-2">
                                <GraduationCap className="w-5 h-5 text-[#00a896]" />
                                Agregar Programa Académico
                            </h2>
                            <button
                                onClick={() => setModalCrearOpen(false)}
                                className="text-white/70 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Formulario */}
                        <form onSubmit={handleCrearPrograma}>
                            <div className="p-6 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                        Nombre del Programa Académico *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: Ingeniería de Sistemas"
                                        value={nombrePrograma}
                                        onChange={(e) => setNombrePrograma(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#00a896] transition-colors bg-gray-50 focus:bg-white"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                        Facultad Asociada *
                                    </label>
                                    <select
                                        value={idFacultadSeleccionada}
                                        onChange={(e) => setIdFacultadSeleccionada(Number(e.target.value))}
                                        required
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#00a896] transition-colors bg-gray-50 focus:bg-white font-medium text-gray-700 cursor-pointer"
                                    >
                                        <option value={0}>Selecciona una facultad...</option>
                                        {facultades.filter(f => f.activa).map(f => (
                                            <option key={f.id_facultad} value={f.id_facultad}>
                                                {f.nombre_facultad}
                                            </option>
                                        ))}
                                    </select>
                                    {facultades.filter(f => f.activa).length === 0 && (
                                        <p className="text-[10px] text-rose-500 font-semibold mt-1">
                                            ¡Advertencia! No existen facultades activas en el sistema. Debes crear una facultad activa primero.
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <div className="space-y-0.5">
                                        <div className="text-sm font-semibold text-gray-700">Estado Inicial</div>
                                        <div className="text-xs text-gray-500">Define si el programa estará activo para docentes.</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setActivo(!activo)}
                                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                            activo ? 'bg-[#00a896]' : 'bg-gray-300'
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                activo ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* Botones de acción */}
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setModalCrearOpen(false)}
                                    className="px-4 py-2 border border-gray-200 text-gray-500 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={procesando}
                                    className="px-4 py-2 bg-[#00a896] hover:bg-[#029081] text-white rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {procesando ? 'Guardando...' : 'Guardar Programa'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: EDITAR PROGRAMA */}
            {modalEditarOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden transform transition-all">
                        {/* Cabecera Modal */}
                        <div className="px-6 py-4 border-b border-gray-100 bg-[#063759] text-white flex justify-between items-center">
                            <h2 className="font-bold text-base flex items-center gap-2">
                                <Edit className="w-5 h-5 text-[#00a896]" />
                                Editar Programa Académico
                            </h2>
                            <button
                                onClick={() => setModalEditarOpen(false)}
                                className="text-white/70 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Formulario */}
                        <form onSubmit={handleEditarPrograma}>
                            <div className="p-6 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                        Nombre del Programa Académico *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: Ingeniería de Sistemas"
                                        value={nombrePrograma}
                                        onChange={(e) => setNombrePrograma(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#00a896] transition-colors bg-gray-50 focus:bg-white"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                        Facultad Asociada *
                                    </label>
                                    <select
                                        value={idFacultadSeleccionada}
                                        onChange={(e) => setIdFacultadSeleccionada(Number(e.target.value))}
                                        required
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#00a896] transition-colors bg-gray-50 focus:bg-white font-medium text-gray-700 cursor-pointer"
                                    >
                                        <option value={0}>Selecciona una facultad...</option>
                                        {/* Mostramos todas las facultades en edición, pero permitimos activas principalmente */}
                                        {facultades.map(f => (
                                            <option key={f.id_facultad} value={f.id_facultad} disabled={!f.activa && f.id_facultad !== programaAEditar?.id_facultad}>
                                                {f.nombre_facultad} {!f.activa && '(Inactiva)'}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <div className="space-y-0.5">
                                        <div className="text-sm font-semibold text-gray-700">Estado del Programa</div>
                                        <div className="text-xs text-gray-500">Define si estará activo.</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setActivo(!activo)}
                                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                            activo ? 'bg-[#00a896]' : 'bg-gray-300'
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                activo ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* Botones de acción */}
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setModalEditarOpen(false)}
                                    className="px-4 py-2 border border-gray-200 text-gray-500 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={procesando}
                                    className="px-4 py-2 bg-[#00a896] hover:bg-[#029081] text-white rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {procesando ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: CONFIRMACIÓN ELIMINAR */}
            {modalEliminarOpen && programaAEliminar && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden transform transition-all">
                        {/* Cabecera */}
                        <div className="p-5 border-b border-gray-100 flex items-center gap-3 bg-rose-50 text-rose-800">
                            <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0" />
                            <div>
                                <h3 className="font-bold text-sm">¿Confirmar eliminación del programa?</h3>
                                <p className="text-[11px] text-rose-700/80 mt-0.5">Esta acción es irreversible y permanente.</p>
                            </div>
                        </div>

                        {/* Cuerpo */}
                        <div className="p-5 space-y-3">
                            <p className="text-gray-600 text-xs leading-relaxed">
                                Estás a punto de eliminar de raíz el programa académico <strong className="text-gray-900 font-bold">"{programaAEliminar.nombre_programa}"</strong>.
                            </p>
                            
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-start gap-2.5">
                                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div className="text-[11px] text-amber-800 leading-relaxed">
                                    <strong>Nota de seguridad:</strong> Si este programa académico cuenta con docentes, directores, o agendas asociadas, el backend detendrá el borrado preventivamente para asegurar la integridad de la base de datos.
                                </div>
                            </div>
                        </div>

                        {/* Pie */}
                        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setModalEliminarOpen(false)}
                                className="px-4 py-2 border border-gray-200 text-gray-500 rounded-xl text-xs font-semibold hover:bg-gray-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleEliminarPrograma}
                                disabled={procesando}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-colors disabled:opacity-50"
                            >
                                {procesando ? 'Eliminando...' : 'Sí, Eliminar de Raíz'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
