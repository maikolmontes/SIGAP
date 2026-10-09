import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import type { MetricaAnalitica } from '../../services/analiticaService';
import { serie } from '../../services/analiticaService';
import { estiloTooltip } from './paleta';
import PanelGrafico from './PanelGrafico';

// Cada categoría tiene un significado fijo: verde enviada, ámbar construyendo, rojo devuelta, gris sin agenda
const COLOR: Record<string, string> = {
  'Agenda enviada': '#10B981',
  'En construcción': '#F59E0B',
  'Devuelta': '#EF4444',
  'Sin agenda': '#94A3B8'
};

/** IND-12 — cobertura de las agendas sobre los docentes asignados al período. */
export default function CoberturaAgendasChart({ metrica }: { metrica?: MetricaAnalitica }) {
  if (!metrica) return null;

  const valores = serie(metrica, 'docentes');
  const datos = metrica.categorias.map((categoria, i) => ({ categoria, docentes: valores[i] ?? 0 }));
  const total = metrica.resumenNumerico.total ?? 0;

  return (
    <PanelGrafico
      titulo={metrica.titulo}
      descripcion={metrica.descripcion}
      notaTecnica={metrica.notaTecnica}
      vacio={total === 0}
      mensajeVacio="Todavía no hay docentes asignados a este período."
      acciones={
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700">
          {(metrica.resumenNumerico.porcentajeGlobal ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 1 })} % con agenda enviada
        </span>
      }
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="categoria" width={118} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
          <Tooltip
            {...estiloTooltip}
            cursor={{ fill: 'rgba(15,23,42,.04)' }}
            formatter={(v) => {
              const cantidad = Number(v) || 0;
              return [`${cantidad} docente${cantidad === 1 ? '' : 's'}`, 'Docentes'];
            }}
          />
          <Bar dataKey="docentes" radius={[0, 6, 6, 0]} maxBarSize={28}>
            {datos.map((d) => (
              <Cell key={d.categoria} fill={COLOR[d.categoria] ?? '#94A3B8'} />
            ))}
            <LabelList dataKey="docentes" position="right" style={{ fontSize: 12, fill: '#475569', fontWeight: 700 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-500 mt-2">{total} {total === 1 ? 'docente asignado' : 'docentes asignados'} al período.</p>
    </PanelGrafico>
  );
}
