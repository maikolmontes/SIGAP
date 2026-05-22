import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../../components/common/Layout';
import * as XLSX from 'xlsx';

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
  tipo_documento?: string;
  numero_documento?: string;
  activo: boolean;
  tipo_contrato: string;
  horas_contrato: number;
  programa: string;
  facultad?: string;
  roles: string;
}

export default function Docentes() {
  const location = useLocation();
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
  const [idPrograma, setIdPrograma] = useState(1);
  const [rol, setRol] = useState('Docente');
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedPrograma, setSelectedPrograma] = useState('todos');

  // Carga Masiva (Excel)
  const [archivoImportar, setArchivoImportar] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ insertados: number; errores: any[] } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);


  useEffect(() => {
    cargarUsuarios();
  }, []);

  useEffect(() => {
    if (location.state?.openAddModal) {
      setShowAddModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

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
        // Guardar la nómina completa del período para filtrar dinámicamente
        setUsuarios(res.data);
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
        id_contrato: 1,
        id_programa: rol === 'Planeacion' ? null : idPrograma,
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

  const handleImportSubmit = async () => {
    setBulkError(null);
    setImportResult(null);

    if (!archivoImportar) {
      setBulkError('Por favor selecciona un archivo Excel primero.');
      return;
    }

    try {
      setImporting(true);
      const data = await archivoImportar.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

      const payload = jsonData.map(row => {
        const userRol = row.Rol || row.rol || 'Docente';
        const isPl = userRol.toLowerCase().includes('plane');
        return {
          nombres: row.Nombres || row.nombres || '',
          apellidos: row.Apellidos || row.apellidos || '',
          correo: row.Correo || row.correo || '',
          tipo_documento: row['Tipo Documento'] || row.tipo_documento || row.tipoDocumento || 'CC',
          numero_documento: row['Número Documento'] || row.numero_documento || row.numeroDocumento || '0000000000',
          programa: isPl ? null : (row['Programa Académico'] || row['Programa Academico'] || row.programa || row.Programa || 'Ingeniería de Sistemas'),
          facultad: isPl ? null : 'Ingeniería',
          rol: userRol
        };
      }).filter(u => u.nombres && u.apellidos && u.correo);

      if (payload.length === 0) {
        setBulkError('El Excel no tiene datos válidos. Revisa las columnas (Nombres, Apellidos, Correo, Tipo Documento, Número Documento, Programa Académico, Rol).');
        return;
      }

      const res = await createBulkUsuarios(payload);
      
      setImportResult({
        insertados: res.data.insertados || 0,
        errores: res.data.errores || []
      });

      if (res.data.insertados > 0) {
        cargarUsuarios();
      }

      setArchivoImportar(null);
    } catch (error: any) {
      console.error('Error al realizar importación:', error);
      const errMsg = error.response?.data?.error || error.message || 'Falló la importación del Excel.';
      setBulkError(errMsg);
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

    const coincidePrograma = selectedPrograma === 'todos' ||
                              (selectedPrograma === 'Ninguno' && (!user.programa || user.programa === '')) ||
                              (user.programa && user.programa.toLowerCase() === selectedPrograma.toLowerCase());

    return coincideBusqueda && coincideRol && coincideEstado && coincidePrograma;
  });

  // Métricas para tarjetas KPI
  const totalUsuariosCount = usuarios.length;
  const docentesActivosCount = usuarios.filter(u => u.activo && u.roles?.toLowerCase().includes('docente')).length;
  const directoresCount = usuarios.filter(u => u.roles?.toLowerCase().includes('director')).length;
  const activePeriodName = periodoActivo ? `${periodoActivo.anio}-${periodoActivo.semestre === 1 ? 'I' : 'II'}` : 'Sin Período';

  // Descargar plantilla Excel de ejemplo con listas desplegables y sin columna Facultad
  const handleDescargarPlantilla = () => {
    const link = document.createElement('a');
    link.href = '/plantilla_docentes_SIGAP.xlsx';
    link.download = 'plantilla_docentes_SIGAP.xlsx';
    link.click();
  };

  // Exportar la lista de docentes actual a Excel (.xlsx)
  const handleExportarExcel = () => {
    const encabezados = [['Nombres', 'Apellidos', 'Correo', 'Tipo Documento', 'Número Documento', 'Programa Académico', 'Facultad', 'Tipo Contrato', 'Roles', 'Estado']];
    const filas = usuarios.map(u => {
      const isPl = u.roles && u.roles.toLowerCase().includes('plane');
      return [
        u.nombres,
        u.apellidos,
        u.correo,
        u.tipo_documento || 'CC',
        u.numero_documento || '0000000000',
        isPl ? 'No aplica' : (u.programa || 'Sin Asignar'),
        isPl ? 'No aplica' : (u.facultad || 'Ingeniería'),
        u.tipo_contrato || 'Hora Cátedra',
        u.roles || 'Docente',
        u.activo ? 'Habilitado' : 'Bloqueado'
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([...encabezados, ...filas]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Docentes");
    XLSX.writeFile(wb, "docentes_SIGAP.xlsx");
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
              Gestión de Docentes y Usuarios
            </h1>
            <p className="text-blue-100/80 text-sm mt-1 max-w-xl">
              Administra el personal de los programas de la **Facultad de Ingeniería** para el período activo. Agrega docentes, realiza cargas masivas e inhabilita accesos en tiempo real.
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
                setArchivoImportar(null);
              }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-bold shadow-md hover:shadow-lg transition-all duration-200 text-sm"
            >
              <Upload className="w-4 h-4" />
              Importar Excel
            </button>
            <button
              onClick={handleExportarExcel}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white px-4 py-2.5 rounded-lg font-bold border border-white/10 transition-all duration-200 text-sm backdrop-blur-sm"
            >
              <Download className="w-4 h-4" />
              Exportar Excel
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
            {/* Filtro Programa */}
            <div>
              <select
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-700 font-semibold"
                value={selectedPrograma}
                onChange={(e) => setSelectedPrograma(e.target.value)}
              >
                <option value="todos">Todos los Programas</option>
                <option value="Ingeniería de Sistemas">Ing. de Sistemas</option>
                <option value="Ingeniería Electrónica">Ing. Electrónica</option>
                <option value="Ingeniería Industrial">Ing. Industrial</option>
                <option value="Ingeniería Financiera">Ing. Financiera</option>
                <option value="Ninguno">Sin Programa (Administrativo)</option>
              </select>
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
                          <div className="w-10 h-5.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
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
                  <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Programa Académico *</label>
                  <select
                    disabled={rol === 'Planeacion'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-gray-700 font-semibold disabled:bg-gray-100 disabled:text-gray-400"
                    value={rol === 'Planeacion' ? '' : idPrograma}
                    onChange={(e) => setIdPrograma(Number(e.target.value))}
                  >
                    {rol === 'Planeacion' ? (
                      <option value="">No aplica (Administrativo)</option>
                    ) : (
                      <>
                        <option value={1}>Ingeniería de Sistemas</option>
                        <option value={2}>Ingeniería Electrónica</option>
                        <option value={3}>Ingeniería Industrial</option>
                        <option value={4}>Ingeniería Financiera</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Rol de Acceso Principal</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-gray-700 font-semibold"
                    value={rol}
                    onChange={(e) => setRol(e.target.value)}
                  >
                    <option value="Docente">Docente</option>
                    <option value="Director">Director</option>
                    <option value="Planeacion">Planeación</option>
                  </select>
                </div>
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
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md transition-colors"
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
                Importar Docentes desde Excel
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
                  <p>
                    Importa múltiples docentes y usuarios a la vez desde un archivo Excel (<code>.xlsx</code>). 
                    El sistema creará las cuentas automáticamente, asignándolas a sus respectivos programas y vinculándolas al <strong>período académico activo</strong>.
                  </p>
                  <p className="mt-2 text-blue-900 bg-blue-100/50 p-2.5 rounded-lg border border-blue-200/50 text-[11px] leading-relaxed">
                    💡 <strong>Campos de Creación Requeridos:</strong> El archivo debe contener las columnas: <strong>Nombres</strong>, <strong>Apellidos</strong>, <strong>Correo</strong>, <strong>Tipo Documento</strong>, <strong>Número Documento</strong>, <strong>Programa Académico</strong> y <strong>Rol</strong>.
                  </p>
                  <div className="flex gap-4 mt-3 font-bold">
                    <button type="button" onClick={handleDescargarPlantilla} className="text-blue-600 hover:text-blue-750 flex items-center gap-1">
                      <Download className="w-3.5 h-3.5" /> Descargar Plantilla Excel Oficial (.xlsx)
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

              {/* Selector de Archivo Excel con Zona Drag-and-Drop */}
              <div 
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 hover:border-blue-500 transition-colors cursor-pointer group text-center bg-gray-50/30" 
                onClick={() => document.getElementById('file-import')?.click()}
              >
                <Upload className="w-12 h-12 text-gray-300 group-hover:text-blue-500 mx-auto mb-3" />
                <p className="text-sm font-bold text-gray-700">
                  {archivoImportar ? archivoImportar.name : 'Arrastra aquí tu archivo Excel o haz clic para seleccionar'}
                </p>
                {archivoImportar && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    {(archivoImportar.size / 1024).toFixed(1)} KB · Listo para procesar
                  </p>
                )}
                {!archivoImportar && (
                  <p className="text-xs text-gray-400 mt-1">
                    Formatos soportados: .xlsx (Excel)
                  </p>
                )}
                <input 
                  type="file" 
                  id="file-import" 
                  className="hidden" 
                  accept=".xlsx" 
                  onChange={e => setArchivoImportar(e.target.files ? e.target.files[0] : null)} 
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
                  disabled={importing || !archivoImportar}
                  onClick={handleImportSubmit}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md transition-colors"
                >
                  {importing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Importando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Comenzar Importación
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