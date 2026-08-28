import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Layout from '../../components/common/Layout'
import { 
    Library, 
    GraduationCap, 
    Plus, 
    Edit, 
    Trash2, 
    AlertCircle, 
    CheckCircle2, 
    X,
    Info
} from 'lucide-react'
import { 
    getFacultades, 
    createFacultad, 
    updateFacultad, 
    toggleActivaFacultad, 
    deleteFacultad 
} from '../../services/facultadesService'
import { getProgramas } from '../../services/programasService'

interface Facultad {
    id_facultad: number
    nombre_facultad: string
    detalle_facultad: string | null
    activa: boolean
    creado_en: string
    total_programas?: number
}

export default function Facultades() {
    const [facultades, setFacultades] = useState<Facultad[]>([])
    const [totalProgramas, setTotalProgramas] = useState<number>(0)
    const [cargando, setCargando] = useState<boolean>(true)
    const [error, setError] = useState<string>('')
    const [success, setSuccess] = useState<string>('')

    // Modales
    const [modalCrearOpen, setModalCrearOpen] = useState<boolean>(false)
    const [modalEditarOpen, setModalEditarOpen] = useState<boolean>(false)
    const [modalEliminarOpen, setModalEliminarOpen] = useState<boolean>(false)

    // Datos de Formularios
    const [facultadAEditar, setFacultadAEditar] = useState<Facultad | null>(null)
    const [facultadAEliminar, setFacultadAEliminar] = useState<Facultad | null>(null)
    const [nombre, setNombre] = useState<string>('')
    const [detalle, setDetalle] = useState<string>('')
    const [activa, setActiva] = useState<boolean>(true)
    
    // Subiendo/Guardando estado
    const [procesando, setProcesando] = useState<boolean>(false)

    const cargarDatos = async () => {
        setCargando(true)
        try {
            const [resFac, resProg] = await Promise.all([
                getFacultades(),
                getProgramas()
            ])
            setFacultades(resFac.data)
            
            // Calcular total programas
            setTotalProgramas(resProg.data.length)
            setError('')
        } catch (err: any) {
            console.error('Error al cargar datos de facultades:', err)
            setError('No se pudo establecer conexión con el servidor. Revisa tu red.')
        } finally {
            setCargando(false)
        }
    }

    useEffect(() => {
        cargarDatos()
    }, [])

    const location = useLocation()

    useEffect(() => {
        if (location.state?.openAddModal) {
            limpiarFormulario()
            setModalCrearOpen(true)
            window.history.replaceState({}, document.title)
        }
    }, [location.state])

    // Mostrar notificaciones automáticas que desaparecen
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

    // Crear Facultad
    const handleCrearFacultad = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!nombre.trim()) {
            setError('El nombre de la facultad es requerido')
            return
        }

        setProcesando(true)
        try {
            await createFacultad({
                nombre_facultad: nombre,
                detalle_facultad: detalle,
                activa: activa
            })
            setSuccess('¡Facultad agregada correctamente!')
            setModalCrearOpen(false)
            limpiarFormulario()
            cargarDatos()
        } catch (err: any) {
            console.error(err)
            setError(err.response?.data?.error || 'Error al crear la facultad')
        } finally {
            setProcesando(false)
        }
    }

    // Preparar edición
    const abrirEditarModal = (f: Facultad) => {
        setFacultadAEditar(f)
        setNombre(f.nombre_facultad)
        setDetalle(f.detalle_facultad || '')
        setActiva(f.activa)
        setModalEditarOpen(true)
    }

    // Editar Facultad
    const handleEditarFacultad = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!facultadAEditar) return
        if (!nombre.trim()) {
            setError('El nombre de la facultad es requerido')
            return
        }

        setProcesando(true)
        try {
            await updateFacultad(facultadAEditar.id_facultad, {
                nombre_facultad: nombre,
                detalle_facultad: detalle,
                activa: activa
            })
            setSuccess('¡Facultad actualizada correctamente!')
            setModalEditarOpen(false)
            limpiarFormulario()
            cargarDatos()
        } catch (err: any) {
            console.error(err)
            setError(err.response?.data?.error || 'Error al actualizar la facultad')
        } finally {
            setProcesando(false)
        }
    }

    // Toggle de estado
    const handleToggleEstado = async (id: number, nombreFac: string) => {
        try {
            // Optimistic UI update
            setFacultades(prev => prev.map(f => f.id_facultad === id ? { ...f, activa: !f.activa } : f))
            
            await toggleActivaFacultad(id)
            setSuccess(`Estado de la facultad "${nombreFac}" modificado correctamente`)
        } catch (err: any) {
            console.error(err)
            // Rollback on error
            setFacultades(prev => prev.map(f => f.id_facultad === id ? { ...f, activa: !f.activa } : f))
            setError(err.response?.data?.error || 'Error al modificar el estado de la facultad')
        }
    }

    // Preparar eliminación
    const abrirEliminarModal = (f: Facultad) => {
        setFacultadAEliminar(f)
        setModalEliminarOpen(true)
    }

    // Eliminar Facultad
    const handleEliminarFacultad = async () => {
        if (!facultadAEliminar) return
        setProcesando(true)
        try {
            await deleteFacultad(facultadAEliminar.id_facultad)
            setSuccess('¡Facultad eliminada correctamente!')
            setModalEliminarOpen(false)
            setFacultadAEliminar(null)
            cargarDatos()
        } catch (err: any) {
            console.error(err)
            setError(err.response?.data?.error || 'No se pudo eliminar la facultad')
            setModalEliminarOpen(false)
        } finally {
            setProcesando(false)
        }
    }

    const limpiarFormulario = () => {
        setNombre('')
        setDetalle('')
        setActiva(true)
        setFacultadAEditar(null)
    }

    return (
        <Layout rol="planeacion" path="/planeacion/facultades">
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
                            <Library className="w-6 h-6 text-[#00a896]" />
                            Gestión de Facultades
                        </h1>
                        <p className="text-gray-500 text-xs mt-1">
                            Administra las facultades institucionales del ecosistema UNICESMAG.
                        </p>
                    </div>
                    <button
                        onClick={() => { limpiarFormulario(); setModalCrearOpen(true); }}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-[#00a896] hover:bg-[#029081] text-white rounded-xl shadow-sm text-sm font-medium transition-all transform hover:scale-[1.02]"
                    >
                        <Plus className="w-4 h-4" />
                        Agregar Facultad
                    </button>
                </div>

                {/* Estadísticas Superiores */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/80 backdrop-blur-md p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-sky-50 rounded-xl flex items-center justify-center text-sky-600">
                            <Library className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Total Facultades</div>
                            <div className="text-2xl font-bold text-[#063759] mt-0.5">{facultades.length}</div>
                        </div>
                    </div>

                    <div className="bg-white/80 backdrop-blur-md p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                            <GraduationCap className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Total Programas</div>
                            <div className="text-2xl font-bold text-[#063759] mt-0.5">{totalProgramas}</div>
                        </div>
                    </div>
                </div>

                {/* Grid de Tarjetas */}
                {cargando ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00a896]"></div>
                        <p className="text-gray-400 text-sm mt-3 font-medium">Cargando facultades...</p>
                    </div>
                ) : facultades.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm text-center px-4">
                        <Library className="w-16 h-16 text-gray-200" />
                        <h3 className="text-lg font-bold text-gray-700 mt-4">No hay facultades registradas</h3>
                        <p className="text-gray-400 text-sm mt-1 max-w-md">
                            Comienza agregando tu primera facultad institucional haciendo clic en el botón superior derecho.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {facultades.map((f) => (
                            <div 
                                key={f.id_facultad} 
                                className={`bg-white rounded-xl border transition-all duration-300 shadow-sm overflow-hidden flex flex-col justify-between group hover:shadow-md ${
                                    f.activa ? 'border-gray-100' : 'border-gray-200 bg-gray-50/50'
                                }`}
                            >
                                <div className="p-5 space-y-4">
                                    {/* Encabezado Tarjeta */}
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="space-y-1">
                                            <h3 className="font-bold text-[#063759] text-base group-hover:text-[#00a896] transition-colors line-clamp-1">
                                                {f.nombre_facultad}
                                            </h3>
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                                <GraduationCap className="w-3.5 h-3.5" />
                                                <span>{f.total_programas} {f.total_programas === 1 ? 'programa' : 'programas'}</span>
                                            </div>
                                        </div>
                                        
                                        {/* Switch/Toggle de Estado */}
                                        <button
                                            onClick={() => handleToggleEstado(f.id_facultad, f.nombre_facultad)}
                                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                f.activa ? 'bg-[#00a896]' : 'bg-gray-300'
                                            }`}
                                            title={f.activa ? 'Inactivar Facultad' : 'Activar Facultad'}
                                        >
                                            <span
                                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                    f.activa ? 'translate-x-5' : 'translate-x-0'
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Descripción */}
                                    <p className="text-gray-500 text-xs line-clamp-2 leading-relaxed min-h-[2rem]">
                                        {f.detalle_facultad || 'Sin descripción o detalle registrado.'}
                                    </p>
                                </div>

                                {/* Acciones en el pie */}
                                <div className="px-5 py-3.5 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider ${
                                        f.activa 
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                                    }`}>
                                        {f.activa ? 'ACTIVA' : 'INACTIVA'}
                                    </span>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => abrirEditarModal(f)}
                                            className="p-1.5 hover:bg-sky-50 text-[#063759] hover:text-sky-600 rounded-lg transition-colors"
                                            title="Editar Facultad"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => abrirEliminarModal(f)}
                                            className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded-lg transition-colors"
                                            title="Eliminar Facultad"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* MODAL: CREAR FACULTAD */}
            {modalCrearOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden transform transition-all">
                        {/* Cabecera Modal */}
                        <div className="px-6 py-4 border-b border-gray-100 bg-[#063759] text-white flex justify-between items-center">
                            <h2 className="font-bold text-base flex items-center gap-2">
                                <Library className="w-5 h-5 text-[#00a896]" />
                                Agregar Nueva Facultad
                            </h2>
                            <button
                                onClick={() => setModalCrearOpen(false)}
                                className="text-white/70 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Formulario */}
                        <form onSubmit={handleCrearFacultad}>
                            <div className="p-6 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                        Nombre de la Facultad *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: Facultad de Ingeniería"
                                        value={nombre}
                                        onChange={(e) => setNombre(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#00a896] transition-colors bg-gray-50 focus:bg-white"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                        Descripción o Detalle
                                    </label>
                                    <textarea
                                        rows={3}
                                        placeholder="Escribe brevemente el enfoque de esta facultad..."
                                        value={detalle}
                                        onChange={(e) => setDetalle(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#00a896] transition-colors bg-gray-50 focus:bg-white resize-none"
                                    />
                                </div>

                                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <div className="space-y-0.5">
                                        <div className="text-sm font-semibold text-gray-700">Estado Inicial</div>
                                        <div className="text-xs text-gray-500">Define si estará disponible inmediatamente para programas.</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setActiva(!activa)}
                                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                            activa ? 'bg-[#00a896]' : 'bg-gray-300'
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                activa ? 'translate-x-5' : 'translate-x-0'
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
                                    {procesando ? 'Guardando...' : 'Guardar Facultad'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: EDITAR FACULTAD */}
            {modalEditarOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden transform transition-all">
                        {/* Cabecera Modal */}
                        <div className="px-6 py-4 border-b border-gray-100 bg-[#063759] text-white flex justify-between items-center">
                            <h2 className="font-bold text-base flex items-center gap-2">
                                <Edit className="w-5 h-5 text-[#00a896]" />
                                Editar Facultad
                            </h2>
                            <button
                                onClick={() => setModalEditarOpen(false)}
                                className="text-white/70 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Formulario */}
                        <form onSubmit={handleEditarFacultad}>
                            <div className="p-6 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                        Nombre de la Facultad *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: Facultad de Ingeniería"
                                        value={nombre}
                                        onChange={(e) => setNombre(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#00a896] transition-colors bg-gray-50 focus:bg-white"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                        Descripción o Detalle
                                    </label>
                                    <textarea
                                        rows={3}
                                        placeholder="Escribe brevemente el enfoque de esta facultad..."
                                        value={detalle}
                                        onChange={(e) => setDetalle(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#00a896] transition-colors bg-gray-50 focus:bg-white resize-none"
                                    />
                                </div>

                                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <div className="space-y-0.5">
                                        <div className="text-sm font-semibold text-gray-700">Estado de la Facultad</div>
                                        <div className="text-xs text-gray-500">Define si estará disponible.</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setActiva(!activa)}
                                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                            activa ? 'bg-[#00a896]' : 'bg-gray-300'
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                activa ? 'translate-x-5' : 'translate-x-0'
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
            {modalEliminarOpen && facultadAEliminar && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden transform transition-all">
                        {/* Cabecera */}
                        <div className="p-5 border-b border-gray-100 flex items-center gap-3 bg-rose-50 text-rose-800">
                            <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0" />
                            <div>
                                <h3 className="font-bold text-sm">¿Confirmar eliminación de facultad?</h3>
                                <p className="text-[11px] text-rose-700/80 mt-0.5">Esta acción es irreversible y permanente.</p>
                            </div>
                        </div>

                        {/* Cuerpo */}
                        <div className="p-5 space-y-3">
                            <p className="text-gray-600 text-xs leading-relaxed">
                                Estás a punto de eliminar de raíz la facultad <strong className="text-gray-900 font-bold">"{facultadAEliminar.nombre_facultad}"</strong>.
                            </p>
                            
                            {facultadAEliminar.total_programas && facultadAEliminar.total_programas > 0 ? (
                                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-start gap-2.5">
                                    <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-[11px] text-amber-800 leading-relaxed">
                                        <strong>Advertencia importante:</strong> Esta facultad cuenta con <strong>{facultadAEliminar.total_programas} programas académicos</strong> vinculados. La base de datos denegará la solicitud para proteger la integridad de los datos.
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-500 text-[11px] bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                    Esta facultad no tiene programas asociados registrados actualmente, por lo que su borrado es totalmente seguro.
                                </p>
                            )}
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
                                onClick={handleEliminarFacultad}
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
