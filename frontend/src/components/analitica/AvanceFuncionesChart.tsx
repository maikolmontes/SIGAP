import type { MetricaAnalitica } from '../../services/analiticaService';
import { serie } from '../../services/analiticaService';
import { CESMAG } from './paleta';
import PanelGrafico from './PanelGrafico';

const formato = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 1 });
const entre0y100 = (n: number) => Math.max(0, Math.min(100, n));

interface Props {
  /** IND-06: avance por función en la semana 8 y acumulado a la 16 */
  metrica?: MetricaAnalitica;
  /** IND-10: solo para explicar cuánto pesa Docencia Directa en la meta */
  peso?: MetricaAnalitica;
}

/**
 * Avance de las metas por función sustantiva: una barra por función que se llena hasta el 100 %.
 * Lo que se logró hasta la semana 8, lo que se sumó en la 16 y lo que falta.
 */
export default function AvanceFuncionesChart({ metrica, peso }: Props) {
  if (!metrica) return null;

  const metas = serie(metrica, 'meta');
  const ejec8 = serie(metrica, 'ejecucion8');
  const ejec16 = serie(metrica, 'ejecucion16');
  const avance8 = serie(metrica, 'avance8');
  const acumulado = serie(metrica, 'avance16');

  const filas = metrica.categorias.map((nombre, i) => {
    const meta = metas[i] ?? 0;
    const hasta8 = entre0y100(avance8[i] ?? 0);
    const total = entre0y100(acumulado[i] ?? 0);
    return {
      nombre,
      meta,
      ejecutado: (ejec8[i] ?? 0) + (ejec16[i] ?? 0),
      hasta8,
      en16: Math.max(0, total - hasta8),
      total
    };
  });

  const sinMetas = filas.every((f) => f.meta === 0);
  const pesoDocenciaDirecta = peso?.resumenNumerico.pesoDocenciaDirecta;
  const sinDocenciaDirecta = peso?.resumenNumerico.porcentajeSinDocenciaDirecta;

  return (
    <PanelGrafico
      titulo="Avance de las metas por función"
      descripcion="Cuánto de lo que se propusieron los docentes ya está cumplido en cada función sustantiva."
      vacio={sinMetas}
      mensajeVacio="Todavía no hay metas con indicadores registradas en este período."
      acciones={
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 whitespace-nowrap">
          {formato(metrica.resumenNumerico.porcentajeGlobal ?? 0)} % de la meta total
        </span>
      }
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: CESMAG.azul }} />Logrado hasta la Semana 8</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: CESMAG.verde }} />Sumado en la Semana 16</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-200" />Falta por lograr</span>
      </div>

      <ul className="space-y-3.5">
        {filas.map((f) => (
          <li key={f.nombre}>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <span className="text-sm font-semibold text-slate-800 truncate">{f.nombre}</span>
              {f.meta > 0 ? (
                <span className="text-sm shrink-0">
                  <strong className="text-slate-900 tabular-nums">{formato(f.total)} %</strong>
                  <span className="text-xs text-slate-500 ml-2 tabular-nums">{formato(f.ejecutado)} de {formato(f.meta)}</span>
                </span>
              ) : (
                <span className="text-xs text-slate-400 shrink-0">Sin metas registradas</span>
              )}
            </div>
            <div
              className="flex h-3.5 rounded-full overflow-hidden bg-slate-200"
              role="img"
              aria-label={f.meta > 0
                ? `${f.nombre}: ${formato(f.total)} % de la meta; ${formato(f.hasta8)} % hasta la semana 8 y ${formato(f.en16)} % sumado en la semana 16`
                : `${f.nombre}: sin metas registradas`}
            >
              {f.meta > 0 && (
                <>
                  <div style={{ width: `${f.hasta8}%`, backgroundColor: CESMAG.azul }} title={`Hasta la Semana 8: ${formato(f.hasta8)} %`} />
                  <div style={{ width: `${f.en16}%`, backgroundColor: CESMAG.verde }} title={`Sumado en la Semana 16: ${formato(f.en16)} %`} />
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {pesoDocenciaDirecta !== null && pesoDocenciaDirecta !== undefined && filas.some((f) => f.nombre === 'Docencia Directa') && (
        <p className="text-xs text-slate-500 mt-4 leading-relaxed">
          Docencia Directa concentra el <strong className="text-slate-700">{formato(pesoDocenciaDirecta)} %</strong> de las metas del período (tiene una por cada clase),
          por eso el avance general se parece al suyo.
          {sinDocenciaDirecta !== null && sinDocenciaDirecta !== undefined && (
            <> Sin contarla, el avance es de <strong className="text-slate-700">{formato(sinDocenciaDirecta)} %</strong>.</>
          )}
        </p>
      )}
    </PanelGrafico>
  );
}
