import api from './api';

export interface RolItem {
  id_rol: number;
  nombre_rol: string;
  descripcion_rol?: string;
}

export interface PaginaPermisos {
  nombre: string;
  descripcion: string;
  acciones: {
    Ver?: number;
    Crear?: number;
    Editar?: number;
    Eliminar?: number;
    [key: string]: number | undefined;
  };
}

export interface ModuloPermisos {
  modulo: string;
  paginas: PaginaPermisos[];
}

export interface CatalogoPermisosResponse {
  roles: RolItem[];
  modulos: ModuloPermisos[];
  asignaciones: Record<string, number[]>;
}

export interface PermisosRolResponse {
  id_rol: number;
  paginasVer: string[];
  mapaPermisos: Record<string, string[]>;
  permisos: Array<{
    id_permisos: number;
    modulo: string;
    pagina: string;
    accion: string;
  }>;
}

export const getPermisosByRol = (id_rol: number) => {
  return api.get<PermisosRolResponse>(`/permisos/rol/${id_rol}`);
};

export const getCatalogoPermisos = () => {
  return api.get<CatalogoPermisosResponse>('/permisos/catalogo');
};

export const updateRolPermisos = (id_rol: number, permisosIds: number[]) => {
  return api.put(`/permisos/roles/${id_rol}`, { permisosIds });
};

export const copiarPermisosRol = (id_rol_origen: number, id_rol_destino: number) => {
  return api.post('/permisos/copiar', { id_rol_origen, id_rol_destino });
};
