import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import api from '../../services/api';
import {
  Users, CheckCircle, Clock, TrendingUp, AlertCircle,
  Upload, UploadCloud, X, ClipboardList, Calendar, Lock,
  FileBarChart2, RefreshCw, Trash2, ChevronDown, ChevronUp, UserX, Info, BookOpen, Search,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];

// Estado de la agenda de un docente, en orden de precedencia:
// Sin asignar → Devuelta → Aprobada → Completa → En progreso → Pendiente
const getEstadoDocente = (d: any) => {
  const total = parseInt(d.total_funciones) || 0;
  const aceptadas = parseInt(d.funciones_aceptadas) || 0;
  const aprobadas = parseInt(d.funciones_aprobadas) || 0;
  const devueltas = parseInt(d.funciones_devueltas) || 0;
  // El Director ya aprobó: cuenta como diligenciada
  const diligenciadas = aceptadas + aprobadas;

  if (total === 0) return { label: 'Sin asignar', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
  if (devueltas > 0) return { label: 'Devuelta', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' };
  if (aprobadas >= total) return { label: 'Aprobada', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' };
  if (diligenciadas >= total) return { label: 'Completa', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' };
  if (diligenciadas > 0) return { label: 'En progreso', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' };
  return { label: 'Pendiente', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' };
};

// ─────────────────────────────────────────────────────────────
// Panel de resultado de importación con advertencias detalladas.
// En vista previa (simulacion = true) no se guardó nada: muestra el
// mismo informe y los botones para confirmar o cancelar.
// ─────────────────────────────────────────────────────────────
interface AlertaImportacion {
  documento: string;
  docente: string;
  nivel: 'advertencia' | 'info';
  mensaje: string;
}

function ImportResultPanel({ result, onClose, onConfirmar, confirmando }: {
  result: any;
  onClose: () => void;
  onConfirmar?: () => void;
  confirmando?: boolean;
}) {
  const [showNoEncontrados, setShowNoEncontrados] = useState(true);
  const [showErrores, setShowErrores] = useState(false);
  const [showAlertas, setShowAlertas] = useState(true);
  const [verInformativas, setVerInformativas] = useState(false);

  if (!result.success) {
    return (
      <div className="mb-6 p-5 rounded-2xl border border-red-200 bg-red-50 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
          <p className="font-bold text-red-900">{result.error}</p>
        </div>
      </div>
    );
  }

  const esVistaPrevia = !!result.data?.simulacion;
  const r = result.data?.resultados || {};
  const noEncontrados: any[] = r.docentesNoEncontrados || [];
  const erroresTecnicos: string[] = r.detallesErrores || [];
  const alertas: AlertaImportacion[] = r.alertas || [];
  const clasesOtrosProgramas: { programa: string; filas: number }[] = r.clasesOtrosProgramas || [];
  const procesados: number = (r.procesados || 0) + (r.actualizados || 0);
  const totalNoEncontrados: number = r.totalNoEncontrados || 0;
  const tieneAdvertencias = totalNoEncontrados > 0;
  const tieneErrores = erroresTecnicos.length > 0;

  // Alertas agrupadas por docente; las informativas se muestran a pedido
  const visibles = verInformativas ? alertas : alertas.filter(a => a.nivel === 'advertencia');
  const porDocente = new Map<string, { docente: string; items: AlertaImportacion[] }>();
  for (const a of visibles) {
    if (!porDocente.has(a.documento)) porDocente.set(a.documento, { docente: a.docente, items: [] });
    porDocente.get(a.documento)!.items.push(a);
  }
  const totalAdvertencias = alertas.filter(a => a.nivel === 'advertencia').length;
  const totalInformativas = alertas.length - totalAdvertencias;

  const cabecera = esVistaPrevia
    ? { fondo: 'bg-indigo-50 border-indigo-200', icono: <Info className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />, titulo: 'text-indigo-900', texto: 'text-indigo-700' }
    : { fondo: 'bg-green-50 border-green-200', icono: <CheckCircle className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />, titulo: 'text-green-900', texto: 'text-green-700' };

  return (
    <div className="mb-6 rounded-2xl border overflow-hidden shadow-sm">
      {/* Cabecera */}
      <div className={`${cabecera.fondo} border-b px-5 py-4 flex items-start justify-between gap-3`}>
        <div className="flex items-start gap-3">
          {cabecera.icono}
          <div>
            <p className={`font-bold ${cabecera.titulo}`}>
              {esVistaPrevia ? `Vista previa de la ${result.tipo.toLowerCase()} — todavía no se guardó nada` : `${result.tipo} procesada correctamente`}
            </p>
            <p className={`text-sm mt-0.5 ${cabecera.texto}`}>
              <span className="font-semibold">{procesados}</span> de {r.filasLeidas ?? procesados} fila{(r.filasLeidas ?? procesados) !== 1 ? 's' : ''} {esVistaPrevia ? 'se cargarían' : 'cargadas'}
              {' '}para <span className="font-semibold">{r.docentesProcesados ?? 0}</span> docente{r.docentesProcesados !== 1 ? 's' : ''}
              {r.contratosActualizados > 0 && <> · {r.contratosActualizados} contrato{r.contratosActualizados !== 1 ? 's' : ''} {esVistaPrevia ? 'se actualizarían' : 'actualizados'} desde la columna VIN</>}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5" aria-label="Cerrar"><X className="w-5 h-5" /></button>
      </div>

      {/* Resumen de contadores */}
      <div className="bg-white px-5 py-3 flex flex-wrap gap-x-5 gap-y-2 border-b border-gray-100 text-sm">
        <span className="flex items-center gap-2 text-gray-700">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
          <span className="font-semibold text-gray-900">{r.procesados || 0}</span> nuevas
        </span>
        {(r.actualizados || 0) > 0 && (
          <span className="flex items-center gap-2 text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            <span className="font-semibold text-gray-900">{r.actualizados}</span> actualizadas
          </span>
        )}
        {(r.conservados || 0) > 0 && (
          <span className="flex items-center gap-2 text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
            <span className="font-semibold text-gray-900">{r.conservados}</span> conservadas (ya diligenciadas)
          </span>
        )}
        {tieneAdvertencias && (
          <span className="flex items-center gap-2 text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            <span className="font-semibold text-amber-700">{totalNoEncontrados}</span> docente{totalNoEncontrados !== 1 ? 's' : ''} omitido{totalNoEncontrados !== 1 ? 's' : ''}
          </span>
        )}
        {totalAdvertencias > 0 && (
          <span className="flex items-center gap-2 text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
            <span className="font-semibold text-orange-700">{r.docentesConAlertas}</span> docente{r.docentesConAlertas !== 1 ? 's' : ''} con alertas
          </span>
        )}
        {tieneErrores && (
          <span className="flex items-center gap-2 text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            <span className="font-semibold text-red-700">{erroresTecnicos.length}</span> error{erroresTecnicos.length !== 1 ? 'es' : ''}
          </span>
        )}
      </div>

      {/* Clases de programas que no están registrados en SIGAP */}
      {clasesOtrosProgramas.length > 0 && (
        <div className="px-5 py-2.5 bg-slate-50 border-b border-gray-100 text-xs text-slate-600 flex items-start gap-1.5">
          <BookOpen className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Clases en programas no registrados en SIGAP, cargadas como Docencia Directa:{' '}
            {clasesOtrosProgramas.map(c => `${c.programa} (${c.filas})`).join(', ')}.
          </span>
        </div>
      )}

      {/* Panel: Alertas de la carga (horas vs contrato, 30 %, actividades) */}
      {alertas.length > 0 && (
        <div className="border-b border-orange-100">
          <button
            onClick={() => setShowAlertas(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 bg-orange-50 hover:bg-orange-100 transition-colors text-left"
          >
            <span className="flex items-center gap-2 font-semibold text-orange-800 text-sm">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              Revisión de la carga: {totalAdvertencias} alerta{totalAdvertencias !== 1 ? 's' : ''}
              {totalInformativas > 0 && <span className="font-normal text-orange-700">· {totalInformativas} nota{totalInformativas !== 1 ? 's' : ''}</span>}
            </span>
            {showAlertas ? <ChevronUp className="w-4 h-4 text-orange-600" /> : <ChevronDown className="w-4 h-4 text-orange-600" />}
          </button>
          {showAlertas && (
            <div className="bg-white">
              <div className="px-5 py-2 bg-orange-50/50 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-orange-700 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Las alertas no impiden la carga: el listado es la asignación oficial y el Director la revisa.
                </p>
                {totalInformativas > 0 && (
                  <label className="text-xs text-gray-600 flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={verInformativas} onChange={e => setVerInformativas(e.target.checked)} />
                    Ver también las notas informativas
                  </label>
                )}
              </div>
              <ul className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                {[...porDocente].map(([documento, g]) => (
                  <li key={documento} className="px-5 py-2.5">
                    <p className="text-sm font-semibold text-gray-800">
                      {g.docente} <span className="font-mono text-xs text-gray-400">{documento}</span>
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {g.items.map((a, i) => (
                        <li key={i} className={`text-xs ${a.nivel === 'advertencia' ? 'text-orange-700' : 'text-gray-500'}`}>
                          {a.nivel === 'advertencia' ? '⚠ ' : '· '}{a.mensaje}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
                {porDocente.size === 0 && (
                  <li className="px-5 py-3 text-xs text-gray-500">Sin alertas; marque la casilla para ver las notas informativas.</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Panel: Docentes omitidos */}
      {tieneAdvertencias && (
        <div className="border-b border-amber-100">
          <button
            onClick={() => setShowNoEncontrados(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <UserX className="w-4 h-4 text-amber-600" />
              <span className="font-semibold text-amber-800 text-sm">
                {totalNoEncontrados} docente{totalNoEncontrados !== 1 ? 's' : ''} del Excel no se {totalNoEncontrados !== 1 ? 'cargaron' : 'cargó'} con este programa
              </span>
            </div>
            {showNoEncontrados
              ? <ChevronUp className="w-4 h-4 text-amber-600" />
              : <ChevronDown className="w-4 h-4 text-amber-600" />
            }
          </button>
          {showNoEncontrados && (
            <div className="bg-white">
              <div className="px-5 py-2 bg-amber-50/50">
                <p className="text-xs text-amber-700 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Si no existe, regístrelo en <strong>Docentes</strong> y vuelva a importar. Si pertenece a otro programa, su carga se importa con el listado de ese programa.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-y border-gray-100">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-bold">Documento</th>
                      <th className="px-4 py-2.5 text-left font-bold">Nombre</th>
                      <th className="px-4 py-2.5 text-left font-bold">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {noEncontrados.map((d: any, idx: number) => (
                      <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-gray-800 font-mono">{d.documento}</td>
                        <td className="px-4 py-2.5 text-gray-700">{d.nombre || <span className="text-gray-400 italic">—</span>}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{d.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Panel: Errores */}
      {tieneErrores && (
        <div>
          <button
            onClick={() => setShowErrores(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 bg-red-50 hover:bg-red-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="font-semibold text-red-800 text-sm">
                {erroresTecnicos.length} fila{erroresTecnicos.length !== 1 ? 's' : ''} con error (no se cargaron)
              </span>
            </div>
            {showErrores
              ? <ChevronUp className="w-4 h-4 text-red-500" />
              : <ChevronDown className="w-4 h-4 text-red-500" />
            }
          </button>
          {showErrores && (
            <ul className="bg-white px-5 py-3 space-y-1 border-t border-red-100">
              {erroresTecnicos.map((e: string, idx: number) => (
                <li key={idx} className="text-xs text-red-700 font-mono bg-red-50 rounded px-2 py-1">{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Confirmación de la vista previa */}
      {esVistaPrevia && onConfirmar && (
        <div className="bg-gray-50 px-5 py-3 flex flex-wrap items-center justify-end gap-3 border-t border-gray-100">
          <button onClick={onClose} disabled={confirmando} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={confirmando || procesados === 0}
            className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed rounded-lg inline-flex items-center gap-2"
          >
            {confirmando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {confirmando ? 'Guardando…' : `Confirmar ${result.tipo.toLowerCase()}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Panel de Importación de Asignaciones — rol Planeación
// Gestiona la carga académica del periodo activo: importación
// desde Excel, actualización, eliminación y monitoreo.
// ─────────────────────────────────────────────────────────────
interface PanelAgendasTiempoRealProps {
  /** Permisos dinámicos del rol activo sobre esta página */
  puedeCrear?: boolean;
  puedeEditar?: boolean;
  puedeEliminar?: boolean;
}

export default function PanelAgendasTiempoReal({
  puedeCrear = true,
  puedeEditar = true,
  puedeEliminar = true,
}: PanelAgendasTiempoRealProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false);
  const [confirmacionEliminar, setConfirmacionEliminar] = useState('');
  const [uploadResult, setUploadResult] = useState<any>(null);
  // Listado en vista previa, esperando que Planeación confirme
  const [listadoPendiente, setListadoPendiente] = useState<{ file: File; endpoint: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroContrato, setFiltroContrato] = useState('');
  const [filtroFacultad, setFiltroFacultad] = useState<number | ''>('');
  const [filtroPrograma, setFiltroPrograma] = useState<number | ''>('');
  const [mostrarFiltros, setMostrarFiltros] = useState(true);
  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(10);
  const [docenteSeleccionado, setDocenteSeleccionado] = useState<any>(null);
  const [distribucionDocente, setDistribucionDocente] = useState<any[]>([]);
  const [loadingDistribucion, setLoadingDistribucion] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string>('');

  // Selección múltiple para eliminar agendas
  const [docentesParaEliminar, setDocentesParaEliminar] = useState<Set<number>>(new Set());
  const [eliminandoSeleccion, setEliminandoSeleccion] = useState(false);
  const [modoSeleccion, setModoSeleccion] = useState(false);

  // Selector Facultad → Programa (requerido antes de importar/actualizar/eliminar)
  const [facultades, setFacultades] = useState<any[]>([]);
  const [programas, setProgramas] = useState<any[]>([]);
  const [todosProgramas, setTodosProgramas] = useState<any[]>([]); // lista completa para filtros de la tabla
  const [facultadSel, setFacultadSel] = useState<number | ''>('');
  const [programaSel, setProgramaSel] = useState<number | ''>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileUpdateRef = useRef<HTMLInputElement>(null);

  const cargarDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/director/dashboard');
      setData(res.data);
      setUltimaActualizacion(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      // Si hay un docente seleccionado, limpiar para evitar datos desfasados
      setDocenteSeleccionado(null);
      setDistribucionDocente([]);
    } catch (e) {
      console.error('Error cargando panel de agendas:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar facultades y todos los programas al montar
  useEffect(() => {
    api.get('/facultades').then(res => setFacultades(res.data || [])).catch(() => {});
    api.get('/programas').then(res => setTodosProgramas(res.data || [])).catch(() => {});
  }, []);

  // Cargar programas cuando cambia la facultad
  useEffect(() => {
    setProgramaSel('');
    if (!facultadSel) { setProgramas([]); return; }
    api.get('/programas').then(res => {
      const todos: any[] = res.data || [];
      setProgramas(todos.filter((p: any) => p.id_facultad === facultadSel && p.activo !== false));
    }).catch(() => {});
  }, [facultadSel]);

  useEffect(() => {
    cargarDashboard();
    const interval = setInterval(cargarDashboard, 30000);
    return () => clearInterval(interval);
  }, [cargarDashboard]);

  const cargarDistribucionDocente = async (docente: any) => {
    if (modoSeleccion) return; // No cambiar gráfico en modo selección
    if (docenteSeleccionado?.id_usuario === docente.id_usuario) {
      setDocenteSeleccionado(null);
      setDistribucionDocente([]);
      return;
    }
    setDocenteSeleccionado(docente);
    setLoadingDistribucion(true);
    try {
      const res = await api.get(`/director/docente/${docente.id_usuario}/distribucion`);
      setDistribucionDocente(res.data.distribucion || []);
    } catch (e) {
      console.error('Error cargando distribución del docente:', e);
      setDistribucionDocente([]);
    } finally {
      setLoadingDistribucion(false);
    }
  };

  const toggleSeleccionDocente = (id: number) => {
    setDocentesParaEliminar(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSeleccionTodos = (docentes: any[]) => {
    if (docentesParaEliminar.size === docentes.length) {
      setDocentesParaEliminar(new Set());
    } else {
      setDocentesParaEliminar(new Set(docentes.map((d: any) => d.id_usuario)));
    }
  };

  const handleEliminarSeleccionados = async () => {
    const ids = Array.from(docentesParaEliminar);
    if (ids.length === 0) return;
    const nombres = docentesFiltrados
      .filter((d: any) => ids.includes(d.id_usuario))
      .map((d: any) => d.nombre)
      .join(', ');
    if (!window.confirm(`¿Eliminar las agendas de ${ids.length} docente(s)?\n\n${nombres}\n\nEsta acción no se puede deshacer.`)) return;
    setEliminandoSeleccion(true);
    try {
      await api.delete('/director/eliminar-agendas-docentes', { data: { ids } });
      setUploadResult({ success: true, data: { resultados: { procesados: ids.length } }, tipo: `Eliminación de agendas (${ids.length} docente(s))` });
      setDocentesParaEliminar(new Set());
      setModoSeleccion(false);
      cargarDashboard();
    } catch (err: any) {
      setUploadResult({ success: false, error: err.response?.data?.error || 'Error al eliminar las agendas seleccionadas.' });
    } finally {
      setEliminandoSeleccion(false);
    }
  };

  // Subir el listado. Primero va en vista previa (simular=true): el servidor
  // procesa todo y revierte, y Planeación revisa el informe antes de confirmar.
  const enviarListado = async (file: File, endpoint: string, simular: boolean) => {
    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('id_programa', String(programaSel));
    const res = await api.post(`/director/${endpoint}${simular ? '?simular=true' : ''}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { success: true, data: res.data, tipo: endpoint === 'importar' ? 'Importación' : 'Actualización' };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, endpoint: string) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (fileUpdateRef.current) fileUpdateRef.current.value = '';
    if (!file) return;
    if (!programaSel) {
      alert('Debes seleccionar una facultad y un programa antes de importar.');
      return;
    }
    setUploading(true);
    setUploadResult(null);
    setListadoPendiente(null);
    try {
      setUploadResult(await enviarListado(file, endpoint, true));
      setListadoPendiente({ file, endpoint });
    } catch (err: any) {
      setUploadResult({ success: false, error: err.response?.data?.error || 'Error de conexión.' });
    } finally {
      setUploading(false);
    }
  };

  const confirmarListado = async () => {
    if (!listadoPendiente) return;
    setUploading(true);
    try {
      setUploadResult(await enviarListado(listadoPendiente.file, listadoPendiente.endpoint, false));
      setListadoPendiente(null);
      cargarDashboard();
    } catch (err: unknown) {
      const mensaje = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setUploadResult({ success: false, error: mensaje || 'Error de conexión.' });
      setListadoPendiente(null);
    } finally {
      setUploading(false);
    }
  };

  const handleEliminarAgendas = async () => {
    if (!programaSel) {
      alert('Debes seleccionar una facultad y un programa antes de eliminar agendas.');
      return;
    }
    // La confirmación se hace en un modal donde hay que escribir el nombre del programa
    setConfirmacionEliminar('');
    setModalEliminarAbierto(true);
  };

  const confirmarEliminarAgendas = async () => {
    const progNombre = programas.find(p => p.id_programa === programaSel)?.nombre_programa || 'el programa seleccionado';
    setModalEliminarAbierto(false);
    setUploading(true);
    setUploadResult(null);
    try {
      const res = await api.delete('/director/eliminar-agendas', {
        data: { id_programa: programaSel, confirmacion: confirmacionEliminar }
      });
      const respaldo = res.data?.respaldo?.archivo;
      setUploadResult({
        success: true,
        data: null,
        tipo: `Eliminación de agendas (${progNombre})${respaldo ? ` — respaldo: ${respaldo}` : ''}`
      });
      cargarDashboard();
    } catch (err: any) {
      setUploadResult({ success: false, error: err.response?.data?.error || 'Error de conexión al eliminar las agendas.' });
    } finally {
      setUploading(false);
    }
  };

  const periodoActivo = data?.periodo;
  const docentes: any[] = data?.docentes || [];
  const metricas = data?.metricas || { total: 0, aceptadas: 0, pendientes: 0, total_horas: 0 };
  const distribucion: any[] = data?.distribucion || [];
  const importacionRealizada = data?.importacionRealizada || false;
  // "Importar (Nuevo)" se bloquea solo para el programa que ya tiene carga en el período
  const importadoEnPrograma = !!programaSel && (data?.programasImportados || []).includes(programaSel);
  const puedeImportar = !!periodoActivo;

  const docentesFiltrados = docentes.filter((d: any) => {
    const q = searchQuery.toLowerCase();
    const coincideBusqueda = !q ||
      d.nombre.toLowerCase().includes(q) ||
      d.correo?.toLowerCase().includes(q);
    const coincideContrato = !filtroContrato ||
      (d.tipo_contrato || '').toLowerCase().includes(filtroContrato.toLowerCase());
    const estadoDocente = getEstadoDocente(d).label;
    const coincideEstado = !filtroEstado || estadoDocente === filtroEstado;
    const coincideFacultad = !filtroFacultad || d.id_facultad === filtroFacultad;
    const coincidePrograma = !filtroPrograma || d.id_programa === filtroPrograma;
    return coincideBusqueda && coincideContrato && coincideEstado && coincideFacultad && coincidePrograma;
  }).sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));

  const totalRegistros = docentesFiltrados.length;
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / registrosPorPagina));
  const indiceInicio = (paginaActual - 1) * registrosPorPagina;
  const indiceFin = Math.min(indiceInicio + registrosPorPagina, totalRegistros);

  const docentesPaginados = useMemo(() => {
    return docentesFiltrados.slice(indiceInicio, indiceFin);
  }, [docentesFiltrados, indiceInicio, indiceFin]);

  useEffect(() => {
    setPaginaActual(1);
  }, [searchQuery, filtroEstado, filtroContrato, filtroFacultad, filtroPrograma, registrosPorPagina]);

  useEffect(() => {
    if (paginaActual > totalPaginas) {
      setPaginaActual(totalPaginas);
    }
  }, [paginaActual, totalPaginas]);

  const totalFiltrosActivos = [
    Boolean(searchQuery.trim()),
    Boolean(filtroFacultad),
    Boolean(filtroPrograma),
    Boolean(filtroEstado),
    Boolean(filtroContrato)
  ].filter(Boolean).length;

  const hayFiltros = searchQuery || filtroEstado || filtroContrato || filtroFacultad || filtroPrograma;
  const limpiarFiltros = () => {
    setSearchQuery('');
    setFiltroEstado('');
    setFiltroContrato('');
    setFiltroFacultad('');
    setFiltroPrograma('');
  };

  // Tipos de contrato únicos presentes en los datos
  const tiposContrato = Array.from(new Set(docentes.map((d: any) => d.tipo_contrato).filter(Boolean))) as string[];
  // Facultades completas (todas las del sistema)
  const facultadesTabla = [...facultades].sort((a: any, b: any) => a.nombre_facultad.localeCompare(b.nombre_facultad));
  // Programas filtrados por facultad elegida (de la lista completa del sistema)
  const programasTabla = [...todosProgramas]
    .filter((p: any) => !filtroFacultad || p.id_facultad === filtroFacultad)
    .sort((a: any, b: any) => a.nombre_programa.localeCompare(b.nombre_programa));

  const periodoLabel = periodoActivo
    ? `${periodoActivo.anio} - ${periodoActivo.semestre === 1 ? 'Semestre I' : 'Semestre II'}`
    : 'Sin periodo activo';

  if (loading && !data) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      {/* BANNER */}
      <div className="bg-gradient-to-br from-[#0f2744] via-[#1a3a6c] to-[#0d3b7a] rounded-2xl px-8 py-7 mb-7 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
          <div>
            <h1 className="text-2xl font-extrabold text-white mb-1 tracking-tight flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-blue-300" />
              Importación de Asignaciones
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${periodoActivo ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                <span className={`w-2 h-2 rounded-full ${periodoActivo ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                {periodoActivo ? 'Periodo Activo' : 'Sin Periodo Activo'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white border border-white/20">
                <Calendar className="w-3.5 h-3.5" />
                {periodoLabel}
              </span>
              {periodoActivo && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-blue-200 border border-white/20">
                  {periodoActivo.fecha_inicio?.split('T')[0]} → {periodoActivo.fecha_fin?.split('T')[0]}
                </span>
              )}
              {ultimaActualizacion && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-blue-200 border border-white/20">
                  <Clock className="w-3.5 h-3.5" />
                  Actualizado: {ultimaActualizacion}
                </span>
              )}
            </div>
          </div>

          {/* SELECTOR FACULTAD → PROGRAMA */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-blue-200 uppercase tracking-wide flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Facultad
              </label>
              <select
                value={facultadSel}
                onChange={e => setFacultadSel(e.target.value ? parseInt(e.target.value) : '')}
                className="bg-white/10 border border-white/25 text-white rounded-xl px-3 py-2 text-sm min-w-[180px] focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent appearance-none"
              >
                <option value="" className="bg-[#1a3a6c] text-white">— Seleccione facultad —</option>
                {facultades.map((f: any) => (
                  <option key={f.id_facultad} value={f.id_facultad} className="bg-[#1a3a6c] text-white">{f.nombre_facultad}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-blue-200 uppercase tracking-wide flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5" /> Programa
              </label>
              <select
                value={programaSel}
                onChange={e => setProgramaSel(e.target.value ? parseInt(e.target.value) : '')}
                disabled={!facultadSel || programas.length === 0}
                className="bg-white/10 border border-white/25 text-white rounded-xl px-3 py-2 text-sm min-w-[220px] focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
              >
                <option value="" className="bg-[#1a3a6c] text-white">{!facultadSel ? '— Primero elige facultad —' : programas.length === 0 ? '— Sin programas —' : '— Seleccione programa —'}</option>
                {programas.map((p: any) => (
                  <option key={p.id_programa} value={p.id_programa} className="bg-[#1a3a6c] text-white">{p.nombre_programa}</option>
                ))}
              </select>
            </div>
          </div>

          {/* BOTONES DE IMPORTACIÓN */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="file" accept=".xlsx,.xls" className="hidden" ref={fileInputRef}
              onChange={(e) => handleFileChange(e, 'importar')} />
            <input type="file" accept=".xlsx,.xls" className="hidden" ref={fileUpdateRef}
              onChange={(e) => handleFileChange(e, 'actualizar')} />

            {!puedeImportar ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-xl text-gray-400 text-sm font-semibold">
                <Lock className="w-4 h-4" />
                Importación bloqueada — sin periodo activo
              </div>
            ) : !programaSel ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-600/30 border border-yellow-500/40 rounded-xl text-yellow-200 text-sm font-semibold">
                <AlertCircle className="w-4 h-4" />
                Selecciona una facultad y programa para habilitar acciones
              </div>
            ) : (
              <>
                {puedeCrear && (
                  <button
                    disabled={uploading || importadoEnPrograma}
                    onClick={() => fileInputRef.current?.click()}
                    title={importadoEnPrograma ? 'Este programa ya tiene carga en el período. Use Actualizar.' : 'Importar desde cero para el periodo activo'}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md ${
                      importadoEnPrograma
                        ? 'bg-gray-500/40 text-gray-400 cursor-not-allowed border border-gray-600/30'
                        : uploading ? 'bg-indigo-400 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                    {importadoEnPrograma ? 'Ya Importado ✓' : uploading ? 'Procesando...' : 'Importar (Nuevo)'}
                  </button>
                )}
                {puedeEditar && (
                  <button
                    disabled={uploading}
                    onClick={() => fileUpdateRef.current?.click()}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md ${uploading ? 'bg-emerald-400 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                  >
                    {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? 'Procesando...' : 'Actualizar Importación'}
                  </button>
                )}
                <button onClick={cargarDashboard} className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white text-sm font-bold transition-all">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
                </button>
                {importadoEnPrograma && puedeEliminar && (
                  <button
                    disabled={uploading}
                    onClick={handleEliminarAgendas}
                    className={`flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-400 text-white rounded-xl text-sm font-bold transition-all shadow-md`}
                    title="Eliminar agendas del programa seleccionado en este periodo"
                  >
                    {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Eliminar Agendas
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* RESULTADO IMPORTACIÓN */}
      {uploadResult && (
        <ImportResultPanel
          result={uploadResult}
          onClose={() => { setUploadResult(null); setListadoPendiente(null); }}
          onConfirmar={listadoPendiente ? confirmarListado : undefined}
          confirmando={uploading}
        />
      )}

      {/* CONFIRMACIÓN DE ELIMINACIÓN: hay que escribir el nombre del programa */}
      {modalEliminarAbierto && (() => {
        const progNombre = programas.find(p => p.id_programa === programaSel)?.nombre_programa || '';
        const coincide = confirmacionEliminar.trim().toLowerCase() === progNombre.trim().toLowerCase() && progNombre !== '';
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setModalEliminarAbierto(false)}
          >
            <div
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-rose-600 px-5 py-4 flex items-center gap-2 text-white">
                <Trash2 className="w-5 h-5" />
                <h3 className="font-bold">Eliminar todas las agendas del programa</h3>
              </div>
              <div className="p-5 space-y-3 text-sm text-gray-700">
                <p>
                  Se eliminarán todas las funciones, actividades, indicadores y evidencias de <strong>{progNombre}</strong> en
                  el período activo. Antes de borrar, el sistema guarda una copia de seguridad en el servidor.
                </p>
                <p>Para confirmar, escribe el nombre del programa:</p>
                <input
                  autoFocus
                  value={confirmacionEliminar}
                  onChange={e => setConfirmacionEliminar(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && coincide) confirmarEliminarAgendas(); }}
                  placeholder={progNombre}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-500"
                />
              </div>
              <div className="px-5 py-3 bg-gray-50 flex justify-end gap-2">
                <button
                  onClick={() => setModalEliminarAbierto(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  disabled={!coincide}
                  onClick={confirmarEliminarAgendas}
                  className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:bg-rose-300 disabled:cursor-not-allowed rounded-lg"
                >
                  Eliminar definitivamente
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SIN PERIODO ACTIVO */}
      {!periodoActivo && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center mb-7">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-amber-900">No hay un periodo académico activo</h3>
          <p className="text-sm text-amber-700 mt-1">Abre un nuevo periodo desde <strong>Períodos</strong> para poder importar asignaciones y gestionar agendas.</p>
        </div>
      )}

      {/* MÉTRICAS */}
      {periodoActivo && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
            {[
              { label: 'Total Docentes', value: metricas.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Agendas Completas', value: metricas.aceptadas, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Agendas Pendientes', value: metricas.pendientes, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
              { label: 'Total Horas Asign.', value: Math.round(metricas.total_horas), icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map((m) => (
              <div key={m.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className={`w-10 h-10 ${m.bg} rounded-xl flex items-center justify-center mb-3`}>
                  <m.icon className={`w-5 h-5 ${m.color}`} />
                </div>
                <div className="text-2xl font-black text-gray-800">{m.value}</div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>

          {/* TABLA + GRÁFICA */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-7">

            {/* TABLA DOCENTES */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* CABECERA CON FILTROS */}
              <div className="border-b border-gray-100">
                <div className="px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Estado de Docentes</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Periodo: {periodoLabel}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {importacionRealizada && puedeEliminar && (
                      <button
                        onClick={() => {
                          setModoSeleccion(v => !v);
                          setDocentesParaEliminar(new Set());
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          modoSeleccion
                            ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                        title={modoSeleccion ? 'Cancelar selección' : 'Seleccionar docentes para eliminar agenda'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {modoSeleccion ? 'Cancelar' : 'Eliminar agenda'}
                      </button>
                    )}
                  </div>
                </div>

                {/* BARRA EXTENSIBLE DE FILTROS */}
                <div 
                  onClick={() => setMostrarFiltros(v => !v)}
                  className="px-6 py-2.5 bg-gray-50/80 hover:bg-gray-100/80 border-t border-gray-100 flex items-center justify-between cursor-pointer select-none transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-blue-50 text-blue-600">
                      <Filter className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Filtros de Búsqueda
                    </span>
                    {totalFiltrosActivos > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full">
                        {totalFiltrosActivos} aplicado{totalFiltrosActivos > 1 ? 's' : ''}
                      </span>
                    )}
                    {totalFiltrosActivos > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          limpiarFiltros();
                        }}
                        className="text-xs font-semibold text-red-500 hover:text-red-700 hover:underline ml-2"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-blue-600 transition-colors">
                    <span>{mostrarFiltros ? 'Ocultar filtros' : 'Extender y mostrar filtros'}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${mostrarFiltros ? 'rotate-180 text-blue-600' : ''}`} />
                  </div>
                </div>

                {/* CONTENIDO DE FILTROS DESPLEGABLE */}
                {mostrarFiltros && (
                  <div className="px-6 py-3.5 bg-white border-t border-gray-100">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Búsqueda */}
                      <div className="relative flex-1 min-w-[160px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Buscar por nombre o correo..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
                        />
                      </div>

                      {/* Filtro Facultad */}
                      <select
                        value={filtroFacultad}
                        onChange={e => {
                          setFiltroFacultad(e.target.value ? parseInt(e.target.value) : '');
                          setFiltroPrograma('');
                        }}
                        className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-600 focus:outline-none focus:border-blue-400 bg-white"
                      >
                        <option value="">Todas las facultades</option>
                        {(facultadesTabla as any[]).map(f => (
                          <option key={f.id_facultad} value={f.id_facultad}>{f.nombre_facultad}</option>
                        ))}
                      </select>

                      {/* Filtro Programa */}
                      <select
                        value={filtroPrograma}
                        onChange={e => setFiltroPrograma(e.target.value ? parseInt(e.target.value) : '')}
                        disabled={programasTabla.length === 0}
                        className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-600 focus:outline-none focus:border-blue-400 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Todos los programas</option>
                        {(programasTabla as any[]).map(p => (
                          <option key={p.id_programa} value={p.id_programa}>{p.nombre_programa}</option>
                        ))}
                      </select>

                      {/* Filtro Estado */}
                      <select
                        value={filtroEstado}
                        onChange={e => setFiltroEstado(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-600 focus:outline-none focus:border-blue-400 bg-white"
                      >
                        <option value="">Todos los estados</option>
                        {['Pendiente', 'En progreso', 'Completa', 'Aprobada', 'Devuelta', 'Sin asignar'].map(e => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>

                      {/* Filtro Contrato */}
                      <select
                        value={filtroContrato}
                        onChange={e => setFiltroContrato(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-600 focus:outline-none focus:border-blue-400 bg-white"
                      >
                        <option value="">Todos los contratos</option>
                        {tiposContrato.map((tc: string) => (
                          <option key={tc} value={tc}>{tc}</option>
                        ))}
                      </select>

                      {/* Limpiar filtros */}
                      {hayFiltros && (
                        <button
                          onClick={limpiarFiltros}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold transition-all border border-gray-200"
                        >
                          <X className="w-3.5 h-3.5" />
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* BARRA DE ACCIÓN FLOTANTE cuando hay seleccionados */}
              {modoSeleccion && docentesParaEliminar.size > 0 && (
                <div className="mx-4 my-3 flex items-center justify-between gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 flex items-center justify-center bg-rose-600 text-white text-xs font-black rounded-full">
                      {docentesParaEliminar.size}
                    </span>
                    <span className="text-sm font-semibold text-rose-800">
                      {docentesParaEliminar.size === 1 ? 'docente seleccionado' : 'docentes seleccionados'}
                    </span>
                  </div>
                  <button
                    disabled={eliminandoSeleccion}
                    onClick={handleEliminarSeleccionados}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-lg text-xs font-bold transition-all"
                  >
                    {eliminandoSeleccion
                      ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />
                    }
                    {eliminandoSeleccion ? 'Eliminando...' : 'Eliminar agenda(s)'}
                  </button>
                </div>
              )}

              <div className="overflow-x-auto overflow-y-auto max-h-[460px]">
                <table className="w-full text-sm relative">
                  <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100 shadow-xs">
                    <tr>
                      {modoSeleccion && (
                        <th className="px-3 py-3 text-center bg-gray-50">
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-rose-600 cursor-pointer"
                            checked={docentesPaginados.length > 0 && docentesParaEliminar.size === docentesPaginados.length}
                            onChange={() => toggleSeleccionTodos(docentesPaginados)}
                            title="Seleccionar todos de esta página"
                          />
                        </th>
                      )}
                      <th className="px-5 py-3 text-left font-bold bg-gray-50">Docente</th>
                      <th className="px-5 py-3 text-left font-bold bg-gray-50">Programa</th>
                      <th className="px-5 py-3 text-left font-bold bg-gray-50">Contrato</th>
                      <th className="px-5 py-3 text-center font-bold bg-gray-50">Horas</th>
                      <th className="px-5 py-3 text-center font-bold bg-gray-50">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {docentesPaginados.length === 0 ? (
                      <tr>
                        <td colSpan={modoSeleccion ? 6 : 5} className="px-5 py-10 text-center text-gray-400 text-sm">
                          {importacionRealizada ? 'No se encontraron docentes' : 'Importa un Excel para ver los docentes asignados'}
                        </td>
                      </tr>
                    ) : docentesPaginados.map((d) => {
                      const estado = getEstadoDocente(d);
                      const isSelected = docenteSeleccionado?.id_usuario === d.id_usuario;
                      const isChecked = docentesParaEliminar.has(d.id_usuario);
                      return (
                        <tr
                          key={d.id_usuario}
                          onClick={() => modoSeleccion ? toggleSeleccionDocente(d.id_usuario) : cargarDistribucionDocente(d)}
                          className={`transition-colors cursor-pointer group ${
                            modoSeleccion
                              ? isChecked
                                ? 'bg-rose-50 border-l-4 border-rose-500'
                                : 'hover:bg-rose-50/40 border-l-4 border-transparent'
                              : isSelected
                                ? 'bg-blue-50 border-l-4 border-blue-500'
                                : 'hover:bg-blue-50/40 border-l-4 border-transparent'
                          }`}
                        >
                          {modoSeleccion && (
                            <td className="px-3 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="w-4 h-4 accent-rose-600 cursor-pointer"
                                checked={isChecked}
                                onChange={() => toggleSeleccionDocente(d.id_usuario)}
                              />
                            </td>
                          )}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${isChecked && modoSeleccion ? 'bg-rose-500' : 'bg-gradient-to-br from-blue-500 to-purple-600'}`}>
                                {d.nombre.charAt(0)}{d.nombre.split(' ')[1]?.charAt(0) || ''}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 text-sm leading-tight">{d.nombre}</p>
                                <p className="text-xs text-gray-400">{d.correo}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-block text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded font-medium leading-tight max-w-[160px] truncate" title={d.nombre_programa}>
                              {d.nombre_programa || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium border border-blue-100">{d.tipo_contrato}</span>
                            <div className="mt-1.5">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${d.perfil_docente === 'INCONSISTENCIAS EN AGENDA AC 30' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                                    {d.perfil_docente || 'Calculando...'}
                                </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-center font-bold text-gray-700">
                            {parseFloat(d.horas_asignadas).toFixed(0)}
                            <span className="text-xs text-gray-400 font-normal">/{d.horas_contrato}h</span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${estado.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${estado.dot}`} />
                              {estado.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* PAGINACIÓN */}
              {docentesFiltrados.length > 0 && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
                  {/* Selector registros e info */}
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-medium">Mostrar</span>
                      <select
                        value={registrosPorPagina}
                        onChange={(e) => {
                          setRegistrosPorPagina(Number(e.target.value));
                          setPaginaActual(1);
                        }}
                        className="border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 font-medium shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={15}>15</option>
                        <option value={20}>20</option>
                        <option value={25}>25</option>
                      </select>
                      <span className="text-gray-500 font-medium">por pág.</span>
                    </div>

                    <div className="text-gray-500">
                      Mostrando <span className="font-semibold text-gray-800">{totalRegistros === 0 ? 0 : indiceInicio + 1}</span> a <span className="font-semibold text-gray-800">{indiceFin}</span> de <span className="font-semibold text-gray-800">{totalRegistros}</span> docentes
                    </div>
                  </div>

                  {/* Botones de navegación */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPaginaActual(1)}
                      disabled={paginaActual === 1}
                      title="Primera página"
                      className="p-1.5 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))}
                      disabled={paginaActual === 1}
                      title="Página anterior"
                      className="px-2.5 py-1 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 font-medium"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Anterior</span>
                    </button>

                    {/* Números de página */}
                    <div className="flex items-center gap-1 mx-1">
                      {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                        .filter(p => {
                          if (totalPaginas <= 7) return true;
                          if (p === 1 || p === totalPaginas) return true;
                          return Math.abs(p - paginaActual) <= 1;
                        })
                        .map((p, idx, arr) => {
                          const prev = arr[idx - 1];
                          const showEllipsis = prev && p - prev > 1;

                          return (
                            <div key={p} className="flex items-center">
                              {showEllipsis && (
                                <span className="px-1 text-gray-400 select-none">...</span>
                              )}
                              <button
                                onClick={() => setPaginaActual(p)}
                                className={`w-7 h-7 rounded-md font-semibold text-xs transition-colors ${
                                  paginaActual === p
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                {p}
                              </button>
                            </div>
                          );
                        })}
                    </div>

                    <button
                      onClick={() => setPaginaActual(prev => Math.min(prev + 1, totalPaginas))}
                      disabled={paginaActual === totalPaginas}
                      title="Página siguiente"
                      className="px-2.5 py-1 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 font-medium"
                    >
                      <span className="hidden sm:inline">Siguiente</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setPaginaActual(totalPaginas)}
                      disabled={paginaActual === totalPaginas}
                      title="Última página"
                      className="p-1.5 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>


            {/* GRÁFICAS */}
            <div className="flex flex-col gap-5">
              {/* Pie chart distribución horas */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex-1">
                {docenteSeleccionado ? (
                  /* === DISTRIBUCIÓN DE UN DOCENTE SELECCIONADO === */
                  <>
                    {/* Header con botón de cerrar */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                          <FileBarChart2 className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="truncate">{docenteSeleccionado.nombre}</span>
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold border border-blue-100">
                            {docenteSeleccionado.tipo_contrato}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {parseFloat(docenteSeleccionado.horas_asignadas || 0).toFixed(0)}h / {docenteSeleccionado.horas_contrato}h asignadas
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => { setDocenteSeleccionado(null); setDistribucionDocente([]); }}
                        className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0 ml-1"
                        title="Volver a distribución global"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {loadingDistribucion ? (
                      <div className="h-44 flex items-center justify-center">
                        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                      </div>
                    ) : distribucionDocente.length > 0 ? (
                      <>
                        {/* Barra de progreso horas */}
                        <div className="mb-3">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Horas asignadas</span>
                            <span className="font-bold text-blue-700">
                              {parseFloat(docenteSeleccionado.horas_asignadas || 0).toFixed(0)}/{docenteSeleccionado.horas_contrato}h
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${Math.min(100, (parseFloat(docenteSeleccionado.horas_asignadas || 0) / parseFloat(docenteSeleccionado.horas_contrato || 40)) * 100)}%`,
                                background: parseFloat(docenteSeleccionado.horas_asignadas || 0) === parseFloat(docenteSeleccionado.horas_contrato || 40)
                                  ? 'linear-gradient(to right, #22c55e, #16a34a)'
                                  : 'linear-gradient(to right, #3b82f6, #6366f1)'
                              }}
                            />
                          </div>
                        </div>
                        {/* Pie chart */}
                        <div className="h-36">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={distribucionDocente.map(d => ({ name: d.funcion_sustantiva, value: parseFloat(d.horas) }))}
                                cx="50%" cy="50%" innerRadius={35} outerRadius={58}
                                paddingAngle={3} dataKey="value" stroke="none"
                              >
                                {distribucionDocente.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                              </Pie>
                              <Tooltip formatter={(v: any) => `${v}h`}
                                contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Leyenda */}
                        <div className="space-y-1.5 mt-2">
                          {distribucionDocente.map((d, i) => (
                            <div key={i} className="flex justify-between items-center text-xs">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                <span className="text-gray-600 truncate max-w-[120px]">{d.funcion_sustantiva}</span>
                              </div>
                              <span className="font-bold text-gray-800">{parseFloat(d.horas).toFixed(0)}h</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="h-44 flex items-center justify-center text-gray-400 text-sm text-center">
                        <div>
                          <FileBarChart2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          Este docente no tiene horas asignadas.
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* === DISTRIBUCIÓN GLOBAL (sin docente seleccionado) === */
                  <>
                    <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                      <FileBarChart2 className="w-4 h-4 text-blue-500" /> Distribución de Horas
                    </h3>
                    <p className="text-xs text-gray-400 mb-3">Por función sustantiva — periodo activo</p>
                    {distribucion.length > 0 ? (
                      <>
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={distribucion.map(d => ({ name: d.funcion_sustantiva, value: parseFloat(d.horas) }))}
                                cx="50%" cy="50%" innerRadius={45} outerRadius={72}
                                paddingAngle={3} dataKey="value" stroke="none">
                                {distribucion.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                              </Pie>
                              <Tooltip formatter={(v: any) => `${v}h`}
                                contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-1.5 mt-2">
                          {distribucion.map((d, i) => (
                            <div key={i} className="flex justify-between items-center text-xs">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                <span className="text-gray-600 truncate max-w-[130px]">{d.funcion_sustantiva}</span>
                              </div>
                              <span className="font-bold text-gray-800">{parseFloat(d.horas).toFixed(0)}h</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-3 text-center italic">Haz clic en un docente para ver su distribución individual</p>
                      </>
                    ) : (
                      <div className="h-44 flex items-center justify-center text-gray-400 text-sm text-center">
                        <div>
                          <FileBarChart2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          Sin datos de distribución.<br />Importa un Excel primero.
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Resumen de estado */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Progreso General</h3>
                {metricas.total > 0 ? (
                  <>
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Agendas completas</span>
                        <span className="font-bold text-green-700">{metricas.aceptadas}/{metricas.total}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-1000"
                          style={{ width: `${metricas.total > 0 ? (metricas.aceptadas / metricas.total) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-right text-xs font-bold text-green-600 mt-1">
                        {metricas.total > 0 ? Math.round((metricas.aceptadas / metricas.total) * 100) : 0}%
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-green-50 rounded-lg p-2 border border-green-100">
                        <div className="font-black text-green-700 text-lg">{metricas.aceptadas}</div>
                        <div className="text-green-600 font-semibold">Completas</div>
                      </div>
                      <div className="bg-yellow-50 rounded-lg p-2 border border-yellow-100">
                        <div className="font-black text-yellow-700 text-lg">{metricas.pendientes}</div>
                        <div className="text-yellow-600 font-semibold">Pendientes</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                        <div className="font-black text-gray-700 text-lg">{metricas.total - metricas.aceptadas - metricas.pendientes}</div>
                        <div className="text-gray-600 font-semibold">Sin asign.</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-4">Sin docentes para este periodo</p>
                )}
              </div>
            </div>
          </div>

          {/* BARRA DE HORAS POR FUNCIÓN SUSTANTIVA */}
          {(docenteSeleccionado ? distribucionDocente : distribucion).length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-500" />
                {docenteSeleccionado
                  ? `Horas por Función — ${docenteSeleccionado.nombre}`
                  : 'Horas por Función Sustantiva (Global)'}
              </h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(docenteSeleccionado ? distribucionDocente : distribucion).map((d: any) => ({
                      name: d.funcion_sustantiva.replace('Docencia ', 'Doc. '),
                      horas: parseFloat(d.horas)
                    }))}
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => `${v}h`} contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)' }} />
                    <Bar dataKey="horas" radius={[6, 6, 0, 0]}>
                      {(docenteSeleccionado ? distribucionDocente : distribucion).map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
