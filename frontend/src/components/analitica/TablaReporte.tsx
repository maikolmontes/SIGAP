import { useMemo, useState, type ReactNode } from 'react';
import { Search, X, TableProperties } from 'lucide-react';

export interface ColumnaReporte<T> {
  clave: string;
  titulo: string;
  alinear?: 'izq' | 'der';
  /** Contenido personalizado de la celda; por defecto imprime fila[clave] */
  render?: (fila: T) => ReactNode;
}

interface Props<T> {
  titulo: string;
  descripcion?: string;
  notaTecnica?: string | null;
  columnas: ColumnaReporte<T>[];
  filas: T[];
  /** Campos sobre los que actúa el buscador */
  buscarEn?: (keyof T)[];
  mensajeVacio?: string;
  resumen?: ReactNode;
  claveFila: (fila: T, i: number) => string | number;
}

/**
 * Tabla de reporte genérica: buscador, encabezado y estado vacío comunes.
 * Las columnas se declaran desde fuera para no repetir esta estructura en
 * cada indicador de tipo tabla.
 */
export default function TablaReporte<T>({
  titulo, descripcion, notaTecnica, columnas, filas,
  buscarEn = [], mensajeVacio = 'No hay registros para este período.', resumen, claveFila
}: Props<T>) {
  const [busqueda, setBusqueda] = useState('');

  const visibles = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q || buscarEn.length === 0) return filas;
    return filas.filter((f) =>
      buscarEn.some((campo) => String(f[campo] ?? '').toLowerCase().includes(q))
    );
  }, [filas, busqueda, buscarEn]);

  // Acceso genérico por nombre de columna cuando no hay `render` propio
  const celda = (fila: T, clave: string) => String((fila as Record<string, unknown>)[clave] ?? '');

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="px-5 pt-5 pb-4 flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-slate-900">{titulo}</h3>
          {descripcion && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{descripcion}</p>}
          {resumen && <div className="mt-3">{resumen}</div>}
        </div>

        {buscarEn.length > 0 && filas.length > 0 && (
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar…"
              className="w-56 pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#00a896] focus:ring-1 focus:ring-[#00a896]/30"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {visibles.length === 0 ? (
        <div className="py-14 text-center border-t border-slate-100">
          <TableProperties className="w-9 h-9 mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {filas.length === 0 ? mensajeVacio : 'Ningún registro coincide con la búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {columnas.map((col) => (
                  <th
                    key={col.clave}
                    className={`px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap ${
                      col.alinear === 'der' ? 'text-right' : ''
                    }`}
                  >
                    {col.titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibles.map((fila, i) => (
                <tr key={claveFila(fila, i)} className="hover:bg-slate-50/70 transition-colors">
                  {columnas.map((col) => (
                    <td
                      key={col.clave}
                      className={`px-4 py-3 ${col.alinear === 'der' ? 'text-right tabular-nums' : ''}`}
                    >
                      {col.render ? col.render(fila) : celda(fila, col.clave)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {notaTecnica && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
          <p className="text-[11px] text-slate-500 leading-relaxed">{notaTecnica}</p>
        </div>
      )}
    </div>
  );
}
