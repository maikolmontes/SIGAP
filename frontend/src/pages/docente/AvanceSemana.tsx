import { useState, useEffect } from 'react';
import Layout from '../../components/common/Layout';
import { FileText, CheckCircle, AlertCircle, UploadCloud, Save, BookOpen, Target, ClipboardList } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface AvanceSemanaProps {
  semana: '8' | '16';
  rolActual?: 'docente' | 'director' | 'planeacion';
}

export default function AvanceSemana({ semana, rolActual = 'docente' }: AvanceSemanaProps) {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [semanaInfo, setSemanaInfo] = useState<any>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: string, texto: string } | null>(null);

  const [selectedFunctionIndex, setSelectedFunctionIndex] = useState(0);

  useEffect(() => {
    if (user) {
      cargarData();
    }
  }, [semana, user]);

  const cargarData = async () => {
    try {
      setLoading(true);
      const userId = (user as any)?.id_usuario || user?.id;
      if (!userId) return;

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
                     existing = { ...curr, indicadores: [] };
                     acc.push(existing);
                 }
                 if (curr.id_indicador) {
                     existing.indicadores.push({
                         id_indicador: curr.id_indicador,
                         nombre_indicador: curr.nombre_indicador,
                         ejecucion_8: curr.ejecucion_8,
                         ejecucion_16: curr.ejecucion_16,
                         observaciones: curr.observaciones
                     });
                 }
                 return acc;
             }, [])
         }));
         
         setData(struct);
      }
    } catch (error) {
      console.error("Error cargando data de avance:", error);
      setMensaje({ tipo: 'error', texto: 'No se pudo cargar la información de la agenda.' });
    } finally {
      setLoading(false);
    }
  };

  const guardarAvance = async () => {
    try {
        setGuardando(true);
        setMensaje(null);

        // Flatten indicators to send to backend
        const indicadores = data.flatMap(f => 
            f.actividades.flatMap((a: any) => a.indicadores)
        );

        await api.post('/agenda/guardar-avance', { indicadores });

        setMensaje({ tipo: 'exito', texto: `¡Avance de la Semana ${semana} guardado correctamente!` });
        
        // Refetch to ensure data is in sync
        cargarData();
    } catch (error) {
        console.error("Error guardando avance:", error);
        setMensaje({ tipo: 'error', texto: 'Ocurrió un error al intentar guardar el avance.' });
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

  const handleIndicadorChange = (fIndex: number, aIndex: number, iIndex: number, campo: string, valor: any) => {
    const newData = [...data];
    newData[fIndex].actividades[aIndex].indicadores[iIndex][campo] = valor;
    setData(newData);
  };

  if (loading) {
    return (
      <Layout rol="docente" path={`Registro de Actividades / Reporte Semana ${semana}`}>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  if (!semanaInfo?.habilitada) {
    return (
      <Layout rol="docente" path={`Registro de Actividades / Reporte Semana ${semana}`}>
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md mx-auto text-center mt-10">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Semana Cerrada</h2>
          <p className="text-gray-600 mb-4">
            El reporte de evidencias para la Semana {semana} no está habilitado en este momento. Consulta con Planeación si necesitas realizar ajustes.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout rol="docente" path={`Registro de Actividades / Reporte Semana ${semana}`}>
      <div className="bg-[#1a2744] rounded-xl px-6 py-6 mb-8 shadow-sm">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-blue-400" />
          Reporte de Avance Académico - Semana {semana}
        </h1>
        <p className="text-blue-100 text-sm mt-1">
          Gestiona el cumplimiento de tus actividades según el periodo académico activo.
        </p>
      </div>

      {mensaje && (
        <div className={`p-4 mb-6 rounded-xl flex items-start gap-3 border animate-in fade-in slide-in-from-top-4 ${mensaje.tipo === 'exito' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {mensaje.tipo === 'exito' ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
          <p className="font-medium text-sm">{mensaje.texto}</p>
        </div>
      )}

      {data.length > 0 ? (
          <>
            {/* TABS DE FUNCIONES (Como en Agenda) */}
            <div className="flex flex-wrap gap-2 mb-6">
                {data.map((f, idx) => (
                    <button
                        key={idx}
                        onClick={() => setSelectedFunctionIndex(idx)}
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
                 
                 <div className="divide-y divide-gray-100">
                 {data[selectedFunctionIndex].actividades?.map((actividad: any, aIndex: number) => (
                    <div key={aIndex} className="p-6">
                        {/* Identificación de Actividad */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-gray-50">
                            <div className="flex-1">
                                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Actividad Asignada</div>
                                <h3 className="font-bold text-gray-800 text-base">{actividad.rol_seleccionado || 'Actividad no especificada'}</h3>
                            </div>
                            <div className="flex-1">
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Resultado Esperado</div>
                                <p className="text-sm text-gray-600 line-clamp-2">{actividad.resultado_esperado || 'Sin descripción'}</p>
                            </div>
                        </div>
                        
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 min-w-[200px] flex items-center gap-1.5">
                                            <Target className="w-3.5 h-3.5 text-orange-500" />
                                            Indicador
                                        </th>
                                        <th className="px-4 py-3 text-center">Meta</th>
                                        <th className="px-4 py-3 text-center">Ejecución Sem 8</th>
                                        <th className="px-4 py-3 text-center">Ejecución Sem 16</th>
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
                                        const meta = actividad.meta || 0;
                                        const ejec8 = Number(ind.ejecucion_8) || 0;
                                        const ejec16 = Number(ind.ejecucion_16) || 0;
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
                                                        max={semana === '8' ? meta : undefined}
                                                        value={ind.ejecucion_8 || ''}
                                                        onChange={(e) => handleIndicadorChange(selectedFunctionIndex, aIndex, iIndex, 'ejecucion_8', e.target.value)}
                                                        disabled={semana !== '8'}
                                                        className={`w-full text-center border rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors ${semana !== '8' ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200' : 'bg-white border-gray-300'}`}
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input 
                                                        type="number" 
                                                        min="0"
                                                        max={semana === '16' ? Math.max(0, meta - ejec8) : undefined}
                                                        value={ind.ejecucion_16 || ''}
                                                        onChange={(e) => handleIndicadorChange(selectedFunctionIndex, aIndex, iIndex, 'ejecucion_16', e.target.value)}
                                                        disabled={semana !== '16'}
                                                        className={`w-full text-center border rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors ${semana !== '16' ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200' : 'bg-white border-gray-300'}`}
                                                    />
                                                </td>
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
                                                    <textarea 
                                                        value={ind.observaciones || ''}
                                                        onChange={(e) => handleIndicadorChange(selectedFunctionIndex, aIndex, iIndex, 'observaciones', e.target.value)}
                                                        disabled={rolActual !== 'director'} 
                                                        placeholder={rolActual === 'director' ? "Escribe una observación aquí..." : "El director agregará observaciones aquí..."}
                                                        className={`w-full text-xs border rounded px-2 py-1.5 resize-none h-12 transition-colors ${rolActual === 'director' ? 'bg-white border-blue-300 focus:ring-2 focus:ring-blue-200 focus:outline-none' : 'bg-gray-50 border-gray-200 text-gray-600 cursor-not-allowed'}`}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded border border-blue-200 text-xs font-medium transition-colors w-full">
                                                        <UploadCloud className="w-3.5 h-3.5" />
                                                        Subir
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-bold text-gray-800">
                                    <tr>
                                        <td className="px-4 py-3 text-right">TOTALES:</td>
                                        <td className="px-4 py-3 text-center">{actividad.meta || 0}</td>
                                        <td className="px-4 py-3 text-center">
                                            {actividad.indicadores?.reduce((acc: number, curr: any) => acc + (Number(curr.ejecucion_8) || 0), 0)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {actividad.indicadores?.reduce((acc: number, curr: any) => acc + (Number(curr.ejecucion_16) || 0), 0)}
                                        </td>
                                        <td className="px-4 py-3 text-center text-blue-700">
                                            {calcularAvance(
                                                actividad.meta || 0,
                                                actividad.indicadores?.reduce((acc: number, curr: any) => acc + (Number(curr.ejecucion_8) || 0), 0),
                                                actividad.indicadores?.reduce((acc: number, curr: any) => acc + (Number(curr.ejecucion_16) || 0), 0)
                                            )}%
                                        </td>
                                        <td colSpan={3}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                 ))}
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
    </Layout>
  );
}
