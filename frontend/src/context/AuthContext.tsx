import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: number;
  correo: string;
  roles: string;
  nombres?: string;
  apellidos?: string;
  imagen_perfil?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('sigap_token');
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('sigap_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  // Control de inactividad de sesión (3 minutos = 180,000 ms)
  useEffect(() => {
    if (!token) return;

    const INACTIVITY_LIMIT_MS = 3 * 60 * 1000; // 3 minutos
    let timer: any = null;

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // Expirar sesión
        setToken(null);
        setUser(null);
        localStorage.removeItem('sigap_token');
        localStorage.removeItem('sigap_user');
        localStorage.removeItem('sigap_active_role');
        navigate('/login', { 
          replace: true, 
          state: { mensajeInactividad: 'Tu sesión ha expirado por inactividad (3 minutos).' } 
        });
      }, INACTIVITY_LIMIT_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    
    // Throttle de eventos para no reiniciar el timer en cada milisegundo de movimiento
    let lastActivity = Date.now();
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastActivity > 1000) {
        lastActivity = now;
        resetTimer();
      }
    };

    events.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));
    resetTimer();

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach(evt => window.removeEventListener(evt, handleUserActivity));
    };
  }, [token, navigate]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('sigap_token', newToken);
    localStorage.setItem('sigap_user', JSON.stringify(newUser));

    // Dirigir al usuario al gestor de roles para evaluar si tiene uno o múltiples perfiles
    navigate('/role-selection', { replace: true });
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('sigap_token');
    localStorage.removeItem('sigap_user');
    localStorage.removeItem('sigap_active_role');
    navigate('/login', { replace: true });
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      isAuthenticated: !!token,
      isLoading
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
