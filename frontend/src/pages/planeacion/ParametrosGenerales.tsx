import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import Layout from '../../components/common/Layout'
import { usePermisosPagina } from '../../hooks/usePermisos'
import {
    AlertCircle, BookOpen, CheckCircle2, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Eye, EyeOff, Info,
    ListTree, Loader2, Lock, Pencil, Plus, Search, Target, Trash2, X,
} from 'lucide-react'
import {
    getArbolCatalogo, crearFuncionCatalogo, crearActividadCatalogo, crearDescripcionCatalogo,
    crearIndicadorCatalogo, editarFuncionCatalogo, editarActividadCatalogo, editarDescripcionCatalogo,
    editarIndicadorCatalogo, cambiarVisibilidadCatalogo, eliminarElementoCatalogo, getAsignaturasCargadas,
} from '../../services/parametrosService'
import type {
    FuncionCatalogo, ActividadCatalogo, DescripcionCatalogo, IndicadorCatalogo, TipoElemento, AsignaturaCatalogo,
} from '../../services/parametrosService'

// Qué formulario está abierto y sobre qué elemento
type Formulario =
    | { tipo: 'funcion-nueva' }
    | { tipo: 'actividad-nueva'; funcion: FuncionCatalogo }
    | { tipo: 'descripcion-nueva'; actividad: ActividadCatalogo; usaMeta: boolean; usaIndicador: boolean }
    | { tipo: 'indicador-nuevo'; descripcion: DescripcionCatalogo }
    | { tipo: 'funcion-editar'; funcion: FuncionCatalogo }
    | { tipo: 'actividad-editar'; actividad: ActividadCatalogo }
    | { tipo: 'descripcion-editar'; descripcion: DescripcionCatalogo; usaMeta: boolean }
    | { tipo: 'indicador-editar'; indicador: IndicadorCatalogo }

interface Valores {
    nombre: string
    actividad: string
    descripcion: string
    meta: string
    indicador: string
}
const VALORES_VACIOS: Valores = { nombre: '', actividad: '', descripcion: '', meta: '1', indicador: '' }

interface ElementoAEliminar {
    tipo: TipoElemento
    id: number
    nombre: string
    contenido: string
}

interface CambioVisibilidad {
    tipo: TipoElemento
    id: number
    nombre: string
    en_uso: number
}

const indicadorBorrable = (i: IndicadorCatalogo) => i.en_uso === 0
const descripcionBorrable = (d: DescripcionCatalogo) => d.en_uso === 0 && d.indicadores.every(indicadorBorrable)
const actividadBorrable = (a: ActividadCatalogo) => !a.protegida && a.en_uso === 0 && a.descripciones.every(descripcionBorrable)
const funcionBorrable = (f: FuncionCatalogo) => !f.protegida && f.en_uso === 0 && f.actividades.every(actividadBorrable)

const mensajeDeError = (e: unknown, porDefecto: string) =>
    (e as { response?: { data?: { error?: string } } }).response?.data?.error || porDefecto

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

function Insignia({ children, tono }: { children: ReactNode; tono: 'gris' | 'ambar' | 'azul' | 'verde' }) {
    const estilos = {
        gris: 'bg-gray-100 text-gray-600 border-gray-200',
        ambar: 'bg-amber-50 text-amber-700 border-amber-200',
        azul: 'bg-blue-50 text-blue-700 border-blue-100',
        verde: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    }[tono]
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${estilos}`}>{children}</span>
}

type Alineacion = 'centro' | 'izquierda' | 'derecha'

// Tooltip propio: aparece al pasar el mouse o al enfocar con el teclado, sin la espera del título nativo
function ConAyuda({ ayuda, alinear = 'centro', ancho = false, children }: {
    ayuda: string
    alinear?: Alineacion
    ancho?: boolean
    children: (idAyuda: string) => ReactNode
}) {
    const id = useId()
    const posicion = { centro: 'left-1/2 -translate-x-1/2', izquierda: 'left-0', derecha: 'right-0' }[alinear]
    return (
        <span className={`relative group ${ancho ? 'flex w-full' : 'inline-flex'}`}>
            {children(id)}
            <span
                id={id}
                role="tooltip"
                className={`pointer-events-none absolute z-30 bottom-full mb-2 ${posicion} w-max max-w-[15rem] rounded-lg bg-gray-900 px-2.5 py-1.5 text-left text-[11px] font-medium leading-snug text-white shadow-lg opacity-0 invisible transition-opacity duration-150 group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible`}
            >
                {ayuda}
            </span>
        </span>
    )
}

function Boton({ children, onClick, ayuda, tono = 'neutro', alinear = 'centro', ancho = false }: {
    children: ReactNode
    onClick: () => void
    ayuda: string
    tono?: 'neutro' | 'primario' | 'crear' | 'ambar' | 'peligro'
    alinear?: Alineacion
    ancho?: boolean
}) {
    const estilos = {
        neutro: 'border-gray-200 text-gray-700 hover:bg-gray-50',
        primario: 'border-transparent bg-[#00a896] text-white hover:bg-[#029081]',
        crear: 'border-[#00a896]/50 text-[#007f72] hover:bg-teal-50',
        ambar: 'border-amber-200 text-amber-700 hover:bg-amber-50',
        peligro: 'border-rose-200 text-rose-700 hover:bg-rose-50',
    }[tono]
    return (
        <ConAyuda ayuda={ayuda} alinear={alinear} ancho={ancho}>
            {(idAyuda) => (
                <button
                    type="button"
                    onClick={onClick}
                    aria-describedby={idAyuda}
                    className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${ancho ? 'w-full' : ''} ${estilos}`}
                >
                    {children}
                </button>
            )}
        </ConAyuda>
    )
}

function BotonIcono({ titulo, onClick, children }: { titulo: string; onClick: () => void; children: ReactNode }) {
    return (
        <ConAyuda ayuda={titulo}>
            {(idAyuda) => (
                <button
                    type="button"
                    aria-label={titulo}
                    aria-describedby={idAyuda}
                    onClick={onClick}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-[#063759] hover:bg-gray-100 transition-colors"
                >
                    {children}
                </button>
            )}
        </ConAyuda>
    )
}

// Separa "agregar" de las acciones sobre el elemento mismo
const Separador = () => <span aria-hidden="true" className="hidden sm:block w-px h-5 bg-gray-200 mx-1" />

// Asignaturas que dejó el importador. Solo lectura: se corrigen en el listado de Excel y se importa de nuevo.
function ListaAsignaturas() {
    const [filas, setFilas] = useState<AsignaturaCatalogo[] | null>(null)
    const [error, setError] = useState('')
    const [filtro, setFiltro] = useState('')
    const [abierta, setAbierta] = useState(false)

    useEffect(() => {
        let vigente = true
        getAsignaturasCargadas()
            .then(res => { if (vigente) setFilas(res.data.asignaturas) })
            .catch(e => { if (vigente) setError(mensajeDeError(e, 'No se pudieron cargar las asignaturas.')) })
        return () => { vigente = false }
    }, [])

    const q = normalizar(filtro.trim())
    const visibles = (filas || []).filter(a => !q || normalizar(a.nombre).includes(q) || normalizar(a.codigo || '').includes(q))
    // La columna de uso solo aparece cuando alguna asignatura ya está en agendas
    const hayUso = (filas || []).some(a => a.en_agendas > 0)

    return (
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <button
                type="button"
                onClick={() => setAbierta(v => !v)}
                aria-expanded={abierta}
                className="w-full flex flex-wrap items-center gap-2 px-4 py-3 text-left"
            >
                {abierta ? <ChevronDown className="w-4 h-4 text-[#00a896] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[#00a896] shrink-0" />}
                <BookOpen className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm font-bold text-gray-700">Asignaturas cargadas</span>
                {filas && <Insignia tono="gris">{filas.length}</Insignia>}
                <Insignia tono="azul">Solo lectura</Insignia>
            </button>
            {abierta && (
                <div className="px-4 pb-4 space-y-3">
                    <p className="text-xs text-gray-500">
                        Las crea el importador a partir del listado de Excel. Para corregir una, edita el listado y vuelve a importar.
                    </p>
                    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
                    {!filas && !error && (
                        <p className="flex items-center gap-2 text-xs text-gray-500" role="status"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p>
                    )}
                    {filas && (
                        <>
                            <div className="relative">
                                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="search"
                                    value={filtro}
                                    onChange={e => setFiltro(e.target.value)}
                                    placeholder="Buscar asignatura o código…"
                                    aria-label="Buscar entre las asignaturas cargadas"
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-[#00a896] focus:ring-1 focus:ring-[#00a896] outline-none"
                                />
                            </div>
                            <div className="max-h-96 overflow-auto rounded-lg border border-gray-100">
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-gray-50 text-gray-500 uppercase tracking-wide text-[11px]">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-bold">Asignatura</th>
                                            <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Semestre</th>
                                            {hayUso && <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Uso</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {visibles.map(a => (
                                            <tr key={a.id} className={a.activo ? '' : 'opacity-50'}>
                                                <td className="px-3 py-2 text-gray-800">
                                                    {a.nombre}
                                                    {a.codigo && <span className="ml-1.5 text-gray-400">{a.codigo}</span>}
                                                    {!a.activo && <span className="ml-1.5"><Insignia tono="ambar">Inactiva</Insignia></span>}
                                                </td>
                                                <td className="px-3 py-2 text-gray-600">{a.semestre ?? '—'}</td>
                                                {hayUso && (
                                                    <td className="px-3 py-2 whitespace-nowrap">
                                                        {a.en_agendas > 0 && <Insignia tono="verde">En {plural(a.en_agendas, 'agenda', 'agendas')}</Insignia>}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                        {visibles.length === 0 && (
                                            <tr><td colSpan={hayUso ? 3 : 2} className="px-3 py-6 text-center text-gray-400">
                                                {filas.length === 0 ? 'Todavía no hay asignaturas: se cargan al importar un listado.' : 'Ninguna asignatura coincide.'}
                                            </td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}
        </section>
    )
}

export default function ParametrosGenerales() {
    const { puedeCrear, puedeEditar, puedeEliminar } = usePermisosPagina('Parámetros Generales')

    const [funciones, setFunciones] = useState<FuncionCatalogo[]>([])
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')
    const [aviso, setAviso] = useState('')
    const [busqueda, setBusqueda] = useState('')
    const [verOcultos, setVerOcultos] = useState(false)
    const [seleccionada, setSeleccionada] = useState<number | null>(null)
    // Actividades abiertas o cerradas a mano; sin marca se abren las funciones con pocas actividades
    const [manual, setManual] = useState<Record<string, boolean>>({})

    const [formulario, setFormulario] = useState<Formulario | null>(null)
    const [valores, setValores] = useState<Valores>(VALORES_VACIOS)
    const [errorForm, setErrorForm] = useState('')
    const [guardando, setGuardando] = useState(false)
    const [cambio, setCambio] = useState<CambioVisibilidad | null>(null)
    const [eliminar, setEliminar] = useState<ElementoAEliminar | null>(null)
    const [errorEliminar, setErrorEliminar] = useState('')

    const cargar = useCallback(async () => {
        try {
            const res = await getArbolCatalogo()
            setFunciones(res.data.funciones)
            setError('')
        } catch (e) {
            setError(mensajeDeError(e, 'No se pudo cargar el catálogo.'))
        } finally {
            setCargando(false)
        }
    }, [])

    useEffect(() => { cargar() }, [cargar])

    // Los avisos se retiran solos
    useEffect(() => {
        if (!aviso && !error) return
        const t = setTimeout(() => { setAviso(''); setError('') }, 4500)
        return () => clearTimeout(t)
    }, [aviso, error])

    const abrir = (...claves: string[]) =>
        setManual(prev => ({ ...prev, ...Object.fromEntries(claves.map(k => [k, true])) }))

    // ---------- Filtros ----------
    const q = normalizar(busqueda.trim())
    const visibles = useMemo(() => {
        const ok = (activo: boolean) => verOcultos || activo
        const coincide = (...textos: string[]) => !q || textos.some(t => normalizar(t).includes(q))
        return funciones
            .filter(f => ok(f.activo))
            .map(f => ({
                ...f,
                actividades: f.actividades
                    .filter(a => ok(a.activo))
                    .map(a => ({
                        ...a,
                        descripciones: a.descripciones
                            .filter(d => ok(d.activo))
                            .map(d => ({ ...d, indicadores: d.indicadores.filter(i => ok(i.activo)) }))
                            .filter(d => !q || coincide(d.texto, ...d.indicadores.map(i => i.nombre)) || coincide(a.nombre, f.nombre)),
                    }))
                    .filter(a => !q || coincide(a.nombre, f.nombre) || a.descripciones.length > 0),
            }))
            .filter(f => !q || coincide(f.nombre) || f.actividades.length > 0)
    }, [funciones, q, verOcultos])

    const borrables = useMemo(() => {
        const ok = new Set<string>()
        for (const f of funciones) {
            if (funcionBorrable(f)) ok.add(`f${f.id}`)
            for (const a of f.actividades) {
                if (actividadBorrable(a)) ok.add(`a${a.id}`)
                for (const d of a.descripciones) {
                    if (descripcionBorrable(d)) ok.add(`d${d.id}`)
                    for (const i of d.indicadores) if (indicadorBorrable(i)) ok.add(`i${i.id}`)
                }
            }
        }
        return ok
    }, [funciones])

    const totalOcultos = useMemo(() => {
        let n = 0
        for (const f of funciones) {
            if (!f.activo) n++
            for (const a of f.actividades) {
                if (!a.activo) n++
                for (const d of a.descripciones) {
                    if (!d.activo) n++
                    n += d.indicadores.filter(i => !i.activo).length
                }
            }
        }
        return n
    }, [funciones])

    // ---------- Formularios ----------
    const abrirFormulario = (f: Formulario) => {
        setErrorForm('')
        setValores(
            f.tipo === 'funcion-editar' ? { ...VALORES_VACIOS, nombre: f.funcion.nombre }
            : f.tipo === 'actividad-editar' ? { ...VALORES_VACIOS, nombre: f.actividad.nombre }
            : f.tipo === 'descripcion-editar' ? { ...VALORES_VACIOS, descripcion: f.descripcion.texto, meta: String(f.descripcion.meta ?? 1) }
            : f.tipo === 'indicador-editar' ? { ...VALORES_VACIOS, nombre: f.indicador.nombre }
            : VALORES_VACIOS
        )
        setFormulario(f)
    }
    const cerrarFormulario = () => { if (!guardando) setFormulario(null) }

    useEffect(() => {
        if (!formulario && !cambio && !eliminar) return
        const alTeclear = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !guardando) { setFormulario(null); setCambio(null); setEliminar(null) }
        }
        window.addEventListener('keydown', alTeclear)
        return () => window.removeEventListener('keydown', alTeclear)
    }, [formulario, cambio, eliminar, guardando])

    const guardar = async (e: FormEvent) => {
        e.preventDefault()
        if (!formulario) return
        setGuardando(true)
        setErrorForm('')
        const v = valores
        // La meta solo se envía donde el catálogo la lleva (Docencia Directa)
        const conMeta = formulario.tipo === 'actividad-nueva' ? formulario.funcion.usa_meta
            : formulario.tipo === 'descripcion-nueva' || formulario.tipo === 'descripcion-editar' ? formulario.usaMeta
            : false
        const meta = conMeta ? v.meta : undefined
        const actividadNueva = { nombre: v.actividad || v.nombre, descripcion: v.descripcion, meta, indicador: v.indicador }
        try {
            switch (formulario.tipo) {
                case 'funcion-nueva':
                    setSeleccionada((await crearFuncionCatalogo(v.nombre, { ...actividadNueva, nombre: v.actividad })).data.id)
                    setAviso(`Función "${v.nombre}" creada.`)
                    break
                case 'actividad-nueva':
                    abrir(`a${(await crearActividadCatalogo(formulario.funcion.id, { ...actividadNueva, nombre: v.nombre })).data.id}`)
                    setAviso(`Actividad "${v.nombre}" agregada.`)
                    break
                case 'descripcion-nueva':
                    await crearDescripcionCatalogo(formulario.actividad.id, { texto: v.descripcion, meta, indicador: v.indicador })
                    abrir(`a${formulario.actividad.id}`)
                    setAviso('Descripción agregada.')
                    break
                case 'indicador-nuevo':
                    await crearIndicadorCatalogo(formulario.descripcion.id, v.nombre)
                    setAviso('Indicador agregado.')
                    break
                case 'funcion-editar':
                    await editarFuncionCatalogo(formulario.funcion.id, v.nombre)
                    setAviso('Función actualizada.')
                    break
                case 'actividad-editar':
                    await editarActividadCatalogo(formulario.actividad.id, v.nombre)
                    setAviso('Actividad actualizada.')
                    break
                case 'descripcion-editar':
                    await editarDescripcionCatalogo(formulario.descripcion.id, v.descripcion, meta)
                    setAviso('Descripción actualizada.')
                    break
                case 'indicador-editar':
                    await editarIndicadorCatalogo(formulario.indicador.id, v.nombre)
                    setAviso('Indicador actualizado.')
                    break
            }
            setFormulario(null)
            await cargar()
        } catch (err) {
            setErrorForm(mensajeDeError(err, 'No se pudo guardar el cambio.'))
        } finally {
            setGuardando(false)
        }
    }

    // ---------- Ocultar / mostrar ----------
    const aplicarVisibilidad = async (tipo: TipoElemento, id: number, activo: boolean) => {
        setGuardando(true)
        try {
            await cambiarVisibilidadCatalogo(tipo, id, activo)
            setAviso(activo ? 'Elemento visible de nuevo en las agendas nuevas.' : 'Elemento oculto de las agendas nuevas.')
            setCambio(null)
            await cargar()
        } catch (err) {
            setError(mensajeDeError(err, 'No se pudo cambiar la visibilidad.'))
            setCambio(null)
        } finally {
            setGuardando(false)
        }
    }
    const pedirOcultar = (tipo: TipoElemento, id: number, nombre: string, en_uso: number) =>
        setCambio({ tipo, id, nombre, en_uso })

    // Texto de lo que se llevaría consigo la eliminación (sobre el catálogo completo)
    const contenidoDe = (tipo: TipoElemento, id: number): string => {
        const partes = (a: number, d: number, i: number) =>
            [a > 0 && plural(a, 'actividad', 'actividades'), d > 0 && plural(d, 'descripción', 'descripciones'), i > 0 && plural(i, 'indicador', 'indicadores')]
                .filter(Boolean).join(', ')
        const contar = (acts: ActividadCatalogo[]) => partes(
            acts.length,
            acts.reduce((n, a) => n + a.descripciones.length, 0),
            acts.reduce((n, a) => n + a.descripciones.reduce((m, d) => m + d.indicadores.length, 0), 0))
        for (const f of funciones) {
            if (tipo === 'funciones' && f.id === id) return contar(f.actividades)
            for (const a of f.actividades) {
                if (tipo === 'actividades' && a.id === id) return contar([a]).replace(/^1 actividad, ?/, '')
                for (const d of a.descripciones) {
                    if (tipo === 'descripciones' && d.id === id) return partes(0, 0, d.indicadores.length)
                }
            }
        }
        return ''
    }
    const pedirEliminar = (tipo: TipoElemento, id: number, nombre: string) => {
        setErrorEliminar('')
        setEliminar({ tipo, id, nombre, contenido: contenidoDe(tipo, id) })
    }
    const confirmarEliminar = async () => {
        if (!eliminar) return
        setGuardando(true)
        setErrorEliminar('')
        try {
            await eliminarElementoCatalogo(eliminar.tipo, eliminar.id)
            setAviso('Eliminado definitivamente.')
            setEliminar(null)
            await cargar()
        } catch (err) {
            setErrorEliminar(mensajeDeError(err, 'No se pudo eliminar.'))
        } finally {
            setGuardando(false)
        }
    }

    // ---------- Piezas de la pantalla ----------
    const funcionActual = visibles.find(f => f.id === seleccionada) ?? visibles[0] ?? null

    const actividadAbierta = (a: ActividadCatalogo, total: number) => manual[`a${a.id}`] ?? (!!q || total <= 4)
    const alternarActividad = (a: ActividadCatalogo, total: number) =>
        setManual(prev => ({ ...prev, [`a${a.id}`]: !actividadAbierta(a, total) }))
    const abrirTodas = (f: FuncionCatalogo, abierto: boolean) =>
        setManual(prev => ({ ...prev, ...Object.fromEntries(f.actividades.map(a => [`a${a.id}`, abierto])) }))

    const pedirVisibilidad = (tipo: TipoElemento, id: number, nombre: string, activo: boolean, en_uso: number) =>
        activo ? pedirOcultar(tipo, id, nombre, en_uso) : aplicarVisibilidad(tipo, id, true)

    // Orden de las acciones en cada nivel: Agregar | Renombrar o Editar · Ocultar · Eliminar
    const botonVisibilidad = (tipo: TipoElemento, id: number, nombre: string, activo: boolean, en_uso: number, nivel: string, alinear: Alineacion = 'centro', bloqueada = false, ancho = false) =>
        puedeEliminar && !(bloqueada && activo) ? (
            <Boton
                tono="ambar"
                alinear={alinear}
                ancho={ancho}
                ayuda={activo
                    ? `Ocultar ${nivel}: dejará de ofrecerse en las agendas nuevas. Se puede volver a mostrar.`
                    : `Volver a ofrecer ${nivel} en las agendas nuevas.`}
                onClick={() => pedirVisibilidad(tipo, id, nombre, activo, en_uso)}
            >
                {activo ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {activo ? 'Ocultar' : 'Mostrar'}
            </Boton>
        ) : null

    const botonEliminar = (tipo: TipoElemento, id: number, nombre: string, clave: string, nivel: string, alinear: Alineacion = 'centro', ancho = false) =>
        puedeEliminar && borrables.has(clave) ? (
            <Boton
                tono="peligro"
                alinear={alinear}
                ancho={ancho}
                ayuda={`Eliminar ${nivel} para siempre. Ninguna agenda lo usa y no se puede deshacer.`}
                onClick={() => pedirEliminar(tipo, id, nombre)}
            >
                <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </Boton>
        ) : null

    // Cada indicador lleva sus propios íconos pegados a su texto
    const renderIndicador = (i: IndicadorCatalogo) => (
        <li key={i.id} className={`py-1.5 text-xs text-gray-600 ${i.activo ? '' : 'opacity-50'}`}>
            <span className="flex items-start gap-2">
                <Target className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-1" />
                <span className="min-w-0 break-words leading-6">
                    {i.nombre}
                    {!i.activo && <span className="ml-1.5 align-middle"><Insignia tono="ambar">Oculto</Insignia></span>}
                    <span className="inline-flex items-center align-middle ml-1.5 whitespace-nowrap">
                        {puedeEditar && i.en_uso === 0 && (
                            <BotonIcono titulo="Editar este indicador" onClick={() => abrirFormulario({ tipo: 'indicador-editar', indicador: i })}>
                                <Pencil className="w-3.5 h-3.5" />
                            </BotonIcono>
                        )}
                        {puedeEliminar && (
                            <BotonIcono
                                titulo={i.activo ? 'Ocultar este indicador: dejará de ofrecerse en las agendas nuevas' : 'Volver a mostrar este indicador'}
                                onClick={() => pedirVisibilidad('indicadores', i.id, i.nombre, i.activo, i.en_uso)}
                            >
                                {i.activo ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </BotonIcono>
                        )}
                        {puedeEliminar && borrables.has(`i${i.id}`) && (
                            <BotonIcono titulo="Eliminar este indicador para siempre (ninguna agenda lo usa)" onClick={() => pedirEliminar('indicadores', i.id, i.nombre)}>
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            </BotonIcono>
                        )}
                    </span>
                </span>
            </span>
        </li>
    )

    const COLUMNAS = 'md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_8rem]'
    const rotulo = 'md:hidden text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1'

    const renderDescripcion = (d: DescripcionCatalogo, usaMeta: boolean, usaIndicadores: boolean) => (
        <div key={d.id} className={`grid gap-3 px-4 py-3 border-t border-gray-100 ${COLUMNAS} ${d.activo ? '' : 'opacity-60'}`}>
            <div className="min-w-0">
                <p className={rotulo}>Descripción / resultado esperado</p>
                <p className="text-sm text-gray-800 break-words">{d.texto}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {usaMeta && <Insignia tono="azul">Meta: {d.meta ?? '—'}</Insignia>}
                    {d.en_uso > 0 && <Insignia tono="verde">En {plural(d.en_uso, 'agenda', 'agendas')}</Insignia>}
                    {!d.activo && <Insignia tono="ambar">Oculta</Insignia>}
                </div>
            </div>
            <div className="min-w-0">
                <p className={rotulo}>Indicadores (entregables)</p>
                {d.indicadores.length === 0
                    ? <p className="text-xs text-gray-400">{usaIndicadores ? 'Sin indicadores visibles.' : 'El docente registra el indicador en su agenda.'}</p>
                    : <ul className="divide-y divide-gray-100">{d.indicadores.map(renderIndicador)}</ul>}
                {puedeCrear && usaIndicadores && (
                    <div className="mt-2">
                        <Boton tono="crear" alinear="izquierda" ayuda="Agregar otro indicador (entregable) a esta descripción"
                            onClick={() => abrirFormulario({ tipo: 'indicador-nuevo', descripcion: d })}>
                            <Plus className="w-3.5 h-3.5" /> Agregar indicador
                        </Boton>
                    </div>
                )}
            </div>
            <div className="flex flex-wrap md:flex-col gap-1.5 md:items-stretch">
                {puedeEditar && (usaMeta || d.en_uso === 0) && (
                    <Boton alinear="derecha" ancho
                        ayuda={usaMeta ? 'Cambiar el texto y la meta de esta descripción' : 'Cambiar el texto de esta descripción'}
                        onClick={() => abrirFormulario({ tipo: 'descripcion-editar', descripcion: d, usaMeta })}>
                        <Pencil className="w-3.5 h-3.5" /> Editar
                    </Boton>
                )}
                {botonVisibilidad('descripciones', d.id, d.texto, d.activo, d.en_uso, 'esta descripción', 'derecha', false, true)}
                {botonEliminar('descripciones', d.id, d.texto, `d${d.id}`, 'esta descripción con sus indicadores', 'derecha', true)}
            </div>
        </div>
    )

    const renderActividad = (a: ActividadCatalogo, f: FuncionCatalogo) => {
        const abierta = actividadAbierta(a, f.actividades.length)
        return (
            <li key={a.id} className={`rounded-xl border border-gray-200 bg-white ${a.activo ? '' : 'opacity-60'}`}>
                <div className={`px-4 py-3 bg-gray-50/80 space-y-2.5 ${abierta ? 'rounded-t-xl' : 'rounded-xl'}`}>
                    <button
                        type="button"
                        onClick={() => alternarActividad(a, f.actividades.length)}
                        aria-expanded={abierta}
                        className="flex flex-wrap items-center gap-2 min-w-0 text-left"
                    >
                        {abierta ? <ChevronDown className="w-4 h-4 text-[#00a896] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[#00a896] shrink-0" />}
                        <span className="text-sm font-bold text-[#063759] break-words">{a.nombre}</span>
                        <Insignia tono="gris">{plural(a.descripciones.length, 'descripción', 'descripciones')}</Insignia>
                        {a.protegida && <Insignia tono="gris"><Lock className="w-3 h-3" />Del sistema</Insignia>}
                        {a.en_uso > 0 && <Insignia tono="verde">En {plural(a.en_uso, 'agenda', 'agendas')}</Insignia>}
                        {!a.activo && <Insignia tono="ambar">Oculta</Insignia>}
                    </button>
                    {abierta && (
                        <div className="flex flex-wrap items-center gap-1.5 pl-6">
                            {puedeCrear && (
                                <Boton tono="crear" alinear="izquierda" ayuda="Agregar otra descripción (con su indicador) a esta actividad"
                                    onClick={() => abrirFormulario({ tipo: 'descripcion-nueva', actividad: a, usaMeta: f.usa_meta, usaIndicador: f.usa_indicadores })}>
                                    <Plus className="w-3.5 h-3.5" /> Agregar descripción
                                </Boton>
                            )}
                            {puedeCrear && <Separador />}
                            {puedeEditar && !a.protegida && a.en_uso === 0 && (
                                <Boton ayuda="Cambiar el nombre de esta actividad" onClick={() => abrirFormulario({ tipo: 'actividad-editar', actividad: a })}>
                                    <Pencil className="w-3.5 h-3.5" /> Renombrar
                                </Boton>
                            )}
                            {botonVisibilidad('actividades', a.id, a.nombre, a.activo, a.en_uso, 'esta actividad', 'centro', a.protegida)}
                            {botonEliminar('actividades', a.id, a.nombre, `a${a.id}`, 'esta actividad con sus descripciones e indicadores')}
                        </div>
                    )}
                </div>
                {abierta && (
                    <div>
                        <div className={`hidden md:grid gap-3 px-4 py-2 border-t border-gray-100 text-[11px] font-bold uppercase tracking-wide text-gray-500 ${COLUMNAS}`}>
                            <span>Descripción / resultado esperado</span>
                            <span>Indicadores (entregables)</span>
                            <span>Esta descripción</span>
                        </div>
                        {a.descripciones.length === 0
                            ? <p className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">Sin descripciones visibles.</p>
                            : a.descripciones.map(d => renderDescripcion(d, f.usa_meta, f.usa_indicadores))}
                    </div>
                )}
            </li>
        )
    }

    const renderPanelFuncion = (f: FuncionCatalogo) => (
        <div className="space-y-4 min-w-0">
            <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 ${f.activo ? '' : 'opacity-70'}`}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Función sustantiva</p>
                <h2 className="text-lg font-bold text-[#063759] break-words mt-1">{f.nombre}</h2>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <Insignia tono="gris">{plural(f.actividades.length, 'actividad', 'actividades')}</Insignia>
                    {f.protegida && <Insignia tono="gris"><Lock className="w-3 h-3" />Del sistema</Insignia>}
                    {f.en_uso > 0 && <Insignia tono="verde">En {plural(f.en_uso, 'agenda', 'agendas')}</Insignia>}
                    {f.usa_meta && <Insignia tono="azul">Con meta por defecto</Insignia>}
                    {!f.usa_indicadores && <Insignia tono="azul">Indicador: lo registra el docente</Insignia>}
                    {!f.activo && <Insignia tono="ambar">Oculta</Insignia>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    {puedeCrear && (
                        <Boton tono="primario" alinear="izquierda" ayuda="Agregar una actividad nueva a esta función"
                            onClick={() => abrirFormulario({ tipo: 'actividad-nueva', funcion: f })}>
                            <Plus className="w-3.5 h-3.5" /> Agregar actividad
                        </Boton>
                    )}
                    {puedeCrear && <Separador />}
                    {puedeEditar && !f.protegida && f.en_uso === 0 && (
                        <Boton ayuda="Cambiar el nombre de esta función" onClick={() => abrirFormulario({ tipo: 'funcion-editar', funcion: f })}>
                            <Pencil className="w-3.5 h-3.5" /> Renombrar
                        </Boton>
                    )}
                    {botonVisibilidad('funciones', f.id, f.nombre, f.activo, f.en_uso, 'esta función')}
                    {botonEliminar('funciones', f.id, f.nombre, `f${f.id}`, 'esta función con todo lo que contiene')}
                </div>
            </div>

            {f.nombre === 'Docencia Directa' && (
                <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl px-4 py-3 text-xs">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" />
                    <p>
                        En esta función la “actividad” de cada docente es su <strong>asignatura</strong>, que sale del listado de Excel y no se
                        administra aquí (la lista está al final, solo para consultarla). Las descripciones de abajo, con su indicador y su meta,
                        <strong> aplican a cada asignatura</strong>.
                    </p>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-gray-700">Actividades de {f.nombre}</h3>
                {f.actividades.length > 1 && (
                    <div className="flex gap-1.5">
                        <Boton alinear="derecha" ayuda="Abrir todas las actividades de esta función" onClick={() => abrirTodas(f, true)}>
                            <ChevronsUpDown className="w-3.5 h-3.5" /> Expandir todas
                        </Boton>
                        <Boton alinear="derecha" ayuda="Cerrar todas las actividades de esta función" onClick={() => abrirTodas(f, false)}>
                            <ChevronsDownUp className="w-3.5 h-3.5" /> Contraer todas
                        </Boton>
                    </div>
                )}
            </div>

            {f.actividades.length === 0
                ? <p className="bg-white border border-gray-100 rounded-xl p-6 text-center text-sm text-gray-400">Esta función no tiene actividades visibles.</p>
                : <ul className="space-y-3">{f.actividades.map(a => renderActividad(a, f))}</ul>}

            {f.nombre === 'Docencia Directa' && <ListaAsignaturas />}
        </div>
    )

    // ---------- Formulario ----------
    const campo = (clave: keyof Valores, etiqueta: string, opciones?: { area?: boolean; deshabilitado?: boolean; ayuda?: string; numero?: boolean }) => {
        const clases = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#00a896] focus:ring-1 focus:ring-[#00a896] outline-none disabled:bg-gray-100 disabled:text-gray-500'
        const id = `par-${clave}`
        return (
            <div key={clave}>
                <label htmlFor={id} className="block text-xs font-bold text-gray-700 mb-1">{etiqueta}</label>
                {opciones?.area ? (
                    <textarea id={id} rows={3} className={`${clases} resize-y`} value={valores[clave]} disabled={opciones.deshabilitado || guardando}
                        onChange={e => setValores(prev => ({ ...prev, [clave]: e.target.value }))} />
                ) : (
                    <input id={id} type={opciones?.numero ? 'number' : 'text'} min={opciones?.numero ? 0 : undefined} className={clases}
                        value={valores[clave]} disabled={opciones?.deshabilitado || guardando}
                        onChange={e => setValores(prev => ({ ...prev, [clave]: e.target.value }))} />
                )}
                {opciones?.ayuda && <p className="text-[11px] text-gray-500 mt-1">{opciones.ayuda}</p>}
            </div>
        )
    }

    const descripcionFormulario = (f: Formulario) => {
        switch (f.tipo) {
            case 'funcion-nueva':
                return {
                    titulo: 'Nueva función sustantiva',
                    ayuda: 'Toda función nace con su primera actividad, descripción e indicador; después puedes agregar más.',
                    campos: [campo('nombre', 'Nombre de la función'), campo('actividad', 'Primera actividad'),
                        campo('descripcion', 'Descripción / resultado esperado', { area: true }),
                        campo('indicador', 'Indicador (entregable)')],
                }
            case 'actividad-nueva':
                return {
                    titulo: `Nueva actividad en ${f.funcion.nombre}`,
                    ayuda: 'Incluye su primera descripción e indicador para que el docente pueda usarla.',
                    campos: [campo('nombre', 'Nombre de la actividad'),
                        campo('descripcion', 'Descripción / resultado esperado', { area: true }),
                        ...(f.funcion.usa_meta ? [campo('meta', 'Meta', { numero: true })] : []),
                        ...(f.funcion.usa_indicadores ? [campo('indicador', 'Indicador (entregable)')] : [])],
                }
            case 'descripcion-nueva':
                return {
                    titulo: `Nueva descripción en ${f.actividad.nombre}`,
                    ayuda: '',
                    campos: [campo('descripcion', 'Descripción / resultado esperado', { area: true }),
                        ...(f.usaMeta ? [campo('meta', 'Meta', { numero: true })] : []),
                        ...(f.usaIndicador ? [campo('indicador', 'Indicador (entregable)')] : [])],
                }
            case 'indicador-nuevo':
                return { titulo: 'Nuevo indicador', ayuda: '', campos: [campo('nombre', 'Indicador (entregable)', { area: true })] }
            case 'funcion-editar':
                return { titulo: 'Renombrar función', ayuda: '', campos: [campo('nombre', 'Nombre de la función')] }
            case 'actividad-editar':
                return { titulo: 'Renombrar actividad', ayuda: '', campos: [campo('nombre', 'Nombre de la actividad')] }
            case 'descripcion-editar':
                return {
                    titulo: 'Editar descripción',
                    ayuda: f.descripcion.en_uso > 0
                        ? `Está en ${plural(f.descripcion.en_uso, 'agenda', 'agendas')}: solo puedes cambiar la meta, que aplica a las agendas nuevas.`
                        : '',
                    campos: [campo('descripcion', 'Descripción / resultado esperado', { area: true, deshabilitado: f.descripcion.en_uso > 0 }),
                        ...(f.usaMeta ? [campo('meta', 'Meta', { numero: true })] : [])],
                }
            case 'indicador-editar':
                return { titulo: 'Editar indicador', ayuda: '', campos: [campo('nombre', 'Indicador (entregable)', { area: true })] }
        }
    }
    const vistaFormulario = formulario ? descripcionFormulario(formulario) : null

    return (
        <Layout rol="planeacion" path="/planeacion/parametros">
            <div className="space-y-5 max-w-7xl mx-auto pb-10">
                {(aviso || error) && (
                    <div
                        role="status"
                        className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 border ${error ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}
                    >
                        {error ? <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                        <span className="text-sm font-medium">{error || aviso}</span>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div>
                        <h1 className="text-xl font-bold text-[#063759] flex items-center gap-2">
                            <ListTree className="w-6 h-6 text-[#00a896]" />
                            Parámetros generales
                        </h1>
                        <p className="flex flex-wrap items-center gap-1.5 text-gray-500 text-xs mt-1.5">
                            Cómo se arma la agenda del docente:
                            {['Función', 'Actividad', 'Descripción', 'Indicador'].map((paso, i) => (
                                <span key={paso} className="inline-flex items-center gap-1.5">
                                    {i > 0 && <ChevronRight className="w-3 h-3 text-gray-300" />}
                                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-semibold">{paso}</span>
                                </span>
                            ))}
                        </p>
                    </div>
                    {puedeCrear && (
                        <button
                            type="button"
                            onClick={() => abrirFormulario({ tipo: 'funcion-nueva' })}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#00a896] hover:bg-[#029081] text-white rounded-xl shadow-sm text-sm font-medium transition-all"
                        >
                            <Plus className="w-4 h-4" /> Nueva función
                        </button>
                    )}
                </div>

                <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 text-blue-800 rounded-xl px-4 py-3 text-xs">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>
                        Los cambios aplican a las <strong>agendas nuevas</strong>: las que los docentes ya tienen conservan su texto. Lo oculto se puede volver a mostrar. <strong>Eliminar</strong> solo
                        aparece en lo que ninguna agenda usa (para corregir un error); lo demás se oculta. La meta de cada actividad la registra el docente; aquí solo se define la de Docencia Directa.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="search"
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            placeholder="Buscar función, actividad, descripción o indicador…"
                            aria-label="Buscar en el catálogo"
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:border-[#00a896] focus:ring-1 focus:ring-[#00a896] outline-none"
                        />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                        <input type="checkbox" checked={verOcultos} onChange={e => setVerOcultos(e.target.checked)} className="rounded" />
                        Mostrar ocultos {totalOcultos > 0 && <span className="text-gray-400">({totalOcultos})</span>}
                    </label>
                </div>

                {cargando ? (
                    <div className="flex items-center justify-center gap-3 text-gray-500 py-16" role="status">
                        <Loader2 className="w-5 h-5 animate-spin" /> Cargando el catálogo…
                    </div>
                ) : visibles.length === 0 ? (
                    <div className="bg-white border border-gray-100 rounded-xl p-10 text-center text-sm text-gray-500">
                        {q ? 'Ningún elemento coincide con la búsqueda.' : 'El catálogo no tiene funciones visibles.'}
                    </div>
                ) : (
                    <div className="grid gap-5 grid-cols-[minmax(0,1fr)] lg:grid-cols-[17rem_minmax(0,1fr)] items-start">
                        <nav aria-label="Funciones sustantivas" className="lg:sticky lg:top-4">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2 px-1">
                                1 · Funciones ({visibles.length})
                            </p>
                            <ul className="flex lg:flex-col gap-2 overflow-x-auto pb-1 lg:pb-0">
                                {visibles.map(f => {
                                    const activa = funcionActual?.id === f.id
                                    return (
                                        <li key={f.id} className="shrink-0 lg:shrink">
                                            <button
                                                type="button"
                                                onClick={() => setSeleccionada(f.id)}
                                                aria-current={activa ? 'true' : undefined}
                                                className={`w-full text-left rounded-xl border px-3.5 py-2.5 transition-colors ${activa
                                                    ? 'bg-[#063759] border-[#063759] text-white shadow-sm'
                                                    : 'bg-white border-gray-200 text-gray-700 hover:border-[#00a896]'} ${f.activo ? '' : 'opacity-60'}`}
                                            >
                                                <span className="block text-sm font-bold break-words">{f.nombre}</span>
                                                <span className={`flex flex-wrap items-center gap-x-2 text-[11px] mt-0.5 ${activa ? 'text-white/75' : 'text-gray-400'}`}>
                                                    {plural(f.actividades.length, 'actividad', 'actividades')}
                                                    {f.en_uso > 0 && <span>· En {plural(f.en_uso, 'agenda', 'agendas')}</span>}
                                                    {!f.activo && <span>· Oculta</span>}
                                                </span>
                                            </button>
                                        </li>
                                    )
                                })}
                            </ul>
                        </nav>

                        {funcionActual && renderPanelFuncion(funcionActual)}
                    </div>
                )}
            </div>

            {/* Formulario */}
            {formulario && vistaFormulario && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={cerrarFormulario}>
                    <form
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="par-titulo"
                        onSubmit={guardar}
                        onClick={e => e.stopPropagation()}
                        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
                    >
                        <div className="bg-[#063759] px-5 py-4 flex items-center justify-between text-white">
                            <h3 id="par-titulo" className="font-bold text-sm">{vistaFormulario.titulo}</h3>
                            <button type="button" onClick={cerrarFormulario} aria-label="Cerrar" className="text-white/80 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
                            {vistaFormulario.ayuda && <p className="text-xs text-gray-500">{vistaFormulario.ayuda}</p>}
                            {vistaFormulario.campos}
                            {errorForm && (
                                <p role="alert" className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-3">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {errorForm}
                                </p>
                            )}
                        </div>
                        <div className="px-5 py-3 bg-gray-50 flex justify-end gap-2">
                            <button type="button" onClick={cerrarFormulario} disabled={guardando} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg">Cancelar</button>
                            <button type="submit" disabled={guardando} className="px-4 py-2 text-sm font-bold text-white bg-[#00a896] hover:bg-[#029081] disabled:opacity-60 rounded-lg inline-flex items-center gap-2">
                                {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Confirmación de eliminar */}
            {eliminar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !guardando && setEliminar(null)}>
                    <div role="dialog" aria-modal="true" aria-labelledby="par-eliminar" onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="bg-rose-600 px-5 py-4 flex items-center gap-2 text-white">
                            <Trash2 className="w-5 h-5" />
                            <h3 id="par-eliminar" className="font-bold text-sm">Eliminar definitivamente</h3>
                        </div>
                        <div className="p-5 space-y-3 text-sm text-gray-700">
                            <p className="font-medium break-words">“{eliminar.nombre}”</p>
                            {eliminar.contenido && (
                                <p>Se eliminará junto con lo que contiene: <strong>{eliminar.contenido}</strong>.</p>
                            )}
                            <p className="flex items-start gap-2 text-xs text-rose-800 bg-rose-50 border border-rose-100 rounded-lg p-3">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                No se puede deshacer. Ninguna agenda lo usa, así que no afecta a los docentes. Si solo quieres que no se ofrezca, usa Ocultar.
                            </p>
                            {errorEliminar && (
                                <p role="alert" className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {errorEliminar}
                                </p>
                            )}
                        </div>
                        <div className="px-5 py-3 bg-gray-50 flex justify-end gap-2">
                            <button type="button" onClick={() => setEliminar(null)} disabled={guardando} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg">Cancelar</button>
                            <button type="button" onClick={confirmarEliminar} disabled={guardando}
                                className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 rounded-lg inline-flex items-center gap-2">
                                {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmación de ocultar */}
            {cambio && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !guardando && setCambio(null)}>
                    <div role="dialog" aria-modal="true" aria-labelledby="par-ocultar" onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="bg-amber-500 px-5 py-4 flex items-center gap-2 text-white">
                            <EyeOff className="w-5 h-5" />
                            <h3 id="par-ocultar" className="font-bold text-sm">Ocultar de las agendas nuevas</h3>
                        </div>
                        <div className="p-5 space-y-3 text-sm text-gray-700">
                            <p className="font-medium break-words">“{cambio.nombre}”</p>
                            <p>Dejará de ofrecerse a los docentes que armen su agenda de ahora en adelante. Puedes volver a mostrarlo cuando quieras.</p>
                            {cambio.en_uso > 0 && (
                                <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3">
                                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                    Está en {plural(cambio.en_uso, 'agenda', 'agendas')} de docentes. Esas agendas conservan su texto; solo cambia lo que ven las agendas nuevas.
                                </p>
                            )}
                        </div>
                        <div className="px-5 py-3 bg-gray-50 flex justify-end gap-2">
                            <button type="button" onClick={() => setCambio(null)} disabled={guardando} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg">Cancelar</button>
                            <button type="button" onClick={() => aplicarVisibilidad(cambio.tipo, cambio.id, false)} disabled={guardando}
                                className="px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 rounded-lg inline-flex items-center gap-2">
                                {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Ocultar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
