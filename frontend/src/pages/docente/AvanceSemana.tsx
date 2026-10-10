import { useState, useEffect } from 'react';
import Layout from '../../components/common/Layout';
import { FileText, AlertCircle, UploadCloud, Save, BookOpen, Target, ClipboardList, ExternalLink, Download, Eye, MessageSquare, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { confirmar, avisar } from '../../components/common/dialogo';
import { useAuth } from '../../context/AuthContext';
import SubirEvidenciaModal from '../../components/evidencias/SubirEvidenciaModal';
import VisorEvidenciaModal from '../../components/evidencias/VisorEvidenciaModal';
import type { EvidenciaVisor } from '../../components/evidencias/VisorEvidenciaModal';
import useSemestreActivo from '../../hooks/useSemestreActivo'
import { etiquetaCorte, rotularCortes } from '../../utils/periodo'

interface AvanceSemanaProps {
  semana: '8' | '16';
  rolActual?: 'docente' | 'director' | 'planeacion';
}

export default function AvanceSemana({ semana, rolActual = 'docente' }: AvanceSemanaProps) {
  const semestreActivo = useSemestreActivo();
  const nombreCorte = etiquetaCorte(semana, semestreActivo);
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [puedeEditar, setPuedeEditar] = useState(true);
  const [semanaInfo, setSemanaInfo] = useState<any>(null);
  const [guardando, setGuardando] = useState(false);
  // Aviso al entrar al reporte: hay que registrar TODO el avance del corte antes de guardar
  const [avisoEntrada, setAvisoEntrada] = useState(false);
  const [noMostrarAviso, setNoMostrarAviso] = useState(false);

  const [selectedFunctionIndex, setSelectedFunctionIndex] = useState(0);
  const [selectedActivityIndex, setSelectedActivityIndex] = useState(0);
  const [modalEvidencia, setModalEvidencia] = useState({ isOpen: false, idIndicador: 0, nombreIndicador: '' });
  // Evidencia abierta en el visor (vista previa sin descargar)
  const [evidenciaVisor, setEvidenciaVisor] = useState<EvidenciaVisor | null>(null);

  useEffect(() => {
    setSelectedActivityIndex(0);
  }, [selectedFunctionIndex]);

  useEffect(() => {
    if (user) {
      cargarData();
    }
  }, [semana, user]);

  const claveAviso = `sigap_aviso_avance_${semana}`;
  useEffect(() => {
    // Solo si el reporte está abierto y se puede editar (con la semana cerrada no hay nada que registrar)
    if (loading || sinPermiso || !semanaInfo?.habilitada || !puedeEditar) return;
    let oculto = false;
    try { oculto = localStorage.getItem(claveAviso) === '1'; } catch { /* sin almacenamiento: se mostrará */ }
    setNoMostrarAviso(false);
    setAvisoEntrada(!oculto);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sinPermiso, semanaInfo?.habilitada, puedeEditar, semana]);

  const cerrarAvisoEntrada = () => {
    if (noMostrarAviso) {
      try { localStorage.setItem(claveAviso, '1'); } catch { /* sin almacenamiento */ }
    }
    setAvisoEntrada(false);
  };

  const cargarData = async () => {
    try {
      setLoading(true);
      const userId = (user as any)?.id_usuario || user?.id;
      if (!userId) return;

      // Validar permisos del rol activo para esta semana
      try {
        const storedRole = localStorage.getItem('sigap_active_role');
        const roleId = storedRole ? JSON.parse(storedRole).id_rol : 2;
        const permRes = await api.get(`/permisos/rol/${roleId}`);
        const paginas = permRes.data.paginasVer || [];
        const tieneVer = paginas.some((p: string) => 
          p.toLowerCase().trim() === `avance semana ${semana}`.toLowerCase().trim() ||
          p.toLowerCase().includes(`semana ${semana}`)
        );
        if (!tieneVer) {
          setSinPermiso(true);
          setLoading(false);
          return;
        }
        const accionesPagina = permRes.data.mapaPermisos[`Avance Semana ${semana}`] || [];
        const canEdit = accionesPagina.includes('Editar') || accionesPagina.includes('Crear');
        setPuedeEditar(canEdit);
      } catch (e) {
        // En caso de fallo de red en permisos, continuar
      }

      // Fetch week status
      const semRes = await api.get('/semanas');
      const week = semRes.data.find((s: any) => s.numero_semana === semana);
      setSemanaInfo(week);

      if (week) {
         // Fetch all activities (Option A)
         const agRes = await api.get(`/agenda/base/${userId}`);
         const funs = agRes.data.funciones || [];
         const acts = agRes.data.actividades || [];

         // Map activities into functions structure
         const struct = funs.map((f: any) => ({
             ...f,
             actividades: acts.filter((a: any) => a.id_funciones === f.id_funciones).reduce((acc: any[], curr: any) => {
                 let existing = acc.find(x => x.id_asignacionact === curr.id_asignacionact);
                 if (!existing) {
                     // observaciones_director viene por actividad (no por indicador)
                     existing = { ...curr, observaciones_director: curr.observaciones_director || [], indicadores: [] };
                     acc.push(existing);
                 }
                 if (curr.id_indicador) {
                     existing.indicadores.push({
                         id_indicador: curr.id_indicador,
                         nombre_indicador: curr.nombre_indicador,
                         ejecucion_8: curr.ejecucion_8 !== null ? String(parseFloat(curr.ejecucion_8)) : null,
                         ejecucion_16: curr.ejecucion_16 !== null ? String(parseFloat(curr.ejecucion_16)) : null,
                         observaciones: curr.observaciones,
                         meta: curr.meta !== null ? String(parseFloat(curr.meta)) : null,
                         evidencias: curr.evidencias || []
                     });
                 }
                 return acc;
             }, [])
         }));
         
         setData(struct);
      }
    } catch (error) {
      console.error("Error cargando data de avance:", error);
      void avisar({ tipo: 'error', mensaje: 'No se pudo cargar la información de la agenda.' });
    } finally {
      setLoading(false);
    }
  };

  // Después de subir una evidencia solo se actualiza la lista de evidencias de cada indicador.
  // NO se recarga todo: eso reemplazaría con lo que hay en el servidor la ejecución que el docente
  // ya escribió pero todavía no guardó (y mostraría la pantalla de carga).
  const refrescarEvidencias = async () => {
    try {
      const userId = (user as unknown as { id_usuario?: number } | null)?.id_usuario || user?.id;
      if (!userId) return;
      const agRes = await api.get(`/agenda/base/${userId}`);
      const nuevas = new Map<number, unknown[]>();
      for (const a of (agRes.data.actividades || []) as { id_indicador?: number; evidencias?: unknown[] }[]) {
        if (a.id_indicador) nuevas.set(a.id_indicador, a.evidencias || []);
      }
      // Actualización funcional: parte de lo que hay en pantalla en este momento, no de una copia vieja
      setData(prev => prev.map(f => ({
        ...f,
        actividades: f.actividades.map((a: { indicadores: { id_indicador: number }[] }) => ({
          ...a,
          indicadores: a.indicadores.map(i => (nuevas.has(i.id_indicador) ? { ...i, evidencias: nuevas.get(i.id_indicador) } : i))
        }))
      })));
    } catch (error) {
      // La evidencia ya quedó guardada; si no se pudo refrescar la lista, aparecerá al volver a entrar
      console.error('No se pudo actualizar la lista de evidencias:', error);
    }
  };

  // Elimina una evidencia ya cargada (archivo o enlace). Solo se quita de la lista si el servidor la borró.
  const [eliminandoEvidencia, setEliminandoEvidencia] = useState<number | null>(null);
  const eliminarEvidencia = async (ev: { id_evidencias: number; nombre_archivo: string }) => {
    const acepta = await confirmar({
      tipo: 'peligro',
      titulo: '¿Eliminar evidencia?',
      mensaje: `Se eliminará "${ev.nombre_archivo}". Esta acción no se puede deshacer.`,
      textoAceptar: 'Eliminar',
    });
    if (!acepta) return;
    setEliminandoEvidencia(ev.id_evidencias);
    try {
      await api.delete(`/evidencias/${ev.id_evidencias}`);
      await refrescarEvidencias();
    } catch (error) {
      console.error('No se pudo eliminar la evidencia:', error);
      void avisar({ tipo: 'error', mensaje: 'No se pudo eliminar la evidencia. Inténtalo de nuevo.' });
    } finally {
      setEliminandoEvidencia(null);
    }
  };

  const guardarAvance = async () => {
    try {
        setGuardando(true);

        // Flatten indicators to send to backend
        const indicadores = data.flatMap(f => 
            f.actividades.flatMap((a: any) => a.indicadores)
        );

        const response = await api.post('/agenda/guardar-avance', { indicadores });

        if (response.data.advertencias?.length > 0) {
          void avisar({ tipo: 'advertencia', titulo: 'Avance guardado con observaciones', mensaje: response.data.mensaje });
        } else {
          void avisar({ tipo: 'exito', titulo: 'Avance guardado', mensaje: `¡Avance de la ${nombreCorte} guardado correctamente!`, cerrarEn: 4000 });
        }
        
        // Refetch to ensure data is in sync
        cargarData();
    } catch (error: any) {
        console.error("Error guardando avance:", error);
        const errorMsg = error.response?.data?.error || 'Ocurrió un error al intentar guardar el avance.';
        void avisar({ tipo: 'error', titulo: 'No se pudo guardar', mensaje: errorMsg });
    } finally {
        setGuardando(false);
    }
  };

  const calcularAvance = (actividadMeta: number, ejec8: number = 0, ejec16: number = 0) => {
    if (!actividadMeta) return 0;
    const total = (Number(ejec8) || 0) + (semana === '16' ? (Number(ejec16) || 0) : 0);
    const porcentaje = (total / actividadMeta) * 100;
    return Math.round(porcentaje);
  };

  const getEstadoVisual = (porcentaje: number) => {
    if (porcentaje >= 100) return { bg: 'bg-green-100', text: 'text-green-800', label: 'Completado', dot: 'bg-green-500' };
    if (porcentaje > 0) return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'En progreso', dot: 'bg-yellow-500' };
    return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Sin iniciar', dot: 'bg-gray-400' };
  };

  // Teclado en el campo de avance (como en una hoja de cálculo):
  //  · ↑ / ↓  pasan al campo de la fila de arriba / abajo (se salta lo deshabilitado)
  //  · ← / →  bajan / suben el número en 1 (sin pasar de 0 ni de la meta: eso lo cuida handleIndicadorChange)
  const teclasAvance = (
    e: React.KeyboardEvent<HTMLInputElement>,
    campo: 'ejecucion_8' | 'ejecucion_16',
    fIndex: number, aIndex: number, iIndex: number
  ) => {
    const input = e.currentTarget;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const campos = Array.from(
        input.closest('tbody')?.querySelectorAll<HTMLInputElement>(`input[data-avance="${campo}"]:not(:disabled)`) ?? []
      );
      const destino = campos[campos.indexOf(input) + (e.key === 'ArrowDown' ? 1 : -1)];
      e.preventDefault(); // el número no cambia con estas flechas
      destino?.focus();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const actual = parseFloat(input.value) || 0;
      const nuevoValor = Math.max(0, Math.round((actual + (e.key === 'ArrowRight' ? 1 : -1)) * 1000) / 1000);
      handleIndicadorChange(fIndex, aIndex, iIndex, campo, String(nuevoValor));
    }
  };

  const handleIndicadorChange = (fIndex: number, aIndex: number, iIndex: number, campo: string, valor: any) => {
    const newData = [...data];
    const indicador = newData[fIndex].actividades[aIndex].indicadores[iIndex];
    const actividad = newData[fIndex].actividades[aIndex];
    const meta = Number(indicador.meta) || Number(actividad.meta) || 0;

    if (campo === 'ejecucion_8' || campo === 'ejecucion_16') {
      // Sin ceros a la izquierda: al escribir sobre el 0 que ya está, '01' pasa a '1' (pero '0.5' se conserva)
      let valStr = String(valor).replace(/^0+(?=\d)/, '');
      
      if (valStr === '') {
          indicador[campo] = null;
      } else {
          // Permitir escribir números con decimales (ej. "0.")
          let numVal = parseFloat(valStr);
          
          if (!isNaN(numVal)) {
              if (numVal < 0) {
                  valStr = "0";
                  numVal = 0;
              }
              
              if (meta > 0) {
                  if (campo === 'ejecucion_8' && numVal > meta) {
                      valStr = String(meta);
                  } else if (campo === 'ejecucion_16') {
                      const ejec8Actual = parseFloat(String(indicador.ejecucion_8)) || 0;
                      const maxPermitido = Math.max(0, meta - ejec8Actual);
                      if (numVal > maxPermitido) {
                          valStr = String(maxPermitido);
                      }
                  }
              }
          }
          indicador[campo] = valStr;
      }
    } else {
      indicador[campo] = valor;
    }

    setData(newData);
  };

  if (loading) {
    return (
      <Layout rol="docente" path={`Registro de Actividades / Reporte ${nombreCorte}`}>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  if (sinPermiso) {
    return (
      <Layout rol="docente" path={`Registro de Actividades / Reporte ${nombreCorte}`}>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-white rounded-2xl border border-gray-200 mt-6 shadow-sm max-w-lg mx-auto">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">Acceso Restringido por Permisos</h2>
          <p className="text-xs text-gray-500 max-w-md mb-6 leading-relaxed">
            Tu perfil de docente no tiene permisos activos de visualización para el Reporte de la {nombreCorte}. Este acceso es administrado por el equipo de Planeación en la Gestión de Perfiles.
          </p>
          <a
            href="/docente/dashboard"
            className="px-5 py-2.5 bg-[#063759] text-white rounded-xl text-xs font-bold hover:bg-[#084b7a] transition-all shadow-md"
          >
            Volver al Dashboard
          </a>
        </div>
      </Layout>
    );
  }

  if (!semanaInfo?.habilitada) {
    return (
      <Layout rol="docente" path={`Registro de Actividades / Reporte ${nombreCorte}`}>
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md mx-auto text-center mt-10">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Semana Cerrada</h2>
          <p className="text-gray-600 mb-4">
            El reporte de evidencias para la {nombreCorte} no está habilitado en este momento. Consulta con Planeación si necesitas realizar ajustes.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout rol="docente" path={`Registro de Actividades / Reporte ${nombreCorte}`}>
      <div className="bg-[#1a2744] rounded-xl px-6 py-6 mb-8 shadow-sm">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-blue-400" />
          Reporte de Avance Académico - {nombreCorte}
        </h1>
        <p className="text-blue-100 text-sm mt-1">
          Gestiona el cumplimiento de tus actividades según el periodo académico activo.
        </p>
      </div>

      {avisoEntrada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-aviso-avance"
          onClick={cerrarAvisoEntrada}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mx-auto mb-5">
              <ClipboardList className="w-9 h-9 text-blue-600" />
            </div>
            <h2 id="titulo-aviso-avance" className="text-xl font-bold text-[#1a2744] mb-2 text-center">
              Registra todo tu avance de la {nombreCorte}
            </h2>
            <p className="text-sm text-gray-600 mb-4 text-center">
              Para que tu reporte quede completo debes:
            </p>
            <ol className="text-sm text-gray-700 space-y-2 mb-5 bg-blue-50 border border-blue-100 rounded-xl p-4 list-decimal list-inside">
              <li>Escribir la ejecución de <strong>cada indicador</strong> de todas tus funciones y actividades.</li>
              <li>Subir las <strong>evidencias</strong> que respalden tu avance.</li>
              <li>Presionar <strong>Guardar Avance Semanal</strong> al terminar: sin ese paso no se registra.</li>
            </ol>
            <label className="flex items-center gap-2 text-xs text-gray-500 mb-5 cursor-pointer select-none">
              <input type="checkbox" checked={noMostrarAviso} onChange={(e) => setNoMostrarAviso(e.target.checked)} className="rounded border-gray-300" />
              No volver a mostrar este aviso
            </label>
            <button
              autoFocus
              onClick={cerrarAvisoEntrada}
              className="w-full px-4 py-2.5 rounded-xl bg-[#1a2744] text-white font-semibold text-sm hover:bg-[#243560] transition-colors"
            >
              Entendido, comenzar
            </button>
          </div>
        </div>
      )}

      {data.length > 0 ? (
          <>
            {/* TABS DE FUNCIONES (Como en Agenda) */}
            <div className="flex flex-wrap gap-2 mb-6">
                {data.map((f, idx) => (
                    <button
                        key={idx}
                        onClick={() => {
                            setSelectedFunctionIndex(idx);
                            setSelectedActivityIndex(0);
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
                            selectedFunctionIndex === idx 
                            ? 'bg-[#063759] text-white border-[#063759] shadow-md' 
                            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                    >
                        {f.funcion_sustantiva}
                    </button>
                ))}
            </div>

            {/* CONTENIDO DE LA FUNCIÓN SELECCIONADA */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8 overflow-hidden animate-in fade-in duration-300">
                 {/* Cabecera de Función Sustantiva */}
                 <div className="bg-[#063759] px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg text-white">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-white font-bold text-lg leading-none">{data[selectedFunctionIndex].funcion_sustantiva}</h2>
                            <div className="text-white/60 text-[10px] mt-1.5 font-bold uppercase tracking-widest">Función Sustantiva Seleccionada</div>
                        </div>
                    </div>
                    <div className="bg-white/10 px-3 py-1 rounded-full border border-white/10">
                        <span className="text-white text-xs font-bold">{data[selectedFunctionIndex].horas_funcion} Horas</span>
                    </div>
                 </div>
                 
                 <div className="bg-[#f8fafc] px-6 py-4 border-b border-gray-100">
                    {data[selectedFunctionIndex].actividades?.length > 1 && (
                        <div className="flex overflow-x-auto pb-2 gap-2 custom-scrollbar">
                            {data[selectedFunctionIndex].actividades.map((act: any, idx: number) => {
                                const active = selectedActivityIndex === idx;
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedActivityIndex(idx)}
                                        className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                                            active
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="truncate max-w-[200px]">{act.rol_seleccionado || 'Actividad'}</span>
                                            {act.grupo_nombre && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${active ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                    G: {act.grupo_nombre}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                 </div>

                 <div className="divide-y divide-gray-100">
                 {data[selectedFunctionIndex].actividades && data[selectedFunctionIndex].actividades.length > 0 ? (
                    <div className="p-6">
                        {(() => {
                            const actividad = data[selectedFunctionIndex].actividades[selectedActivityIndex];
                            const aIndex = selectedActivityIndex;
                            return (
                                <>
                                    {/* Identificación de Actividad */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-gray-50 bg-blue-50/30 p-4 rounded-xl border border-blue-100">
                                        <div className="flex-1">
                                            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Espacio Académico / Actividad</div>
                                            <h3 className="font-bold text-gray-800 text-lg mb-2">{actividad.rol_seleccionado || 'Actividad no especificada'}</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {actividad.semestre_nombre && (
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                                                        Semestre: {actividad.semestre_nombre}
                                                    </span>
                                                )}
                                                {actividad.grupo_nombre && (
                                                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                                                        Grupo: {actividad.grupo_nombre}
                                                    </span>
                                                )}
                                                {actividad.horas_rol && (
                                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold border border-gray-200">
                                                        {actividad.horas_rol} Horas
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-1 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Resultado Esperado</div>
                                            <p className="text-sm text-gray-600 line-clamp-2">{actividad.resultado_esperado || 'Sin descripción'}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 min-w-[200px] flex items-center gap-1.5">
                                            <Target className="w-3.5 h-3.5 text-orange-500" />
                                            Indicador
                                        </th>
                                        <th className="px-4 py-3 text-center">Meta</th>
                                        <th className="px-4 py-3 text-center leading-tight">{rotularCortes('Avance Sem 8', semestreActivo)}<span className="block text-[10px] font-normal text-gray-400">según la meta</span></th>
                                        {semana === '16' && <th className="px-4 py-3 text-center leading-tight">{rotularCortes('Avance Sem 16', semestreActivo)}<span className="block text-[10px] font-normal text-gray-400">según la meta</span></th>}
                                        <th className="px-4 py-3 text-center">% Avance</th>
                                        <th className="px-4 py-3 text-center min-w-[120px]">Estado</th>
                                        <th className="px-4 py-3 min-w-[200px]">
                                            <div className="flex items-center gap-1.5">
                                                <FileText className="w-3.5 h-3.5 text-blue-500" />
                                                Observaciones
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 text-center">Evidencia</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {actividad.indicadores?.map((ind: any, iIndex: number) => {
                                        const meta = Number(ind.meta) || Number(actividad.meta) || 0;
                                        const ejec8 = ind.ejecucion_8 !== null && ind.ejecucion_8 !== undefined && ind.ejecucion_8 !== '' ? parseFloat(String(ind.ejecucion_8)) : 0;
                                        const ejec16 = ind.ejecucion_16 !== null && ind.ejecucion_16 !== undefined && ind.ejecucion_16 !== '' ? parseFloat(String(ind.ejecucion_16)) : 0;
                                        const totalEjecucion = ejec8 + (semana === '16' ? ejec16 : 0);
                                        const superaMeta = totalEjecucion > meta;
                                        const porcentaje = calcularAvance(meta, ejec8, ejec16);
                                        const estado = getEstadoVisual(porcentaje);

                                        return (
                                            <tr key={iIndex} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-4 py-3 text-gray-800 font-medium">{ind.nombre_indicador}</td>
                                                <td className="px-4 py-3 text-center font-bold text-gray-700 bg-gray-50/50">{meta}</td>
                                                <td className="px-4 py-3">
                                                    <input 
                                                        type="number" 
                                                        min="0"
                                                        step="any"
                                                        max={meta > 0 ? meta : undefined}
                                                        value={ind.ejecucion_8 !== null && ind.ejecucion_8 !== undefined ? ind.ejecucion_8 : ''}
                                                        data-avance="ejecucion_8"
                                                        onKeyDown={(e) => teclasAvance(e, 'ejecucion_8', selectedFunctionIndex, aIndex, iIndex)}
                                                        onFocus={(e) => e.target.select()}
                                                        onChange={(e) => handleIndicadorChange(selectedFunctionIndex, aIndex, iIndex, 'ejecucion_8', e.target.value)}
                                                        disabled={semana !== '8'}
                                                        className={`w-full text-center border rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors ${semana !== '8' ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200' : 'bg-white border-gray-300'}`}
                                                    />
                                                </td>
                                                {semana === '16' && (
                                                <td className="px-4 py-3">
                                                    <input 
                                                        type="number" 
                                                        min="0"
                                                        step="any"
                                                        max={meta > 0 ? Math.max(0, meta - ejec8) : undefined}
                                                        value={ind.ejecucion_16 !== null && ind.ejecucion_16 !== undefined ? ind.ejecucion_16 : ''}
                                                        data-avance="ejecucion_16"
                                                        onKeyDown={(e) => teclasAvance(e, 'ejecucion_16', selectedFunctionIndex, aIndex, iIndex)}
                                                        onFocus={(e) => e.target.select()}
                                                        onChange={(e) => handleIndicadorChange(selectedFunctionIndex, aIndex, iIndex, 'ejecucion_16', e.target.value)}
                                                        className={`w-full text-center border rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors bg-white border-gray-300`}
                                                    />
                                                </td>
                                                )}
                                                <td className="px-4 py-3 text-center">
                                                    <div className={`font-bold text-lg ${superaMeta ? 'text-red-600' : 'text-blue-600'}`}>
                                                        {porcentaje}%
                                                    </div>
                                                    {superaMeta && (
                                                        <div className="text-[10px] text-red-500 font-semibold leading-tight mt-1">
                                                            La ejecución supera la meta
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${estado.bg} ${estado.text}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${estado.dot}`}></span>
                                                        {estado.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {/* Observaciones que el Director dejó para ESTA semana sobre la
                                                        actividad. Son de solo lectura: el docente responde con su
                                                        ejecución y sus evidencias, no editando el texto. */}
                                                    {(() => {
                                                        const obsSemana = (actividad.observaciones_director || [])
                                                            .filter((o: any) => String(o.semana) === semana);

                                                        if (obsSemana.length === 0) {
                                                            return (
                                                                <p className="text-xs text-gray-400 italic">
                                                                    Sin observaciones del director para la semana {semana}.
                                                                </p>
                                                            );
                                                        }

                                                        return (
                                                            <div className="space-y-2">
                                                                {obsSemana.map((o: any) => (
                                                                    <div key={o.id} className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                                                                        <div className="flex items-center gap-1.5 mb-1">
                                                                            <MessageSquare className="w-3 h-3 text-amber-600 shrink-0" />
                                                                            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">
                                                                                Semana {o.semana}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-xs text-amber-900 leading-snug whitespace-pre-wrap">{o.texto}</p>
                                                                        <p className="text-[10px] text-amber-600/80 mt-1">
                                                                            {o.director_nombre}
                                                                            {o.ultima_edicion && ` · ${new Date(o.ultima_edicion).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-2">
                                                        <button 
                                                            onClick={() => setModalEvidencia({ isOpen: true, idIndicador: ind.id_indicador, nombreIndicador: ind.nombre_indicador })}
                                                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded border border-blue-200 text-xs font-medium transition-colors w-full"
                                                        >
                                                            <UploadCloud className="w-3.5 h-3.5" />
                                                            Subir
                                                        </button>
                                                        {ind.evidencias?.filter((ev: any) => String(ev.semana) === semana).length > 0 && (
                                                            <div className="flex flex-col gap-1.5 mt-2">
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Cargadas:</span>
                                                                {ind.evidencias.filter((ev: any) => String(ev.semana) === semana).map((ev: any) => (
                                                                    <div key={ev.id_evidencias} className="flex items-stretch gap-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setEvidenciaVisor(ev)}
                                                                            className="flex-1 min-w-0 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline bg-white p-1.5 rounded border border-gray-100 shadow-sm text-left"
                                                                            title={`Ver ${ev.nombre_archivo}`}
                                                                        >
                                                                            {ev.tipo_archivo === 'enlace' ? <ExternalLink className="w-3.5 h-3.5 shrink-0" /> : <Eye className="w-3.5 h-3.5 shrink-0" />}
                                                                            <span className="truncate max-w-[100px]">{ev.nombre_archivo}</span>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => eliminarEvidencia(ev)}
                                                                            disabled={eliminandoEvidencia === ev.id_evidencias}
                                                                            className="shrink-0 px-1.5 rounded border border-red-100 bg-white text-red-500 hover:bg-red-50 hover:text-red-700 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                                                                            title={`Eliminar ${ev.nombre_archivo}`}
                                                                            aria-label={`Eliminar ${ev.nombre_archivo}`}
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-bold text-gray-800">
                                    <tr>
                                        <td className="px-4 py-3 text-right">TOTALES:</td>
                                        <td className="px-4 py-3 text-center">
                                            {actividad.indicadores?.reduce((acc: number, curr: any) => acc + (Number(curr.meta) || Number(actividad.meta) || 0), 0)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {actividad.indicadores?.reduce((acc: number, curr: any) => acc + (Number(curr.ejecucion_8) || 0), 0)}
                                        </td>
                                        {semana === '16' && (
                                        <td className="px-4 py-3 text-center">
                                            {actividad.indicadores?.reduce((acc: number, curr: any) => acc + (Number(curr.ejecucion_16) || 0), 0)}
                                        </td>
                                        )}
                                        <td className="px-4 py-3 text-center text-blue-700">
                                            {calcularAvance(
                                                actividad.indicadores?.reduce((acc: number, curr: any) => acc + (Number(curr.meta) || Number(actividad.meta) || 0), 0) || 0,
                                                actividad.indicadores?.reduce((acc: number, curr: any) => acc + (Number(curr.ejecucion_8) || 0), 0),
                                                actividad.indicadores?.reduce((acc: number, curr: any) => acc + (Number(curr.ejecucion_16) || 0), 0)
                                            )}%
                                        </td>
                                        <td colSpan={3}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        </>
                            );
                        })()}
                    </div>
                 ) : (
                    <div className="p-12 text-center text-gray-500">
                        No hay actividades registradas en esta función.
                    </div>
                 )}
                 </div>

                 <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-200">
                    <button 
                        onClick={guardarAvance}
                        disabled={guardando}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold transition-colors shadow-sm disabled:bg-blue-400 disabled:cursor-not-allowed"
                    >
                        {guardando ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {guardando ? 'Guardando...' : `Guardar Avance Semanal`}
                    </button>
                 </div>
            </div>
          </>
      ) : (
          <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center text-center">
             <AlertCircle className="w-16 h-16 text-gray-300 mb-4" />
             <h3 className="text-xl font-bold text-gray-800">No hay actividades registradas</h3>
             <p className="text-sm text-gray-500 mt-2 max-w-md">Aún no se ha configurado tu agenda docente o no tienes actividades asignadas para reportar avance.</p>
          </div>
      )}
      <SubirEvidenciaModal
        isOpen={modalEvidencia.isOpen}
        onClose={() => setModalEvidencia({ ...modalEvidencia, isOpen: false })}
        idIndicador={modalEvidencia.idIndicador}
        nombreIndicador={modalEvidencia.nombreIndicador}
        semana={semana}
        onUploadSuccess={refrescarEvidencias}
      />
      {evidenciaVisor && (
        <VisorEvidenciaModal evidencia={evidenciaVisor} onClose={() => setEvidenciaVisor(null)} />
      )}
    </Layout>
  );
}
