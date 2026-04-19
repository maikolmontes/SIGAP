import { NavLink } from 'react-router-dom'

const menuPlaneacion = [
    { label: 'Dashboard', path: '/planeacion/dashboard' },
    { label: 'Docentes', path: '/planeacion/docentes' },
    { label: 'Períodos', path: '/planeacion/periodos' },
    { label: 'Semanas', path: '/planeacion/semanas' },
    { label: 'Analítica', path: '/planeacion/analitica' },
]

const menuDirector = [
    { label: 'Dashboard', path: '/director/dashboard' },
    { label: 'Agendas', path: '/director/agendas' },
    { label: 'Observaciones', path: '/director/observaciones' },
]

interface SidebarProps {
    rol: 'planeacion' | 'director'
}

export default function Sidebar({ rol }: SidebarProps) {
    const menu = rol === 'planeacion' ? menuPlaneacion : menuDirector
    const rolLabel = rol === 'planeacion' ? 'Planeación' : 'Director'

    return (
        <aside className="w-52 min-h-screen bg-[#063759] flex flex-col">
            <div className="px-4 py-5 border-b border-white/10">
                <div className="text-white font-medium text-sm">SIGAP</div>
                <div className="text-white/50 text-xs mt-1">{rolLabel} · 2025 IIP</div>
            </div>

            <div className="px-3 py-3">
                <div className="bg-white/10 rounded-lg px-3 py-2">
                    <div className="text-white/40 text-xs">Período activo</div>
                    <div className="text-white text-xs font-medium">2025 IIP</div>
                </div>
            </div>

            <nav className="flex-1 px-2 pb-4">
                <div className="text-white/30 text-xs uppercase tracking-widest px-2 mb-2 mt-2">
                    Principal
                </div>
                {menu.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-1 transition-all
              ${isActive
                                ? 'bg-white/10 text-white border-l-2 border-[#4A9BE8]'
                                : 'text-white/60 hover:bg-white/5 hover:text-white'
                            }`
                        }
                    >
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            <div className="px-4 py-3 border-t border-white/10 text-white/40 text-xs">
                CESMAG · v1.0
            </div>
        </aside>
    )
}