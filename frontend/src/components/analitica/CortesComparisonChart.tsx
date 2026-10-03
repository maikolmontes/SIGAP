import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import type { MetricaAnalitica } from '../../services/analiticaService';
import { aDatosGrafico } from '../../services/analiticaService';
import { CESMAG, estiloTooltip } from './paleta';
import PanelGrafico from './PanelGrafico';

const abreviar = (s: string) => (s.length > 18 ? s.slice(0, 17) + '…' : s);

export default function CortesComparisonChart({ metrica }: { metrica?: MetricaAnalitica }) {
  if (!metrica) return null;

  const datos = aDatosGrafico<{ avance8: number; avance16: number }>(metrica, {
    avance8: 'avance8',
    avance16: 'avance16'
  });

  const sinEjecucion = datos.every((d) => d.avance8 === 0 && d.avance16 === 0);

  return (
    <PanelGrafico
      titulo={metrica.titulo}
      descripcion={metrica.descripcion}
      notaTecnica={metrica.notaTecnica}
      vacio={datos.length === 0 || sinEjecucion}
      mensajeVacio="Aún no hay ejecución registrada en los cortes de semana 8 y 16 para este período."
      acciones={
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">
          {metrica.resumenNumerico.porcentajeGlobal ?? 0}% acumulado
        </span>
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={datos} margin={{ top: 10, right: 8, left: -18, bottom: 4 }}>
          <defs>
            <linearGradient id="gradSemana8" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CESMAG.azul} stopOpacity={0.35} />
              <stop offset="95%" stopColor={CESMAG.azul} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradSemana16" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CESMAG.verde} stopOpacity={0.45} />
              <stop offset="95%" stopColor={CESMAG.verde} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="categoria"
            tickFormatter={abreviar}
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
            interval={0}
            angle={-18}
            textAnchor="end"
            height={62}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <ReferenceLine y={100} stroke="#cbd5e1" strokeDasharray="4 4" />
          <Tooltip {...estiloTooltip} formatter={(v, n) => [`${Number(v) || 0}%`, String(n)]} />
          <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '12px', paddingBottom: 8 }} />

          <Area
            type="monotone"
            dataKey="avance8"
            name="Corte I · Semana 8"
            stroke={CESMAG.azul}
            strokeWidth={2}
            fill="url(#gradSemana8)"
          />
          <Area
            type="monotone"
            dataKey="avance16"
            name="Acumulado · Semana 16"
            stroke={CESMAG.verde}
            strokeWidth={2}
            fill="url(#gradSemana16)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </PanelGrafico>
  );
}
