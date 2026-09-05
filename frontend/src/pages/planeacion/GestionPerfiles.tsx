import { useState, useEffect, useMemo } from 'react'
import Layout from '../../components/common/Layout'
import { 
    getCatalogoPermisos, 
    updateRolPermisos, 
    copiarPermisosRol
} from '../../services/permisosService'
import type { RolItem, ModuloPermisos } from '../../services/permisosService'
import { 
    Shield, 
    Check, 
    Minus, 
    Search, 
    Save, 
    RotateCcw, 
    Copy, 
    CheckSquare, 
    Square, 
    AlertCircle, 
    CheckCircle2, 
    Sparkles, 
    Lock,
    HelpCircle
} from 'lucide-react'

export default function GestionPerfiles() {
    const [roles, setRoles] = useState<RolItem[]>([])
    const [modulos, setModulos] = useState<ModuloPermisos[]>([])
    const [asignacionesServidor, setAsignacionesServidor] = useState<Record<string, number[]>>({})
    
    // Rol seleccionado en las pestañas superiores
    const [rolActivoId, setRolActivoId] = useState<number>(1)
    
    // Permisos seleccionados localmente para cada rol: { [id_rol]: Set<id_permiso> }
    const [permisosLocales, setPermisosLocales] = useState<Record<number, Set<number>>>({})
    
    // UI states
    const [cargando, setCargando] = useState<boolean>(true)
    const [guardando, setGuardando] = useState<boolean>(false)
    const [busqueda, setBusqueda] = useState<string>('')
    const [toast, setToast] = useState<{ tipo: 'exito' | 'error' | 'info'; mensaje: string } | null>(null)
    const [modalClonarOpen, setModalClonarOpen] = useState<boolean>(false)
    const [rolOrigenId, setRolOrigenId] = useState<number>(1)
    const [clonando, setClonando] = useState<boolean>(false)

    // Cargar catálogo inicial
    const cargarDatos = async () => {
        try {
            setCargando(true)
            const res = await getCatalogoPermisos()
            const { roles: rolesData, modulos: modulosData, asignaciones } = res.data

            setRoles(rolesData || [])
            setModulos(modulosData || [])
            setAsignacionesServidor(asignaciones || {})

            // Inicializar estado local de selección
            const localMap: Record<number, Set<number>> = {}
            for (const r of (rolesData || [])) {
                const arr = (asignaciones && asignaciones[r.id_rol]) || []
                localMap[r.id_rol] = new Set(arr)
            }
            setPermisosLocales(localMap)

            if (rolesData.length > 0 && !rolesData.some(r => r.id_rol === rolActivoId)) {
                setRolActivoId(rolesData[0].id_rol)
            }
        } catch (error) {
            console.error('Error al cargar catálogo de permisos:', error)
            setToast({
                tipo: 'error',
                mensaje: 'No se pudo cargar el catálogo de permisos. Intente nuevamente.'
            })
        } finally {
            setCargando(false)
        }
    }

    useEffect(() => {
        cargarDatos()
    }, [])

    // Conjunto de permisos seleccionados para el rol activo
    const permisosRolActivo = useMemo(() => {
        return permisosLocales[rolActivoId] || new Set<number>()
    }, [permisosLocales, rolActivoId])

    // Permisos en servidor para el rol activo
    const permisosServidorRolActivo = useMemo(() => {
        return new Set(asignacionesServidor[rolActivoId] || [])
    }, [asignacionesServidor, rolActivoId])

    // Detectar si hay cambios pendientes sin guardar para el rol activo
    const hayCambios = useMemo(() => {
        if (permisosRolActivo.size !== permisosServidorRolActivo.size) return true
        for (const id of permisosRolActivo) {
            if (!permisosServidorRolActivo.has(id)) return true
        }
        return false
    }, [permisosRolActivo, permisosServidorRolActivo])

    // Total de permisos posibles en el catálogo
    const todosLosIdsPermisos = useMemo(() => {
        const ids: number[] = []
        for (const mod of modulos) {
            for (const pag of mod.paginas) {
                for (const acc of Object.values(pag.acciones)) {
                    if (acc) ids.push(acc)
                }
            }
        }
        return ids
    }, [modulos])

    // Alternar permiso individual
    const togglePermiso = (idPermiso: number, accionNombre: string, pagAcciones: Record<string, number | undefined>) => {
        setPermisosLocales(prev => {
            const currentSet = new Set(prev[rolActivoId] || [])
            const tiene = currentSet.has(idPermiso)

            if (tiene) {
                // Al quitar el permiso
                currentSet.delete(idPermiso)
                // Validación UX inteligente: Si se desmarca "Ver", se desmarcan Crear, Editar, Eliminar de esa página
                if (accionNombre === 'Ver') {
                    if (pagAcciones.Crear) currentSet.delete(pagAcciones.Crear)
                    if (pagAcciones.Editar) currentSet.delete(pagAcciones.Editar)
                    if (pagAcciones.Eliminar) currentSet.delete(pagAcciones.Eliminar)
                }
            } else {
                // Al agregar el permiso
                currentSet.add(idPermiso)
                // Si activa Crear, Editar o Eliminar, se asegura de activar "Ver"
                if (accionNombre !== 'Ver' && pagAcciones.Ver) {
                    currentSet.add(pagAcciones.Ver)
                }
            }

            return {
                ...prev,
                [rolActivoId]: currentSet
            }
        })
    }

    // Alternar "Todos" para una página completa (fila)
    const toggleFilaTodos = (pagAcciones: Record<string, number | undefined>) => {
        const idsFila = Object.values(pagAcciones).filter((id): id is number => typeof id === 'number')
        const todosActivos = idsFila.every(id => permisosRolActivo.has(id))

        setPermisosLocales(prev => {
            const currentSet = new Set(prev[rolActivoId] || [])
            if (todosActivos) {
                // Desmarcar todos en esta fila
                idsFila.forEach(id => currentSet.delete(id))
            } else {
                // Marcar todos en esta fila
                idsFila.forEach(id => currentSet.add(id))
            }
            return {
                ...prev,
                [rolActivoId]: currentSet
            }
        })
    }

    // Alternar una acción completa (columna) en todo el sistema
    const toggleColumnaAccion = (accion: 'Ver' | 'Crear' | 'Editar' | 'Eliminar') => {
        const idsAccion: number[] = []
        for (const mod of modulos) {
            for (const pag of mod.paginas) {
                const id = pag.acciones[accion]
                if (id) idsAccion.push(id)
            }
        }

        const todosActivos = idsAccion.every(id => permisosRolActivo.has(id))

        setPermisosLocales(prev => {
            const currentSet = new Set(prev[rolActivoId] || [])
            if (todosActivos) {
                idsAccion.forEach(id => currentSet.delete(id))
                // Si se desmarca toda la columna "Ver", también desmarca Crear, Editar y Eliminar
                if (accion === 'Ver') {
                    for (const mod of modulos) {
                        for (const pag of mod.paginas) {
                            if (pag.acciones.Crear) currentSet.delete(pag.acciones.Crear)
                            if (pag.acciones.Editar) currentSet.delete(pag.acciones.Editar)
                            if (pag.acciones.Eliminar) currentSet.delete(pag.acciones.Eliminar)
                        }
                    }
                }
            } else {
                idsAccion.forEach(id => currentSet.add(id))
                // Si se marca Crear, Editar o Eliminar, asegurar que Ver esté marcado
                if (accion !== 'Ver') {
                    for (const mod of modulos) {
                        for (const pag of mod.paginas) {
                            if (pag.acciones.Ver) currentSet.add(pag.acciones.Ver)
                        }
                    }
                }
            }
            return {
                ...prev,
                [rolActivoId]: currentSet
            }
        })
    }

    // Alternar todos los permisos de un módulo completo
    const toggleModuloCompleto = (mod: ModuloPermisos) => {
        const idsModulo: number[] = []
        for (const pag of mod.paginas) {
            for (const id of Object.values(pag.acciones)) {
                if (typeof id === 'number') idsModulo.push(id)
            }
        }
        const todosActivos = idsModulo.every(id => permisosRolActivo.has(id))

        setPermisosLocales(prev => {
            const currentSet = new Set(prev[rolActivoId] || [])
            if (todosActivos) {
                idsModulo.forEach(id => currentSet.delete(id))
            } else {
                idsModulo.forEach(id => currentSet.add(id))
            }
            return {
                ...prev,
                [rolActivoId]: currentSet
            }
        })
    }

    // Marcar todos los permisos del catálogo
    const marcarTodos = () => {
        setPermisosLocales(prev => ({
            ...prev,
            [rolActivoId]: new Set(todosLosIdsPermisos)
        }))
    }

    // Desmarcar todos los permisos del catálogo
    const desmarcarTodos = () => {
        setPermisosLocales(prev => ({
            ...prev,
            [rolActivoId]: new Set<number>()
        }))
    }

    // Deshacer cambios no guardados
    const revertirCambios = () => {
        setPermisosLocales(prev => ({
            ...prev,
            [rolActivoId]: new Set(asignacionesServidor[rolActivoId] || [])
        }))
        setToast({
            tipo: 'info',
            mensaje: 'Cambios revertidos al estado del servidor.'
        })
        setTimeout(() => setToast(null), 3000)
    }

    // Guardar cambios en el backend
    const handleGuardar = async () => {
        try {
            setGuardando(true)
            const idsAGuardar = Array.from(permisosRolActivo)
            const res = await updateRolPermisos(rolActivoId, idsAGuardar)

            // Actualizar asignaciones en servidor
            setAsignacionesServidor(prev => ({
                ...prev,
                [rolActivoId]: idsAGuardar
            }))

            const rolActual = roles.find(r => r.id_rol === rolActivoId)?.nombre_rol || 'Rol'
            // Disparar evento para que el Sidebar y otras vistas se sincronicen de inmediato
            window.dispatchEvent(new Event('sigap_permisos_actualizados'))

            setToast({
                tipo: 'exito',
                mensaje: `Permisos de ${rolActual} guardados exitosamente (${idsAGuardar.length} asignados).`
            })
            setTimeout(() => setToast(null), 4000)
        } catch (error) {
            console.error('Error al guardar permisos:', error)
            setToast({
                tipo: 'error',
                mensaje: 'Ocurrió un error al guardar los permisos. Verifique su conexión.'
            })
        } finally {
            setGuardando(false)
        }
    }

    // Clonar permisos
    const handleConfirmarClonar = async () => {
        try {
            setClonando(true)
            await copiarPermisosRol(rolOrigenId, rolActivoId)
            await cargarDatos()
            window.dispatchEvent(new Event('sigap_permisos_actualizados'))
            setModalClonarOpen(false)
            setToast({
                tipo: 'exito',
                mensaje: 'Permisos clonados y aplicados correctamente.'
            })
            setTimeout(() => setToast(null), 4000)
        } catch (error) {
            console.error('Error al clonar permisos:', error)
            setToast({
                tipo: 'error',
                mensaje: 'Error al clonar permisos entre roles.'
            })
        } finally {
            setClonando(false)
        }
    }

    // Filtrar módulos y páginas por término de búsqueda
    const modulosFiltrados = useMemo(() => {
        if (!busqueda.trim()) return modulos
        const q = busqueda.toLowerCase().trim()

        return modulos
            .map(mod => {
                const matchModulo = mod.modulo.toLowerCase().includes(q)
                const paginasMatch = mod.paginas.filter(p => 
                    p.nombre.toLowerCase().includes(q) || 
                    p.descripcion.toLowerCase().includes(q)
                )

                if (matchModulo) {
                    return mod
                }
                if (paginasMatch.length > 0) {
                    return {
                        ...mod,
                        paginas: paginasMatch
                    }
                }
                return null
            })
            .filter((mod): mod is ModuloPermisos => mod !== null)
    }, [modulos, busqueda])

    const rolActivoObj = roles.find(r => r.id_rol === rolActivoId)

    return (
        <Layout rol="planeacion" path="/planeacion/perfiles">
            {/* ── Encabezado y Breadcrumbs (Fiel al mock) ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-[#1a2744] uppercase">
                        Gestión de Perfiles
                    </h1>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Configuración matricial de privilegios y accesos por rol institucional
                    </p>
                </div>
                <div className="text-xs text-gray-400 font-medium">
                    <span>Administración</span>
                    <span className="mx-2 text-gray-300">/</span>
                    <span className="text-[#1a2744] font-semibold">Gestión Perfiles</span>
                </div>
            </div>

            {/* ── Toast de Notificaciones ── */}
            {toast && (
                <div className={`mb-5 px-4 py-3 rounded-xl border flex items-center justify-between text-sm font-medium transition-all animate-in fade-in slide-in-from-top-2 duration-200 shadow-sm ${
                    toast.tipo === 'error'
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : toast.tipo === 'info'
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-green-50 border-green-200 text-green-700'
                }`}>
                    <div className="flex items-center gap-2">
                        {toast.tipo === 'error' ? (
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        ) : toast.tipo === 'info' ? (
                            <HelpCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        ) : (
                            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                        )}
                        <span>{toast.mensaje}</span>
                    </div>
                    <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600 font-bold ml-4">✕</button>
                </div>
            )}

            {/* ── Pestañas de Roles (Header de Pestañas idéntico al mock) ── */}
            <div className="bg-white border-b border-gray-200 rounded-t-xl overflow-x-auto shadow-sm">
                <div className="flex items-center min-w-max px-2">
                    {roles.map(r => {
                        const isActive = r.id_rol === rolActivoId
                        const totalAsignados = permisosLocales[r.id_rol]?.size || 0
                        return (
                            <button
                                key={r.id_rol}
                                onClick={() => setRolActivoId(r.id_rol)}
                                className={`relative px-6 py-4 text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                                    isActive
                                        ? 'text-blue-600 border-b-2 border-blue-600 font-bold bg-blue-50/20'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-b-2 border-transparent'
                                }`}
                            >
                                <span>{r.nombre_rol}</span>
                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                                    isActive ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-gray-100 text-gray-500'
                                }`}>
                                    {totalAsignados}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* ── Barra de Control y Acciones ── */}
            <div className="bg-white border-x border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                {/* Buscador */}
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar módulo o página..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50"
                    />
                    {busqueda && (
                        <button 
                            onClick={() => setBusqueda('')} 
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-bold"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Acciones Rápidas y Botón Guardar */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                    <button
                        onClick={marcarTodos}
                        title="Marcar todos los permisos para este perfil"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-blue-700 bg-gray-100 hover:bg-blue-50 border border-gray-200 rounded-lg transition-colors"
                    >
                        <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                        Marcar Todos
                    </button>

                    <button
                        onClick={desmarcarTodos}
                        title="Desmarcar todos los permisos para este perfil"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-red-700 bg-gray-100 hover:bg-red-50 border border-gray-200 rounded-lg transition-colors"
                    >
                        <Square className="w-3.5 h-3.5 text-red-500" />
                        Desmarcar Todos
                    </button>

                    <button
                        onClick={() => setModalClonarOpen(true)}
                        title="Copiar permisos existentes desde otro rol"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-purple-700 bg-gray-100 hover:bg-purple-50 border border-gray-200 rounded-lg transition-colors"
                    >
                        <Copy className="w-3.5 h-3.5 text-purple-600" />
                        Clonar de otro rol
                    </button>

                    {hayCambios && (
                        <button
                            onClick={revertirCambios}
                            title="Deshacer cambios no guardados"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-amber-700 bg-amber-50 border border-amber-200 rounded-lg transition-colors"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                            Deshacer
                        </button>
                    )}

                    <button
                        onClick={handleGuardar}
                        disabled={guardando || !hayCambios}
                        className={`flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg transition-all shadow-sm ${
                            hayCambios
                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 animate-pulse'
                                : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                        }`}
                    >
                        <Save className="w-4 h-4" />
                        {guardando ? 'Guardando...' : hayCambios ? 'Guardar Cambios *' : 'Al día'}
                    </button>
                </div>
            </div>

            {/* ── Tabla Matricial de Permisos (Diseño fiel al mock) ── */}
            <div className="bg-white border-x border-b border-gray-200 rounded-b-xl overflow-hidden shadow-sm mb-12">
                {cargando ? (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-400 text-sm">
                        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                        <span>Cargando matriz de permisos...</span>
                    </div>
                ) : modulosFiltrados.length === 0 ? (
                    <div className="py-20 text-center text-gray-400 text-sm">
                        No se encontraron módulos ni páginas que coincidan con "{busqueda}".
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[760px]">
                            {/* Cabecera de la tabla */}
                            <thead>
                                <tr className="bg-[#f8fafc] border-b border-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider">
                                    <th className="py-3.5 px-6 w-1/4">Módulo</th>
                                    <th className="py-3.5 px-6 w-1/3">Página</th>
                                    <th 
                                        onClick={() => toggleColumnaAccion('Ver')}
                                        title="Haga clic para conmutar toda la columna Ver"
                                        className="py-3.5 px-4 text-center cursor-pointer hover:bg-gray-100 transition-colors w-20 select-none group"
                                    >
                                        <span className="group-hover:text-blue-600">Ver</span>
                                    </th>
                                    <th 
                                        onClick={() => toggleColumnaAccion('Crear')}
                                        title="Haga clic para conmutar toda la columna Crear"
                                        className="py-3.5 px-4 text-center cursor-pointer hover:bg-gray-100 transition-colors w-20 select-none group"
                                    >
                                        <span className="group-hover:text-blue-600">Crear</span>
                                    </th>
                                    <th 
                                        onClick={() => toggleColumnaAccion('Editar')}
                                        title="Haga clic para conmutar toda la columna Editar"
                                        className="py-3.5 px-4 text-center cursor-pointer hover:bg-gray-100 transition-colors w-20 select-none group"
                                    >
                                        <span className="group-hover:text-blue-600">Editar</span>
                                    </th>
                                    <th 
                                        onClick={() => toggleColumnaAccion('Eliminar')}
                                        title="Haga clic para conmutar toda la columna Eliminar"
                                        className="py-3.5 px-4 text-center cursor-pointer hover:bg-gray-100 transition-colors w-20 select-none group"
                                    >
                                        <span className="group-hover:text-blue-600">Eliminar</span>
                                    </th>
                                    <th className="py-3.5 px-6 text-center w-24">Todos</th>
                                </tr>
                            </thead>

                            {/* Cuerpo de la tabla */}
                            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                                {modulosFiltrados.map((mod) => {
                                    return mod.paginas.map((pag, pagIdx) => {
                                        const idsFila = Object.values(pag.acciones).filter((id): id is number => typeof id === 'number')
                                        const activosFilaCount = idsFila.filter(id => permisosRolActivo.has(id)).length
                                        const todosActivos = idsFila.length > 0 && activosFilaCount === idsFila.length
                                        const algunoActivo = activosFilaCount > 0 && !todosActivos

                                        const idsModulo = mod.paginas.flatMap(p => Object.values(p.acciones).filter((id): id is number => typeof id === 'number'))
                                        const todosModuloActivos = idsModulo.length > 0 && idsModulo.every(id => permisosRolActivo.has(id))

                                        return (
                                            <tr 
                                                key={`${mod.modulo}-${pag.nombre}`}
                                                className="hover:bg-blue-50/30 transition-colors group"
                                            >
                                                {/* Celda de Módulo (se muestra con estilo distintivo o agrupado) */}
                                                <td className="py-3 px-6 font-bold text-gray-800 align-middle">
                                                    {pagIdx === 0 ? (
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                                                                <span className="font-extrabold text-[#1a2744] text-xs">
                                                                    {mod.modulo}
                                                                </span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleModuloCompleto(mod)}
                                                                title={todosModuloActivos ? `Desmarcar todo el módulo ${mod.modulo}` : `Marcar todo el módulo ${mod.modulo}`}
                                                                className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer bg-blue-50/50 hover:bg-blue-100 px-1.5 py-0.5 rounded transition-colors"
                                                            >
                                                                {todosModuloActivos ? 'Desmarcar' : 'Marcar'}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300 pl-4 text-[11px] select-none font-medium">
                                                            ↳ {mod.modulo}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Celda de Página */}
                                                <td className="py-3 px-6 text-gray-700 font-medium align-middle">
                                                    <div>
                                                        <span className="text-gray-800 font-semibold">{pag.nombre}</span>
                                                        {pag.descripcion && (
                                                            <p className="text-[11px] text-gray-400 font-normal mt-0.5 line-clamp-1">
                                                                {pag.descripcion}
                                                            </p>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Checkbox: Ver */}
                                                <td className="py-3 px-4 text-center align-middle">
                                                    {pag.acciones.Ver ? (
                                                        <label className="inline-flex items-center justify-center cursor-pointer p-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={permisosRolActivo.has(pag.acciones.Ver)}
                                                                onChange={() => togglePermiso(pag.acciones.Ver!, 'Ver', pag.acciones)}
                                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                                                            />
                                                        </label>
                                                    ) : (
                                                        <span className="text-gray-300 font-mono">-</span>
                                                    )}
                                                </td>

                                                {/* Checkbox: Crear */}
                                                <td className="py-3 px-4 text-center align-middle">
                                                    {pag.acciones.Crear ? (
                                                        <label className="inline-flex items-center justify-center cursor-pointer p-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={permisosRolActivo.has(pag.acciones.Crear)}
                                                                onChange={() => togglePermiso(pag.acciones.Crear!, 'Crear', pag.acciones)}
                                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                                                            />
                                                        </label>
                                                    ) : (
                                                        <span className="text-gray-300 font-mono">-</span>
                                                    )}
                                                </td>

                                                {/* Checkbox: Editar */}
                                                <td className="py-3 px-4 text-center align-middle">
                                                    {pag.acciones.Editar ? (
                                                        <label className="inline-flex items-center justify-center cursor-pointer p-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={permisosRolActivo.has(pag.acciones.Editar)}
                                                                onChange={() => togglePermiso(pag.acciones.Editar!, 'Editar', pag.acciones)}
                                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                                                            />
                                                        </label>
                                                    ) : (
                                                        <span className="text-gray-300 font-mono">-</span>
                                                    )}
                                                </td>

                                                {/* Checkbox: Eliminar */}
                                                <td className="py-3 px-4 text-center align-middle">
                                                    {pag.acciones.Eliminar ? (
                                                        <label className="inline-flex items-center justify-center cursor-pointer p-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={permisosRolActivo.has(pag.acciones.Eliminar)}
                                                                onChange={() => togglePermiso(pag.acciones.Eliminar!, 'Eliminar', pag.acciones)}
                                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                                                            />
                                                        </label>
                                                    ) : (
                                                        <span className="text-gray-300 font-mono">-</span>
                                                    )}
                                                </td>

                                                {/* Checkbox: Todos (Columna azul distintiva idéntica a la imagen) */}
                                                <td className="py-3 px-6 text-center align-middle">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleFilaTodos(pag.acciones)}
                                                        title={todosActivos ? 'Desmarcar todas las acciones de esta página' : 'Marcar todas las acciones'}
                                                        className={`w-5 h-5 rounded flex items-center justify-center mx-auto transition-all ${
                                                            todosActivos
                                                                ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                                                                : algunoActivo
                                                                    ? 'bg-blue-100 text-blue-700 border border-blue-400 hover:bg-blue-200'
                                                                    : 'border border-gray-300 bg-white hover:border-blue-400'
                                                        }`}
                                                    >
                                                        {todosActivos ? (
                                                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                        ) : algunoActivo ? (
                                                            <Minus className="w-3 h-3 stroke-[3]" />
                                                        ) : null}
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Modal para Clonar Permisos de otro Rol ── */}
            {modalClonarOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-100">
                        <div className="bg-[#1a2744] px-6 py-4 flex items-center justify-between text-white">
                            <div className="flex items-center gap-2">
                                <Copy className="w-5 h-5 text-blue-400" />
                                <h3 className="font-bold text-sm">Clonar Permisos de otro Rol</h3>
                            </div>
                            <button 
                                onClick={() => setModalClonarOpen(false)}
                                className="text-white/60 hover:text-white transition-colors text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-xs text-gray-600">
                                Copiará todos los privilegios asignados al rol seleccionado y los aplicará al rol destino actual: 
                                <span className="font-bold text-[#1a2744] ml-1">
                                    "{rolActivoObj?.nombre_rol}"
                                </span>.
                            </p>

                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                                    Seleccione el Rol de Origen
                                </label>
                                <select
                                    value={rolOrigenId}
                                    onChange={(e) => setRolOrigenId(Number(e.target.value))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                                >
                                    {roles.filter(r => r.id_rol !== rolActivoId).map(r => (
                                        <option key={r.id_rol} value={r.id_rol}>
                                            {r.nombre_rol} ({permisosLocales[r.id_rol]?.size || 0} permisos activos)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                <span>Esta acción sobrescribirá los permisos actuales de {rolActivoObj?.nombre_rol}.</span>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setModalClonarOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmarClonar}
                                    disabled={clonando}
                                    className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                                >
                                    {clonando ? 'Clonando...' : 'Copiar y Aplicar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
