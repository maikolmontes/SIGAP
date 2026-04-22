import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

interface TopbarProps {
    path: string
    rol: 'planeacion' | 'director' | 'docente'
    onOpenMenu?: () => void
    onToggleDesktop?: () => void
}

export default function Topbar({ path, rol, onOpenMenu, onToggleDesktop }: TopbarProps) {
    const { user, logout } = useAuth();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const rolLabel = rol === 'planeacion' ? 'Planeación' : rol === 'director' ? 'Director' : 'Docente'
    const iniciales = rol === 'planeacion' ? 'PL' : rol === 'director' ? 'DI' : 'DO'

    return (
        <header className="h-14 sm:h-11 bg-white border-b border-gray-200 flex items-center justify-between px-3 sm:px-5 flex-shrink-0 z-10 w-full relative">
            <div className="flex items-center gap-3">
                {onOpenMenu && (
                    <button 
                        onClick={onOpenMenu} 
                        className="lg:hidden text-gray-500 hover:text-gray-700 focus:outline-none p-1"
                        title="Abrir menú"
                    >
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                )}
                {onToggleDesktop && (
                    <button 
                        onClick={onToggleDesktop} 
                        className="hidden lg:block text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md focus:outline-none p-1.5 -ml-1 transition-colors"
                        title="Alternar menú"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                )}
                <span className="text-gray-400 text-xs hidden sm:block ml-2">{path}</span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
                <span className="hidden md:inline-block bg-yellow-50 text-yellow-800 border border-yellow-300 rounded px-2 py-0.5 text-xs font-medium">
                    {rolLabel} · 2025 IIP
                </span>

                {/* Contenedor del Dropdown */}
                <div className="relative">
                    <button 
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center gap-2 border border-gray-200 rounded-full px-2 sm:px-3 py-1 hover:bg-gray-50 transition-colors focus:outline-none"
                    >
                        {user?.imagen_perfil ? (
                            <img src={user.imagen_perfil} alt="Perfil" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full" referrerPolicy="no-referrer" />
                        ) : (
                            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-medium">
                                {user?.nombres ? user.nombres.charAt(0) : iniciales}
                            </div>
                        )}
                        <span className="text-xs text-gray-700 hidden sm:block font-medium truncate max-w-[120px]">
                            {user?.nombres ? `${user.nombres.split(' ')[0]}` : rolLabel}
                        </span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>

                    {/* Menú Dropdown */}
                    {isDropdownOpen && (
                        <>
                            <div 
                                className="fixed inset-0 z-40" 
                                onClick={() => setIsDropdownOpen(false)}
                            ></div>
                            <div className="absolute right-0 mt-2 w-48 sm:w-56 bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] py-1 border border-gray-100 z-50 transform origin-top-right transition-all">
                                <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50 rounded-t-lg mb-1">
                                    <p className="text-sm font-bold text-gray-800 truncate">{user?.nombres || 'Usuario'} {user?.apellidos || ''}</p>
                                    <p className="text-xs text-gray-500 truncate">{user?.correo || 'correo@institucion.edu.co'}</p>
                                </div>
                                <Link 
                                    to="/perfil" 
                                    onClick={() => setIsDropdownOpen(false)}
                                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    Perfil
                                </Link>
                                <Link 
                                    to="/configuracion" 
                                    onClick={() => setIsDropdownOpen(false)}
                                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    Configuración
                                </Link>
                                <div className="border-t border-gray-100 mt-1"></div>
                                <button 
                                    onClick={() => {
                                        setIsDropdownOpen(false);
                                        logout();
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 mt-1 rounded-b-lg font-medium"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                    Cerrar sesión
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    )
}