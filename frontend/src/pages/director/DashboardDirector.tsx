import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../../components/common/Layout';
import api from '../../services/api';
import {
  Users, CheckCircle, Clock, TrendingUp, AlertCircle,
  Upload, UploadCloud, X, BookOpen, Calendar, Lock,
  FileBarChart2, ChevronRight, RefreshCw
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];

const getEstadoDocente = (d: any) => {
  const total = parseInt(d.total_funciones);
  const aceptadas = parseInt(d.funciones_aceptadas);
  if (total === 0) return { label: 'Sin asignar', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
  if (aceptadas >= total) return { label: 'Completa', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' };
  if (aceptadas > 0) return { label: 'En progreso', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' };
  return { label: 'Pendiente', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' };
};

export default function DashboardDirector() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileUpdateRef = useRef<HTMLInputElement>(null);

  const cargarDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/director/dashboard');
      setData(res.data);
    } catch (e) {
      console.error('Error cargando dashboard director:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDashboard();
    const interval = setInterval(cargarDashboard, 30000);
    return () => clearInterval(interval);
  }, [cargarDashboard]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, endpoint: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append('archivo', file);
    try {
      const res = await api.post(`/director/${endpoint}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadResult({ success: true, data: res.data, tipo: endpoint === 'importar' ? 'Importación' : 'Actualización' });
      cargarDashboard();
    } catch (err: any) {
      setUploadResult({ success: false, error: err.response?.data?.error || 'Error de conexión.' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (fileUpdateRef.current) fileUpdateRef.current.value = '';
    }
  };

  const periodoActivo = data?.periodo;
  const docentes: any[] = data?.docentes || [];
  const metricas = data?.metricas || { total: 0, aceptadas: 0, pendientes: 0, total_horas: 0 };
  const distribucion: any[] = data?.distribucion || [];
  const importacionRealizada = data?.importacionRealizada || false;
  const puedeImportar = !!periodoActivo;

  const docentesFiltrados = docentes.filter(d =>
    d.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.correo?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const periodoLabel = periodoActivo
    ? `${periodoActivo.anio} - ${periodoActivo.semestre === 1 ? 'Semestre I' : 'Semestre II'}`
    : 'Sin periodo activo';

  if (loading) {
    return (
      <Layout rol="director" path="Inicio / Dashboard Director">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout rol="director" path="Inicio / Dashboard Director">

      {/* BANNER */}
      <div className="bg-gradient-to-br from-[#0f2744] via-[#1a3a6c] to-[#0d3b7a] rounded-2xl px-8 py-7 mb-7 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
          <div>
            <h1 className="text-2xl font-extrabold text-white mb-1 tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-300" />
              Panel del Director
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
            ) : (
              <>
                <button
                  disabled={uploading || importacionRealizada}
                  onClick={() => fileInputRef.current?.click()}
                  title={importacionRealizada ? 'Ya se importó para este periodo. Use Actualizar.' : 'Importar desde cero para el periodo activo'}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md ${
                    importacionRealizada
                      ? 'bg-gray-500/40 text-gray-400 cursor-not-allowed border border-gray-600/30'
                      : uploading ? 'bg-indigo-400 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  {importacionRealizada ? 'Ya Importado ✓' : uploading ? 'Procesando...' : 'Importar (Nuevo)'}
                </button>
                <button
                  disabled={uploading}
                  onClick={() => fileUpdateRef.current?.click()}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md ${uploading ? 'bg-emerald-400 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                >
                  {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Procesando...' : 'Actualizar Importación'}
                </button>
                <button onClick={cargarDashboard} className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white text-sm font-bold transition-all">
                  <RefreshCw className="w-4 h-4" /> Actualizar
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* RESULTADO IMPORTACIÓN */}
      {uploadResult && (
        <div className={`mb-6 p-5 rounded-2xl border relative ${uploadResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <button onClick={() => setUploadResult(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          {uploadResult.success ? (
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
              <div>
                <p className="font-bold text-green-900">{uploadResult.tipo} exitosa — {uploadResult.data?.resultados?.procesados || 0} registros procesados</p>
                {uploadResult.data?.resultados?.erroresEncontrados > 0 && (
                  <p className="text-sm text-red-600 mt-1">{uploadResult.data.resultados.erroresEncontrados} filas con errores</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
              <p className="font-bold text-red-900">{uploadResult.error}</p>
            </div>
          )}
        </div>
      )}

      {/* SIN PERIODO ACTIVO */}
      {!periodoActivo && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center mb-7">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-amber-900">No hay un periodo académico activo</h3>
          <p className="text-sm text-amber-700 mt-1">Solicita a Planeación que abra un nuevo periodo para poder importar asignaciones y gestionar agendas.</p>
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
              <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Estado de Docentes</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Periodo: {periodoLabel}</p>
                </div>
                <input
                  type="text"
                  placeholder="Buscar docente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 w-full sm:w-52"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                    <tr>
                      <th className="px-5 py-3 text-left font-bold">Docente</th>
                      <th className="px-5 py-3 text-left font-bold">Contrato</th>
                      <th className="px-5 py-3 text-center font-bold">Horas</th>
                      <th className="px-5 py-3 text-center font-bold">Funciones</th>
                      <th className="px-5 py-3 text-center font-bold">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {docentesFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-gray-400 text-sm">
                          {importacionRealizada ? 'No se encontraron docentes' : 'Importa un Excel para ver los docentes asignados'}
                        </td>
                      </tr>
                    ) : docentesFiltrados.map((d) => {
                      const estado = getEstadoDocente(d);
                      const total = parseInt(d.total_funciones);
                      const aceptadas = parseInt(d.funciones_aceptadas);
                      return (
                        <tr key={d.id_usuario} className="hover:bg-blue-50/40 transition-colors group">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                {d.nombre.charAt(0)}{d.nombre.split(' ')[1]?.charAt(0) || ''}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 text-sm leading-tight">{d.nombre}</p>
                                <p className="text-xs text-gray-400">{d.correo}</p>
                              </div>
                            </div>
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
                            {total > 0 ? (
                              <span className="text-sm font-bold text-gray-700">{aceptadas}<span className="text-gray-400 font-normal">/{total}</span></span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
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
            </div>

            {/* GRÁFICAS */}
            <div className="flex flex-col gap-5">
              {/* Pie chart distribución horas */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex-1">
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
                  </>
                ) : (
                  <div className="h-44 flex items-center justify-center text-gray-400 text-sm text-center">
                    <div>
                      <FileBarChart2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Sin datos de distribución.<br />Importa un Excel primero.
                    </div>
                  </div>
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

          {/* BARRA DE HORAS POR CONTRATO */}
          {distribucion.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-500" /> Horas por Función Sustantiva
              </h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribucion.map(d => ({ name: d.funcion_sustantiva.replace('Docencia ', 'Doc. '), horas: parseFloat(d.horas) }))} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => `${v}h`} contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)' }} />
                    <Bar dataKey="horas" radius={[6, 6, 0, 0]}>
                      {distribucion.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
