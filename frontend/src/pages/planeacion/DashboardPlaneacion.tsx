import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/common/Layout'
import * as XLSX from 'xlsx'
import api from '../../services/api'
// @ts-ignore
import { getUsuarios, createUsuario, toggleActivo, createBulkUsuarios } from '../../services/usuariosService'

interface Docente {
    id_usuario: number
    nombres: string
    apellidos: string
    correo: string
    activo: boolean
    tipo_contrato: string
    programa: string
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

interface NuevoDocente {
    nombres: string
    apellidos: string
    correo: string
    rol: string
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
    const [modalAgregar, setModalAgregar] = useState(false)
    const [modalImportar, setModalImportar] = useState(false)
    const [archivoImportar, setArchivoImportar] = useState<File | null>(null)
    const [importando, setImportando] = useState(false)
    const [guardando, setGuardando] = useState(false)
    const [editandoId, setEditandoId] = useState<number | null>(null)
    const [tabActiva, setTabActiva] = useState<'usuarios' | 'agendas'>('usuarios')

    const [nuevoDocente, setNuevoDocente] = useState<NuevoDocente>({
        nombres: '',
        apellidos: '',
        correo: '',
        rol: 'Docente'
    })

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
        const interval = setInterval(() => {
            cargarAgendas()
        }, 30000)
        return () => clearInterval(interval)
    }, [cargarDocentes, cargarAgendas])

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

    const handleCrear = async () => {
        if (!nuevoDocente.nombres.trim() || !nuevoDocente.apellidos.trim() || !nuevoDocente.correo.trim()) {
            setError('Completa todos los campos')
            return
        }
        if (!nuevoDocente.correo.includes('@')) {
            setError('Ingresa un correo válido')
            return
        }
        try {
            setGuardando(true)
            setError('')
            const res = await createUsuario({
                nombres: nuevoDocente.nombres,
                apellidos: nuevoDocente.apellidos,
                correo: nuevoDocente.correo,
                tipo_documento: 'CC',
                numero_documento: '0000000000',
                id_contrato: 1,
                id_programa: 1,
                rol: nuevoDocente.rol
            })
            setDocentes(prev => [...prev, {
                ...res.data,
                activo: true,
                tipo_contrato: 'Tiempo Completo',
                programa: 'Ingeniería de Sistemas',
                roles: nuevoDocente.rol
            }])
            setNuevoDocente({ nombres: '', apellidos: '', correo: '', rol: 'Docente' })
            setModalAgregar(false)
        } catch {
            setError('Error al crear el docente. Verifica que el correo no esté registrado.')
        } finally {
            setGuardando(false)
        }
    }

    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ['Nombres', 'Apellidos', 'Correo', 'Rol'],
            ['Diego', 'Villarreal', 'diego@correo.com', 'Docente'],
            ['Maria', 'Gomez', 'maria@correo.com', 'Planeacion']
        ])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla Docentes")
        XLSX.writeFile(wb, "plantilla_docentes_SIGAP.xlsx")
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

            const payload = jsonData.map(row => ({
                nombres: row.Nombres || row.nombres || '',
                apellidos: row.Apellidos || row.apellidos || '',
                correo: row.Correo || row.correo || '',
                rol: row.Rol || row.rol || 'Docente'
            })).filter(u => u.nombres && u.apellidos && u.correo)

            if (payload.length === 0) {
                setError('El Excel no tiene datos válidos. Revisa las columnas (Nombres, Apellidos, Correo).')
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
        const encabezado = ['Nombres', 'Apellidos', 'Correo', 'Activo']
        const filas = docentes.map(d => [
            d.nombres,
            d.apellidos,
            d.correo,
            d.activo ? 'Sí' : 'No'
        ])
        const contenido = [encabezado, ...filas]
            .map(f => f.join(','))
            .join('\n')
        const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'docentes_SIGAP.csv'
        link.click()
        URL.revokeObjectURL(url)
    }

    return (
        <Layout rol="planeacion" path="Inicio / Dashboard">

            {/* ── Encabezado ── */}
            <div className="bg-[#1a2744] rounded-xl px-6 py-4 mb-5 flex items-center justify-between shadow-sm">
                <div>
                    <h2 className="text-white text-lg font-medium">Bienvenido, Planeación</h2>
                    <p className="text-white/50 text-xs mt-0.5">
                        Período 2025 IIP · Facultad de Ingeniería
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
                            <p className="text-xl font-black text-gray-800 tracking-tight">2025 IIP</p>
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
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <button
                                onClick={() => { setModalAgregar(true); setError('') }}
                                className="flex flex-col items-center justify-center py-5 px-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md hover:bg-blue-50/50 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                </div>
                                <span className="text-sm font-bold text-gray-800">Crear docente</span>
                                <span className="text-xs text-gray-500 mt-1 text-center">Registrar usuario manual</span>
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
                                                    <button className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                    </button>
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

            {/* ══════════ MODAL AGREGAR DOCENTE ══════════ */}
            {modalAgregar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-[#1a2744] px-6 py-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-white font-medium">Registrar nuevo docente</h3>
                                <p className="text-white/50 text-xs">Acceso inmediato al sistema</p>
                            </div>
                            <button onClick={() => setModalAgregar(false)} className="text-white/50 hover:text-white transition-colors">✕</button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombres</label>
                                    <input
                                        type="text"
                                        value={nuevoDocente.nombres}
                                        onChange={e => setNuevoDocente(p => ({ ...p, nombres: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Apellidos</label>
                                    <input
                                        type="text"
                                        value={nuevoDocente.apellidos}
                                        onChange={e => setNuevoDocente(p => ({ ...p, apellidos: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Correo institucional</label>
                                <input
                                    type="email"
                                    value={nuevoDocente.correo}
                                    onChange={e => setNuevoDocente(p => ({ ...p, correo: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rol</label>
                                <select
                                    value={nuevoDocente.rol}
                                    onChange={e => setNuevoDocente(p => ({ ...p, rol: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                                >
                                    <option value="Docente">Docente</option>
                                    <option value="Director">Director</option>
                                    <option value="Planeacion">Planeación</option>
                                </select>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                            <button onClick={() => setModalAgregar(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">Cancelar</button>
                            <button
                                onClick={handleCrear}
                                disabled={guardando}
                                className="px-5 py-2 text-sm bg-[#1a2744] text-white rounded-lg hover:bg-[#243460] transition-colors disabled:opacity-50"
                            >
                                {guardando ? 'Guardando...' : 'Registrar Docente'}
                            </button>
                        </div>
                    </div>
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
        </Layout>
    )
}