import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

interface ProtectedRouteProps {
    allowedRoles?: string[];
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
    const { isAuthenticated, user, isLoading } = useAuth();
    const location = useLocation();

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

    const [isCheckingProfile, setIsCheckingProfile] = useState(true);
    const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);

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
            if (!isDocenteRoute) {
                setIsCheckingProfile(false);
                return;
            }

            const userId = user?.id || (user as any)?.id_usuario;
            if (userId) {
                try {
                    const response = await api.get(`/usuarios/${userId}/perfil-completo`);
                    setIsProfileComplete(response.data?.perfil_completo);
                } catch (error) {
                    setIsProfileComplete(false);
                }
            } else {
                setIsProfileComplete(false);
            }
            setIsCheckingProfile(false);
        };

        checkProfile();
    }, [isDocenteRoute, user]);

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

    return <Outlet />;
};
