import { useEffect, useState, useRef } from 'react';
import { LogOut, RefreshCw, ShieldAlert } from 'lucide-react';

interface SessionTimeoutModalProps {
  secondsRemaining: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

// Paleta institucional Universidad CESMAG
const AZUL = '#1a2744';
const VERDE = '#00a896';
const ROJO = '#b91c1c';

export default function SessionTimeoutModal({
  secondsRemaining,
  onStayLoggedIn,
  onLogout,
}: SessionTimeoutModalProps) {
  const [count, setCount] = useState(secondsRemaining);
  const botonPrincipal = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setCount(secondsRemaining);
  }, [secondsRemaining]);

  useEffect(() => {
    if (count <= 0) return;
    const interval = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsRemaining]);

  // El foco entra al botón principal y Escape mantiene la sesión abierta
  useEffect(() => {
    botonPrincipal.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onStayLoggedIn();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStayLoggedIn]);

  const progressPct = Math.max(0, Math.min(100, (count / secondsRemaining) * 100));
  const esUrgente = count <= 15;
  const acento = esUrgente ? ROJO : VERDE;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const RADIO = 42;
  const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

  return (
    <>
      {/* Fondo */}
      <div
        className="fixed inset-0 z-[9998] bg-slate-900/60 backdrop-blur-[2px]"
        onClick={onStayLoggedIn}
        aria-hidden="true"
      />

      {/* Diálogo */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="titulo-sesion"
          aria-describedby="descripcion-sesion"
          className="pointer-events-auto w-full max-w-[440px] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Encabezado institucional */}
          <div className="flex items-center gap-3 px-6 py-4" style={{ backgroundColor: AZUL }}>
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-[18px] h-[18px] text-white" />
            </div>
            <div className="min-w-0">
              <h2 id="titulo-sesion" className="text-white font-bold text-base leading-tight">
                Sesión por expirar
              </h2>
              <p className="text-[11px] text-slate-300 mt-0.5 tracking-wide uppercase">
                SIGAP · Universidad CESMAG
              </p>
            </div>
          </div>

          {/* Línea de acento */}
          <div className="h-[3px] w-full transition-colors duration-500" style={{ backgroundColor: acento }} />

          {/* Cuerpo */}
          <div className="px-6 py-6">
            <p id="descripcion-sesion" className="text-sm text-slate-700 leading-relaxed">
              Su sesión se cerrará automáticamente por inactividad. Seleccione
              <strong className="text-slate-900"> Continuar sesión </strong>
              si desea permanecer en el sistema.
            </p>

            {/* Temporizador */}
            <div className="mt-5 flex items-center gap-5">
              <div className="relative w-24 h-24 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r={RADIO} fill="none" stroke="#e2e8f0" strokeWidth="5" />
                  <circle
                    cx="50"
                    cy="50"
                    r={RADIO}
                    fill="none"
                    stroke={acento}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={CIRCUNFERENCIA}
                    strokeDashoffset={CIRCUNFERENCIA * (1 - progressPct / 100)}
                    style={{ transition: 'stroke-dashoffset 0.95s linear, stroke 0.5s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="text-[22px] font-bold tabular-nums tracking-tight transition-colors duration-500"
                    style={{ color: esUrgente ? ROJO : AZUL }}
                  >
                    {formatTime(count)}
                  </span>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Tiempo restante
                </p>
                <p
                  className="text-sm font-semibold mt-1 transition-colors duration-500"
                  style={{ color: esUrgente ? ROJO : '#334155' }}
                  aria-live="polite"
                >
                  {count > 0
                    ? `${count} segundo${count !== 1 ? 's' : ''} para el cierre`
                    : 'Cerrando la sesión…'}
                </p>

                <div className="mt-2.5 w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${progressPct}%`,
                      backgroundColor: acento,
                      transition: 'width 0.95s linear, background-color 0.5s ease',
                    }}
                  />
                </div>
              </div>
            </div>

            <p className="mt-5 text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-4">
              Por seguridad de la información institucional, el SIGAP finaliza las sesiones
              que permanecen inactivas. Los cambios sin guardar podrían perderse.
            </p>
          </div>

          {/* Acciones */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
            <button
              onClick={onLogout}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>

            <button
              ref={botonPrincipal}
              onClick={onStayLoggedIn}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white shadow-sm transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ backgroundColor: acento }}
            >
              <RefreshCw className="w-4 h-4" />
              Continuar sesión
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
