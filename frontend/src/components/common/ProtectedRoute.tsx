import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { ShieldOff, Home } from 'lucide-react';

interface ProtectedRouteProps {
    allowedRoles?: string[];
}

// Mapa de rutas → nombre de página en el catálogo de permisos
const RUTA_PAGINA_MAP: Record<string, string> = {
    '/planeacion/docentes': 'Docentes y Usuarios',
    '/planeacion/facultades': 'Facultades',
    '/planeacion/programas': 'Programas',
    '/planeacion/periodos': 'Períodos Académicos',
    '/planeacion/gestion-perfiles': 'Gestión de Perfiles',
    '/planeacion/dashboard': 'Dashboard Planeación',
    '/docente/avance-semana-1': 'Avance Semana 1',
    '/docente/avance-semana-2': 'Avance Semana 2',
    '/docente/avance-semana-3': 'Avance Semana 3',
    '/docente/avance-semana-4': 'Avance Semana 4',
    '/docente/avance-semana-5': 'Avance Semana 5',
    '/docente/avance-semana-6': 'Avance Semana 6',
    '/docente/avance-semana-7': 'Avance Semana 7',
    '/docente/avance-semana-8': 'Avance Semana 8',
    '/docente/avance-semana-9': 'Avance Semana 9',
    '/docente/avance-semana-10': 'Avance Semana 10',
    '/docente/avance-semana-11': 'Avance Semana 11',
    '/docente/avance-semana-12': 'Avance Semana 12',
    '/docente/avance-semana-13': 'Avance Semana 13',
    '/docente/avance-semana-14': 'Avance Semana 14',
    '/docente/avance-semana-15': 'Avance Semana 15',
    '/docente/avance-semana-16': 'Avance Semana 16',
    '/docente/agenda': 'Agenda Docente',
    '/docente/evidencias': 'Evidencias',
    '/director/dashboard': 'Dashboard Director',
    '/director/agenda': 'Agenda Director',
    '/consultor/dashboard': 'Dashboard Consultor',
    '/decano/dashboard': 'Dashboard Decano',
    '/decano/agendas': 'Agendas Decano',
    '/decano/observaciones': 'Observaciones Decano',
};

// Componente de Acceso Restringido
const AccesoRestringido = ({ pagina }: { pagina: string }) => (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="bg-white border border-red-100 rounded-2xl shadow-xl p-10 flex flex-col items-center gap-5 max-w-md w-full mx-4">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
                <ShieldOff className="w-10 h-10 text-red-500" />
            </div>
            <div className="text-center">
                <h2 className="text-xl font-bold text-gray-800 mb-2">Acceso Restringido</h2>
                <p className="text-gray-500 text-sm leading-relaxed">
                    Tu rol activo no tiene permiso de <strong>Ver</strong> el módulo{' '}
                    <strong className="text-gray-700">"{pagina}"</strong>. Contacta con el administrador
                    de planeación si crees que esto es un error.
                </p>
            </div>
            <button
                onClick={() => window.history.back()}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1a2744] hover:bg-[#0d162a] text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
            >
                <Home className="w-4 h-4" />
                Regresar
            </button>
        </div>
    </div>
);

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
    const { isAuthenticated, user, isLoading } = useAuth();
    const location = useLocation();

    // Estado para perfil docente
    const [isCheckingProfile, setIsCheckingProfile] = useState(true);
    const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);

    // Estado para verificación de permisos
    const [isCheckingPermisos, setIsCheckingPermisos] = useState(true);
    const [tienePermiso, setTienePermiso] = useState<boolean | null>(null);
    const [nombrePaginaActual, setNombrePaginaActual] = useState('');

    // Para proteger las rutas del docente si su perfil está incompleto
    const activeRole = (() => {
        try {
            const stored = localStorage.getItem('sigap_active_role');
            if (stored) {
                return JSON.parse(stored).nombre_rol?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
            }
        } catch { /* ignore */ }
        return user?.roles?.toLowerCase() || '';
    })();

    const isDocenteRoute = activeRole.includes('docente') && !location.pathname.includes('/perfil');

    useEffect(() => {
        const checkProfile = async () => {
            if (isLoading || !isAuthenticated || !user) {
                return;
            }

            if (!isDocenteRoute) {
                setIsCheckingProfile(false);
                return;
            }

            const userId = user?.id || (user as any)?.id_usuario;
            const token = localStorage.getItem('sigap_token');
            if (userId && token) {
                try {
                    const response = await api.get(`/usuarios/${userId}/perfil-completo`);
                    setIsProfileComplete(response.data.perfil_completo);
                } catch (error) {
                    setIsProfileComplete(false);
                }
            } else {
                setIsProfileComplete(false);
            }
            setIsCheckingProfile(false);
        };

        checkProfile();
    }, [isDocenteRoute, user, isLoading, isAuthenticated]);

    // Verificar permiso de "Ver" para la página actual
    useEffect(() => {
        const verificarPermisoPagina = async () => {
            if (isLoading || !isAuthenticated || !user) {
                return;
            }

            // Determinar nombre de página desde la ruta actual
            const pathname = location.pathname;
            
            // Buscar coincidencia exacta o parcial en el mapa
            let nombrePagina = '';
            for (const [ruta, nombre] of Object.entries(RUTA_PAGINA_MAP)) {
                if (pathname === ruta || pathname.startsWith(ruta + '/')) {
                    nombrePagina = nombre;
                    break;
                }
            }

            // Si no hay mapa para esta ruta, no restringir
            if (!nombrePagina) {
                setTienePermiso(true);
                setIsCheckingPermisos(false);
                return;
            }

            setNombrePaginaActual(nombrePagina);

            // Obtener rol activo
            let roleId: number | null = null;
            try {
                const stored = localStorage.getItem('sigap_active_role');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    roleId = parsed.id_rol;
                }
            } catch { /* ignore */ }

            // Si no hay roleId, el usuario es superadmin o tiene acceso total
            if (!roleId) {
                setTienePermiso(true);
                setIsCheckingPermisos(false);
                return;
            }

            try {
                const res = await api.get(`/permisos/rol/${roleId}`);
                const mapa = res.data.mapaPermisos || {};

                // Si el rol no tiene NINGÚN permiso configurado, dar acceso total (no restringir)
                if (Object.keys(mapa).length === 0) {
                    setTienePermiso(true);
                    setIsCheckingPermisos(false);
                    return;
                }

                const targetLow = nombrePagina.toLowerCase().trim();
                
                let listaAcciones: string[] = mapa[nombrePagina] || [];
                if (listaAcciones.length === 0) {
                    const foundKey = Object.keys(mapa).find(k =>
                        k.toLowerCase().trim() === targetLow ||
                        k.toLowerCase().includes(targetLow) ||
                        targetLow.includes(k.toLowerCase())
                    );
                    if (foundKey) listaAcciones = mapa[foundKey] || [];
                }

                // Si esta página específica no aparece en el mapa (no está configurada), permitir acceso
                // Solo bloquear si la página SÍ aparece y "Ver" está explícitamente ausente
                if (listaAcciones.length === 0) {
                    setTienePermiso(true);
                } else {
                    setTienePermiso(listaAcciones.includes('Ver'));
                }
            } catch (err) {
                // En caso de fallo de red, permitir acceso
                setTienePermiso(true);
            }

            setIsCheckingPermisos(false);
        };

        verificarPermisoPagina();
    }, [location.pathname, isLoading, isAuthenticated, user]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Si se especificaron roles permitidos, verificar que el usuario tenga al menos uno
    if (allowedRoles && user?.roles) {
        const hasRole = allowedRoles.some(role => user.roles.includes(role));
        if (!hasRole) {
            return <Navigate to="/login" replace />;
        }
    }

    // Loading para verificación de perfil docente
    if (isDocenteRoute && isCheckingProfile) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (isDocenteRoute && isProfileComplete === false) {
        return <Navigate to="/perfil" replace />;
    }

    // Loading para verificación de permisos
    if (isCheckingPermisos) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // Sin permiso de Ver
    if (tienePermiso === false) {
        return <AccesoRestringido pagina={nombrePaginaActual} />;
    }

    return <Outlet />;
};
