import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/common/Layout';
import api from '../../services/api';
import { 
  Users, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  FileCheck, 
  AlertCircle,
  Eye,
  BarChart,
  Download,
  Filter,
  MoreVertical,
  Upload,
  UploadCloud,
  X
} from 'lucide-react';
import { 
  BarChart as RechartsBar, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell
} from 'recharts';

// Datos estáticos (Mocks) para la simulación
const MOCK_DATA = {
  director: { nombre: 'María Fernanda', programa: 'Ingeniería de Sistemas', periodo: '2025 IIP' },
  metricas: { agendasPendientes: 4, agendasAprobadas: 18, avancePromedio: 65, evidenciasRevision: 8 },
  docentes: [
    { id: 1, nombre: 'Diego Javier Montes', contrato: 'Tiempo Completo', horas: 40, estadoAgenda: 'Aprobado', avance8: 75, evidencias: 3 },
    { id: 2, nombre: 'Ana Rosa Lizarazo', contrato: 'Medio Tiempo', horas: 20, estadoAgenda: 'En Revisión', avance8: 45, evidencias: 1 },
    { id: 3, nombre: 'Carlos Andrés Perez', contrato: 'Hora Cátedra', horas: 12, estadoAgenda: 'Pendiente', avance8: 0, evidencias: 0 },
    { id: 4, nombre: 'Luis Fernando Gomez', contrato: 'Tiempo Completo', horas: 40, estadoAgenda: 'Aprobado', avance8: 80, evidencias: 4 },
    { id: 5, nombre: 'Elena Sofia Castro', contrato: 'Hora Cátedra', horas: 10, estadoAgenda: 'Rechazado', avance8: 10, evidencias: 0 }
  ],
  distribucionPrograma: [
    { funcion: 'Docencia Directa', horas: 240 },
    { funcion: 'Docencia Indirecta', horas: 120 },
    { funcion: 'Investigación', horas: 90 },
    { funcion: 'Acad. Administrativo', horas: 85 }
  ],
  avanceHistorico: [
    { name: 'Semana 4', avance: 20 },
    { name: 'Semana 8', avance: 45 },
    { name: 'Semana 12', avance: 60 },
    { name: 'Semana 16', avance: 85 },
  ]
};

const PIE_COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b'];

export default function DashboardDirector() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [yaImporto, setYaImporto] = useState(false);
  
  const [semanaActiva, setSemanaActiva] = useState(false);
  const [tiempoRestanteTexto, setTiempoRestanteTexto] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileUpdateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        try {
          const semanasRes = await api.get('/semanas');
          const semanaCero = semanasRes.data.find((s: any) => s.numero_semana === '0');
          if (semanaCero && semanaCero.habilitada && semanaCero.fecha_inicio && semanaCero.fecha_fin) {
              const ahora = new Date();
              const inicio = new Date(semanaCero.fecha_inicio);
              inicio.setHours(0, 0, 0, 0);
              const fin = new Date(semanaCero.fecha_fin);
              fin.setHours(23, 59, 59, 999);
              
              if (ahora >= inicio && ahora <= fin) {
                  setSemanaActiva(true);
                  const diffMs = fin.getTime() - ahora.getTime();
                  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  const horas = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  setTiempoRestanteTexto(`Semana 0: ${dias}d ${horas}h restantes`);
              } else {
                  setSemanaActiva(false);
                  setTiempoRestanteTexto('Semana 0 Finalizada');
              }
          } else {
              setSemanaActiva(false);
              setTiempoRestanteTexto(semanaCero ? 'Semana 0 Deshabilitada' : 'Sin Semana 0 Activa');
          }
        } catch (error) {
            console.error("Error al cargar semanas:", error);
        }

        // Verificar si ya hay asignaciones importadas
        const res = await api.get('/agenda/base/1'); // Check any user
        if (res.data?.funciones?.length > 0) {
          setYaImporto(true);
        }
      } catch { /* No hay datos */ }
      setLoading(false);
    };
    init();
  }, []);

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpdateClick = () => {
    fileUpdateRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, endpoint: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('archivo', file);

    try {
      const response = await api.post(`/director/${endpoint}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadResult({ success: true, data: response.data, tipo: endpoint === 'importar' ? 'Importación' : 'Actualización' });
      if (endpoint === 'importar') setYaImporto(true);
    } catch (error: any) {
      console.error("Error al subir archivo", error);
      setUploadResult({ 
        success: false, 
        error: error.response?.data?.error || 'Error de conexión con el servidor.'
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (fileUpdateRef.current) fileUpdateRef.current.value = '';
    }
  };

  const clearResult = () => setUploadResult(null);

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case 'Aprobado':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3"/> {estado}</span>;
      case 'En Revisión':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold flex items-center gap-1"><Clock className="w-3 h-3"/> {estado}</span>;
      case 'Pendiente':
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {estado}</span>;
      case 'Rechazado':
        return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {estado}</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">{estado}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium tracking-wide">Analizando datos del programa...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout rol="director" path="Inicio / Dashboard Director">
      {/* Banner de Bienvenida Estilizado */}
      <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2a5286] rounded-2xl px-8 py-8 mb-6 flex flex-col xl:flex-row items-start xl:items-center justify-between shadow-lg relative overflow-hidden group gap-4">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-700"></div>
        <div className="relative z-10 w-full xl:w-auto">
          <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
            Bienvenido, Director(a) {MOCK_DATA.director.nombre.split(' ')[0]}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <p className="text-blue-200 text-sm font-medium flex items-center gap-2">
              <span className="bg-blue-900/50 px-2 py-1 rounded-md">{MOCK_DATA.director.programa}</span>
              <span className="bg-white/10 px-2 py-1 rounded-md">Período Activo: {MOCK_DATA.director.periodo}</span>
            </p>
            {tiempoRestanteTexto && (
              <div className={`px-3 py-1 rounded-md font-bold text-xs ${semanaActiva ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                  <div className="flex items-center justify-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {tiempoRestanteTexto}
                  </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="relative z-10 mt-2 xl:mt-0 w-full xl:w-auto flex flex-col sm:flex-row gap-3">
           <input type="file" accept=".xlsx,.xls" className="hidden" ref={fileInputRef} onChange={(e) => handleFileChange(e, 'importar')} />
           <input type="file" accept=".xlsx,.xls" className="hidden" ref={fileUpdateRef} onChange={(e) => handleFileChange(e, 'actualizar')} />
           
           <button 
              disabled={uploading || yaImporto}
              onClick={handleFileUploadClick}
              className={`flex items-center justify-center gap-2 px-5 py-3 ${
                yaImporto 
                  ? 'bg-gray-400 cursor-not-allowed opacity-60' 
                  : uploading ? 'bg-indigo-300' : 'bg-indigo-600 hover:bg-indigo-500'
              } rounded-xl text-white text-sm font-semibold transition-all shadow-md focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600`}
              title={yaImporto ? 'Ya se realizó una importación. Use Actualizar para agregar más datos.' : 'Limpia todo e importa desde cero'}
           >
              {uploading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <UploadCloud className="w-5 h-5" />}
              {yaImporto ? 'Ya Importado ✓' : uploading ? 'Procesando...' : 'Importar (Nuevo)'}
           </button>
           <button 
              disabled={uploading}
              onClick={handleFileUpdateClick}
              className={`flex items-center justify-center gap-2 px-5 py-3 ${uploading ? 'bg-green-300' : 'bg-green-600 hover:bg-green-500'} rounded-xl text-white text-sm font-semibold transition-all shadow-md focus:ring-2 focus:ring-offset-2 focus:ring-green-600`}
              title="Agrega funciones/actividades sin borrar las existentes"
           >
              {uploading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload className="w-5 h-5" />}
              {uploading ? 'Procesando...' : 'Actualizar Importación'}
           </button>
           <button className="flex items-center justify-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl text-white text-sm font-semibold transition-all border border-white/20 hover:border-white/40 shadow-sm hover:shadow-md">
             <Download className="w-5 h-5" />
             Reporte Consolidado
           </button>
        </div>
      </div>

      {uploadResult && (
        <div className={`mb-6 p-6 rounded-2xl shadow-md border ${uploadResult.success ? 'bg-white border-green-200' : 'bg-red-50 border-red-200'} relative animate-in fade-in slide-in-from-top-4`}>
          <button onClick={clearResult} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
          
          {uploadResult.success ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{uploadResult.tipo || 'Importación'} Exitosa</h3>
                    <p className="text-sm text-gray-500">
                      Se procesaron <span className="font-bold text-green-600">{uploadResult.data.resultados.procesados} asignaciones</span>
                      {uploadResult.data.resultados.omitidos > 0 && <> · <span className="font-bold text-blue-600">{uploadResult.data.resultados.omitidos} ya existían</span></>}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                 <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                   <Clock className="w-4 h-4 text-indigo-500" />
                   Historial Reciente de la Importación
                 </h4>
                 
                 {/* Aquí se simula la vista de lo que se hizo, pero en una app real se mostrarían los registros directamente mapeados. */}
                 <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                       <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                       <div>
                         <p className="text-sm font-semibold text-gray-800">Se vincularon roles docentes base con funciones sustantivas</p>
                         <p className="text-xs text-gray-500">Ejemplo: Horas administrativas ({'>'} Docencia Indirecta), Investigación</p>
                       </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                       <span className="w-2 h-2 mt-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>
                       <div>
                         <p className="text-sm font-semibold text-gray-800">Estructura Semestre-Grupo actualizada</p>
                         <p className="text-xs text-gray-500">Se generaron o verificaron los semestres y grupos (ej. "11-M", "5E-N", "9A-M")</p>
                       </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                       <span className="w-2 h-2 mt-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
                       <div>
                         <p className="text-sm font-semibold text-gray-800">Disponibilidad en agendas docentes actualizadas</p>
                         <p className="text-xs text-gray-500">Los profesores como Diego Villareal y Maikol Montenegro ya pueden acceder y cargar sus evidencias.</p>
                       </div>
                    </div>
                 </div>
              </div>

              {uploadResult.data.resultados.erroresEncontrados > 0 && (
                <div className="mt-4 bg-red-50/80 border border-red-100 p-4 rounded-xl text-sm text-red-700">
                  <p className="font-semibold mb-2 flex items-center gap-2">
                     <AlertCircle className="w-4 h-4" /> 
                     Novedades/Errores no importados ({uploadResult.data.resultados.erroresEncontrados}):
                  </p>
                  <ul className="list-disc pl-5 max-h-40 overflow-y-auto space-y-1">
                    {uploadResult.data.resultados.detallesErrores.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="p-2">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-red-900">Error al importar</h3>
              </div>
              <p className="text-sm text-red-700 mt-2">{uploadResult.error}</p>
            </div>
          )}
        </div>
      )}

      {/* Tarjetas de Métricas Directivas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-xl">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-xs font-bold px-2 py-1 bg-green-100 text-green-700 rounded-lg">+12% vs Ant.</span>
          </div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Agendas Aprobadas</h3>
          <div className="text-3xl font-black text-gray-800">
            {MOCK_DATA.metricas.agendasAprobadas} <span className="text-sm font-medium text-gray-400">/ 25</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-50 rounded-xl">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <span className="text-xs font-bold px-2 py-1 bg-red-100 text-red-700 rounded-lg">Acción Req.</span>
          </div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Por Revisar</h3>
          <div className="text-3xl font-black text-gray-800">
            {MOCK_DATA.metricas.agendasPendientes} <span className="text-sm font-medium text-gray-400">Agendas</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
             <span className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded-lg">Corte 1</span>
          </div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Avance Programa</h3>
          <div className="text-3xl font-black text-gray-800">
            {MOCK_DATA.metricas.avancePromedio}% <span className="text-sm font-medium text-gray-400">Promedio</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 rounded-xl">
              <FileCheck className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Evidencias en Cola</h3>
          <div className="text-3xl font-black text-gray-800">
            {MOCK_DATA.metricas.evidenciasRevision} <span className="text-sm font-medium text-gray-400">Por validar</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Tabla / Lista de Docentes */}
        <div className="col-span-1 lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Estado de Docentes</h2>
              <p className="text-sm text-gray-500">Supervisión de agendas y cumplimiento</p>
            </div>
            <div className="flex gap-2">
              <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600">
                <Filter className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold">Docente</th>
                  <th className="px-6 py-4 font-bold">Agenda</th>
                  <th className="px-6 py-4 font-bold text-center">Avance (Sem 8)</th>
                  <th className="px-6 py-4 font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {MOCK_DATA.docentes.map((doc) => (
                  <tr key={doc.id} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                          {doc.nombre.charAt(0)}{doc.nombre.split(' ')[1]?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{doc.nombre}</p>
                          <p className="text-xs text-gray-500">{doc.contrato} · {doc.horas}h</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(doc.estadoAgenda)}
                    </td>
                    <td className="px-6 py-4 w-48">
                      <div className="flex items-center gap-3">
                        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${doc.avance8 < 30 ? 'bg-red-500' : doc.avance8 < 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${doc.avance8}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-gray-700">{doc.avance8}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-blue-600 hover:text-blue-800 rounded-lg text-sm font-medium transition-colors border border-gray-200">
                        <Eye className="w-4 h-4" />
                        Revisar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Gráficas Consolidadas del Programa */}
        <div className="col-span-1 flex flex-col gap-6">
          
          {/* Dona de Distribución */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex-1">
             <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900">Distribución de Horas</h2>
              <p className="text-sm text-gray-500">Global del programa</p>
            </div>
            <div className="h-48 relative mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={MOCK_DATA.distribucionPrograma}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="horas"
                    stroke="none"
                  >
                    {MOCK_DATA.distribucionPrograma.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-gray-800">535h</span>
                <span className="text-xs text-gray-500 font-medium">Asignadas</span>
              </div>
            </div>
            <div className="space-y-2">
               {MOCK_DATA.distribucionPrograma.map((item, idx) => (
                 <div key={item.funcion} className="flex justify-between items-center text-sm">
                   <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                      <span className="text-gray-600 font-medium">{item.funcion}</span>
                   </div>
                   <span className="font-bold text-gray-900">{item.horas}h</span>
                 </div>
               ))}
            </div>
          </div>

        </div>
      </div>

    </Layout>
  );
}
