import type { MetricaAnalitica, FilaConsolidadoPrograma } from '../../services/analiticaService';
import TablaReporte, { type ColumnaReporte } from './TablaReporte';
import { COLOR_ESTADO } from './paleta';

/** Barra apilada en miniatura con el reparto de estados del programa. */
function BarraEstados({ fila }: { fila: FilaConsolidadoPrograma }) {
  const partes = [
    { n: fila.aprobadas, color: COLOR_ESTADO['Aprobada'], etiqueta: 'Aprobadas' },
    { n: fila.enRevision, color: COLOR_ESTADO['En revisión'], etiqueta: 'En revisión' },
    { n: fila.pendientes, color: COLOR_ESTADO['Pendiente'], etiqueta: 'Pendientes' },
    { n: fila.devueltas, color: COLOR_ESTADO['Devuelta'], etiqueta: 'Devueltas' }
  ].filter((p) => p.n > 0);

  if (fila.docentes === 0) return <span className="text-slate-400">—</span>;

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-2 w-28 rounded-full overflow-hidden bg-slate-100 shrink-0">
        {partes.map((p) => (
          <div
            key={p.etiqueta}
            style={{ width: `${(p.n / fila.docentes) * 100}%`, backgroundColor: p.color }}
            title={`${p.etiqueta}: ${p.n}`}
          />
        ))}
      </div>
      <span className="text-[11px] text-slate-500 whitespace-nowrap">
        {fila.aprobadas}/{fila.docentes}
      </span>
    </div>
  );
}

export default function ConsolidadoProgramasTable({ metrica }: { metrica?: MetricaAnalitica }) {
  if (!metrica) return null;

  const filas = (metrica.filasTabla ?? []) as unknown as FilaConsolidadoPrograma[];

  const columnas: ColumnaReporte<FilaConsolidadoPrograma>[] = [
    {
      clave: 'programa',
      titulo: 'Programa',
      render: (f) => (
        <div>
          <div className="font-semibold text-slate-900">{f.programa}</div>
          <div className="text-[11px] text-slate-400">{f.facultad}</div>
        </div>
      )
    },
    { clave: 'docentes', titulo: 'Docentes', alinear: 'der', render: (f) => <span className="font-bold">{f.docentes}</span> },
    { clave: 'estados', titulo: 'Estado de agendas', render: (f) => <BarraEstados fila={f} /> },
    {
      clave: 'devueltas',
      titulo: 'Devueltas',
      alinear: 'der',
      render: (f) => (
        <span className={f.devueltas > 0 ? 'font-bold text-rose-600' : 'text-slate-400'}>{f.devueltas}</span>
      )
    },
    { clave: 'horas', titulo: 'Horas', alinear: 'der', render: (f) => <span className="text-slate-600">{f.horas}</span> },
    {
      clave: 'avance',
      titulo: 'Avance de metas',
      alinear: 'der',
      render: (f) => (
        <span className={`font-bold ${f.avance >= 70 ? 'text-emerald-600' : f.avance >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
          {f.avance}%
        </span>
      )
    }
  ];

  return (
    <TablaReporte<FilaConsolidadoPrograma>
      titulo={metrica.titulo}
      descripcion={metrica.descripcion}
      columnas={columnas}
      filas={filas}
      buscarEn={['programa', 'facultad']}
      claveFila={(f) => f.id_programa}
      mensajeVacio="Ningún programa tiene agendas cargadas en este período."
      resumen={
        filas.length > 1 ? (
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="text-slate-500">
              <strong className="text-slate-900">{filas.length}</strong> programas con actividad
            </span>
            <span className="text-slate-500">
              <strong className="text-slate-900">{metrica.resumenNumerico.total ?? 0}</strong> docentes en total
            </span>
            <span className="text-slate-500">
              Promedio de agendas aprobadas: <strong className="text-slate-900">{metrica.resumenNumerico.promedio ?? 0}%</strong>
            </span>
          </div>
        ) : undefined
      }
    />
  );
}
