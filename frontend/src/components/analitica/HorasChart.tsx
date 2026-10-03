import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import type { MetricaAnalitica } from '../../services/analiticaService';
import { aDatosGrafico } from '../../services/analiticaService';
import { colorFuncion, estiloTooltip } from './paleta';
import PanelGrafico from './PanelGrafico';

/** Acorta nombres largos de función para que el eje no se amontone. */
const abreviar = (s: string) => (s.length > 18 ? s.slice(0, 17) + '…' : s);

export default function HorasChart({ metrica }: { metrica?: MetricaAnalitica }) {
  if (!metrica) return null;

  const datos = aDatosGrafico<{ horas: number; participacion: number; docentes: number }>(metrica, {
    horas: 'horas',
    participacion: 'participacion',
    docentes: 'docentes'
  });

  return (
    <PanelGrafico
      titulo={metrica.titulo}
      descripcion={metrica.descripcion}
      vacio={datos.length === 0}
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={datos} margin={{ top: 18, right: 8, left: -18, bottom: 4 }}>
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
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'horas', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#94a3b8' } }}
          />
          <Tooltip
            {...estiloTooltip}
            cursor={{ fill: 'rgba(15,23,42,.04)' }}
            formatter={(v, nombre, item) => {
              const fila = (item as { payload?: { participacion?: number; docentes?: number } })?.payload;
              const p = fila?.participacion ?? 0;
              const d = fila?.docentes ?? 0;
              return [`${Number(v) || 0} h  ·  ${p}% del total  ·  ${d} docente(s)`, String(nombre)];
            }}
          />
          <Bar dataKey="horas" radius={[6, 6, 0, 0]} maxBarSize={56}>
            {datos.map((_, i) => (
              <Cell key={i} fill={colorFuncion(i)} />
            ))}
            <LabelList dataKey="horas" position="top" style={{ fontSize: 11, fill: '#475569', fontWeight: 700 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </PanelGrafico>
  );
}
