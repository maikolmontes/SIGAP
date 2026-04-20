import { useEffect, useState } from 'react'
import Layout from '../../components/common/Layout'
import * as XLSX from 'xlsx'
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

interface NuevoDocente {
    nombres: string
    apellidos: string
    correo: string
    rol: string
}

export default function DashboardPlaneacion() {
    const [docentes, setDocentes] = useState<Docente[]>([])
    const [busqueda, setBusqueda] = useState('')
    const [filtroEstado, setFiltroEstado] = useState<'Todos'|'Activos'|'Inactivos'>('Todos')
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')
    const [modalAgregar, setModalAgregar] = useState(false)
    const [modalImportar, setModalImportar] = useState(false)
    const [archivoImportar, setArchivoImportar] = useState<File | null>(null)
    const [importando, setImportando] = useState(false)
    const [guardando, setGuardando] = useState(false)
    const [editandoId, setEditandoId] = useState<number | null>(null)

    const [nuevoDocente, setNuevoDocente] = useState<NuevoDocente>({
        nombres: '',
        apellidos: '',
        correo: '',
        rol: 'Docente'
    })

    useEffect(() => {
        cargarDocentes()
    }, [])

    const cargarDocentes = async () => {
        try {
            setCargando(true)
            const res = await getUsuarios()
            setDocentes(res.data)
        } catch {
            setError('No se pudieron cargar los docentes')
        } finally {
            setCargando(false)
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
                id_programa: 1
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

            if(payload.length === 0) {
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
            <div className="bg-[#1a2744] rounded-xl px-6 py-4 mb-5 flex items-center justify-between">
                <div>
                    <h2 className="text-white text-lg font-medium">Bienvenido, Planeación</h2>
                    <p className="text-white/50 text-xs mt-0.5">
                        Período 2025 IIP · Facultad de Ingeniería
                    </p>
                </div>
                <div className="text-white/30 text-xs text-right">
                    <div className="text-white/60 text-sm font-medium">{docentes.length} docentes</div>
                    <div>registrados</div>
                </div>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex justify-between items-center">
                    {error}
                    <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 font-bold ml-4">✕</button>
                </div>
            )}

            {/* ── Barra de acciones ── */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">

                {/* Buscador */}
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

                {/* Filtro de Estado */}
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

                {/* Botones */}
                <div className="flex gap-2 flex-shrink-0">

                    {/* Importar Excel */}
                    <button
                        onClick={() => setModalImportar(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm border border-green-600 text-green-700 rounded-lg hover:bg-green-50 transition-colors font-medium"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Importar Excel
                    </button>

                    {/* Exportar Excel */}
                    <button
                        onClick={handleExportar}
                        className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Exportar Excel
                    </button>

                    {/* Agregar Docente */}
                    <button
                        onClick={() => { setModalAgregar(true); setError('') }}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-[#1a2744] text-white rounded-lg hover:bg-[#243460] transition-colors font-medium"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Agregar docente
                    </button>
                </div>
            </div>

            {/* ── Tabla de docentes ── */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {cargando ? (
                    <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                        Cargando docentes...
                    </div>
                ) : docentesFiltrados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <svg className="w-10 h-10 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-sm">No se encontraron docentes</p>
                        {busqueda && (
                            <button onClick={() => setBusqueda('')} className="text-blue-500 text-xs mt-1 hover:underline">
                                Limpiar búsqueda
                            </button>
                        )}
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-1/4">Nombres</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-1/4">Apellidos</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-1/3">Correo</th>
                                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 w-20">Estado</th>
                                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 w-20">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {docentesFiltrados.map((d, i) => (
                                <tr
                                    key={d.id_usuario}
                                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}
                                >
                                    <td className="px-4 py-3 font-medium text-gray-800">{d.nombres}</td>
                                    <td className="px-4 py-3 text-gray-700">{d.apellidos}</td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">{d.correo}</td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => handleToggle(d.id_usuario)}
                                            disabled={editandoId === d.id_usuario}
                                            title={d.activo ? 'Desactivar docente' : 'Activar docente'}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none
                        ${d.activo ? 'bg-green-500' : 'bg-gray-300'}
                        ${editandoId === d.id_usuario ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                        >
                                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
                        ${d.activo ? 'translate-x-4' : 'translate-x-1'}`}
                                            />
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            title="Editar docente"
                                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* Footer tabla */}
                {!cargando && docentesFiltrados.length > 0 && (
                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                        <span>Mostrando {docentesFiltrados.length} de {docentes.length} docentes</span>
                        <span>{docentes.filter(d => d.activo).length} activos · {docentes.filter(d => !d.activo).length} inactivos</span>
                    </div>
                )}
            </div>

            {/* ══════════ MODAL AGREGAR DOCENTE ══════════ */}
            {modalAgregar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">

                        {/* Header modal */}
                        <div className="bg-[#1a2744] px-6 py-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-white font-medium text-sm">Registrar nuevo docente</h3>
                                <p className="text-white/50 text-xs mt-0.5">Solo necesitas nombre, apellidos, rol y correo</p>
                            </div>
                            <button onClick={() => { setModalAgregar(false); setError('') }} className="text-white/50 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Body modal */}
                        <div className="px-6 py-5 space-y-4">
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-lg">
                                    {error}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombres</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Diego Javier"
                                        value={nuevoDocente.nombres}
                                        onChange={e => setNuevoDocente(p => ({ ...p, nombres: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Apellidos</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Villarreal Moreno"
                                        value={nuevoDocente.apellidos}
                                        onChange={e => setNuevoDocente(p => ({ ...p, apellidos: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Correo institucional Google</label>
                                <input
                                    type="email"
                                    placeholder="correo@unicesmag.edu.co"
                                    value={nuevoDocente.correo}
                                    onChange={e => setNuevoDocente(p => ({ ...p, correo: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                                />
                                <p className="text-xs text-gray-400 mt-1">Este correo es el que el docente usará para iniciar sesión con Google</p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
                                <select
                                    value={nuevoDocente.rol}
                                    onChange={e => setNuevoDocente(p => ({ ...p, rol: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white"
                                >
                                    <option value="Docente">Docente</option>
                                    <option value="Director">Director</option>
                                    <option value="Planeacion">Planeación</option>
                                </select>
                            </div>

                            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700">
                                El docente completará el resto de su perfil cuando inicie sesión por primera vez (contrato, nivel académico, etc.)
                            </div>
                        </div>

                        {/* Footer modal */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => { setModalAgregar(false); setError('') }}
                                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCrear}
                                disabled={guardando}
                                className="px-5 py-2 text-sm bg-[#1a2744] text-white rounded-lg hover:bg-[#243460] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {guardando ? (
                                    <>
                                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        Guardando...
                                    </>
                                ) : 'Guardar docente'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════ MODAL IMPORTAR EXCEL ══════════ */}
            {modalImportar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">

                        <div className="bg-[#1a2744] px-6 py-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-white font-medium text-sm">Importar docentes desde Excel</h3>
                                <p className="text-white/50 text-xs mt-0.5">Sube un archivo .xlsx o .csv</p>
                            </div>
                            <button onClick={() => { setModalImportar(false); setArchivoImportar(null); setError('') }} className="text-white/50 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-300 transition-colors cursor-pointer group">
                                <svg className="w-10 h-10 text-gray-300 group-hover:text-blue-400 transition-colors mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-sm font-medium text-gray-600 mb-1">
                                    {archivoImportar ? archivoImportar.name : 'Arrastra tu archivo aquí'}
                                </p>
                                {!archivoImportar && <p className="text-xs text-gray-400 mb-3">o haz clic para seleccionar</p>}
                                <input 
                                    type="file" 
                                    accept=".xlsx,.csv" 
                                    className="hidden" 
                                    id="file-import" 
                                    onChange={(e) => setArchivoImportar(e.target.files ? e.target.files[0] : null)}
                                />
                                <label htmlFor="file-import" className="px-4 py-2 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors mt-2 inline-block">
                                    {archivoImportar ? 'Elegir otro archivo' : 'Seleccionar archivo'}
                                </label>
                            </div>

                            <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-500">
                                <p className="font-medium text-gray-700 mb-1">Columnas requeridas en el archivo:</p>
                                <div className="flex gap-2 flex-wrap">
                                    {['Nombres', 'Apellidos', 'Correo'].map(col => (
                                        <span key={col} className="bg-white border border-gray-200 rounded px-2 py-0.5 font-medium text-gray-600">
                                            {col}
                                        </span>
                                    ))}
                                </div>
                                <button type="button" onClick={handleDownloadTemplate} className="text-blue-500 hover:underline mt-2 block">
                                    Descargar plantilla de ejemplo ↓
                                </button>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => { setModalImportar(false); setArchivoImportar(null); setError('') }}
                                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleImportSubmit}
                                disabled={importando || !archivoImportar}
                                className="px-5 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {importando ? (
                                    <>
                                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        Importando...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        Importar docentes
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