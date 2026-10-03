import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { MetricaAnalitica } from '../../services/analiticaService';
import { serie } from '../../services/analiticaService';
import { COLOR_ESTADO, estiloTooltip } from './paleta';
import PanelGrafico from './PanelGrafico';

export default function AgendasChart({ metrica }: { metrica?: MetricaAnalitica }) {
  if (!metrica) return null;

  const valores = serie(metrica, 'docentes');
  const datos = metrica.categorias
    .map((categoria, i) => ({ name: categoria, value: valores[i] ?? 0 }))
    .filter((d) => d.value > 0);

  const total = metrica.resumenNumerico.total ?? 0;

  return (
    <PanelGrafico titulo={metrica.titulo} descripcion={metrica.descripcion} vacio={total === 0}>
      <div className="relative">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={datos}
              dataKey="value"
              nameKey="name"
              innerRadius={72}
              outerRadius={104}
              paddingAngle={datos.length > 1 ? 3 : 0}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {datos.map((d) => (
                <Cell key={d.name} fill={COLOR_ESTADO[d.name] ?? '#94A3B8'} />
              ))}
            </Pie>
            <Tooltip
              {...estiloTooltip}
              formatter={(v, n) => {
                const cantidad = Number(v) || 0;
                return [`${cantidad} docente${cantidad === 1 ? '' : 's'}`, String(n)];
              }}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Centro del donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -mt-6">
          <span className="text-3xl font-black text-slate-900 tabular-nums">{total}</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {total === 1 ? 'docente' : 'docentes'}
          </span>
        </div>
      </div>
    </PanelGrafico>
  );
}
