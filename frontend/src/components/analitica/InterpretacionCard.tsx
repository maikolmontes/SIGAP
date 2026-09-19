import { Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import type { InterpretacionIA } from '../../services/analiticaService';

interface Props {
  interpretacion: InterpretacionIA | null;
  cargando: boolean;
  onReintentar?: () => void;
}

const MOTIVOS: Record<string, string> = {
  no_configurado: 'La interpretación asistida no está configurada en este entorno.',
  limite_alcanzado: 'Se alcanzó el límite de consultas por minuto. Intente de nuevo en un momento.',
  cuota_agotada: 'Se agotó la cuota diaria del servicio de interpretación. Se restablece mañana.',
  sin_datos: 'No hay indicadores suficientes para generar una interpretación.',
  respuesta_vacia: 'El servicio no devolvió contenido.',
  respuesta_incompleta: 'La interpretación llegó incompleta. Puede intentar generarla de nuevo.',
  error_proveedor: 'El servicio de interpretación no está disponible en este momento.',
  error_interno: 'Ocurrió un error al solicitar la interpretación.'
};

export default function InterpretacionCard({ interpretacion, cargando, onReintentar }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-2.5 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1a2744] to-[#00a896] flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-extrabold text-slate-900">Interpretación de resultados</h3>
          <p className="text-[11px] text-slate-500">Lectura descriptiva generada sobre las cifras del período</p>
        </div>
        {!cargando && onReintentar && (
          <button
            onClick={onReintentar}
            className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-slate-100"
            title="Generar de nuevo"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        {cargando ? (
          <div className="space-y-2.5 animate-pulse">
            <div className="h-3 bg-slate-100 rounded w-11/12" />
            <div className="h-3 bg-slate-100 rounded w-9/12" />
            <div className="h-3 bg-slate-100 rounded w-10/12" />
            <p className="text-[11px] text-slate-400 pt-2">Analizando las cifras del período…</p>
          </div>
        ) : !interpretacion || !interpretacion.disponible ? (
          <div className="flex items-start gap-2.5 text-slate-500">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
            <div>
              <p className="text-sm">
                {MOTIVOS[interpretacion?.motivo ?? ''] ?? 'Interpretación no disponible temporalmente.'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Los gráficos y las cifras de esta página no dependen de este servicio.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-800 leading-relaxed">{interpretacion.resumen}</p>

            {interpretacion.hallazgos.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Hallazgos</p>
                <ul className="space-y-1.5">
                  {interpretacion.hallazgos.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00a896] shrink-0 mt-[7px]" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {interpretacion.observaciones.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Observaciones</p>
                <ul className="space-y-1.5">
                  {interpretacion.observaciones.map((o, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0 mt-[7px]" />
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">
              Texto generado automáticamente a partir de los datos agregados del período. Es una lectura
              descriptiva, no una recomendación de gestión.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
