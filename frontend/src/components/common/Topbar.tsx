interface TopbarProps {
    path: string
    rol: 'planeacion' | 'director'
}

export default function Topbar({ path, rol }: TopbarProps) {
    const rolLabel = rol === 'planeacion' ? 'Planeación' : 'Director'
    const iniciales = rol === 'planeacion' ? 'PL' : 'DI'

    return (
        <header className="h-11 bg-white border-b border-gray-200 flex items-center justify-between px-5 flex-shrink-0">
            <span className="text-gray-400 text-xs">{path}</span>

            <div className="flex items-center gap-3">
                <span className="bg-yellow-50 text-yellow-800 border border-yellow-300 rounded px-2 py-0.5 text-xs font-medium">
                    {rolLabel} · 2025 IIP
                </span>

                <div className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-1">
                    <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-medium">
                        {iniciales}
                    </div>
                    <span className="text-xs text-gray-700">{rolLabel}</span>
                </div>
            </div>
        </header>
    )
}