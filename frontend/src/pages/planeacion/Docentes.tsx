import { useState, useEffect } from 'react';
import Layout from '../../components/common/Layout';
import { 
  Users, 
  UserPlus, 
  Upload, 
  Search, 
  Check, 
  X, 
  Shield, 
  Mail, 
  FileText, 
  BookOpen, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  Info,
  UserCheck,
  UserMinus,
  Briefcase,
  Calendar
} from 'lucide-react';
import { 
  getUsuarios, 
  createUsuario, 
  createBulkUsuarios, 
  toggleActivo 
} from '../../services/usuariosService';
import {
  getPeriodoActivo,
  getDocentesPeriodo
} from '../../services/periodosService';

interface Usuario {
  id_usuario: number;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  correo: string;
  activo: boolean;
  tipo_contrato: string;
  horas_contrato: number;
  programa: string;
  roles: string;
}

export default function Docentes() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error', texto: string } | null>(null);
  
  // Periodo activo
  const [periodoActivo, setPeriodoActivo] = useState<any>(null);

  // Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRol, setSelectedRol] = useState('todos');
  const [selectedEstado, setSelectedEstado] = useState('todos');

  // Control de Modales
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Formulario de Creación Individual
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('CC');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [correo, setCorreo] = useState('');
  const [idContrato, setIdContrato] = useState(1);
  const [idPrograma, setIdPrograma] = useState(1);
  const [rol, setRol] = useState('Docente');
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Carga Masiva
  const [bulkInput, setBulkInput] = useState('');
  const [bulkFormat, setBulkFormat] = useState<'json' | 'csv'>('csv');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ insertados: number; errores: any[] } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      // 1. Obtener período activo
      const activePeriodRes = await getPeriodoActivo();
      const pActivo = activePeriodRes.data;
      setPeriodoActivo(pActivo);

      if (pActivo) {
        // 2. Obtener docentes asignados al período activo
        const res = await getDocentesPeriodo(pActivo.id_periodo);
        // Filtrar localmente por Ingeniería de Sistemas (programa = 'Ingeniería de Sistemas') para asegurar
        const listaSistemas = res.data.filter((u: Usuario) => 
          !u.programa || u.programa === 'Ingeniería de Sistemas'
        );
        setUsuarios(listaSistemas);
      } else {
        setUsuarios([]);
      }
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      setMensaje({ tipo: 'error', texto: 'No se pudieron cargar los docentes del período activo.' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActivo = async (id: number, nombreCompleto: string) => {
    try {
      const res = await toggleActivo(id);
      setUsuarios(prev => prev.map(u => u.id_usuario === id ? { ...u, activo: res.data.activo } : u));
      setMensaje({
        tipo: 'exito',
        texto: `Estado de ${nombreCompleto} cambiado exitosamente a ${res.data.activo ? 'ACTIVO' : 'INACTIVO'}.`
      });
      setTimeout(() => setMensaje(null), 4000);
    } catch (error) {
      console.error('Error al alternar estado del usuario:', error);
      setMensaje({ tipo: 'error', texto: 'Ocurrió un error al cambiar el estado del usuario.' });
    }
  };

  const handleResetForm = () => {
    setNombres('');
    setApellidos('');
    setTipoDocumento('CC');
    setNumeroDocumento('');
    setCorreo('');
    setIdContrato(1);
    setIdPrograma(1);
    setRol('Docente');
    setFormError(null);
  };

  const handleSubmitIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!nombres.trim() || !apellidos.trim() || !correo.trim() || !numeroDocumento.trim()) {
      setFormError('Por favor diligencie todos los campos obligatorios.');
      return;
    }

    try {
      setCreating(true);
      await createUsuario({
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        tipo_documento: tipoDocumento,
        numero_documento: numeroDocumento.trim(),
        correo: correo.trim().toLowerCase(),
        id_contrato: idContrato,
        id_programa: idPrograma,
        rol
      });

      setMensaje({
        tipo: 'exito',
        texto: `El usuario ${nombres.trim()} ${apellidos.trim()} ha sido registrado con el rol de ${rol}.`
      });
      setShowAddModal(false);
      handleResetForm();
      cargarUsuarios();
      setTimeout(() => setMensaje(null), 4000);
    } catch (error: any) {
      console.error('Error al crear usuario:', error);
      const errMsg = error.response?.data?.error || 'No se pudo registrar el usuario. Verifique si el correo ya está registrado.';
      setFormError(errMsg);
    } finally {
      setCreating(false);
    }
  };

  const handleImportMasivo = async () => {
    setBulkError(null);
    setImportResult(null);

    if (!bulkInput.trim()) {
      setBulkError('El contenido de importación no puede estar vacío.');
      return;
    }

    let datosAEnviar: any[] = [];

    try {
      setImporting(true);
      if (bulkFormat === 'json') {
        try {
          const parsed = JSON.parse(bulkInput);
          if (!Array.isArray(parsed)) {
            throw new Error('El JSON debe ser un arreglo de objetos.');
          }
          datosAEnviar = parsed;
        } catch (e: any) {
          throw new Error(`Error en el formato JSON: ${e.message}`);
        }
      } else {
        // Parsear CSV
        const lineas = bulkInput.trim().split('\n');
        if (lineas.length < 2) {
          throw new Error('El CSV debe incluir al menos una cabecera y una línea de datos.');
        }

        const cabeceras = lineas[0].toLowerCase().split(',').map(h => h.trim());
        
        // Validar columnas indispensables
        if (!cabeceras.includes('nombres') || !cabeceras.includes('apellidos') || !cabeceras.includes('correo')) {
          throw new Error('El CSV debe contener al menos las columnas: "nombres", "apellidos" y "correo".');
        }

        for (let i = 1; i < lineas.length; i++) {
          const cols = lineas[i].split(',').map(c => c.trim());
          if (cols.length === cabeceras.length) {
            const filaObj: any = {};
            cabeceras.forEach((header, index) => {
              filaObj[header] = cols[index];
            });
            datosAEnviar.push(filaObj);
          }
        }
      }

      // Validar mínimos campos de los datos parseados
      const datosValidados = datosAEnviar.filter(u => u.nombres && u.apellidos && u.correo);
      if (datosValidados.length === 0) {
        throw new Error('No se encontraron registros válidos con nombres, apellidos y correo.');
      }

      const res = await createBulkUsuarios(datosValidados);
      
      setImportResult({
        insertados: res.data.insertados || 0,
        errores: res.data.errores || []
      });

      if (res.data.insertados > 0) {
        cargarUsuarios();
      }

      setBulkInput('');
    } catch (error: any) {
      console.error('Error al realizar importación:', error);
      setBulkError(error.message || 'Error crítico en el procesamiento de los datos.');
    } finally {
      setImporting(false);
    }
  };

  // Filtrar los usuarios en el cliente
  const usuariosFiltrados = usuarios.filter(user => {
    const nombreCompleto = `${user.nombres} ${user.apellidos}`.toLowerCase();
    const coincideBusqueda = nombreCompleto.includes(searchTerm.toLowerCase()) || 
                              user.correo.toLowerCase().includes(searchTerm.toLowerCase());
    
    const coincideRol = selectedRol === 'todos' || 
                        (user.roles && user.roles.toLowerCase().includes(selectedRol.toLowerCase()));

    const coincideEstado = selectedEstado === 'todos' || 
                           (selectedEstado === 'activos' && user.activo) ||
                           (selectedEstado === 'inactivos' && !user.activo);

    return coincideBusqueda && coincideRol && coincideEstado;
  });

  // Métricas para tarjetas KPI
  const totalUsuariosCount = usuarios.length;
  const docentesActivosCount = usuarios.filter(u => u.activo && u.roles?.toLowerCase().includes('docente')).length;
  const directoresCount = usuarios.filter(u => u.roles?.toLowerCase().includes('director')).length;
  const activePeriodName = periodoActivo ? `${periodoActivo.anio}-${periodoActivo.semestre === 1 ? 'I' : 'II'}` : 'Sin Período';

  // Descargar plantilla CSV de ejemplo
  const handleDescargarPlantilla = () => {
    const csvContent = "data:text/csv;charset=utf-8,nombres,apellidos,correo,rol\nJuan Carlos,Perez,juan.perez@cesmag.edu.co,Docente\nMaria Elena,Gomez,maria.gomez@cesmag.edu.co,Director";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "plantilla_importacion_docentes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Layout rol="planeacion" path="Gestión Institucional / Docentes">
      {/* Banner Principal */}
      <div className="bg-gradient-to-r from-[#1a2744] to-[#0d162a] rounded-xl px-6 py-6 mb-6 shadow-md border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-7 h-7 text-blue-400" />
              Gestión de Docentes por Período
            </h1>
            <p className="text-blue-100/80 text-sm mt-1 max-w-xl">
              Administra el personal académico del programa **Ingeniería de Sistemas** para el período activo. Agrega docentes, realiza cargas masivas e inhabilita accesos en tiempo real.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold shadow-md hover:shadow-lg transition-all duration-200 text-sm animate-button"
            >
              <UserPlus className="w-4 h-4" />
              Agregar Docente
            </button>
            <button
              onClick={() => {
                setShowBulkModal(true);
                setImportResult(null);
                setBulkError(null);
              }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white px-4 py-2.5 rounded-lg font-bold border border-white/10 transition-all duration-200 text-sm backdrop-blur-sm"
            >
              <Upload className="w-4 h-4" />
              Carga Masiva (Lote)
            </button>
          </div>
        </div>
      </div>

      {/* Alertas de Notificación */}
      {mensaje && (
        <div className={`p-4 mb-6 rounded-xl flex items-start gap-3 border animate-fadeIn ${
          mensaje.tipo === 'exito' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {mensaje.tipo === 'exito' ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <p className="font-semibold text-sm">{mensaje.texto}</p>
        </div>
      )}

      {/* Tarjetas de Métricas (KPIs) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800">{loading ? '...' : totalUsuariosCount}</div>
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Docentes</div>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200 flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800">{loading ? '...' : docentesActivosCount}</div>
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Docentes Activos</div>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200 flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800">{loading ? '...' : directoresCount}</div>
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Directores</div>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200 flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800">{loading ? '...' : activePeriodName}</div>
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Período Activo</div>
          </div>
        </div>
      </div>

      {/* Contenedor Principal: Filtros y Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
        
        {/* Barra de Filtros */}
        <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex flex-col lg:flex-row gap-3">
          {/* Buscador de Texto */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar docente por nombre o correo electrónico..."
              className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400 text-gray-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
            {/* Indicador Estático de Programa */}
            <div className="bg-gray-100 border border-gray-200 text-gray-600 rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-1.5 justify-center">
              <BookOpen className="w-4 h-4 text-gray-400" />
              Ing. de Sistemas
            </div>

            {/* Filtro Rol */}
            <div>
              <select
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700 font-semibold"
                value={selectedRol}
                onChange={(e) => setSelectedRol(e.target.value)}
              >
                <option value="todos">Todos los Roles</option>
                <option value="Docente">Docentes</option>
                <option value="Director">Directores</option>
                <option value="Planeacion">Planeación</option>
              </select>
            </div>

            {/* Filtro Estado */}
            <div>
              <select
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700 font-semibold"
                value={selectedEstado}
                onChange={(e) => setSelectedEstado(e.target.value)}
              >
                <option value="todos">Todos los Estados</option>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-400 font-medium text-sm">Consultando nómina de docentes...</p>
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <div className="text-center py-20 px-4">
              <div className="p-4 bg-gray-50 text-gray-400 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4">
                <Search className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-gray-800 mb-1">Sin resultados</h3>
              <p className="text-gray-400 text-sm max-w-sm mx-auto">
                No pudimos encontrar ningún usuario que coincida con tus términos de búsqueda o filtros seleccionados.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-150">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Docente / Correo</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Rol de Sistema</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Programa Académico</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Tipo Contrato</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Acceso (Activo)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuariosFiltrados.map((user) => (
                  <tr key={user.id_usuario} className="hover:bg-gray-55 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                        {user.nombre_completo || `${user.nombres} ${user.apellidos}`}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <Mail className="w-3 h-3 shrink-0" />
                        {user.correo}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(user.roles || 'Docente').split(',').map((rolStr, i) => {
                          const rName = rolStr.trim();
                          const isPl = rName.toLowerCase().includes('plane');
                          const isDir = rName.toLowerCase().includes('dire');
                          return (
                            <span 
                              key={i} 
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                isPl 
                                  ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                                  : isDir 
                                    ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              }`}
                            >
                              {rName}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-gray-800">{user.programa || 'Sin Asignar'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700 font-medium flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                        {user.tipo_contrato || 'Hora Cátedra'}
                        {user.horas_contrato && (
                          <span className="text-xs font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {user.horas_contrato}h
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={user.activo}
                            onChange={() => handleToggleActivo(user.id_usuario, user.nombre_completo || `${user.nombres} ${user.apellidos}`)}
                          />
                          <div className="w-10 h-5.5 bg-gray-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                        <span className={`text-[11px] font-bold uppercase w-16 text-left ${user.activo ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {user.activo ? 'Habilitado' : 'Bloqueado'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer de Tabla */}
        {!loading && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500 font-semibold">
            <div>
              Mostrando {usuariosFiltrados.length} de {totalUsuariosCount} usuarios registrados
            </div>
            <div>
              Universidad CESMAG · SIGAP
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: REGISTRO INDIVIDUAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex justify-center items-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100 flex flex-col animate-scaleUp">
            
            {/* Encabezado */}
            <div className="bg-[#1a2744] text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                Registrar Nuevo Docente / Usuario
              </h3>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="p-1.5 bg-white/10 hover:bg-white/15 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmitIndividual} className="p-6 flex flex-col gap-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg flex gap-2 items-start text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <div>{formError}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Nombres *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="Ej. Juan Carlos"
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Apellidos *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="Ej. Perez Gomez"
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Correo Institucional *</label>
                <input
                  type="email"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="ejemplo@cesmag.edu.co"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Tipo Doc.</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                    value={tipoDocumento}
                    onChange={(e) => setTipoDocumento(e.target.value)}
                  >
                    <option value="CC">C.C.</option>
                    <option value="CE">C.E.</option>
                    <option value="PA">Pasaporte</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Número Documento *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="Número de identificación"
                    value={numeroDocumento}
                    onChange={(e) => setNumeroDocumento(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Programa Académico</label>
                  <input
                    type="text"
                    disabled
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 font-semibold cursor-not-allowed"
                    value="Ingeniería de Sistemas"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Tipo de Contrato</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                    value={idContrato}
                    onChange={(e) => setIdContrato(Number(e.target.value))}
                  >
                    <option value={1}>Tiempo Completo (40h)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Rol de Acceso Principal</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  value={rol}
                  onChange={(e) => setRol(e.target.value)}
                >
                  <option value="Docente">Docente (Registra agendas y avances)</option>
                  <option value="Director">Director (Supervisa y califica indicadores)</option>
                  <option value="Planeacion">Planeación (Configura calendarios y nómina)</option>
                </select>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-gray-100 hover:bg-gray-150 text-gray-700 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-blue-650 hover:bg-blue-750 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md transition-colors"
                >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Registrando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Registrar Usuario
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CARGA MASIVA EN LOTE */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex justify-center items-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 flex flex-col animate-scaleUp">
            
            {/* Encabezado */}
            <div className="bg-[#1a2744] text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-400" />
                Carga Masiva de Docentes en Lote
              </h3>
              <button 
                onClick={() => setShowBulkModal(false)} 
                className="p-1.5 bg-white/10 hover:bg-white/15 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido */}
            <div className="p-6 flex flex-col gap-4">
              
              {/* Información */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-xs text-blue-800 leading-relaxed font-semibold">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  Importa múltiples docentes a la vez. Puedes pegar datos estructurados en formato <strong>CSV</strong> (separado por comas) o un arreglo <strong>JSON</strong>. 
                  El sistema creará las cuentas automáticamente, asignando a todos el programa <strong>Ingeniería de Sistemas</strong> y vinculándolos al <strong>período académico activo</strong> en la base de datos.
                  <div className="flex gap-4 mt-2 font-bold">
                    <button onClick={handleDescargarPlantilla} className="text-blue-650 hover:text-blue-850 flex items-center gap-1">
                      <Download className="w-3.5 h-3.5" /> Descargar Plantilla CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Errores */}
              {bulkError && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg flex gap-2 items-start text-xs font-semibold">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-600 mt-0.5" />
                  <div>{bulkError}</div>
                </div>
              )}

              {/* Éxito */}
              {importResult && (
                <div className="p-4 rounded-xl border bg-green-50/50 border-green-200 text-green-900 flex flex-col gap-2 animate-fadeIn text-xs">
                  <div className="flex items-center gap-2 font-bold text-green-800">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ¡Importación procesada exitosamente!
                  </div>
                  <div className="font-semibold mt-1">
                    • Se crearon <strong>{importResult.insertados}</strong> nuevos usuarios correctamente.
                  </div>
                  {importResult.errores.length > 0 && (
                    <div className="mt-2 text-red-800 border-t border-green-150 pt-2">
                      <span className="font-bold block mb-1 text-red-700">Omisiones o errores de registros ({importResult.errores.length}):</span>
                      <div className="max-h-24 overflow-y-auto space-y-1 bg-red-50/40 p-2 rounded border border-red-100 font-mono text-[10px]">
                        {importResult.errores.map((err, i) => (
                          <div key={i}>- <strong>{err.correo}</strong>: {err.motivo}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Selector de Formato */}
              <div className="flex gap-2 border-b border-gray-100 pb-2">
                <button
                  onClick={() => setBulkFormat('csv')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                    bulkFormat === 'csv'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'text-gray-500 hover:bg-gray-50 border-transparent'
                  }`}
                >
                  Formato CSV
                </button>
                <button
                  onClick={() => setBulkFormat('json')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                    bulkFormat === 'json'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'text-gray-500 hover:bg-gray-50 border-transparent'
                  }`}
                >
                  Formato JSON
                </button>
              </div>

              {/* Cuadro de texto */}
              <div>
                <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">
                  {bulkFormat === 'csv' ? 'Pegar filas CSV (Cabecera requerida: nombres,apellidos,correo,rol)' : 'Pegar Arreglo JSON'}
                </label>
                <textarea
                  className="w-full h-44 font-mono text-xs border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder={
                    bulkFormat === 'csv'
                      ? "nombres,apellidos,correo,rol\nJuan Gabriel,Munoz,juan.munoz@cesmag.edu.co,Docente\nAlba Ines,Luna,alba.luna@cesmag.edu.co,Director"
                      : "[\n  {\n    \"nombres\": \"Juan Gabriel\",\n    \"apellidos\": \"Munoz\",\n    \"correo\": \"juan.munoz@cesmag.edu.co\",\n    \"rol\": \"Docente\"\n  }\n]"
                  }
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                />
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="bg-gray-100 hover:bg-gray-150 text-gray-700 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={importing || !bulkInput.trim()}
                  onClick={handleImportMasivo}
                  className="bg-blue-650 hover:bg-blue-750 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md transition-colors"
                >
                  {importing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Importando lote...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Procesar e Importar
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}