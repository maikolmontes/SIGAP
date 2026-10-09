import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import type { MetricaAnalitica } from '../../services/analiticaService';
import { aDatosGrafico } from '../../services/analiticaService';
import { estiloTooltip } from './paleta';
import PanelGrafico from './PanelGrafico';

// Colores de la revisión: verde aprobado, azul visto bueno, rojo devuelto, gris pendiente
const SERIES = [
  { clave: 'aprobadas', nombre: 'Aprobadas', color: '#10B981' },
  { clave: 'vistoBueno', nombre: 'Con visto bueno', color: '#3B82F6' },
  { clave: 'devueltas', nombre: 'Devueltas', color: '#EF4444' },
  { clave: 'pendientes', nombre: 'Pendientes', color: '#CBD5E1' }
] as const;

const formato = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 1 });

/** IND-11 — estado de la revisión de las funciones en cada corte. */
export default function RevisionCortesChart({ metrica }: { metrica?: MetricaAnalitica }) {
  if (!metrica) return null;

  const datos = aDatosGrafico<{ aprobadas: number; vistoBueno: number; devueltas: number; pendientes: number }>(metrica, {
    aprobadas: 'aprobadas',
    vistoBueno: 'vistoBueno',
    devueltas: 'devueltas',
    pendientes: 'pendientes'
  });
  const total = metrica.resumenNumerico.total ?? 0;

  return (
    <PanelGrafico
      titulo={metrica.titulo}
      descripcion={metrica.descripcion}
      notaTecnica={metrica.notaTecnica}
      vacio={total === 0}
      mensajeVacio="Todavía no hay funciones asignadas en este período."
      acciones={
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700">
          Aprobadas: {formato(metrica.resumenNumerico.porcentajeCorte1 ?? 0)} % · {formato(metrica.resumenNumerico.porcentajeCorte2 ?? 0)} %
        </span>
      }
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="categoria" width={96} tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} />
          <Tooltip
            {...estiloTooltip}
            cursor={{ fill: 'rgba(15,23,42,.04)' }}
            formatter={(v, n) => {
              const cantidad = Number(v) || 0;
              return [`${cantidad} función${cantidad === 1 ? '' : 'es'}`, String(n)];
            }}
          />
          <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '12px', paddingBottom: 8 }} />
          {SERIES.map((s) => (
            <Bar key={s.clave} dataKey={s.clave} name={s.nombre} stackId="revision" fill={s.color} maxBarSize={34}>
              <LabelList
                dataKey={s.clave}
                position="center"
                formatter={(v: unknown) => (Number(v) > 0 ? String(v) : '')}
                style={{ fontSize: 11, fontWeight: 700, fill: s.clave === 'pendientes' ? '#475569' : '#ffffff' }}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-500 mt-2">{total} {total === 1 ? 'función' : 'funciones'} de las agendas del período.</p>
    </PanelGrafico>
  );
}
