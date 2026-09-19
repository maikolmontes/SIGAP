import type { ReactNode } from 'react';
import { BarChart3, Info } from 'lucide-react';

interface Props {
  titulo: string;
  descripcion?: string;
  notaTecnica?: string | null;
  vacio?: boolean;
  mensajeVacio?: string;
  acciones?: ReactNode;
  children: ReactNode;
}

/** Contenedor común de los paneles analíticos: mismo marco, mismo vacío. */
export default function PanelGrafico({
  titulo,
  descripcion,
  notaTecnica,
  vacio = false,
  mensajeVacio = 'Todavía no hay datos suficientes para este indicador en el período seleccionado.',
  acciones,
  children
}: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-slate-900">{titulo}</h3>
          {descripcion && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{descripcion}</p>}
        </div>
        {acciones && <div className="shrink-0">{acciones}</div>}
      </div>

      <div className="px-5 pb-5">
        {vacio ? (
          <div className="py-14 text-center">
            <BarChart3 className="w-9 h-9 mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">{mensajeVacio}</p>
          </div>
        ) : (
          children
        )}
      </div>

      {notaTecnica && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-500 leading-relaxed">{notaTecnica}</p>
        </div>
      )}
    </div>
  );
}
