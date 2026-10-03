// ================================================================
// Paleta institucional de la analítica SIGAP.
// El backend nunca envía colores: la presentación se decide aquí.
// ================================================================

export const CESMAG = {
  azul: '#1a2744',
  verde: '#00a896',
  naranja: '#ea580c'
} as const;

/** Colores por estado de agenda — semánticos, no decorativos. */
export const COLOR_ESTADO: Record<string, string> = {
  'Aprobada': '#10B981',
  'En revisión': '#3B82F6',
  'Pendiente': '#F59E0B',
  'Devuelta': '#EF4444',
  'Sin devolución': '#E2E8F0'
};

/** Serie categórica para funciones sustantivas. */
export const COLORES_FUNCION = [
  '#1a2744', '#00a896', '#3B82F6', '#8B5CF6', '#ea580c', '#0891B2', '#65A30D', '#BE123C'
];

export const colorFuncion = (i: number) => COLORES_FUNCION[i % COLORES_FUNCION.length];

/** Color del badge según el balance contractual. */
export const COLOR_BALANCE: Record<string, string> = {
  'Balanceada': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Subcarga': 'bg-amber-50 text-amber-700 border-amber-200',
  'Sobrecarga': 'bg-rose-50 text-rose-700 border-rose-200',
  'Sin parámetro contractual': 'bg-slate-100 text-slate-500 border-slate-200'
};

export const COLOR_ESTADO_BADGE: Record<string, string> = {
  'Aprobada': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'En revisión': 'bg-blue-50 text-blue-700 border-blue-200',
  'Pendiente': 'bg-amber-50 text-amber-700 border-amber-200',
  'Devuelta': 'bg-rose-50 text-rose-700 border-rose-200'
};

/** Tooltip uniforme para todos los gráficos. */
export const estiloTooltip = {
  contentStyle: {
    borderRadius: '0.75rem',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 12px rgba(15,23,42,.08)',
    fontSize: '12px'
  },
  labelStyle: { fontWeight: 700, color: CESMAG.azul, marginBottom: 4 }
};
