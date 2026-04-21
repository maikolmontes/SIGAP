import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, Settings, Eye, ChevronRight } from 'lucide-react';

interface Rol {
  id_rol: number;
  nombre_rol: string;
  descripcion_rol: string;
}

const RoleSelection = () => {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const token = localStorage.getItem('sigap_token');
        if (!token) {
            navigate('/login');
            return;
        }

        const response = await fetch('http://localhost:3000/api/user/roles', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error('No se pudieron obtener los roles');
        }

        const data = await response.json();
        
        if (data.length === 1) {
          handleRoleSelection(data[0]);
        } else {
          setRoles(data);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error cargando roles', error);
        setIsLoading(false);
      }
    };

    fetchRoles();
  }, [navigate]);

  const getRoleIcon = (nombreRol: string) => {
    const rolLower = nombreRol.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (rolLower.includes('docente')) return <BookOpen className="w-8 h-8" />;
    if (rolLower.includes('director')) return <Users className="w-8 h-8" />;
    if (rolLower.includes('planeacion') || rolLower.includes('admin')) return <Settings className="w-8 h-8" />;
    return <Eye className="w-8 h-8" />; 
  };

  const handleRoleSelection = (rolItem: Rol | null = null) => {
    const finalRole = rolItem || roles.find(r => r.id_rol === selectedRoleId);
    if (!finalRole) return;

    localStorage.setItem('sigap_active_role', JSON.stringify(finalRole));

    const nombreNormalizado = finalRole.nombre_rol.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (nombreNormalizado.includes('docente')) navigate('/docente/dashboard');
    else if (nombreNormalizado.includes('director')) navigate('/director/dashboard');
    else if (nombreNormalizado.includes('planeacion') || nombreNormalizado.includes('admin')) navigate('/planeacion/dashboard');
    else navigate('/');
  };

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-gray-500">Cargando perfiles...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
          Selecciona tu perfil
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Tienes acceso a múltiples módulos académicos. ¿Cómo deseas ingresar hoy?
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {roles.map((rol) => {
              const isSelected = selectedRoleId === rol.id_rol;
              return (
                <div
                  key={rol.id_rol}
                  onClick={() => setSelectedRoleId(rol.id_rol)}
                  className={`
                    relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 ease-in-out
                    flex flex-col items-center text-center gap-3
                    ${isSelected 
                      ? 'border-indigo-600 bg-indigo-50 shadow-md transform scale-[1.02]' 
                      : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <div className={`${isSelected ? 'text-indigo-600' : 'text-gray-500'}`}>
                    {getRoleIcon(rol.nombre_rol)}
                  </div>
                  <div>
                    <h3 className={`font-bold text-lg ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                      {rol.nombre_rol}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {rol.descripcion_rol || 'Acceso a las funcionalidades del módulo.'}
                    </p>
                  </div>
                </div>
              );
            })}

          </div>

          <div className="mt-8">
            <button
              onClick={() => handleRoleSelection(null)}
              disabled={!selectedRoleId}
              className={`
                w-full flex justify-center items-center py-3 px-4 rounded-md shadow-sm text-sm font-medium text-white 
                transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
                ${selectedRoleId 
                  ? 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer' 
                  : 'bg-gray-300 cursor-not-allowed'
                }
              `}
            >
              Continuar al Dashboard
              <ChevronRight className="ml-2 w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
