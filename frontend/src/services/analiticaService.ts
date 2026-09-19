// ================================================================
// SIGAP — Cliente de la API de analítica
// ----------------------------------------------------------------
// El backend entrega datos y semántica; la paleta y los estilos se
// deciden aquí en el frontend. Por eso ningún tipo de este archivo
// incluye colores.
// ================================================================

import api from './api';

export type TipoGrafico = 'kpi_card' | 'bar' | 'stacked_bar' | 'donut' | 'area' | 'table';
export type Unidad = '%' | 'h' | 'docentes' | 'evidencias';

export interface SerieAnalitica {
  nombre: string;
  clave: string;
  unidad?: Unidad;
  datos: number[];
}

export interface ResumenNumerico {
  total?: number;
  promedio?: number;
  porcentajeGlobal?: number;
}

export interface FilaBalanceDocente {
  id_usuario: number;
  docente: string;
  correo: string;
  programa: string;
  tipoContrato: string;
  horasContrato: number;
  horasAsignadas: number;
  diferencia: number;
  porcentajeOcupacion: number | null;
  funciones: number;
  balance: 'Balanceada' | 'Subcarga' | 'Sobrecarga' | 'Sin parámetro contractual';
  estadoAgenda: 'Aprobada' | 'Devuelta' | 'En revisión' | 'Pendiente';
}

export interface FilaConsolidadoPrograma {
  id_programa: number;
  programa: string;
  facultad: string;
  docentes: number;
  aprobadas: number;
  enRevision: number;
  pendientes: number;
  devueltas: number;
  horas: number;
  cumplimiento: number;
  avance: number;
}

export interface FilaBrechaEvidencia {
  id_usuario: number;
  docente: string;
  programa: string;
  funcion: string;
  actividad: string;
  indicador: string;
  meta: number;
  ejecutado: number;
  avance: number;
}

export interface MetricaAnalitica {
  indicadorId: string;
  titulo: string;
  descripcion: string;
  tipoGrafico: TipoGrafico;
  periodo: string | null;
  programa: string | null;
  categorias: string[];
  series: SerieAnalitica[];
  resumenNumerico: ResumenNumerico;
  /** El tipo concreto depende del indicador: IND-04, IND-08 o IND-09 */
  filasTabla?: FilaBalanceDocente[] | FilaConsolidadoPrograma[] | FilaBrechaEvidencia[];
  notaTecnica?: string;
}

export type TipoAmbito = 'institucion' | 'facultad' | 'programa';

export interface Ambito {
  tipo: TipoAmbito;
  idPrograma: number | null;
  idFacultad: number | null;
  /** true cuando el rol impone el alcance (Director) y no hay nada que elegir */
  bloqueado: boolean;
}

export interface ProgramaAmbito {
  id_programa: number;
  nombre_programa: string;
  docentesConAgenda: number | null;
}

export interface FacultadAmbito {
  id_facultad: number | null;
  nombre_facultad: string;
  programas: ProgramaAmbito[];
}

export interface RespuestaAmbito {
  bloqueado: boolean;
  facultades: FacultadAmbito[];
}

/** Selección del filtro en la interfaz. */
export interface FiltroAmbito {
  facultadId?: number;
  programaId?: number;
}

export interface ResumenAnalitico {
  periodo: { id_periodo: number; etiqueta: string; activo: boolean };
  programa: string | null;
  ambito: Ambito;
  generadoEn: string;
  indicadores: MetricaAnalitica[];
}

export interface PeriodoAnalitico {
  id_periodo: number;
  etiqueta: string;
  activo: boolean;
  docentesConAgenda: number;
}

export interface InterpretacionIA {
  indicadorId: string;
  periodo: string;
  resumen: string;
  hallazgos: string[];
  observaciones: string[];
  generadoEn: string;
  disponible: boolean;
  motivo?: string;
}

// ----------------------------------------------------------------

export const getPeriodos = async (): Promise<PeriodoAnalitico[]> => {
  const { data } = await api.get('/analitica/periodos');
  return data;
};

/** Arma los parámetros de consulta omitiendo los vacíos. */
const params = (periodoId?: number, filtro?: FiltroAmbito) => {
  const p: Record<string, number> = {};
  if (periodoId) p.periodoId = periodoId;
  // El programa manda sobre la facultad: es el filtro más específico
  if (filtro?.programaId) p.programaId = filtro.programaId;
  else if (filtro?.facultadId) p.facultadId = filtro.facultadId;
  return p;
};

export const getAmbito = async (periodoId?: number): Promise<RespuestaAmbito> => {
  const { data } = await api.get('/analitica/ambito', { params: params(periodoId) });
  return data;
};

export const getResumen = async (periodoId?: number, filtro?: FiltroAmbito): Promise<ResumenAnalitico> => {
  const { data } = await api.get('/analitica/resumen', { params: params(periodoId, filtro) });
  return data;
};

export const getDetalleDocentes = async (periodoId?: number, filtro?: FiltroAmbito): Promise<MetricaAnalitica> => {
  const { data } = await api.get('/analitica/docentes-detalle', { params: params(periodoId, filtro) });
  return data;
};

export const getConsolidadoProgramas = async (periodoId?: number, filtro?: FiltroAmbito): Promise<MetricaAnalitica> => {
  const { data } = await api.get('/analitica/consolidado-programas', { params: params(periodoId, filtro) });
  return data;
};

export const getBrechaEvidencias = async (periodoId?: number, filtro?: FiltroAmbito): Promise<MetricaAnalitica> => {
  const { data } = await api.get('/analitica/evidencias-brecha', { params: params(periodoId, filtro) });
  return data;
};

/**
 * Interpretación descriptiva generada por Gemini.
 * Es un extra: si falla, la analítica numérica sigue en pantalla.
 */
export const interpretar = async (indicadores: MetricaAnalitica[]): Promise<InterpretacionIA> => {
  const { data } = await api.post('/analitica/interpretar', { indicadores });
  return data;
};

/** Busca una serie por su clave dentro de una métrica. */
export const serie = (metrica: MetricaAnalitica | undefined, clave: string): number[] =>
  metrica?.series.find((s) => s.clave === clave)?.datos ?? [];

/** Empareja categorías con una serie para alimentar a Recharts. */
export const aDatosGrafico = <T extends Record<string, number>>(
  metrica: MetricaAnalitica | undefined,
  claves: Record<string, string>
): Array<{ categoria: string } & T> => {
  if (!metrica) return [];
  return metrica.categorias.map((categoria, i) => {
    const fila: Record<string, string | number> = { categoria };
    for (const [destino, clave] of Object.entries(claves)) {
      fila[destino] = serie(metrica, clave)[i] ?? 0;
    }
    return fila as { categoria: string } & T;
  });
};
