import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    AlertCircle, Bell, BookOpen, CalendarDays, CheckCheck, CheckCircle2, ClipboardCheck, Clock, Loader2, MessageSquare, Sparkles, Trash2, X,
} from 'lucide-react'
import type { ComponentType } from 'react'
import {
    eliminarNotificacion, eliminarNotificaciones, getContadorNotificaciones, getMisNotificaciones,
    marcarNotificacionLeida, marcarTodasLasNotificacionesLeidas,
} from '../../services/notificacionesAppService'
import type { NotificacionApp } from '../../services/notificacionesAppService'

// Cada tipo de aviso tiene su ícono y color (son los mismos avisos que llegan por correo)
const ESTILO_POR_TIPO: Record<string, { icono: ComponentType<{ className?: string }>; color: string }> = {
    agenda_enviada: { icono: ClipboardCheck, color: 'bg-indigo-50 text-indigo-600' },
    agenda_aprobada: { icono: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
    agenda_devuelta: { icono: AlertCircle, color: 'bg-orange-50 text-orange-600' },
    bienvenida: { icono: Sparkles, color: 'bg-purple-50 text-purple-600' },
    apertura_periodo: { icono: CalendarDays, color: 'bg-blue-50 text-blue-600' },
    asignaciones_cargadas: { icono: BookOpen, color: 'bg-teal-50 text-teal-600' },
    recordatorio_plazo: { icono: Clock, color: 'bg-amber-50 text-amber-600' },
    observacion_director: { icono: MessageSquare, color: 'bg-sky-50 text-sky-600' },
}
const ESTILO_POR_DEFECTO = { icono: Bell, color: 'bg-gray-100 text-gray-600' }

const INTERVALO_CONTADOR_MS = 60_000

/** "Ahora", "hace 5 min", "hace 3 h", "hace 2 días" o la fecha si es más antigua. */
const hace = (fecha: string): string => {
    const t = new Date(fecha).getTime()
    if (Number.isNaN(t)) return ''
    const min = Math.floor((Date.now() - t) / 60_000)
    if (min < 1) return 'Ahora'
    if (min < 60) return `hace ${min} min`
    const h = Math.floor(min / 60)
    if (h < 24) return `hace ${h} h`
    const d = Math.floor(h / 24)
    if (d < 8) return `hace ${d} ${d === 1 ? 'día' : 'días'}`
    return new Date(fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export default function CampanaNotificaciones() {
    const navigate = useNavigate()
    const [abierta, setAbierta] = useState(false)
    const [noLeidas, setNoLeidas] = useState(0)
    const [items, setItems] = useState<NotificacionApp[]>([])
    const [cargando, setCargando] = useState(false)
    const [error, setError] = useState(false)
    const [confirmandoVaciar, setConfirmandoVaciar] = useState(false)

    // El número de la campana se refresca cada minuto y al volver a la pestaña
    useEffect(() => {
        let vigente = true
        const consultar = () => {
            if (document.hidden) return
            getContadorNotificaciones()
                .then(res => { if (vigente) setNoLeidas(res.data.no_leidas) })
                .catch(() => { /* sin conexión: se conserva el último número */ })
        }
        consultar()
        const reloj = setInterval(consultar, INTERVALO_CONTADOR_MS)
        document.addEventListener('visibilitychange', consultar)
        return () => {
            vigente = false
            clearInterval(reloj)
            document.removeEventListener('visibilitychange', consultar)
        }
    }, [])

    const cargarLista = useCallback(() => {
        setCargando(true)
        setError(false)
        getMisNotificaciones(20)
            .then(res => { setItems(res.data.notificaciones); setNoLeidas(res.data.no_leidas) })
            .catch(() => setError(true))
            .finally(() => setCargando(false))
    }, [])

    const alternar = () => {
        if (!abierta) cargarLista()
        setConfirmandoVaciar(false)
        setAbierta(v => !v)
    }

    useEffect(() => {
        if (!abierta) return
        const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierta(false) }
        window.addEventListener('keydown', alTeclear)
        return () => window.removeEventListener('keydown', alTeclear)
    }, [abierta])

    const abrirNotificacion = (n: NotificacionApp) => {
        if (!n.leida) {
            setItems(prev => prev.map(x => (x.id === n.id ? { ...x, leida: true } : x)))
            setNoLeidas(prev => Math.max(0, prev - 1))
            marcarNotificacionLeida(n.id).catch(() => { /* se reintenta al volver a abrir la campana */ })
        }
        setAbierta(false)
        if (n.enlace) navigate(n.enlace)
    }

    // Borrar una: desaparece al instante; si el servidor falla, se vuelve a cargar la lista
    const borrarUna = (n: NotificacionApp) => {
        setItems(prev => prev.filter(x => x.id !== n.id))
        if (!n.leida) setNoLeidas(prev => Math.max(0, prev - 1))
        eliminarNotificacion(n.id).catch(() => cargarLista())
    }

    // Vaciar: todas, o solo las ya leídas
    const vaciar = (soloLeidas: boolean) => {
        setConfirmandoVaciar(false)
        if (soloLeidas) {
            setItems(prev => prev.filter(x => !x.leida))
        } else {
            setItems([])
            setNoLeidas(0)
        }
        eliminarNotificaciones(soloLeidas).catch(() => cargarLista())
    }

    const marcarTodas = () => {
        setItems(prev => prev.map(x => ({ ...x, leida: true })))
        setNoLeidas(0)
        marcarTodasLasNotificacionesLeidas().catch(() => cargarLista())
    }

    return (
        <div className="relative">
            <button
                type="button"
                onClick={alternar}
                aria-label={noLeidas > 0 ? `Notificaciones: ${noLeidas} sin leer` : 'Notificaciones'}
                aria-haspopup="dialog"
                aria-expanded={abierta}
                className="relative p-1.5 sm:p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
                <Bell className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
                {noLeidas > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center ring-2 ring-white">
                        {noLeidas > 9 ? '9+' : noLeidas}
                    </span>
                )}
            </button>

            {abierta && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setAbierta(false)} />
                    <div
                        role="dialog"
                        aria-label="Notificaciones"
                        className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-[0_8px_30px_-6px_rgba(0,0,0,0.18)] border border-gray-100 z-50 overflow-hidden"
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                            <h3 className="text-sm font-bold text-gray-800">
                                Notificaciones {noLeidas > 0 && <span className="text-xs font-semibold text-red-500">({noLeidas} sin leer)</span>}
                            </h3>
                            {noLeidas > 0 && (
                                <button
                                    type="button"
                                    onClick={marcarTodas}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                                >
                                    <CheckCheck className="w-3.5 h-3.5" /> Marcar todas como leídas
                                </button>
                            )}
                        </div>

                        {items.length > 0 && (
                            <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-100 text-[11px]">
                                {confirmandoVaciar ? (
                                    <>
                                        <span className="font-semibold text-gray-700">¿Borrar todas?</span>
                                        <span className="flex items-center gap-3">
                                            <button type="button" onClick={() => vaciar(false)} className="font-bold text-red-600 hover:text-red-800">Sí, borrar</button>
                                            <button type="button" onClick={() => setConfirmandoVaciar(false)} className="font-semibold text-gray-500 hover:text-gray-700">Cancelar</button>
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => vaciar(true)}
                                            disabled={!items.some(x => x.leida)}
                                            className="font-semibold text-gray-500 hover:text-gray-800 disabled:opacity-40 disabled:hover:text-gray-500"
                                        >
                                            Borrar las leídas
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setConfirmandoVaciar(true)}
                                            className="inline-flex items-center gap-1 font-semibold text-red-500 hover:text-red-700"
                                        >
                                            <Trash2 className="w-3 h-3" /> Borrar todas
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        <div className="max-h-[26rem] overflow-y-auto">
                            {cargando && items.length === 0 && (
                                <p className="flex items-center justify-center gap-2 py-10 text-xs text-gray-500" role="status">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
                                </p>
                            )}
                            {error && items.length === 0 && (
                                <p role="alert" className="py-10 px-4 text-center text-xs text-red-600">No se pudieron cargar las notificaciones.</p>
                            )}
                            {!cargando && !error && items.length === 0 && (
                                <div className="py-10 px-4 text-center text-gray-400">
                                    <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                    <p className="text-sm font-medium text-gray-500">Estás al día</p>
                                    <p className="text-xs mt-0.5">Aquí aparecerán tus avisos, los mismos que llegan a tu correo.</p>
                                </div>
                            )}
                            <ul className="divide-y divide-gray-50">
                                {items.map(n => {
                                    const { icono: Icono, color } = ESTILO_POR_TIPO[n.tipo] || ESTILO_POR_DEFECTO
                                    return (
                                        <li key={n.id} className="relative group">
                                            <button
                                                type="button"
                                                onClick={() => abrirNotificacion(n)}
                                                className={`w-full flex items-start gap-3 pl-4 pr-10 py-3 text-left hover:bg-gray-50 transition-colors ${n.leida ? '' : 'bg-blue-50/40'}`}
                                            >
                                                <span className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${color}`}>
                                                    <Icono className="w-4 h-4" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-start justify-between gap-2">
                                                        <span className={`text-[13px] leading-snug ${n.leida ? 'font-medium text-gray-700' : 'font-bold text-gray-900'}`}>{n.titulo}</span>
                                                        {!n.leida && <span className="mt-1 w-2 h-2 rounded-full bg-blue-500 shrink-0" aria-label="Sin leer" />}
                                                    </span>
                                                    {n.mensaje && <span className="block text-xs text-gray-500 mt-0.5 line-clamp-2">{n.mensaje}</span>}
                                                    <span className="block text-[11px] text-gray-400 mt-1">{hace(n.creado_en)}</span>
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => borrarUna(n)}
                                                aria-label={`Borrar la notificación: ${n.titulo}`}
                                                title="Borrar"
                                                className="absolute top-2 right-2 p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 focus:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 transition"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
