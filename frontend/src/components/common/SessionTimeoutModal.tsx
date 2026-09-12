import { useEffect, useState, useCallback } from 'react';
import { LogOut, Clock, RefreshCw, ShieldAlert } from 'lucide-react';

interface SessionTimeoutModalProps {
  secondsRemaining: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

export default function SessionTimeoutModal({
  secondsRemaining,
  onStayLoggedIn,
  onLogout,
}: SessionTimeoutModalProps) {
  const [count, setCount] = useState(secondsRemaining);

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

  const progressPct = Math.max(0, (count / secondsRemaining) * 100);
  const isUrgent = count <= 15;

  // Formato MM:SS
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <>
      {/* Backdrop con blur */}
      <div
        className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onStayLoggedIn}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`
            pointer-events-auto w-full max-w-md rounded-2xl shadow-2xl
            bg-white border-2 transition-all duration-300
            animate-in slide-in-from-bottom-4 fade-in duration-300
            ${isUrgent ? 'border-red-300' : 'border-amber-200'}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header con degradado */}
          <div
            className={`
              relative overflow-hidden rounded-t-2xl px-6 pt-6 pb-8
              ${isUrgent
                ? 'bg-gradient-to-br from-red-500 to-red-700'
                : 'bg-gradient-to-br from-amber-400 to-orange-500'
              }
            `}
          >
            {/* Ícono animado */}
            <div className="flex justify-center mb-4">
              <div
                className={`
                  w-16 h-16 rounded-full flex items-center justify-center shadow-lg
                  ${isUrgent ? 'bg-red-600/40 animate-pulse' : 'bg-amber-500/40'}
                `}
              >
                <ShieldAlert className="w-8 h-8 text-white" />
              </div>
            </div>

            {/* Título */}
            <h2 className="text-center text-white font-black text-xl mb-1 tracking-tight">
              ¿Sigues ahí?
            </h2>
            <p className="text-center text-white/85 text-sm font-medium">
              Tu sesión está a punto de cerrarse por inactividad
            </p>

            {/* Ondas decorativas */}
            <div className="absolute -bottom-4 left-0 right-0">
              <svg viewBox="0 0 400 20" className="w-full" preserveAspectRatio="none">
                <path d="M0,10 Q100,0 200,10 Q300,20 400,10 L400,20 L0,20 Z" fill="white" />
              </svg>
            </div>
          </div>

          {/* Cuerpo */}
          <div className="px-6 pb-6 pt-2">

            {/* Contador grande */}
            <div className="flex flex-col items-center mb-5">
              <div
                className={`
                  relative flex items-center justify-center w-28 h-28 rounded-full border-4 mb-2
                  ${isUrgent ? 'border-red-400' : 'border-amber-300'}
                `}
              >
                {/* SVG progreso circular */}
                <svg
                  className="absolute inset-0 w-full h-full -rotate-90"
                  viewBox="0 0 112 112"
                >
                  <circle
                    cx="56" cy="56" r="50"
                    fill="none"
                    stroke={isUrgent ? '#fee2e2' : '#fef3c7'}
                    strokeWidth="8"
                  />
                  <circle
                    cx="56" cy="56" r="50"
                    fill="none"
                    stroke={isUrgent ? '#ef4444' : '#f59e0b'}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 50}`}
                    strokeDashoffset={`${2 * Math.PI * 50 * (1 - progressPct / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.9s linear' }}
                  />
                </svg>
                {/* Número */}
                <div className="flex flex-col items-center z-10">
                  <Clock className={`w-4 h-4 mb-0.5 ${isUrgent ? 'text-red-500' : 'text-amber-500'}`} />
                  <span
                    className={`text-2xl font-black tabular-nums leading-none ${isUrgent ? 'text-red-600' : 'text-amber-600'}`}
                  >
                    {formatTime(count)}
                  </span>
                </div>
              </div>

              <p className={`text-sm font-semibold text-center ${isUrgent ? 'text-red-600' : 'text-gray-600'}`}>
                {count > 0
                  ? <>La sesión se cerrará en <strong>{count}</strong> segundo{count !== 1 ? 's' : ''}</>
                  : 'Cerrando sesión...'
                }
              </p>
            </div>

            {/* Barra de progreso lineal */}
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-5">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-linear ${isUrgent ? 'bg-red-500' : 'bg-amber-400'}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={onLogout}
                className="
                  flex-1 flex items-center justify-center gap-2
                  py-2.5 px-4 rounded-xl font-semibold text-sm
                  border-2 border-gray-200 text-gray-600
                  hover:bg-gray-50 hover:border-gray-300
                  transition-all duration-150 active:scale-95
                "
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </button>

              <button
                onClick={onStayLoggedIn}
                className={`
                  flex-1 flex items-center justify-center gap-2
                  py-2.5 px-4 rounded-xl font-bold text-sm text-white
                  shadow-md transition-all duration-150 active:scale-95
                  ${isUrgent
                    ? 'bg-red-500 hover:bg-red-600 shadow-red-200'
                    : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
                  }
                `}
              >
                <RefreshCw className="w-4 h-4" />
                Continuar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
