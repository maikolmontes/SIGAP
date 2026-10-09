import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Info, Loader2, MessageCircleQuestion, Send, Sparkles, XCircle } from 'lucide-react';
import { getEstadoIA, preguntar } from '../../services/analiticaService';
import type { EstadoIA, FiltroAmbito, MetricaAnalitica } from '../../services/analiticaService';

const MIN_PREGUNTA = 8;
const MAX_PREGUNTA = 300;

const SUGERIDAS = [
  '¿Cuánto pesa Docencia Directa en la meta y cuál es el avance sin ella?',
  '¿Cuántos docentes tienen la agenda enviada y cuántos no tienen agenda?',
  '¿Cómo va la revisión de cada corte?',
  '¿Qué función sustantiva tiene el menor avance de metas?',
  '¿Cuántas evidencias se cargaron y cuántos indicadores no tienen evidencia?',
  '¿Qué porcentaje de las agendas fue devuelto?'
];

const MOTIVOS: Record<string, string> = {
  no_configurado: 'El asistente no está configurado en este entorno.',
  limite_diario: 'Llegaste al límite de preguntas de hoy. Mañana podrás hacer más; las preguntas que ya hiciste se pueden repetir sin gastar el límite.',
  limite_alcanzado: 'Estás preguntando muy rápido. Espera un momento e intenta de nuevo.',
  cuota_agotada: 'Se agotó la cuota del servicio de IA por ahora. Intenta más tarde.',
  pregunta_invalida: `Escribe una pregunta un poco más completa (mínimo ${MIN_PREGUNTA} caracteres).`,
  pregunta_larga: `La pregunta es muy larga (máximo ${MAX_PREGUNTA} caracteres).`,
  sin_datos: 'No hay indicadores para consultar en este período.',
  sin_periodo: 'No hay un período para consultar.',
  respuesta_vacia: 'El servicio no devolvió contenido. Intenta de nuevo.',
  respuesta_incompleta: 'La respuesta llegó incompleta. Intenta de nuevo.',
  error_proveedor: 'El servicio de IA no está disponible en este momento.',
  error_interno: 'Ocurrió un error al responder la pregunta.'
};

interface Turno {
  id: number;
  pregunta: string;
  alcance: string;
  estado: 'cargando' | 'respondida' | 'sin_respuesta' | 'error';
  respuesta?: string;
  usados?: string[];
  mensaje?: string;
}

interface Props {
  periodoId?: number;
  filtro: FiltroAmbito;
  etiquetaPeriodo: string;
  programa: string | null;
  indicadores: MetricaAnalitica[];
}

const PUEDE = [
  'Describir las cifras del período y del alcance que estás viendo: estado y cobertura de las agendas, horas por función, avance de metas por corte, evidencias y revisión de los cortes.',
  'Comparar funciones sustantivas entre sí y, cuando tu alcance incluye varios programas, comparar programas.',
  'Decirte de qué indicador sale cada cifra, para que la verifiques en los gráficos.'
];

const NO_PUEDE = [
  'Dar nombres, correos o datos de personas: no ve información individual de los docentes.',
  'Predecir resultados, recomendar decisiones o juzgar la contratación o el desempeño de alguien: solo describe lo que pasó.',
  'Responder sobre otros períodos distintos al seleccionado arriba, ni sobre programas que no gestionas.',
  'Consultar la base de datos, ni crear o modificar información.'
];

/** Qué puede y qué no puede responder la IA, para que el usuario sepa qué esperar. */
function AlcanceAsistente({ indicadores, estado }: { indicadores: MetricaAnalitica[]; estado: EstadoIA | null }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-slate-50/60">
      <summary className="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none list-none text-sm font-semibold text-slate-700 hover:text-slate-900">
        <Info className="w-4 h-4 text-teal-600 shrink-0" />
        <span className="flex-1">Alcance del asistente: qué puede y qué no puede responder</span>
        <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="px-4 pb-4 pt-1 space-y-4">
        {estado && !estado.habilitado && (
          <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> El asistente no está configurado en este entorno, por eso no podrá responder todavía.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-2">Sí puede</p>
            <ul className="space-y-2">
              {PUEDE.map(t => (
                <li key={t} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-px" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 mb-2">No puede</p>
            <ul className="space-y-2">
              {NO_PUEDE.map(t => (
                <li key={t} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-px" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="text-xs text-slate-600 leading-relaxed space-y-1.5 border-t border-slate-200 pt-3">
          <p>
            <strong className="text-slate-700">Cómo funciona.</strong> El sistema calcula las cifras del período y del alcance seleccionados y la IA solo ve
            esos números agregados. Si lo que preguntas no está ahí, te lo dice en vez de inventar. Puede equivocarse, por eso cada respuesta
            indica de qué indicador sale.
          </p>
          {estado && (
            <p>
              <strong className="text-slate-700">Límite.</strong> Hasta {estado.preguntasPorDia} preguntas por persona al día. Repetir una pregunta
              ya hecha sobre las mismas cifras no cuenta.
            </p>
          )}
          {indicadores.length > 0 && (
            <p>
              <strong className="text-slate-700">Indicadores que consulta ahora ({indicadores.length}).</strong>{' '}
              {indicadores.map(i => i.titulo).join(' · ')}.
            </p>
          )}
        </div>
      </div>
    </details>
  );
}

/** Caja de preguntas sobre los resultados del panel: la IA responde solo con las cifras agregadas del período. */
export default function AsistentePreguntas({ periodoId, filtro, etiquetaPeriodo, programa, indicadores }: Props) {
  const [texto, setTexto] = useState('');
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [restantes, setRestantes] = useState<number | null>(null);
  const contador = useRef(0);
  const [estado, setEstado] = useState<EstadoIA | null>(null);

  useEffect(() => { getEstadoIA().then(setEstado).catch(() => setEstado(null)); }, []);

  const titulo = (id: string) => indicadores.find(i => i.indicadorId === id)?.titulo;
  const limpio = texto.trim();
  const puedeEnviar = !enviando && limpio.length >= MIN_PREGUNTA && limpio.length <= MAX_PREGUNTA;

  const enviar = async (pregunta: string) => {
    const id = ++contador.current;
    const alcance = [etiquetaPeriodo, programa].filter(Boolean).join(' · ');
    setTurnos(prev => [{ id, pregunta, alcance, estado: 'cargando' }, ...prev])
    setEnviando(true);
    setTexto('');
    try {
      const r = await preguntar(pregunta, periodoId, filtro);
      if (typeof r.restantesHoy === 'number') setRestantes(r.restantesHoy);
      // El alcance que se muestra es el que usó el servidor (un director siempre queda dentro de sus programas)
      const alcanceReal = [r.periodo, r.alcance].filter(Boolean).join(' · ') || alcance;
      setTurnos(prev => prev.map(t => (t.id !== id ? t : r.disponible
        ? { ...t, alcance: alcanceReal, estado: r.respondible ? 'respondida' : 'sin_respuesta', respuesta: r.respuesta, usados: r.indicadoresUsados }
        : { ...t, alcance: alcanceReal, estado: 'error', mensaje: MOTIVOS[r.motivo ?? ''] ?? 'No se pudo obtener la respuesta. Intenta de nuevo.' })));
    } catch {
      setTurnos(prev => prev.map(t => (t.id !== id ? t : { ...t, estado: 'error', mensaje: 'No se pudo conectar con el servidor. Intenta de nuevo.' })));
    } finally {
      setEnviando(false);
    }
  };

  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    if (puedeEnviar) enviar(limpio);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-2.5 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1a2744] to-[#00a896] flex items-center justify-center shrink-0">
          <MessageCircleQuestion className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-extrabold text-slate-900">Pregúntale a los resultados</h3>
          <p className="text-[11px] text-slate-500">
            Respuestas basadas solo en las cifras de {etiquetaPeriodo || 'este período'}{programa ? ` · ${programa}` : ''}
          </p>
        </div>
        {restantes !== null && (
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 rounded-lg px-2 py-1 shrink-0">
            {restantes} {restantes === 1 ? 'pregunta' : 'preguntas'} hoy
          </span>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        <AlcanceAsistente indicadores={indicadores} estado={estado} />

        <form onSubmit={alEnviar} className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 min-w-0">
            <label htmlFor="pregunta-ia" className="sr-only">Pregunta sobre los resultados</label>
            <input
              id="pregunta-ia"
              type="text"
              value={texto}
              onChange={e => setTexto(e.target.value)}
              maxLength={MAX_PREGUNTA}
              placeholder="Escribe tu pregunta, por ejemplo: ¿cómo va el avance de metas?"
              autoComplete="off"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00a896]/30 focus:border-[#00a896]"
            />
          </div>
          <button
            type="submit"
            disabled={!puedeEnviar}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1a2744] hover:bg-[#24365f] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Preguntar
          </button>
        </form>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Preguntas sugeridas</p>
          <div className="flex flex-wrap gap-2">
            {SUGERIDAS.map(s => (
              <button
                key={s}
                type="button"
                disabled={enviando}
                onClick={() => enviar(s)}
                className="text-left text-xs text-slate-600 bg-slate-50 hover:bg-teal-50 hover:text-teal-800 border border-slate-200 hover:border-teal-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div aria-live="polite" className="space-y-3">
          {turnos.map(t => (
            <div key={t.id} className="rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50/80">
                <p className="text-sm font-semibold text-slate-800">{t.pregunta}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{t.alcance}</p>
              </div>
              <div className="px-4 py-3">
                {t.estado === 'cargando' && (
                  <div className="space-y-2 animate-pulse" role="status">
                    <div className="h-3 bg-slate-100 rounded w-10/12" />
                    <div className="h-3 bg-slate-100 rounded w-7/12" />
                    <span className="sr-only">Buscando la respuesta en las cifras…</span>
                  </div>
                )}
                {t.estado === 'error' && (
                  <p className="flex items-start gap-2 text-sm text-slate-600">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" /> {t.mensaje}
                  </p>
                )}
                {(t.estado === 'respondida' || t.estado === 'sin_respuesta') && (
                  <div className="space-y-2.5">
                    <p className={`text-sm leading-relaxed ${t.estado === 'sin_respuesta' ? 'text-amber-800' : 'text-slate-800'}`}>
                      {t.respuesta}
                    </p>
                    {t.usados && t.usados.length > 0 && (
                      <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="font-semibold">Cifras tomadas de:</span>
                        {t.usados.map(u => (
                          <span key={u} title={titulo(u)} className="font-bold bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                            {u}{titulo(u) ? ` · ${titulo(u)}` : ''}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            La respuesta la genera una IA a partir de cifras agregadas (sin nombres ni correos) y puede equivocarse: verifícala en los gráficos.
            No escribas nombres de personas en la pregunta; el texto se envía al servicio de IA.
          </span>
        </p>
      </div>
    </div>
  );
}
