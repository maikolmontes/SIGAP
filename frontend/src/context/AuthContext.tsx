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
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Restaurar sesión desde localStorage al cargar
    const storedToken = localStorage.getItem('sigap_token');
    const storedUser = localStorage.getItem('sigap_user');

    if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

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
