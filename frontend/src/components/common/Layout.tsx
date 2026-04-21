import { useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

interface LayoutProps {
    children: React.ReactNode
    rol: 'planeacion' | 'director' | 'docente'
    path: string
}

export default function Layout({ children, rol, path }: LayoutProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(true);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden relative">
            
            {/* Fondo oscuro cuando el menú está abierto en el celular */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Panel Lateral (Sidebar) Responsivo y Colapsable en Desktop */}
            <div className={`
                fixed inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out h-screen overflow-hidden
                lg:relative 
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
                ${isDesktopMenuOpen ? 'lg:translate-x-0 lg:w-64' : 'lg:-translate-x-full lg:w-0 lg:opacity-0'}
            `}>
                <Sidebar rol={rol} onClose={() => setIsMobileMenuOpen(false)} />
            </div>

            {/* Contenido Principal */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen transition-all duration-300">
                <Topbar 
                    rol={rol} 
                    path={path} 
                    onOpenMenu={() => setIsMobileMenuOpen(true)} 
                    onToggleDesktop={() => setIsDesktopMenuOpen(!isDesktopMenuOpen)}
                />
                <main className="flex-1 p-3 sm:p-5 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    )
}