import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, Info, Trash2, XCircle } from 'lucide-react';
import { cerrarDialogo, dialogoActual, suscribirDialogos, type TipoDialogo } from './dialogo';

// Montado una sola vez en arranque.tsx: muestra los diálogos pedidos con confirmar() / avisar().

const ESTILOS: Record<TipoDialogo, { Icono: typeof Info; fondo: string; color: string; boton: string; titulo: string }> = {
  info:        { Icono: Info,          fondo: 'bg-blue-100',  color: 'text-blue-600',  boton: 'bg-[#1a2744] hover:bg-[#243560]', titulo: 'Información' },
  exito:       { Icono: CheckCircle2,  fondo: 'bg-green-100', color: 'text-green-600', boton: 'bg-[#1a2744] hover:bg-[#243560]', titulo: 'Listo' },
  error:       { Icono: XCircle,       fondo: 'bg-red-100',   color: 'text-red-600',   boton: 'bg-[#1a2744] hover:bg-[#243560]', titulo: 'Ocurrió un problema' },
  advertencia: { Icono: AlertTriangle, fondo: 'bg-amber-100', color: 'text-amber-600', boton: 'bg-[#1a2744] hover:bg-[#243560]', titulo: 'Atención' },
  peligro:     { Icono: Trash2,        fondo: 'bg-red-100',   color: 'text-red-600',   boton: 'bg-red-600 hover:bg-red-700',     titulo: 'Confirmar acción' },
  pregunta:    { Icono: HelpCircle,    fondo: 'bg-blue-100',  color: 'text-blue-600',  boton: 'bg-[#1a2744] hover:bg-[#243560]', titulo: 'Confirmar' },
};

// Línea que arranca llena y se vacía en "ms" milisegundos. Con key por aviso, cada uno empieza desde cero.
function CuentaRegresiva({ ms, color }: { ms: number; color: string }) {
  const [vaciando, setVaciando] = useState(false);
  useEffect(() => {
    const arranque = requestAnimationFrame(() => requestAnimationFrame(() => setVaciando(true)));
    return () => cancelAnimationFrame(arranque);
  }, []);
  return (
    <div className="mt-5" aria-hidden="true">
      <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: vaciando ? '0%' : '100%', transition: `width ${ms}ms linear` }} />
      </div>
      <p className="text-[11px] text-gray-400 mt-1.5">Se cierra solo en unos segundos</p>
    </div>
  );
}

export default function DialogoGlobal() {
  const pedido = useSyncExternalStore(suscribirDialogos, dialogoActual, () => null);
  const botonCancelar = useRef<HTMLButtonElement>(null);
  const botonAceptar = useRef<HTMLButtonElement>(null);
  // Avisos con cuenta regresiva: se cierran solos pasado "cerrarEn" ms (la línea de abajo muestra el tiempo)
  const cerrarEn = pedido && !pedido.conCancelar ? pedido.cerrarEn : undefined;
  useEffect(() => {
    if (!cerrarEn) return;
    const temporizador = setTimeout(() => cerrarDialogo(true), cerrarEn);
    return () => clearTimeout(temporizador);
  }, [pedido?.id, cerrarEn]);

  // Escape cancela (o cierra el aviso). El foco entra al botón seguro: en acciones peligrosas, "Cancelar".
  useEffect(() => {
    if (!pedido) return;
    (pedido.tipo === 'peligro' ? botonCancelar.current : botonAceptar.current)?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cerrarDialogo(false); }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [pedido]);

  if (!pedido) return null;

  const tipo: TipoDialogo = pedido.tipo ?? (pedido.conCancelar ? 'pregunta' : 'info');
  const { Icono, fondo, color, boton, titulo } = ESTILOS[tipo];

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-[2px] p-4"
      onClick={() => cerrarDialogo(false)}
    >
      <div
        role={pedido.conCancelar ? 'dialog' : 'alertdialog'}
        aria-modal="true"
        aria-labelledby="dialogo-titulo"
        aria-describedby="dialogo-mensaje"
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-center w-16 h-16 rounded-full ${fondo} mx-auto mb-5`}>
          <Icono className={`w-9 h-9 ${color}`} />
        </div>
        <h2 id="dialogo-titulo" className="text-xl font-bold text-[#1a2744] mb-2">{pedido.titulo ?? titulo}</h2>
        <p id="dialogo-mensaje" className="text-sm text-gray-600 mb-6 whitespace-pre-line max-h-64 overflow-y-auto">{pedido.mensaje}</p>

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          {pedido.conCancelar && (
            <button
              ref={botonCancelar}
              onClick={() => cerrarDialogo(false)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {pedido.textoCancelar ?? 'Cancelar'}
            </button>
          )}
          <button
            ref={botonAceptar}
            onClick={() => cerrarDialogo(true)}
            className={`flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-colors cursor-pointer ${boton}`}
          >
            {pedido.textoAceptar ?? (pedido.conCancelar ? 'Aceptar' : 'Entendido')}
          </button>
        </div>

        {cerrarEn && <CuentaRegresiva key={pedido.id} ms={cerrarEn} color={tipo === 'exito' ? 'bg-green-500' : tipo === 'error' ? 'bg-red-500' : 'bg-blue-500'} />}
      </div>
    </div>
  );
}
