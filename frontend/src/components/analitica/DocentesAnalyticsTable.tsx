import { useMemo, useState } from 'react';
import { Search, X, Users } from 'lucide-react';
import type { MetricaAnalitica, FilaBalanceDocente } from '../../services/analiticaService';
import { COLOR_BALANCE, COLOR_ESTADO_BADGE } from './paleta';

export default function DocentesAnalyticsTable({ metrica }: { metrica?: MetricaAnalitica }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroBalance, setFiltroBalance] = useState<string>('');

  // filasTabla es una unión: este indicador siempre trae filas de balance
  const filas: FilaBalanceDocente[] = useMemo(
    () => (metrica?.filasTabla ?? []) as FilaBalanceDocente[],
    [metrica]
  );

  const balances = useMemo(
    () => [...new Set(filas.map((f) => f.balance))],
    [filas]
  );

  const visibles = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return filas.filter((f) => {
      const coincide = !q ||
        f.docente.toLowerCase().includes(q) ||
        f.tipoContrato.toLowerCase().includes(q) ||
        f.programa.toLowerCase().includes(q);
      return coincide && (filtroBalance ? f.balance === filtroBalance : true);
    });
  }, [filas, busqueda, filtroBalance]);

  if (!metrica) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-900">{metrica.titulo}</h3>
            <p className="text-xs text-slate-500 mt-1">{metrica.descripcion}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar docente…"
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
          </div>
        </div>

        {balances.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            <button
              onClick={() => setFiltroBalance('')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                !filtroBalance ? 'bg-[#1a2744] text-white border-[#1a2744]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              Todos ({filas.length})
            </button>
            {balances.map((b) => (
              <button
                key={b}
                onClick={() => setFiltroBalance(filtroBalance === b ? '' : b)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                  filtroBalance === b ? 'bg-[#1a2744] text-white border-[#1a2744]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {b} ({filas.filter((f) => f.balance === b).length})
              </button>
            ))}
          </div>
        )}
      </div>

      {visibles.length === 0 ? (
        <div className="py-14 text-center border-t border-slate-100">
          <Users className="w-9 h-9 mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-500">
            {filas.length === 0 ? 'No hay docentes con agenda en este período.' : 'Ningún docente coincide con el filtro.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Docente</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Vinculación</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Asignadas</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Contrato</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Ocupación</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Balance</th>
                <th className="px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Agenda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibles.map((f) => (
                <tr key={f.id_usuario} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-semibold text-slate-900">{f.docente}</div>
                    <div className="text-[11px] text-slate-400">{f.funciones} función(es) · {f.programa}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{f.tipoContrato}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">{f.horasAsignadas}</td>
                  <td className="px-4 py-3 text-right text-slate-500 tabular-nums">
                    {f.horasContrato > 0 ? f.horasContrato : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {f.porcentajeOcupacion === null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span className={`font-bold ${
                        f.porcentajeOcupacion > 100 ? 'text-rose-600'
                          : f.porcentajeOcupacion === 100 ? 'text-emerald-600'
                          : 'text-amber-600'
                      }`}>
                        {f.porcentajeOcupacion}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border ${COLOR_BALANCE[f.balance] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {f.balance}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border ${COLOR_ESTADO_BADGE[f.estadoAgenda] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {f.estadoAgenda}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {metrica.notaTecnica && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
          <p className="text-[11px] text-slate-500 leading-relaxed">{metrica.notaTecnica}</p>
        </div>
      )}
    </div>
  );
}
