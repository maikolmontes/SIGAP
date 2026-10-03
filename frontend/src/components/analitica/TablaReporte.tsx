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
 * Tabla de reporte genérica: buscador, encabezado, estado vacío,
 * contenedor scroll delimitado y paginación.
 */
export default function TablaReporte<T>({
  titulo, descripcion, notaTecnica, columnas, filas,
  buscarEn = [], mensajeVacio = 'No hay registros para este período.', resumen, claveFila
}: Props<T>) {
  const [busqueda, setBusqueda] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const [regPorPag, setRegPorPag] = useState(10);

  const visibles = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q || buscarEn.length === 0) return filas;
    return filas.filter((f) =>
      buscarEn.some((campo) => String(f[campo] ?? '').toLowerCase().includes(q))
    );
  }, [filas, busqueda, buscarEn]);

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / regPorPag));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const inicio = (paginaSegura - 1) * regPorPag;
  const filasPagina = visibles.slice(inicio, inicio + regPorPag);

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
              onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }}
              placeholder="Buscar…"
              className="w-56 pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#00a896] focus:ring-1 focus:ring-[#00a896]/30"
            />
            {busqueda && (
              <button
                onClick={() => { setBusqueda(''); setPaginaActual(1); }}
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
        <div className="overflow-x-auto overflow-y-auto max-h-[460px] border-t border-slate-100">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-2xs">
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
              {filasPagina.map((fila, i) => (
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

      {/* Paginación */}
      {visibles.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Mostrar</span>
            <select
              value={regPorPag}
              onChange={e => { setRegPorPag(Number(e.target.value)); setPaginaActual(1); }}
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#00a896]"
            >
              {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>registros · {visibles.length} total</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
              disabled={paginaSegura === 1}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              ‹
            </button>
            {Array.from({ length: totalPaginas }, (_, i) => i + 1).filter(p => p === 1 || p === totalPaginas || Math.abs(p - paginaSegura) <= 1).map((p, idx, arr) => (
              <span key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-slate-400">…</span>}
                <button
                  onClick={() => setPaginaActual(p)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    p === paginaSegura ? 'bg-[#1a2744] text-white border-[#1a2744]' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              </span>
            ))}
            <button
              onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaSegura === totalPaginas}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              ›
            </button>
          </div>
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
