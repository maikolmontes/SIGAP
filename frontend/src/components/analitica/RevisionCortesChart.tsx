import type { MetricaAnalitica } from '../../services/analiticaService';
import { serie } from '../../services/analiticaService';
import PanelGrafico from './PanelGrafico';

// Verde aprobado, azul visto bueno, rojo devuelto, ámbar por revisar (el docente ya reportó), gris sin reportar
const PARTES = [
  { clave: 'aprobadas', nombre: 'Aprobadas', color: '#10B981', texto: '#ffffff' },
  { clave: 'vistoBueno', nombre: 'Con visto bueno', color: '#3B82F6', texto: '#ffffff' },
  { clave: 'devueltas', nombre: 'Devueltas', color: '#EF4444', texto: '#ffffff' },
  { clave: 'porRevisar', nombre: 'Por revisar', color: '#F59E0B', texto: '#ffffff' },
  { clave: 'sinReportar', nombre: 'Sin reportar', color: '#E2E8F0', texto: '#475569' }
] as const;

const formato = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 1 });

/** IND-11 — cómo va la revisión de las funciones ya liberadas a los docentes, corte por corte. */
export default function RevisionCortesChart({ metrica }: { metrica?: MetricaAnalitica }) {
  if (!metrica) return null;

  const total = metrica.resumenNumerico.total ?? 0;
  const porLiberar = metrica.resumenNumerico.porLiberar ?? 0;
  const datos = Object.fromEntries(PARTES.map((p) => [p.clave, serie(metrica, p.clave)]));

  return (
    <PanelGrafico
      titulo="Revisión de los cortes"
      descripcion="De las funciones que ya les llegaron a los docentes, cuántas están aprobadas, cuántas esperan tu revisión y cuántas falta reportar."
      vacio={total === 0}
      mensajeVacio={porLiberar > 0
        ? `Todavía no hay funciones liberadas a los docentes: ${porLiberar} ${porLiberar === 1 ? 'sigue' : 'siguen'} con la carga por aprobar.`
        : 'Todavía no hay funciones asignadas en este período.'}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-4 text-xs text-slate-600">
        {PARTES.map((p) => (
          <span key={p.clave} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} />{p.nombre}
          </span>
        ))}
      </div>

      <ul className="space-y-4">
        {metrica.categorias.map((corte, i) => {
          const aprobadas = datos.aprobadas[i] ?? 0;
          return (
            <li key={corte}>
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <span className="text-sm font-semibold text-slate-800">{corte}</span>
                <span className="text-xs text-slate-500 tabular-nums">
                  <strong className="text-slate-800">{aprobadas}</strong> de {total} aprobadas ({formato(total > 0 ? (aprobadas / total) * 100 : 0)} %)
                </span>
              </div>
              <div
                className="flex h-7 rounded-lg overflow-hidden bg-slate-100"
                role="img"
                aria-label={`${corte}: ${PARTES.map((p) => `${datos[p.clave][i] ?? 0} ${p.nombre.toLowerCase()}`).join(', ')}`}
              >
                {PARTES.map((p) => {
                  const n = datos[p.clave][i] ?? 0;
                  if (n <= 0) return null;
                  const ancho = (n / total) * 100;
                  return (
                    <div
                      key={p.clave}
                      className="flex items-center justify-center text-[11px] font-bold tabular-nums"
                      style={{ width: `${ancho}%`, backgroundColor: p.color, color: p.texto }}
                      title={`${p.nombre}: ${n}`}
                    >
                      {ancho >= 6 ? n : ''}
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-slate-500 mt-4 leading-relaxed">
        {total} {total === 1 ? 'función liberada' : 'funciones liberadas'} a los docentes. «Por revisar» son las que el docente ya reportó y esperan la revisión del director.
        {porLiberar > 0 && (
          <> Otras <strong className="text-slate-700">{porLiberar}</strong> {porLiberar === 1 ? 'sigue' : 'siguen'} con la carga por aprobar: el docente todavía no puede reportar{porLiberar === 1 ? 'la' : 'las'}, por eso no entran en estas cuentas.</>
        )}
      </p>
    </PanelGrafico>
  );
}
