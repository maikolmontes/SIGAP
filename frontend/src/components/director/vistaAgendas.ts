import { useState } from 'react';

// Vista de las pestañas de "Agendas por revisar": tarjetas o lista. Se recuerda en este navegador y vale para todas.
export type Vista = 'tarjetas' | 'lista';

const CLAVE_VISTA = 'sigap_vista_agendas';

/** Vista elegida (tarjetas por defecto) y cómo cambiarla. */
export function useVistaAgendas(): [Vista, (v: Vista) => void] {
    const [vista, setVista] = useState<Vista>(() => {
        try { return localStorage.getItem(CLAVE_VISTA) === 'lista' ? 'lista' : 'tarjetas'; } catch { return 'tarjetas'; }
    });
    const cambiar = (v: Vista) => {
        setVista(v);
        try { localStorage.setItem(CLAVE_VISTA, v); } catch { /* sin almacenamiento */ }
    };
    return [vista, cambiar];
}

/** Clase común de los <select> del panel de filtros. */
export const CLASE_SELECT = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100';
