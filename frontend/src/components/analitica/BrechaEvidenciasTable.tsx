import { FileWarning, ShieldCheck } from 'lucide-react';
import type { MetricaAnalitica, FilaBrechaEvidencia } from '../../services/analiticaService';
import TablaReporte, { type ColumnaReporte } from './TablaReporte';

export default function BrechaEvidenciasTable({ metrica }: { metrica?: MetricaAnalitica }) {
  if (!metrica) return null;

  const filas = (metrica.filasTabla ?? []) as unknown as FilaBrechaEvidencia[];
  const sinSoporte = metrica.resumenNumerico.total ?? 0;
  const conEjecucion = metrica.resumenNumerico.promedio ?? 0;
  const porcentaje = metrica.resumenNumerico.porcentajeGlobal ?? 0;

  const columnas: ColumnaReporte<FilaBrechaEvidencia>[] = [
    {
      clave: 'docente',
      titulo: 'Docente',
      render: (f) => (
        <div>
          <div className="font-semibold text-slate-900">{f.docente}</div>
          <div className="text-[11px] text-slate-400">{f.programa}</div>
        </div>
      )
    },
    {
      clave: 'funcion',
      titulo: 'Función / actividad',
      render: (f) => (
        <div className="max-w-xs">
          <div className="text-slate-700">{f.funcion}</div>
          <div className="text-[11px] text-slate-400 truncate" title={f.actividad}>{f.actividad}</div>
        </div>
      )
    },
    {
      clave: 'indicador',
      titulo: 'Indicador',
      render: (f) => <span className="text-slate-600 text-xs">{f.indicador}</span>
    },
    {
      clave: 'ejecutado',
      titulo: 'Reportado',
      alinear: 'der',
      render: (f) => (
        <span className="font-bold text-slate-900">
          {f.ejecutado}
          <span className="font-normal text-slate-400"> / {f.meta}</span>
        </span>
      )
    },
    {
      clave: 'avance',
      titulo: 'Avance',
      alinear: 'der',
      render: (f) => <span className="text-slate-600">{f.avance}%</span>
    },
    {
      clave: 'soporte',
      titulo: 'Soporte',
      render: () => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <FileWarning className="w-3 h-3" />
          Sin evidencia
        </span>
      )
    }
  ];

  return (
    <TablaReporte<FilaBrechaEvidencia>
      titulo={metrica.titulo}
      descripcion={metrica.descripcion}
      notaTecnica={metrica.notaTecnica}
      columnas={columnas}
      filas={filas}
      buscarEn={['docente', 'programa', 'funcion', 'indicador']}
      claveFila={(f, i) => `${f.id_usuario}-${i}`}
      mensajeVacio="Todo el avance reportado en este período cuenta con soporte documental."
      resumen={
        <div className="flex flex-wrap items-center gap-3">
          {conEjecucion === 0 ? (
            <span className="text-xs text-slate-500">Aún no hay ejecución reportada en este período.</span>
          ) : sinSoporte === 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              Cobertura documental completa
            </span>
          ) : (
            <>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                porcentaje >= 40
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                <FileWarning className="w-3.5 h-3.5" />
                {porcentaje}% sin respaldo
              </span>
              <span className="text-xs text-slate-500">
                <strong className="text-slate-900">{sinSoporte}</strong> de{' '}
                <strong className="text-slate-900">{conEjecucion}</strong> indicadores con ejecución
                no tienen ningún archivo adjunto
              </span>
            </>
          )}
        </div>
      }
    />
  );
}
