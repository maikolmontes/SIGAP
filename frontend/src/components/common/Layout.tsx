import Sidebar from './Sidebar'
import Topbar from './Topbar'

interface LayoutProps {
    children: React.ReactNode
    rol: 'planeacion' | 'director'
    path: string
}

export default function Layout({ children, rol, path }: LayoutProps) {
    return (
        <div className="flex min-h-screen bg-gray-100">
            <Sidebar rol={rol} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Topbar rol={rol} path={path} />
                <main className="flex-1 p-5 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    )
}