import type { ReactNode } from 'react';
import { CheckCircle2, RotateCcw, Clock, FileCheck2 } from 'lucide-react';
import type { MetricaAnalitica } from '../../services/analiticaService';
import { serie } from '../../services/analiticaService';

interface Props {
  agendas?: MetricaAnalitica;      // IND-01
  devolucion?: MetricaAnalitica;   // IND-02
  horas?: MetricaAnalitica;        // IND-03
  evidencias?: MetricaAnalitica;   // IND-07
}

interface Tarjeta {
  etiqueta: string;
  valor: string;
  apoyo: string;
  icono: ReactNode;
  tono: string;
}

export default function KpiGrid({ agendas, devolucion, horas, evidencias }: Props) {
  const docentes = serie(agendas, 'docentes');
  const totalDocentes = agendas?.resumenNumerico.total ?? 0;
  const aprobadas = docentes[0] ?? 0;

  const tarjetas: Tarjeta[] = [];

  if (agendas) {
    tarjetas.push({
      etiqueta: 'Agendas aprobadas',
      valor: `${agendas.resumenNumerico.porcentajeGlobal ?? 0}%`,
      apoyo: `${aprobadas} de ${totalDocentes} docentes`,
      icono: <CheckCircle2 className="w-5 h-5" />,
      tono: 'bg-emerald-50 text-emerald-600 border-emerald-100'
    });
  }

  if (devolucion) {
    tarjetas.push({
      etiqueta: 'Índice de devolución',
      valor: `${devolucion.resumenNumerico.porcentajeGlobal ?? 0}%`,
      apoyo: `${devolucion.resumenNumerico.total ?? 0} agenda(s) con observaciones`,
      icono: <RotateCcw className="w-5 h-5" />,
      tono: 'bg-rose-50 text-rose-600 border-rose-100'
    });
  }

  if (horas) {
    tarjetas.push({
      etiqueta: 'Horas planificadas',
      valor: `${horas.resumenNumerico.total ?? 0}`,
      apoyo: `${horas.categorias.length} funciones sustantivas`,
      icono: <Clock className="w-5 h-5" />,
      tono: 'bg-blue-50 text-blue-600 border-blue-100'
    });
  }

  if (evidencias) {
    tarjetas.push({
      etiqueta: 'Evidencias cargadas',
      valor: `${evidencias.resumenNumerico.total ?? 0}`,
      apoyo: evidencias.categorias.length
        ? `en ${evidencias.categorias.length} función(es)`
        : 'sin soportes registrados',
      icono: <FileCheck2 className="w-5 h-5" />,
      tono: 'bg-violet-50 text-violet-600 border-violet-100'
    });
  }

  if (tarjetas.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {tarjetas.map((t) => (
        <div key={t.etiqueta} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t.etiqueta}</p>
              <p className="text-3xl font-black text-slate-900 mt-1.5 leading-none tabular-nums">{t.valor}</p>
              <p className="text-xs text-slate-500 mt-2">{t.apoyo}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${t.tono}`}>
              {t.icono}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
