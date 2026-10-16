import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Vista } from './vistaAgendas';
import { Search, Filter, ChevronDown, LayoutGrid, List, RefreshCw } from 'lucide-react';

// Barra de consulta común de las pestañas de "Agendas por revisar": búsqueda, filtros en un panel que se
// muestra u oculta, y vista en tarjetas o en lista (la vista se guarda en vistaAgendas.ts).

/** Un filtro del panel: etiqueta chica arriba y, debajo, el campo (normalmente un <select>). */
export const CampoFiltro = ({ etiqueta, children }: { etiqueta: string; children: ReactNode }) => (
    <label className="flex flex-col gap-1 min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{etiqueta}</span>
        {children}
    </label>
);

interface Props {
    busqueda: string;
    onBusqueda: (valor: string) => void;
    placeholder?: string;
    vista: Vista;
    onVista: (v: Vista) => void;
    hayFiltros: boolean;
    onLimpiar: () => void;
    cargando?: boolean;
    onActualizar?: () => void;
    /** Los campos del panel de filtros (CampoFiltro con su select). */
    children: ReactNode;
}

export default function BarraConsulta({ busqueda, onBusqueda, placeholder = 'Buscar por nombre, programa o correo...', vista, onVista, hayFiltros, onLimpiar, cargando = false, onActualizar, children }: Props) {
    const [abiertos, setAbiertos] = useState(false);

    return (
        <div className="mb-5">
            <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
                <div className="relative flex-1 min-w-0 w-full lg:max-w-xl">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder={placeholder}
                        value={busqueda}
                        onChange={(e) => onBusqueda(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setAbiertos(v => !v)}
                        aria-expanded={abiertos}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                            hayFiltros ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <Filter className="w-3.5 h-3.5" />
                        Filtros
                        {hayFiltros && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${abiertos ? 'rotate-180' : ''}`} />
                    </button>
                    <div className="inline-flex rounded-xl border border-gray-200 bg-white p-0.5" role="group" aria-label="Tipo de vista">
                        {([['tarjetas', 'Tarjetas', LayoutGrid], ['lista', 'Lista', List]] as const).map(([clave, nombre, Icono]) => (
                            <button
                                key={clave}
                                type="button"
                                onClick={() => onVista(clave)}
                                aria-pressed={vista === clave}
                                title={`Ver como ${nombre.toLowerCase()}`}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                    vista === clave ? 'bg-[#1a2744] text-white' : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                <Icono className="w-3.5 h-3.5" />
                                {nombre}
                            </button>
                        ))}
                    </div>
                    {onActualizar && (
                        <button
                            type="button"
                            onClick={onActualizar}
                            disabled={cargando}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
                            Actualizar
                        </button>
                    )}
                </div>
            </div>

            {abiertos && (
                <div className="mt-3 bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>
                    {hayFiltros && (
                        <div className="mt-3 flex justify-end">
                            <button type="button" onClick={onLimpiar} className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                                Limpiar filtros
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
