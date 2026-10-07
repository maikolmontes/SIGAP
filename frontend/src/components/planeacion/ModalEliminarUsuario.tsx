import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, Trash2, UserX, X } from 'lucide-react'
import { getVinculosUsuario, deleteUsuario } from '../../services/usuariosService'

interface Vinculo {
    tabla: string
    columna: string
    cantidad: number
    descripcion: string
}

interface Analisis {
    puedeEliminar: boolean
    motivos: string[]
    bloqueantes: Vinculo[]
    deAlta: Vinculo[]
}

// Forma de los errores que devuelve el servidor (axios)
interface ErrorApi {
    response?: { data?: { error?: string; motivos?: string[]; bloqueantes?: Vinculo[] } }
}
const datosDeError = (e: unknown) => (e as ErrorApi).response?.data

interface Props {
    usuario: { id_usuario: number; nombres: string; apellidos: string; correo: string; activo?: boolean }
    onCerrar: () => void
    /** Se llama cuando el usuario ya fue eliminado (para refrescar la tabla). */
    onEliminado: (nombre: string) => void
    /** Alternativa cuando no se puede eliminar: quitarle el acceso sin perder el historial. */
    onDesactivar: (id: number, nombre: string) => Promise<void>
}

/**
 * Eliminar un usuario solo es posible si no tiene datos relacionados. La ventana
 * primero consulta al servidor qué depende del usuario y explica el resultado; el
 * servidor vuelve a comprobarlo al borrar, así que esto es información, no seguridad.
 */
export default function ModalEliminarUsuario({ usuario, onCerrar, onEliminado, onDesactivar }: Props) {
    const [analisis, setAnalisis] = useState<Analisis | null>(null)
    const [cargando, setCargando] = useState(true)
    const [eliminando, setEliminando] = useState(false)
    const [desactivando, setDesactivando] = useState(false)
    const [error, setError] = useState('')

    const nombre = `${usuario.nombres} ${usuario.apellidos}`.trim()

    useEffect(() => {
        let vigente = true
        setCargando(true)
        getVinculosUsuario(usuario.id_usuario)
            .then((res: { data: Analisis }) => { if (vigente) setAnalisis(res.data) })
            .catch((e: unknown) => { if (vigente) setError(datosDeError(e)?.error || 'No se pudieron revisar los datos relacionados.') })
            .finally(() => { if (vigente) setCargando(false) })
        return () => { vigente = false }
    }, [usuario.id_usuario])

    useEffect(() => {
        const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape' && !eliminando) onCerrar() }
        window.addEventListener('keydown', alTeclear)
        return () => window.removeEventListener('keydown', alTeclear)
    }, [onCerrar, eliminando])

    const eliminar = async () => {
        setEliminando(true)
        setError('')
        try {
            await deleteUsuario(usuario.id_usuario)
            onEliminado(nombre)
        } catch (e: unknown) {
            const datos = datosDeError(e)
            setError(datos?.error || 'No se pudo eliminar el usuario.')
            // El servidor encontró datos que la revisión previa no vio (alguien los agregó justo ahora)
            if (datos?.bloqueantes || datos?.motivos) {
                setAnalisis({ puedeEliminar: false, motivos: datos.motivos || [], bloqueantes: datos.bloqueantes || [], deAlta: [] })
            }
        } finally {
            setEliminando(false)
        }
    }

    const desactivar = async () => {
        setDesactivando(true)
        try {
            await onDesactivar(usuario.id_usuario, nombre)
            onCerrar()
        } finally {
            setDesactivando(false)
        }
    }

    const bloqueado = analisis && !analisis.puedeEliminar
    const soloProteccion = bloqueado && analisis.bloqueantes.length === 0

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => !eliminando && onCerrar()}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="titulo-eliminar-usuario"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Encabezado */}
                <div className={`px-6 py-4 flex items-start justify-between gap-3 ${bloqueado ? 'bg-amber-500' : 'bg-red-600'}`}>
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="bg-white/20 rounded-lg p-2 shrink-0">
                            {bloqueado ? <ShieldAlert className="w-5 h-5 text-white" /> : <Trash2 className="w-5 h-5 text-white" />}
                        </div>
                        <div className="min-w-0">
                            <h3 id="titulo-eliminar-usuario" className="text-white font-bold">
                                {bloqueado ? 'No se puede eliminar' : 'Eliminar usuario'}
                            </h3>
                            <p className="text-white/90 text-sm truncate">{nombre}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onCerrar} disabled={eliminando} aria-label="Cerrar" className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 shrink-0">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Contenido */}
                <div className="px-6 py-5 space-y-4 text-sm text-gray-700">
                    {cargando && (
                        <div className="flex items-center gap-3 text-gray-500 py-4" role="status">
                            <Loader2 className="w-5 h-5 animate-spin" /> Revisando si el usuario tiene datos relacionados…
                        </div>
                    )}

                    {!cargando && analisis && analisis.puedeEliminar && (
                        <>
                            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                <p>Este usuario <strong>no tiene datos relacionados</strong> (agendas, observaciones ni revisiones), por lo que se puede eliminar.</p>
                            </div>
                            {analisis.deAlta.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Se eliminará junto con el usuario</p>
                                    <ul className="text-xs text-gray-600 list-disc pl-5 space-y-0.5">
                                        {analisis.deAlta.map(v => (
                                            <li key={`${v.tabla}.${v.columna}`}>{etiquetaAlta(v)}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <p className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-100 rounded-lg p-3 text-xs font-medium">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                Esta acción es definitiva y no se puede deshacer. Se registrará en la auditoría del sistema.
                            </p>
                        </>
                    )}

                    {!cargando && bloqueado && (
                        <>
                            {analisis.motivos.length > 0 && (
                                <ul className="space-y-1.5">
                                    {analisis.motivos.map(m => (
                                        <li key={m} className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3 text-amber-800">
                                            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" /> {m}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {analisis.bloqueantes.length > 0 && (
                                <>
                                    <p>Tiene datos relacionados que se perderían o quedarían sin dueño:</p>
                                    <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                                        {analisis.bloqueantes.map(v => (
                                            <li key={`${v.tabla}.${v.columna}`} className="flex items-center justify-between gap-3 px-3 py-2">
                                                <span>{v.descripcion}</span>
                                                <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5 tabular-nums shrink-0">{v.cantidad}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                            {!soloProteccion && usuario.activo !== false && (
                                <p className="text-xs text-gray-500">
                                    Para quitarle el acceso sin perder el historial, <strong>desactívelo</strong>: no podrá iniciar sesión, pero sus datos se conservan.
                                </p>
                            )}
                        </>
                    )}

                    {error && !cargando && (
                        <p role="alert" className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-100 rounded-lg p-3 text-xs">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                        </p>
                    )}
                </div>

                {/* Acciones */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap justify-end gap-3">
                    <button type="button" onClick={onCerrar} disabled={eliminando || desactivando} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
                        {bloqueado ? 'Cerrar' : 'Cancelar'}
                    </button>
                    {bloqueado && !soloProteccion && usuario.activo !== false && (
                        <button type="button" onClick={desactivar} disabled={desactivando} className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 rounded-lg inline-flex items-center gap-2">
                            <UserX className="w-4 h-4" /> {desactivando ? 'Desactivando…' : 'Desactivar usuario'}
                        </button>
                    )}
                    {!cargando && analisis?.puedeEliminar && (
                        <button type="button" onClick={eliminar} disabled={eliminando} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg inline-flex items-center gap-2">
                            <Trash2 className="w-4 h-4" /> {eliminando ? 'Eliminando…' : 'Eliminar definitivamente'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

function etiquetaAlta(v: Vinculo) {
    switch (v.tabla) {
        case 'usuario_rol': return `${v.cantidad} rol(es) asignado(s)`
        case 'docente_periodo': return `Vinculación a ${v.cantidad} período(s) académico(s)`
        case 'usuario_nivel': return `${v.cantidad} nivel(es) académico(s) del perfil`
        case 'director_programa': return `Gestión de ${v.cantidad} programa(s) como director`
        default: return `${v.descripcion} (${v.cantidad})`
    }
}
