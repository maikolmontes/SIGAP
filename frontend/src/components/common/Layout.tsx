import { useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

interface LayoutProps {
    children: React.ReactNode
    rol: 'planeacion' | 'director'
    path: string
}

export default function Layout({ children, rol, path }: LayoutProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden relative">
            
            {/* Fondo oscuro cuando el menú está abierto en el celular */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Panel Lateral (Sidebar) Responsivo */}
            <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <Sidebar rol={rol} onClose={() => setIsMobileMenuOpen(false)} />
            </div>

            {/* Contenido Principal */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen">
                <Topbar rol={rol} path={path} onOpenMenu={() => setIsMobileMenuOpen(true)} />
                <main className="flex-1 p-3 sm:p-5 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    )
}