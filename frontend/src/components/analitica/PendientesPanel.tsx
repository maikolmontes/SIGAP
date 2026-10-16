import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { MetricaAnalitica } from '../../services/analiticaService';
import { serie } from '../../services/analiticaService';
import PanelGrafico from './PanelGrafico';

interface Props {
  /** IND-01: estado de las agendas de los docentes */
  agendas?: MetricaAnalitica;
  /** IND-11: revisión de los cortes */
  revision?: MetricaAnalitica;
  /** Solo el director revisa, así que solo él recibe los enlaces */
  rol: 'planeacion' | 'director' | 'consultor';
}

interface Pendiente {
  n: number;
  texto: string;
  /** true = es algo que le toca hacer al director */
  accion: boolean;
  enlace?: string;
}

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

/** Lo que está esperando acción ahora mismo, en palabras sencillas: lo primero que mira el director. */
export default function PendientesPanel({ agendas, revision, rol }: Props) {
  // Sin docentes en el período no hay nada que decir: la pantalla ya avisa que no hay actividad
  if (!agendas || (agendas.resumenNumerico.total ?? 0) === 0) return null;

  const docentesEn = (estado: string) => {
    const i = agendas.categorias.indexOf(estado);
    return i < 0 ? 0 : (serie(agendas, 'docentes')[i] ?? 0);
  };
  const porRevisar = serie(revision, 'porRevisar');
  const cortes = revision?.categorias ?? [];
  const esDirector = rol === 'director';

  const enRevision = docentesEn('En revisión');
  const pendientes = docentesEn('Pendiente');
  const devueltas = docentesEn('Devuelta');
  const porAprobar = docentesEn('Por aprobar');
  const sinCarga = docentesEn('Sin carga');

  const lista: Pendiente[] = [
    { n: enRevision, accion: true, enlace: '/director/agendas', texto: plural(enRevision, 'agenda espera la revisión del director', 'agendas esperan la revisión del director') },
    ...cortes.map((corte, i) => {
      const n = porRevisar[i] ?? 0;
      return { n, accion: true, enlace: '/director/agendas', texto: `${plural(n, 'función espera', 'funciones esperan')} la revisión del director en la ${corte}` };
    }),
    { n: devueltas, accion: false, texto: plural(devueltas, 'agenda devuelta, a la espera de que el docente la corrija', 'agendas devueltas, a la espera de que los docentes las corrijan') },
    { n: pendientes, accion: false, texto: plural(pendientes, 'docente aún no termina su agenda', 'docentes aún no terminan su agenda') },
    { n: porAprobar, accion: false, texto: plural(porAprobar, 'docente con la carga por aprobar: todavía no puede crear su agenda', 'docentes con la carga por aprobar: todavía no pueden crear su agenda') },
    { n: sinCarga, accion: false, texto: plural(sinCarga, 'docente del período sin carga asignada', 'docentes del período sin carga asignada') },
  ].filter((p) => p.n > 0);

  const hayAccion = lista.some((p) => p.accion);

  return (
    <PanelGrafico
      titulo="Qué hay pendiente"
      descripcion="Lo que está esperando acción en este período, en una mirada."
    >
      {lista.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Todo al día: no hay nada pendiente en este período.
        </p>
      ) : (
        <>
          {!hayAccion && (
            <p className="flex items-center gap-2 text-sm text-emerald-700 mb-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> No hay nada esperando tu revisión.
            </p>
          )}
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {lista.map((p) => (
              <li
                key={p.texto}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${p.accion ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-slate-200'}`}
              >
                <span className={`text-2xl font-black tabular-nums leading-none min-w-8 text-center ${p.accion ? 'text-amber-600' : 'text-slate-700'}`}>{p.n}</span>
                <span className="text-sm text-slate-700 leading-snug flex-1">{p.texto}</span>
                {esDirector && p.accion && p.enlace && (
                  <Link to={p.enlace} className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900">
                    Revisar <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </PanelGrafico>
  );
}
