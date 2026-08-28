import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, Settings, Eye, ChevronRight, LogOut, Check, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

interface Rol {
  id_rol: number;
  nombre_rol: string;
  descripcion_rol: string;
}

const RoleSelection = () => {
  const { user, logout } = useAuth();
  const [roles, setRoles] = useState<Rol[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [enteringRoleId, setEnteringRoleId] = useState<number | null>(null);
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

        const response = await api.get('/user/roles');
        const data = response.data;
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
    if (rolLower.includes('docente')) return <BookOpen className="w-6 h-6" />;
    if (rolLower.includes('director')) return <Users className="w-6 h-6" />;
    if (rolLower.includes('planeacion') || rolLower.includes('admin')) return <Settings className="w-6 h-6" />;
    if (rolLower.includes('consultor') || rolLower.includes('auditor')) return <Eye className="w-6 h-6" />;
    return <Eye className="w-6 h-6" />;
  };

  const getRoleStyling = (nombreRol: string) => {
    const rolLower = nombreRol.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (rolLower.includes('docente')) {
      return {
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
        borderActive: 'border-blue-500',
        badgeBg: 'bg-blue-100',
        badgeText: 'text-blue-700',
        buttonBg: 'bg-blue-600 hover:bg-blue-700',
        moduleName: 'Módulo Docente',
        defaultDesc: 'Accede a tu agenda académica, registra tus actividades pedagógicas y gestiona tus evidencias semanales.',
      };
    }
    if (rolLower.includes('director')) {
      return {
        iconBg: 'bg-purple-50',
        iconColor: 'text-purple-600',
        borderActive: 'border-purple-500',
        badgeBg: 'bg-purple-100',
        badgeText: 'text-purple-700',
        buttonBg: 'bg-purple-600 hover:bg-purple-700',
        moduleName: 'Módulo Dirección',
        defaultDesc: 'Supervisa las agendas académicas de tu equipo docente, revisa reportes periódicos y gestiona observaciones.',
      };
    }
    if (rolLower.includes('planeacion') || rolLower.includes('admin')) {
      return {
        iconBg: 'bg-indigo-50',
        iconColor: 'text-indigo-600',
        borderActive: 'border-indigo-500',
        badgeBg: 'bg-indigo-100',
        badgeText: 'text-indigo-700',
        buttonBg: 'bg-indigo-600 hover:bg-indigo-700',
        moduleName: 'Módulo Planeación',
        defaultDesc: 'Administra los períodos académicos, gestiona la plantilla de docentes, configura semanas y analiza estadísticas.',
      };
    }
    if (rolLower.includes('consultor') || rolLower.includes('auditor')) {
      return {
        iconBg: 'bg-teal-50',
        iconColor: 'text-teal-600',
        borderActive: 'border-teal-500',
        badgeBg: 'bg-teal-100',
        badgeText: 'text-teal-700',
        buttonBg: 'bg-teal-600 hover:bg-teal-700',
        moduleName: 'Módulo Consultoría',
        defaultDesc: 'Visualiza agendas académicas, registros de actividades, evidencias y estadísticas generales en modo de solo lectura.',
      };
    }
    return {
      iconBg: 'bg-gray-50',
      iconColor: 'text-gray-600',
      borderActive: 'border-gray-500',
      badgeBg: 'bg-gray-100',
      badgeText: 'text-gray-700',
      buttonBg: 'bg-gray-600 hover:bg-gray-700',
      moduleName: 'Módulo General',
      defaultDesc: 'Accede a las funcionalidades de consulta y visualización general asignadas a tu cuenta.',
    };
  };

  const handleRoleSelection = (rolItem: Rol | null = null) => {
    const finalRole = rolItem || roles.find(r => r.id_rol === selectedRoleId);
    if (!finalRole) return;

    localStorage.setItem('sigap_active_role', JSON.stringify(finalRole));

    const nombreNormalizado = finalRole.nombre_rol.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (nombreNormalizado.includes('docente')) navigate('/docente/dashboard');
    else if (nombreNormalizado.includes('director')) navigate('/director/dashboard');
    else if (nombreNormalizado.includes('planeacion') || nombreNormalizado.includes('admin')) navigate('/planeacion/dashboard');
    else if (nombreNormalizado.includes('consultor') || nombreNormalizado.includes('auditor')) navigate('/consultor/dashboard');
    else navigate('/');
  };

  const handleRoleSelectionWithDelay = async (rolItem: Rol) => {
    setEnteringRoleId(rolItem.id_rol);
    setSelectedRoleId(rolItem.id_rol);
    await new Promise(resolve => setTimeout(resolve, 500));
    handleRoleSelection(rolItem);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#172554] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Cargando perfiles de acceso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full font-sans bg-gray-50">

      {/* ── Lado izquierdo: Panel institucional (oculto en móvil) ── */}
      <div className="hidden lg:flex w-5/12 relative bg-[#172554] text-white flex-col justify-between overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-[#172554]"></div>
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50 transition-opacity duration-700"
          style={{ backgroundImage: 'url("/edificio.jpg")' }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/90 via-[#0f172a]/40 to-transparent pointer-events-none"></div>

        <div className="relative z-10 p-16 xl:p-24 flex flex-col h-full justify-center">
          <div className="mb-10">
            <span className="bg-white/10 border border-white/20 text-blue-100 text-xs font-bold px-4 py-1.5 uppercase tracking-widest rounded-full backdrop-blur-md shadow-lg">
              Selección de Perfil
            </span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight mb-8 tracking-tight">
            Accede a tu <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-200">módulo</span> <br />
            académico.
          </h1>

          <div className="w-20 h-1.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full mb-8"></div>

          <p className="text-xl text-blue-100/80 max-w-lg mb-16 font-light leading-relaxed">
            Selecciona el perfil con el que deseas trabajar hoy en la plataforma institucional.
          </p>

          <div className="flex gap-16 mt-auto bg-white/5 p-8 rounded-2xl backdrop-blur-sm border border-white/10">
            <div>
              <h3 className="text-4xl font-black mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">
                {roles.length}
              </h3>
              <p className="text-sm text-blue-200/70 font-medium uppercase tracking-wider">Perfiles</p>
            </div>
            <div>
              <h3 className="text-4xl font-black mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">SIGAP</h3>
              <p className="text-sm text-blue-200/70 font-medium uppercase tracking-wider">Plataforma</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Lado derecho: Selector de roles ── */}
      <div className="w-full lg:w-7/12 flex flex-col bg-white/80 backdrop-blur-xl">
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24 relative">

          {/* Cabecera con logo y perfil de usuario */}
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-[#172554] to-blue-800 p-2.5 rounded-xl shadow-lg shadow-blue-900/20">
                <BookOpen className="text-white h-6 w-6" />
              </div>
              <span className="text-[#172554] font-black text-2xl tracking-tight">SIGAP</span>
            </div>

            {user && (
              <div className="flex items-center gap-3 bg-gray-50 rounded-full pl-1 pr-1 py-1 border border-gray-200">
                {user.imagen_perfil ? (
                  <img src={user.imagen_perfil} alt="Perfil" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#172554] flex items-center justify-center text-white text-xs font-bold">
                    {user.nombres ? user.nombres.charAt(0) : 'U'}
                  </div>
                )}
                <div className="hidden sm:block text-left max-w-[140px] pr-1">
                  <p className="text-xs font-semibold text-gray-800 truncate">{user.nombres} {user.apellidos}</p>
                  <p className="text-[10px] text-gray-400 truncate">{user.correo}</p>
                </div>
                <button
                  onClick={logout}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Título */}
          <div className="mb-8">
            <h2 className="text-3xl xl:text-4xl font-extrabold text-gray-900 mb-3 tracking-tight">Selecciona tu perfil</h2>
            <p className="text-gray-500 text-base font-medium leading-relaxed">
              Tienes acceso a múltiples módulos académicos.<br className="hidden sm:block" /> ¿Cómo deseas ingresar hoy?
            </p>
          </div>

          {/* Tarjetas de roles */}
          <div className="space-y-3 mb-8">
            {roles.map((rol) => {
              const isSelected = selectedRoleId === rol.id_rol;
              const isEntering = enteringRoleId === rol.id_rol;
              const styling = getRoleStyling(rol.nombre_rol);

              return (
                <div
                  key={rol.id_rol}
                  onClick={() => {
                    if (!enteringRoleId) setSelectedRoleId(rol.id_rol);
                  }}
                  className={`
                    relative bg-white border-2 rounded-xl p-5 cursor-pointer transition-all duration-200 group
                    flex items-center gap-4
                    ${isSelected
                      ? `${styling.borderActive} shadow-md`
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }
                  `}
                >
                  {/* Icono */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all ${isSelected ? styling.iconBg : 'bg-gray-50 group-hover:bg-gray-100'}`}>
                    <div className={`${isSelected ? styling.iconColor : 'text-gray-400 group-hover:text-gray-600'} transition-colors`}>
                      {getRoleIcon(rol.nombre_rol)}
                    </div>
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? styling.badgeText : 'text-gray-400'}`}>
                        {styling.moduleName}
                      </span>
                      {isSelected && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${styling.badgeBg} ${styling.badgeText}`}>
                          <Check className="w-3 h-3" />
                          Seleccionado
                        </span>
                      )}
                    </div>
                    <h3 className={`font-bold text-base ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                      {rol.nombre_rol}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {rol.descripcion_rol || styling.defaultDesc}
                    </p>
                  </div>

                  {/* Botón de acceso rápido */}
                  <div className="shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!enteringRoleId) handleRoleSelectionWithDelay(rol);
                      }}
                      disabled={!!enteringRoleId}
                      className={`
                        flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all
                        ${isSelected
                          ? `${styling.buttonBg} text-white shadow-sm`
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                        }
                      `}
                    >
                      {isEntering ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                          <span className="hidden sm:inline">Ingresando...</span>
                        </>
                      ) : (
                        <>
                          <span className="hidden sm:inline">Ingresar</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Botón principal */}
          <button
            onClick={() => {
              const selectedRol = roles.find(r => r.id_rol === selectedRoleId);
              if (selectedRol && !enteringRoleId) handleRoleSelectionWithDelay(selectedRol);
            }}
            disabled={!selectedRoleId || !!enteringRoleId}
            className={`
              w-full flex justify-center items-center py-3 px-4 rounded-lg shadow-sm text-sm font-bold transition-all duration-200
              ${selectedRoleId && !enteringRoleId
                ? 'bg-[#1a2744] text-white hover:bg-[#243460] cursor-pointer'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            {enteringRoleId ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Cargando módulo...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>Continuar al Dashboard</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 sm:px-12 lg:px-16 py-6 text-sm font-medium text-gray-400 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50">
          <div className="flex gap-4">
            <span className="hover:text-gray-600 transition-colors">Universidad CESMAG</span>
            <span>•</span>
            <span className="hover:text-gray-600 transition-colors">Facultad de Ingeniería</span>
          </div>
          <p>© 2026 SIGAP · Sistema de Gestión Profesoral</p>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
