// Reemplazo de window.confirm / window.alert: en vez del cuadro gris del navegador se muestra
// un modal propio de SIGAP (DialogoGlobal.tsx, montado una sola vez en arranque.tsx).
//
//   if (!(await confirmar({ titulo: '¿Eliminar?', mensaje: '...', tipo: 'peligro' }))) return;
//   await avisar({ tipo: 'exito', mensaje: 'Usuario actualizado correctamente' });
//
// Se puede llamar desde cualquier parte (componentes, handlers, utilidades): no necesita hooks.
// Si se piden varios a la vez, se muestran uno después de otro.

export type TipoDialogo = 'info' | 'exito' | 'error' | 'advertencia' | 'peligro' | 'pregunta';

export interface OpcionesDialogo {
  titulo?: string;
  mensaje: string;
  tipo?: TipoDialogo;
  textoAceptar?: string;
  textoCancelar?: string;
  /** Milisegundos tras los que el aviso se cierra solo, con una línea de cuenta regresiva (solo en avisar) */
  cerrarEn?: number;
}

export interface PedidoDialogo extends OpcionesDialogo {
  id: number;
  /** true = se puede cancelar (confirmar); false = solo "Entendido" (avisar) */
  conCancelar: boolean;
  resolver: (aceptado: boolean) => void;
}

let contador = 0;
let cola: PedidoDialogo[] = [];
const oyentes = new Set<() => void>();

const avisarCambio = () => oyentes.forEach((o) => o());

export const suscribirDialogos = (oyente: () => void) => {
  oyentes.add(oyente);
  return () => { oyentes.delete(oyente); };
};

/** Diálogo que se está mostrando (el primero de la cola). La referencia solo cambia cuando cambia la cola. */
export const dialogoActual = (): PedidoDialogo | null => cola[0] ?? null;

export const cerrarDialogo = (aceptado: boolean) => {
  const actual = cola[0];
  if (!actual) return;
  cola = cola.slice(1);
  avisarCambio();
  actual.resolver(aceptado);
};

const encolar = (opciones: OpcionesDialogo, conCancelar: boolean) =>
  new Promise<boolean>((resolver) => {
    cola = [...cola, { ...opciones, id: ++contador, conCancelar, resolver }];
    avisarCambio();
  });

/** Pregunta Aceptar / Cancelar. Resuelve true si el usuario acepta. */
export const confirmar = (opciones: OpcionesDialogo | string): Promise<boolean> =>
  encolar(typeof opciones === 'string' ? { mensaje: opciones } : opciones, true);

/** Aviso con un solo botón. Resuelve cuando el usuario lo cierra. */
export const avisar = async (opciones: OpcionesDialogo | string): Promise<void> => {
  await encolar(typeof opciones === 'string' ? { mensaje: opciones } : opciones, false);
};
