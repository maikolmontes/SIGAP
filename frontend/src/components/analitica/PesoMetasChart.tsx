import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import type { MetricaAnalitica } from '../../services/analiticaService';
import { aDatosGrafico } from '../../services/analiticaService';
import { colorFuncion, estiloTooltip } from './paleta';
import PanelGrafico from './PanelGrafico';

const abreviar = (s: string) => (s.length > 24 ? s.slice(0, 23) + '…' : s);
const formato = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 1 });

/** IND-10 — qué parte de la meta aporta cada función y cuánto avanzó, con y sin Docencia Directa. */
export default function PesoMetasChart({ metrica }: { metrica?: MetricaAnalitica }) {
  if (!metrica) return null;

  const datos = aDatosGrafico<{ meta: number; peso: number; avance: number }>(metrica, {
    meta: 'meta',
    peso: 'peso',
    avance: 'avance'
  });
  const r = metrica.resumenNumerico;
  const hayMeta = (r.total ?? 0) > 0;

  return (
    <PanelGrafico
      titulo={metrica.titulo}
      descripcion={metrica.descripcion}
      notaTecnica={metrica.notaTecnica}
      vacio={!hayMeta}
      mensajeVacio="Todavía no hay metas registradas en los indicadores de este período."
      acciones={
        <div className="flex flex-wrap justify-end gap-1.5">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">
            Avance total {formato(r.porcentajeGlobal ?? 0)} %
          </span>
          {r.porcentajeSinDocenciaDirecta !== null && r.porcentajeSinDocenciaDirecta !== undefined && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700">
              Sin Docencia Directa {formato(r.porcentajeSinDocenciaDirecta)} %
            </span>
          )}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={Math.max(220, datos.length * 52 + 40)}>
        <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="categoria"
            width={150}
            tickFormatter={abreviar}
            tick={{ fontSize: 11, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            {...estiloTooltip}
            cursor={{ fill: 'rgba(15,23,42,.04)' }}
            formatter={(v, nombre, item) => {
              const fila = (item as { payload?: { meta?: number; avance?: number } })?.payload;
              return [`${formato(Number(v) || 0)} % de la meta total  ·  meta ${formato(fila?.meta ?? 0)}  ·  avance ${formato(fila?.avance ?? 0)} %`, String(nombre)];
            }}
          />
          <Bar dataKey="peso" name="Peso en la meta" radius={[0, 6, 6, 0]} maxBarSize={26}>
            {datos.map((_, i) => (
              <Cell key={i} fill={colorFuncion(i)} />
            ))}
            <LabelList
              dataKey="peso"
              position="right"
              formatter={(v: unknown) => `${formato(Number(v) || 0)} %`}
              style={{ fontSize: 11, fill: '#475569', fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {(r.pesoDocenciaDirecta ?? 0) >= 50 && (
        <p className="text-xs text-slate-500 leading-relaxed mt-2">
          Docencia Directa aporta el <strong className="text-slate-700">{formato(r.pesoDocenciaDirecta ?? 0)} %</strong> de la meta,
          por eso el avance total ({formato(r.porcentajeGlobal ?? 0)} %) refleja sobre todo esa función.
        </p>
      )}
    </PanelGrafico>
  );
}
