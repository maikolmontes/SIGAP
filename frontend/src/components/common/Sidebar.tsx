import { useState, useEffect, useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { 
    LayoutDashboard, 
    Users, 
    Library, 
    GraduationCap, 
    Calendar, 
    Clock, 
    BarChart3, 
    ClipboardList, 
    History, 
    MessageSquare, 
    FileSpreadsheet, 
    BookOpen, 
    FileText,
    Settings,
    ChevronDown,
    ChevronRight,
    Plus,
    ShieldCheck,
    Crown
} from 'lucide-react'

type MenuItem = {
    label: string;
    path?: string;
    isHeader?: boolean;
    state?: any;
    isSubItem?: boolean;
    icon?: any;
    children?: MenuItem[];
};

const menuPlaneacion: MenuItem[] = [
    { label: 'Principal', isHeader: true },
    { label: 'Dashboard', path: '/planeacion/dashboard', icon: LayoutDashboard },
    { label: 'Gestión Institucional', isHeader: true },
    { label: 'Docentes', path: '/planeacion/docentes', icon: Users },
    { label: 'Facultades', path: '/planeacion/facultades', icon: Library },
    { label: 'Programas', path: '/planeacion/programas', icon: GraduationCap },
    { label: 'Períodos', path: '/planeacion/periodos', icon: Calendar },
    { label: 'Semanas', path: '/planeacion/semanas', icon: Clock },
    { label: 'Seguridad y Accesos', isHeader: true },
    { label: 'Gestión de Perfiles', path: '/planeacion/perfiles', icon: ShieldCheck },
    { label: 'Reportes', isHeader: true },
    { label: 'Analítica', path: '/planeacion/analitica', icon: BarChart3 },
]

const menuDirector: MenuItem[] = [
    { label: 'Principal', isHeader: true },
    { label: 'Dashboard', path: '/director/dashboard', icon: LayoutDashboard },
    { label: 'Supervisión', isHeader: true },
    { label: 'Agendas por revisar', path: '/director/agendas', icon: ClipboardList },
    { label: 'Historial de agendas', path: '/director/historial', icon: History },
    { label: 'Observaciones', path: '/director/observaciones', icon: MessageSquare },
    { label: 'Reportes', isHeader: true },
    { label: 'Reportes', path: '/director/reportes', icon: FileSpreadsheet },
    { label: 'Analítica', path: '/director/analitica', icon: BarChart3 },
]

const menuDocente: MenuItem[] = [
    { label: 'Principal', isHeader: true },
    { label: 'Dashboard', path: '/docente/dashboard', icon: LayoutDashboard },
    { label: 'Agenda Académica', isHeader: true },
    { label: 'Crear o Editar agenda', path: '/docente/agenda', icon: BookOpen },
    { label: 'Registro de Actividades', isHeader: true },
    { label: 'Reporte Semana 8', path: '/docente/avance-semana-8', icon: Clock },
    { label: 'Reporte Semana 16', path: '/docente/avance-semana-16', icon: Clock },
    { label: 'Evidencias', path: '/docente/evidencias', icon: FileText },
]

const menuConsultor: MenuItem[] = [
    { label: 'Principal', isHeader: true },
    { label: 'Dashboard', path: '/consultor/dashboard', icon: LayoutDashboard },
    { label: 'Auditoría', isHeader: true },
    { label: 'Observaciones', path: '/consultor/observaciones', icon: MessageSquare },
    { label: 'Reportes', isHeader: true },
    { label: 'Analítica', path: '/consultor/analitica', icon: BarChart3 },
]

const menuDecano: MenuItem[] = [
    { label: 'Principal', isHeader: true },
    { label: 'Dashboard', path: '/decano/dashboard', icon: LayoutDashboard },
    { label: 'Supervisión Académica', isHeader: true },
    { label: 'Agendas Docentes', path: '/decano/agendas', icon: ClipboardList },
    { label: 'Observaciones', path: '/decano/observaciones', icon: MessageSquare },
]

const PATH_TO_PAGINA: Record<string, string> = {
    // Planeación
    '/planeacion/docentes': 'Docentes y Usuarios',
    '/planeacion/facultades': 'Facultades',
    '/planeacion/programas': 'Programas Académicos',
    '/planeacion/periodos': 'Períodos Académicos',
    '/planeacion/semanas': 'Semanas y Cortes',
    '/planeacion/analitica': 'Analítica y Reportes',
    '/planeacion/perfiles': 'Gestión de Perfiles y Permisos',
    '/planeacion/permisos': 'Gestión de Perfiles y Permisos',

    // Director
    '/director/agendas': 'Agendas por Revisar',
    '/director/historial': 'Historial de Agendas',
    '/director/observaciones': 'Observaciones Docentes',
    '/director/reportes': 'Reportes de Gestión',
    '/director/analitica': 'Reportes de Gestión',

    // Docente
    '/docente/agenda': 'Mi Agenda Académica',
    '/docente/avance-semana-8': 'Avance Semana 8',
    '/docente/avance-semana-16': 'Avance Semana 16',
    '/docente/evidencias': 'Evidencias e Indicadores',

    // Consultor
    '/consultor/agendas': 'Seguimiento y Auditoría',
    '/consultor/observaciones': 'Observaciones de Control',
    '/consultor/analitica': 'Analítica Institucional',
    // Decano
    '/decano/agendas':      'Agendas por Revisar',
    '/decano/observaciones':'Observaciones Docentes',
};

interface SidebarProps {
    rol: 'planeacion' | 'director' | 'docente' | 'consultor' | 'decano'
    onClose?: () => void
}

export default function Sidebar({ rol, onClose }: SidebarProps) {
    const { user } = useAuth()
    const [periodoEtiqueta, setPeriodoEtiqueta] = useState<string>('Cargando...')
    const [tienePeriodo, setTienePeriodo] = useState<boolean>(false)
    const [paginasPermitidas, setPaginasPermitidas] = useState<string[] | null>(null)
    const location = useLocation()
    const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})

    const menu = rol === 'planeacion' 
        ? menuPlaneacion 
        : rol === 'director' 
            ? menuDirector 
            : rol === 'consultor' 
                ? menuConsultor 
                : rol === 'decano'
                    ? menuDecano
                    : menuDocente
    const rolLabel = rol === 'planeacion' 
        ? 'Planeación' 
        : rol === 'director' 
            ? 'Director' 
            : rol === 'consultor' 
                ? 'Consultor' 
                : rol === 'decano'
                    ? 'Decanatura'
                    : 'Docente'

    // Cargar permisos activos asignados al rol actual
    const cargarPermisos = async () => {
        try {
            let roleId: number | null = null;
            const storedRole = localStorage.getItem('sigap_active_role');
            if (storedRole) {
                const parsed = JSON.parse(storedRole);
                roleId = parsed.id_rol;
            }
            if (!roleId) {
                if (rol === 'planeacion') roleId = 1;
                else if (rol === 'docente') roleId = 2;
                else if (rol === 'director') roleId = 3;
                else if (rol === 'consultor') roleId = 4;
                else if (rol === 'decano') roleId = 5;
            }
            if (roleId) {
                const res = await api.get(`/permisos/rol/${roleId}`);
                setPaginasPermitidas(res.data.paginasVer || []);
            }
        } catch (err) {
            console.error('Error al verificar permisos en Sidebar:', err);
        }
    };

    useEffect(() => {
        cargarPermisos();

        const handleActualizacion = () => {
            cargarPermisos();
        };

        window.addEventListener('sigap_permisos_actualizados', handleActualizacion);
        window.addEventListener('storage', handleActualizacion);

        return () => {
            window.removeEventListener('sigap_permisos_actualizados', handleActualizacion);
            window.removeEventListener('storage', handleActualizacion);
        };
    }, [rol]);

    // Filtrar items del menú según permisos de lectura (Ver)
    const menuFiltrado = useMemo(() => {
        if (!paginasPermitidas) return menu;

        // 1. Filtrar los items normales según los permisos de Ver
        const itemsValidos = menu.map(item => {
            if (item.isHeader || !item.path || item.path.includes('/dashboard') || item.path.includes('/perfiles') || item.path.includes('/permisos')) {
                return item;
            }
            const paginaRequerida = PATH_TO_PAGINA[item.path];
            if (!paginaRequerida) return item;

            const tienePermiso = paginasPermitidas.some(
                p => p.toLowerCase().trim() === paginaRequerida.toLowerCase().trim()
            );
            return tienePermiso ? item : null;
        }).filter(Boolean) as MenuItem[];

        // 2. Ocultar encabezados que se hayan quedado sin ningún item visible
        const resultado: MenuItem[] = [];
        for (let i = 0; i < itemsValidos.length; i++) {
            const curr = itemsValidos[i];
            if (curr.isHeader) {
                // Verificar si hay algún item hijo normal antes del siguiente header
                let tieneHijos = false;
                for (let j = i + 1; j < itemsValidos.length; j++) {
                    if (itemsValidos[j].isHeader) break;
                    tieneHijos = true;
                    break;
                }
                if (tieneHijos) {
                    resultado.push(curr);
                }
            } else {
                resultado.push(curr);
            }
        }

        return resultado;
    }, [menu, paginasPermitidas]);

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

    // Auto-expand menu on mount or path change if active child is found
    useEffect(() => {
        const newExpanded: Record<string, boolean> = { ...expandedItems }
        let changed = false
        menu.forEach(item => {
            if (item.children) {
                const hasActiveChild = item.children.some(child => child.path === location.pathname)
                const isActiveParent = item.path === location.pathname
                if ((hasActiveChild || isActiveParent) && !newExpanded[item.label]) {
                    newExpanded[item.label] = true
                    changed = true
                }
            }
        })
        if (changed) {
            setExpandedItems(newExpanded)
        }
    }, [location.pathname, menu])

    return (
        <aside className="w-64 h-screen overflow-y-auto bg-[#063759] flex flex-col shadow-2xl lg:shadow-none overflow-x-hidden relative">
            <div className="px-4 py-4 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#063759] z-10">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-white p-1 flex items-center justify-center shadow-md overflow-hidden shrink-0">
                        <img 
                            src="/logo_cesmag.png" 
                            alt="Universidad CESMAG" 
                            className="w-full h-full object-contain" 
                        />
                    </div>
                    <div>
                        <div className="text-white font-black text-sm tracking-wide">SIGAP</div>
                        <div className="text-white/70 text-[11px] mt-0.5 font-medium leading-tight truncate max-w-[135px]">
                            {rolLabel} {tienePeriodo && `· ${periodoEtiqueta}`}
                        </div>
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

            <div className="px-3 py-4 space-y-2">
                <div className="bg-white/10 border border-white/5 rounded-lg px-3 py-2.5">
                    <div className="text-white/40 text-[10px] uppercase font-bold tracking-wider mb-0.5">Período activo</div>
                    <div className="text-white text-sm font-medium">{periodoEtiqueta}</div>
                </div>

                {rol === 'decano' && user?.facultad && (
                    <div className="bg-emerald-500/15 border border-emerald-400/25 rounded-lg px-3 py-2">
                        <div className="text-emerald-300 text-[10px] uppercase font-bold tracking-wider mb-0.5 flex items-center gap-1">
                            <span>🏛️</span> Facultad
                        </div>
                        <div className="text-white text-xs font-semibold leading-snug">{user.facultad}</div>
                    </div>
                )}
            </div>

            <nav className="flex-1 px-3 pb-8">
                {menuFiltrado.map((item, idx) => {
                    if (item.isHeader) {
                        return (
                            <div key={`header-${idx}`} className="text-white/30 text-[10px] uppercase tracking-widest px-2 mb-2 mt-5 font-bold">
                                {item.label}
                            </div>
                        )
                    }

                    if (item.children) {
                        const isExpanded = !!expandedItems[item.label]
                        return (
                            <div key={`parent-${idx}`} className="space-y-1">
                                <NavLink
                                    to={item.path!}
                                    state={item.state}
                                    onClick={() => {
                                        setExpandedItems(prev => ({
                                            ...prev,
                                            [item.label]: !prev[item.label]
                                        }))
                                    }}
                                    className={({ isActive }) =>
                                        `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm mb-1 transition-all group
                                        ${isActive 
                                            ? 'bg-white/10 text-white border-l-[3px] border-[#4A9BE8] font-medium'
                                            : 'text-white/60 hover:bg-white/5 hover:text-white border-l-[3px] border-transparent'
                                        }`
                                    }
                                >
                                    {({ isActive }) => (
                                        <>
                                            <div className="flex items-center gap-3">
                                                {item.icon && (
                                                    <item.icon 
                                                        className={`w-4 h-4 transition-colors ${
                                                            isActive ? 'text-white' : 'text-white/60 group-hover:text-white'
                                                        }`} 
                                                    />
                                                )}
                                                <span>{item.label}</span>
                                            </div>
                                            {isExpanded ? (
                                                <ChevronDown className="w-3.5 h-3.5 text-white/50 group-hover:text-white transition-transform" />
                                            ) : (
                                                <ChevronRight className="w-3.5 h-3.5 text-white/50 group-hover:text-white transition-transform" />
                                            )}
                                        </>
                                    )}
                                </NavLink>
                                
                                {isExpanded && (
                                    <div className="pl-5 space-y-1 border-l border-white/10 ml-5 my-1 animate-fadeIn duration-200">
                                        {item.children.map((child, cIdx) => (
                                            <NavLink
                                                key={`child-${idx}-${cIdx}`}
                                                to={child.path!}
                                                state={child.state}
                                                className={({ isActive }) =>
                                                    `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all group
                                                    ${isActive && !child.state?.openAddModal
                                                        ? 'bg-white/5 text-white font-medium'
                                                        : 'text-white/50 hover:bg-white/5 hover:text-white'
                                                    }`
                                                }
                                            >
                                                {child.icon && (
                                                    <child.icon className="w-3 h-3 text-white/40 group-hover:text-white transition-colors" />
                                                )}
                                                <span>{child.label}</span>
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    }

                    return (
                        <NavLink
                            key={`link-${idx}`}
                            to={item.path!}
                            state={item.state}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 transition-all group
                                ${isActive && !item.isSubItem
                                    ? 'bg-white/10 text-white border-l-[3px] border-[#4A9BE8] font-medium'
                                    : item.isSubItem
                                        ? 'text-white/60 hover:bg-white/5 hover:text-white pl-8 py-1.5 text-xs'
                                        : 'text-white/60 hover:bg-white/5 hover:text-white border-l-[3px] border-transparent'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    {item.isSubItem && <span className="text-[10px] opacity-70">➕</span>}
                                    {item.icon && (
                                        <item.icon 
                                            className={`w-4 h-4 transition-colors ${
                                                isActive ? 'text-white' : 'text-white/60 group-hover:text-white'
                                            }`} 
                                        />
                                    )}
                                    <span>{item.label}</span>
                                </>
                            )}
                        </NavLink>
                    )
                })}
            </nav>

            <div className="px-4 py-4 border-t border-white/10 text-white/40 text-xs text-center sticky bottom-0 bg-[#063759]">
                CESMAG · v1.0
            </div>
        </aside>
    )
}