import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export interface PermisosAcciones {
  puedeVer: boolean;
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
  cargando: boolean;
}

export function usePermisosPagina(nombrePagina: string): PermisosAcciones {
  const [acciones, setAcciones] = useState<PermisosAcciones>({
    puedeVer: true,
    puedeCrear: true,
    puedeEditar: true,
    puedeEliminar: true,
    cargando: true
  });

  const verificarPermisos = useCallback(async () => {
    try {
      let roleId: number | null = null;
      let nombreRol = '';

      const stored = localStorage.getItem('sigap_active_role');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          roleId = parsed.id_rol;
          nombreRol = (parsed.nombre_rol || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        } catch { /* ignore */ }
      }

      // Si es planeacion o admin y no hay roleId explícito, por defecto tiene todos
      if (!roleId) {
        setAcciones({
          puedeVer: true,
          puedeCrear: true,
          puedeEditar: true,
          puedeEliminar: true,
          cargando: false
        });
        return;
      }

      const res = await api.get(`/permisos/rol/${roleId}`);
      const mapa = res.data.mapaPermisos || {};

      // Si el rol no tiene NINGÚN permiso configurado, acceso total
      if (Object.keys(mapa).length === 0) {
        setAcciones({
          puedeVer: true,
          puedeCrear: true,
          puedeEditar: true,
          puedeEliminar: true,
          cargando: false
        });
        return;
      }
      
      // Buscar coincidencia exacta o parcial normalizada
      const targetLow = nombrePagina.toLowerCase().trim();
      let listaAcciones: string[] = mapa[nombrePagina] || [];

      if (listaAcciones.length === 0) {
        const foundKey = Object.keys(mapa).find(k => k.toLowerCase().trim() === targetLow || k.toLowerCase().includes(targetLow) || targetLow.includes(k.toLowerCase()));
        if (foundKey) {
          listaAcciones = mapa[foundKey] || [];
        }
      }

      // Si esta página no está configurada en el mapa, acceso total
      if (listaAcciones.length === 0) {
        setAcciones({
          puedeVer: true,
          puedeCrear: true,
          puedeEditar: true,
          puedeEliminar: true,
          cargando: false
        });
        return;
      }

      setAcciones({
        puedeVer: listaAcciones.includes('Ver'),
        puedeCrear: listaAcciones.includes('Crear'),
        puedeEditar: listaAcciones.includes('Editar'),
        puedeEliminar: listaAcciones.includes('Eliminar'),
        cargando: false
      });
    } catch (err) {
      console.error(`Error verificando permisos para ${nombrePagina}:`, err);
      // En caso de fallo de red, mantener cargando false
      setAcciones(prev => ({ ...prev, cargando: false }));
    }
  }, [nombrePagina]);

  useEffect(() => {
    verificarPermisos();

    const handler = () => {
      verificarPermisos();
    };

    window.addEventListener('sigap_permisos_actualizados', handler);
    window.addEventListener('storage', handler);

    return () => {
      window.removeEventListener('sigap_permisos_actualizados', handler);
      window.removeEventListener('storage', handler);
    };
  }, [verificarPermisos]);

  return acciones;
}
