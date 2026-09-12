import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: number;
  correo: string;
  roles: string;
  nombres?: string;
  apellidos?: string;
  imagen_perfil?: string;
  facultad?: string;
  id_facultad?: number;
  programa?: string;
  id_programa?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  // Modal de sesión por expirar
  showTimeoutModal: boolean;
  timeoutSeconds: number;
  extendSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Configuración de tiempos
const INACTIVITY_LIMIT_MS  = 4 * 60 * 1000;  // 4 minutos total de inactividad
const WARNING_BEFORE_MS    = 60 * 1000;        // Mostrar modal 60 s antes de expirar
const WARNING_SECONDS      = 60;               // Cuenta regresiva en el modal

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser]           = useState<User | null>(null);
  const [token, setToken]         = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showTimeoutModal, setShowTimeoutModal] = useState<boolean>(false);
  const [timeoutSeconds, setTimeoutSeconds]     = useState<number>(WARNING_SECONDS);

  const navigate    = useNavigate();
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivity = useRef<number>(Date.now());

  // ──────────────────────────────────────────────
  // Ejecutar cierre de sesión definitivo
  // ──────────────────────────────────────────────
  const performLogout = useCallback((motivo = 'inactividad') => {
    setToken(null);
    setUser(null);
    setShowTimeoutModal(false);
    localStorage.removeItem('sigap_token');
    localStorage.removeItem('sigap_user');
    localStorage.removeItem('sigap_active_role');
    navigate('/login', {
      replace: true,
      state: motivo === 'inactividad'
        ? { mensajeInactividad: 'Tu sesión ha expirado por inactividad (4 minutos).' }
        : undefined,
    });
  }, [navigate]);

  // ──────────────────────────────────────────────
  // Limpiar todos los timers
  // ──────────────────────────────────────────────
  const clearAllTimers = useCallback(() => {
    if (timerRef.current)   clearTimeout(timerRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    timerRef.current   = null;
    warningRef.current = null;
  }, []);

  // ──────────────────────────────────────────────
  // Reiniciar el ciclo de timers
  // ──────────────────────────────────────────────
  const resetTimers = useCallback(() => {
    clearAllTimers();
    setShowTimeoutModal(false);
    setTimeoutSeconds(WARNING_SECONDS);

    // Timer de advertencia: se dispara (INACTIVITY_LIMIT - WARNING_BEFORE) ms después
    warningRef.current = setTimeout(() => {
      setShowTimeoutModal(true);
      setTimeoutSeconds(WARNING_SECONDS);
    }, INACTIVITY_LIMIT_MS - WARNING_BEFORE_MS);

    // Timer de expiración definitiva
    timerRef.current = setTimeout(() => {
      performLogout('inactividad');
    }, INACTIVITY_LIMIT_MS);
  }, [clearAllTimers, performLogout]);

  // ──────────────────────────────────────────────
  // Restaurar sesión al cargar
  // ──────────────────────────────────────────────
  useEffect(() => {
    const storedToken = localStorage.getItem('sigap_token');
    const storedUser  = localStorage.getItem('sigap_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  // ──────────────────────────────────────────────
  // Listener de actividad del usuario
  // ──────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      clearAllTimers();
      setShowTimeoutModal(false);
      return;
    }

    const handleActivity = () => {
      const now = Date.now();
      // Throttle: solo reiniciar si pasó más de 1 segundo desde la última actividad
      // y el modal NO está visible (si ya apareció el modal, la actividad no lo oculta)
      if (now - lastActivity.current > 1000 && !showTimeoutModal) {
        lastActivity.current = now;
        resetTimers();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));

    // Iniciar al montar / cuando el token cambia
    resetTimers();

    return () => {
      clearAllTimers();
      events.forEach(evt => window.removeEventListener(evt, handleActivity));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ──────────────────────────────────────────────
  // Extender sesión (botón "Continuar" del modal)
  // ──────────────────────────────────────────────
  const extendSession = useCallback(() => {
    lastActivity.current = Date.now();
    resetTimers();
  }, [resetTimers]);

  // ──────────────────────────────────────────────
  // Login
  // ──────────────────────────────────────────────
  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('sigap_token', newToken);
    localStorage.setItem('sigap_user', JSON.stringify(newUser));
    navigate('/role-selection', { replace: true });
  };

  // ──────────────────────────────────────────────
  // Logout manual
  // ──────────────────────────────────────────────
  const logout = useCallback(() => {
    performLogout('manual');
  }, [performLogout]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      isAuthenticated: !!token,
      isLoading,
      showTimeoutModal,
      timeoutSeconds,
      extendSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
