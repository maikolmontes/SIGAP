import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import api from '../../services/api'

type MenuItem = {
    label: string;
    path?: string;
    isHeader?: boolean;
};

const menuPlaneacion: MenuItem[] = [
    { label: 'Principal', isHeader: true },
    { label: 'Dashboard', path: '/planeacion/dashboard' },
    { label: 'Gestión Institucional', isHeader: true },
    { label: 'Docentes', path: '/planeacion/docentes' },
    { label: 'Períodos', path: '/planeacion/periodos' },
    { label: 'Semanas', path: '/planeacion/semanas' },
    { label: 'Reportes', isHeader: true },
    { label: 'Analítica', path: '/planeacion/analitica' },
]

const menuDirector: MenuItem[] = [
    { label: 'Principal', isHeader: true },
    { label: 'Dashboard', path: '/director/dashboard' },
    { label: 'Supervisión', isHeader: true },
    { label: 'Agendas', path: '/director/agendas' },
    { label: 'Observaciones', path: '/director/observaciones' },
]

const menuDocente: MenuItem[] = [
    { label: 'Principal', isHeader: true },
    { label: 'Dashboard', path: '/docente/dashboard' },
    { label: 'Agenda Académica', isHeader: true },
    { label: 'Crear o Editar agenda', path: '/docente/agenda' },
    { label: 'Distribución de horas', path: '/docente/distribucion-horas' },
    { label: 'Registro de Actividades', isHeader: true },
    { label: 'Reporte Semana 8', path: '/docente/avance-semana-8' },
    { label: 'Reporte Semana 16', path: '/docente/avance-semana-16' },
    { label: 'Evidencias', path: '/docente/evidencias' },
    { label: 'Consultar', isHeader: true },
    { label: 'Estado de agenda', path: '/docente/estado-agenda' },
    { label: 'Historial', path: '/docente/historial' },
]

interface SidebarProps {
    rol: 'planeacion' | 'director' | 'docente'
    onClose?: () => void
}

export default function Sidebar({ rol, onClose }: SidebarProps) {
    const [periodoEtiqueta, setPeriodoEtiqueta] = useState<string>('Cargando...')
    const [tienePeriodo, setTienePeriodo] = useState<boolean>(false)
    const menu = rol === 'planeacion' ? menuPlaneacion : rol === 'director' ? menuDirector : menuDocente
    const rolLabel = rol === 'planeacion' ? 'Planeación' : rol === 'director' ? 'Director' : 'Docente'

    useEffect(() => {
        const fetchPeriodoActivo = async () => {
            try {
                const res = await api.get('/periodos')
                const activo = res.data.find((p: any) => p.activo)
                if (activo) {
                    setPeriodoEtiqueta(`${activo.anio}-${activo.semestre === 1 ? 'I' : 'II'}`)
                    setTienePeriodo(true)
                } else {
                    setPeriodoEtiqueta('Sin período activo')
                    setTienePeriodo(false)
                }
            } catch (error) {
                console.error("Error cargando periodo en sidebar:", error)
                setPeriodoEtiqueta('Desconocido')
                setTienePeriodo(false)
            }
        }
        fetchPeriodoActivo()
    }, [])

    return (
        <aside className="w-64 h-screen overflow-y-auto bg-[#063759] flex flex-col shadow-2xl lg:shadow-none overflow-x-hidden relative">
            <div className="px-4 py-5 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#063759] z-10">
                <div>
                    <div className="text-white font-bold text-sm tracking-wide">SIGAP</div>
                    <div className="text-white/60 text-xs mt-0.5">
                        {rolLabel} {tienePeriodo && `· ${periodoEtiqueta}`}
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="lg:hidden text-white/50 hover:text-white p-1 rounded-md transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            <div className="px-3 py-4">
                <div className="bg-white/10 border border-white/5 rounded-lg px-3 py-2.5">
                    <div className="text-white/40 text-[10px] uppercase font-bold tracking-wider mb-0.5">Período activo</div>
                    <div className="text-white text-sm font-medium">{periodoEtiqueta}</div>
                </div>
            </div>

            <nav className="flex-1 px-3 pb-8">
                {menu.map((item, idx) => (
                    item.isHeader ? (
                        <div key={`header-${idx}`} className="text-white/30 text-[10px] uppercase tracking-widest px-2 mb-2 mt-5 font-bold">
                            {item.label}
                        </div>
                    ) : (
                        <NavLink
                            key={`link-${idx}`}
                            to={item.path!}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 transition-all group
                                ${isActive
                                    ? 'bg-white/10 text-white border-l-[3px] border-[#4A9BE8] font-medium'
                                    : 'text-white/60 hover:bg-white/5 hover:text-white border-l-[3px] border-transparent'
                                }`
                            }
                        >
                            {item.label}
                        </NavLink>
                    )
                ))}
            </nav>

            <div className="px-4 py-4 border-t border-white/10 text-white/40 text-xs text-center sticky bottom-0 bg-[#063759]">
                CESMAG · v1.0
            </div>
        </aside>
    )
}