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
  Calendar,
  Pencil
} from 'lucide-react';
import { 
  getUsuarios, 
  createUsuario, 
  updateUsuario,
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
  const [selectedPrograma, setSelectedPrograma] = useState('todos');

  // Control de Modales
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Formulario de Creación Individual (Multirrol)
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('CC');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [correo, setCorreo] = useState('');
  const [idPrograma, setIdPrograma] = useState(1);
  const [rolesSeleccionados, setRolesSeleccionados] = useState<string[]>(['Docente']);
  const [formError, setFormError] = useState<string | null>(null);
  const [formWarning, setFormWarning] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Formulario de Edición (Multirrol)
  const [usuarioAEditar, setUsuarioAEditar] = useState<Usuario | null>(null);
  const [editNombres, setEditNombres] = useState('');
  const [editApellidos, setEditApellidos] = useState('');
  const [editTipoDocumento, setEditTipoDocumento] = useState('CC');
  const [editNumeroDocumento, setEditNumeroDocumento] = useState('');
  const [editCorreo, setEditCorreo] = useState('');
  const [editIdPrograma, setEditIdPrograma] = useState(1);
  const [editRolesSeleccionados, setEditRolesSeleccionados] = useState<string[]>(['Docente']);
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [editWarning, setEditWarning] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

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
      const activePeriodRes = await getPeriodoActivo();
      const pActivo = activePeriodRes.data;
      setPeriodoActivo(pActivo);

      if (pActivo) {
        const res = await getDocentesPeriodo(pActivo.id_periodo);
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

  const esSoloConsultorOPlaneacion = (list: string[]) => {
    if (!list || list.length === 0) return false;
    return list.every(r => {
      const low = r.toLowerCase();
      return low.includes('consult') || low.includes('planea');
    });
  };

  const toggleRol = (rolName: string, isEdit = false) => {
    if (isEdit) {
      setEditRolesSeleccionados(prev => {
        if (prev.includes(rolName)) {
          if (prev.length === 1) return prev;
          return prev.filter(r => r !== rolName);
        } else {
          return [...prev, rolName];
        }
      });
    } else {
      setRolesSeleccionados(prev => {
        if (prev.includes(rolName)) {
          if (prev.length === 1) return prev;
          return prev.filter(r => r !== rolName);
        } else {
          return [...prev, rolName];
        }
      });
    }
  };

  const mapProgramaToId = (progName?: string): number => {
    if (!progName) return 1;
    const low = progName.toLowerCase();
    if (low.includes('electrónica') || low.includes('electronica')) return 2;
    if (low.includes('industrial')) return 3;
    if (low.includes('financiera')) return 4;
    return 1;
  };

  const handleOpenEditModal = (u: Usuario) => {
    setUsuarioAEditar(u);
    setEditNombres(u.nombres || '');
    setEditApellidos(u.apellidos || '');
    setEditTipoDocumento(u.tipo_documento || 'CC');
    setEditNumeroDocumento(u.numero_documento || '');
    setEditCorreo(u.correo || '');
    setEditIdPrograma(mapProgramaToId(u.programa));

    const parsedRoles = (u.roles || 'Docente').split(',').map(r => r.trim()).filter(Boolean);
    setEditRolesSeleccionados(parsedRoles.length > 0 ? parsedRoles : ['Docente']);
    setEditFormError(null);
    setEditWarning(null);
    setShowEditModal(true);
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
    setRolesSeleccionados(['Docente']);
    setFormError(null);
    setFormWarning(null);
  };

  const handleSubmitIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormWarning(null);

    if (!nombres.trim() || !apellidos.trim() || !correo.trim() || !numeroDocumento.trim()) {
      setFormError('Por favor diligencie todos los campos obligatorios.');
      return;
    }

    if (rolesSeleccionados.length === 0) {
      setFormError('Debe seleccionar al menos un rol.');
      return;
    }

    const soloConsultaOPl = esSoloConsultorOPlaneacion(rolesSeleccionados);

    try {
      setCreating(true);
      const res = await createUsuario({
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        tipo_documento: tipoDocumento,
        numero_documento: numeroDocumento.trim(),
        correo: correo.trim().toLowerCase(),
        id_contrato: 4,
        id_programa: soloConsultaOPl ? null : idPrograma,
        roles: rolesSeleccionados
      });

      if (res.data?.advertencia) {
        setMensaje({
          tipo: 'exito',
          texto: `Usuario registrado. ${res.data.advertencia}`
        });
      } else {
        setMensaje({
          tipo: 'exito',
          texto: `El usuario ${nombres.trim()} ${apellidos.trim()} ha sido registrado con los roles: ${rolesSeleccionados.join(', ')}.`
        });
      }

      setShowAddModal(false);
      handleResetForm();
      cargarUsuarios();
      setTimeout(() => setMensaje(null), 5000);
    } catch (error: any) {
      console.error('Error al crear usuario:', error);
      const errMsg = error.response?.data?.error || 'No se pudo registrar el usuario. Verifique los datos o si la identificación/correo ya está registrado.';
      setFormError(errMsg);
    } finally {
      setCreating(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditFormError(null);
    setEditWarning(null);

    if (!usuarioAEditar) return;

    if (!editNombres.trim() || !editApellidos.trim() || !editCorreo.trim() || !editNumeroDocumento.trim()) {
      setEditFormError('Por favor diligencie todos los campos obligatorios.');
      return;
    }

    if (editRolesSeleccionados.length === 0) {
      setEditFormError('Debe seleccionar al menos un rol.');
      return;
    }

    const soloConsultaOPl = esSoloConsultorOPlaneacion(editRolesSeleccionados);

    try {
      setUpdating(true);
      const res = await updateUsuario(usuarioAEditar.id_usuario, {
        nombres: editNombres.trim(),
        apellidos: editApellidos.trim(),
        tipo_documento: editTipoDocumento,
        numero_documento: editNumeroDocumento.trim(),
        correo: editCorreo.trim().toLowerCase(),
        id_programa: soloConsultaOPl ? null : editIdPrograma,
        roles: editRolesSeleccionados
      });

      if (res.data?.advertencia) {
        setMensaje({
          tipo: 'exito',
          texto: `Usuario actualizado correctamente. ${res.data.advertencia}`
        });
      } else {
        setMensaje({
          tipo: 'exito',
          texto: `El usuario ${editNombres.trim()} ${editApellidos.trim()} ha sido actualizado exitosamente.`
        });
      }

      setShowEditModal(false);
      setUsuarioAEditar(null);
      cargarUsuarios();
      setTimeout(() => setMensaje(null), 5000);
    } catch (error: any) {
      console.error('Error al actualizar usuario:', error);
      const errMsg = error.response?.data?.error || 'No se pudo actualizar el usuario. Verifique los datos o si la identificación/correo ya existe.';
      setEditFormError(errMsg);
    } finally {
      setUpdating(false);
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
      
      // Obtener filas como matriz (array de arrays) para localizar dinámicamente el encabezado
      const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

      if (!rawRows || rawRows.length === 0) {
        setBulkError('El archivo Excel está vacío.');
        return;
      }

      // Buscar la fila de encabezados que contenga 'nombre' o 'nombres'
      let headerIndex = -1;
      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (Array.isArray(row) && row.some(cell => String(cell || '').toLowerCase().includes('nombre'))) {
          headerIndex = i;
          break;
        }
      }

      if (headerIndex === -1) {
        headerIndex = 0; // Fallback a la primera fila si no encuentra coincidencia explícita
      }

      // Limpiar encabezados de asteriscos y espacios extra
      const headers = (rawRows[headerIndex] || []).map(h => String(h || '').trim().replace(/\s*\*/g, ''));

      const payload: any[] = [];
      for (let i = headerIndex + 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!Array.isArray(row) || row.length === 0) continue;

        const rowObj: Record<string, any> = {};
        headers.forEach((h, colIdx) => {
          if (h && row[colIdx] !== undefined) {
            rowObj[h] = String(row[colIdx]).trim();
          }
        });

        // Buscar valor ignorando mayúsculas, minúsculas o variaciones de acento/nombre
        const getVal = (...keys: string[]) => {
          for (const k of keys) {
            for (const objKey of Object.keys(rowObj)) {
              if (objKey.toLowerCase().trim() === k.toLowerCase().trim()) {
                return rowObj[objKey];
              }
            }
          }
          return '';
        };

        const nombres = getVal('Nombres', 'Nombre', 'nombres');
        const apellidos = getVal('Apellidos', 'Apellido', 'apellidos');
        const correo = getVal('Correo Institucional', 'Correo', 'correo');
        const tipoDoc = getVal('Tipo Documento', 'tipo_documento', 'tipoDocumento') || 'CC';
        const numDoc = getVal('Número Documento', 'Numero Documento', 'numero_documento', 'numeroDocumento', 'Documento');
        const roles = getVal('Roles', 'Rol', 'roles', 'rol', 'Roles de Acceso') || 'Docente';
        const programa = getVal('Programa Académico', 'Programa Academico', 'programa', 'Programa');

        if (nombres && apellidos && correo) {
          payload.push({
            nombres,
            apellidos,
            correo,
            tipo_documento: tipoDoc,
            numero_documento: numDoc,
            roles,
            programa
          });
        }
      }

      if (payload.length === 0) {
        setBulkError('El Excel no tiene datos válidos. Revisa las columnas obligatorias: Nombres, Apellidos, Correo Institucional, Tipo Documento, Número Documento, Roles, Programa Académico.');
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

  // Descargar plantilla Excel de ejemplo
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
      const isOnlyConsult = esSoloConsultorOPlaneacion((u.roles || '').split(',').map(r=>r.trim()));
      return [
        u.nombres,
        u.apellidos,
        u.correo,
        u.tipo_documento || 'CC',
        u.numero_documento || '0000000000',
        isOnlyConsult ? 'No aplica' : (u.programa || 'Sin Asignar'),
        isOnlyConsult ? 'No aplica' : (u.facultad || 'Ingeniería'),
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
              Administra el personal de la <strong>Facultad de Ingeniería</strong> para el período activo. Agrega usuarios, asigna múltiples roles e inhabilita accesos en tiempo real.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button
              onClick={() => {
                handleResetForm();
                setShowAddModal(true);
              }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold shadow-md hover:shadow-lg transition-all duration-200 text-sm animate-button"
            >
              <UserPlus className="w-4 h-4" />
              Agregar Usuario
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
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Usuarios</div>
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
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800">
              {loading ? '...' : usuarios.filter(u => u.roles?.toLowerCase().includes('consult') || u.roles?.toLowerCase().includes('planea')).length}
            </div>
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Consultor / Planeación</div>
          </div>
        </div>
      </div>

      {/* Contenedor Principal: Filtros y Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        
        {/* Barra de Búsqueda y Filtros */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-3 justify-between items-center bg-gray-50/50">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por nombre o correo..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
            {/* Filtro por Rol */}
            <select
              value={selectedRol}
              onChange={(e) => setSelectedRol(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="todos">Todos los Roles</option>
              <option value="Docente">Docente</option>
              <option value="Director">Director</option>
              <option value="Consultor">Consultor</option>
              <option value="Planeacion">Planeación</option>
            </select>

            {/* Filtro por Estado */}
            <select
              value={selectedEstado}
              onChange={(e) => setSelectedEstado(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="todos">Todos los Estados</option>
              <option value="activos">Activos (Habilitados)</option>
              <option value="inactivos">Inactivos (Bloqueados)</option>
            </select>

            {/* Filtro por Programa */}
            <select
              value={selectedPrograma}
              onChange={(e) => setSelectedPrograma(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="todos">Todos los Programas</option>
              <option value="Ingeniería de Sistemas">Ingeniería de Sistemas</option>
              <option value="Ingeniería Electrónica">Ingeniería Electrónica</option>
              <option value="Ingeniería Industrial">Ingeniería Industrial</option>
              <option value="Ingeniería Financiera">Ingeniería Financiera</option>
              <option value="Ninguno">No Aplica / Sin Asignar</option>
            </select>
          </div>
        </div>

        {/* Tabla de Usuarios */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-400 font-medium">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              Cargando nómina de usuarios...
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-bold text-base">No se encontraron usuarios</p>
              <p className="text-gray-400 text-xs mt-1">Prueba cambiando los términos de búsqueda o filtros.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-left">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Usuario / Correo</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Roles Asignados</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Programa Académico</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Tipo Contrato</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Acceso (Activo)</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuariosFiltrados.map((user) => {
                  const userRolesList = (user.roles || 'Docente').split(',').map(r=>r.trim());
                  const soloConsult = esSoloConsultorOPlaneacion(userRolesList);
                  return (
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
                          {userRolesList.map((rName, i) => {
                            const isPl = rName.toLowerCase().includes('plane');
                            const isDir = rName.toLowerCase().includes('dire');
                            const isCons = rName.toLowerCase().includes('consult');
                            return (
                              <span 
                                key={i} 
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  isPl 
                                    ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                                    : isDir 
                                      ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                                      : isCons
                                        ? 'bg-amber-50 text-amber-700 border border-amber-100'
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
                        <div className={`text-sm font-semibold ${soloConsult ? 'text-gray-400 italic' : 'text-gray-800'}`}>
                          {soloConsult ? 'No aplica' : (user.programa || 'Sin Asignar')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700 font-medium flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                          {(!user.tipo_contrato || user.tipo_contrato === 'Por Definir') ? (
                            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              Por Definir
                            </span>
                          ) : (
                            <>
                              <span>{user.tipo_contrato}</span>
                              {user.horas_contrato > 0 && (
                                <span className="text-xs font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {user.horas_contrato}h
                                </span>
                              )}
                            </>
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
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleOpenEditModal(user)}
                          title="Editar Usuario"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL 1: REGISTRO INDIVIDUAL MULTIRROL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex justify-center items-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100 flex flex-col animate-scaleUp">
            
            {/* Encabezado */}
            <div className="bg-[#1a2744] text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                Registrar Nuevo Usuario / Docente
              </h3>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="p-1.5 bg-white/10 hover:bg-white/15 rounded-lg transition-colors text-white"
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

              {formWarning && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-lg flex gap-2 items-start text-xs font-semibold">
                  <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>{formWarning}</div>
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
                  placeholder="ejemplo@unicesmag.edu.co"
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

              {/* Multiselección de Roles (Checklist) */}
              <div>
                <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">
                  Roles de Acceso (Selecciona uno o varios) *
                </label>
                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  {['Docente', 'Director', 'Consultor', 'Planeación'].map((rItem) => {
                    const isChecked = rolesSeleccionados.includes(rItem);
                    return (
                      <label
                        key={rItem}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-semibold cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-blue-50 border-blue-400 text-blue-800 shadow-xs'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRol(rItem, false)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <span>{rItem}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Facultad y Programa Académico Dinámicos */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">
                    Facultad
                  </label>
                  <input
                    type="text"
                    disabled
                    value={esSoloConsultorOPlaneacion(rolesSeleccionados) ? 'No aplica' : 'Facultad de Ingeniería'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-400 font-semibold cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">
                    Programa Académico {esSoloConsultorOPlaneacion(rolesSeleccionados) ? '' : '*'}
                  </label>
                  <select
                    disabled={esSoloConsultorOPlaneacion(rolesSeleccionados)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-gray-700 font-semibold disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    value={esSoloConsultorOPlaneacion(rolesSeleccionados) ? '' : idPrograma}
                    onChange={(e) => setIdPrograma(Number(e.target.value))}
                  >
                    {esSoloConsultorOPlaneacion(rolesSeleccionados) ? (
                      <option value="">Deshabilitado (Sin asignación académica)</option>
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

      {/* MODAL EDITAR USUARIO MULTIRROL */}
      {showEditModal && usuarioAEditar && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex justify-center items-center p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100 flex flex-col animate-scaleUp">
            
            {/* Encabezado */}
            <div className="bg-[#1a2744] text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-400" />
                Editar Usuario / Docente
              </h3>
              <button 
                type="button"
                onClick={() => setShowEditModal(false)} 
                className="p-1.5 bg-white/10 hover:bg-white/15 rounded-lg transition-colors text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulario de Edición */}
            <form onSubmit={handleEditSubmit} className="p-6 flex flex-col gap-4">
              {editFormError && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg flex gap-2 items-start text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <div>{editFormError}</div>
                </div>
              )}

              {editWarning && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-lg flex gap-2 items-start text-xs font-semibold">
                  <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>{editWarning}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Nombres *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    value={editNombres}
                    onChange={(e) => setEditNombres(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Apellidos *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    value={editApellidos}
                    onChange={(e) => setEditApellidos(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Correo Institucional *</label>
                <input
                  type="email"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={editCorreo}
                  onChange={(e) => setEditCorreo(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">Tipo Doc.</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                    value={editTipoDocumento}
                    onChange={(e) => setEditTipoDocumento(e.target.value)}
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
                    value={editNumeroDocumento}
                    onChange={(e) => setEditNumeroDocumento(e.target.value)}
                  />
                </div>
              </div>

              {/* Multiselección de Roles en Edición */}
              <div>
                <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">
                  Roles de Acceso (Selecciona uno o varios) *
                </label>
                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  {['Docente', 'Director', 'Consultor', 'Planeación'].map((rItem) => {
                    const isChecked = editRolesSeleccionados.includes(rItem);
                    return (
                      <label
                        key={rItem}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-semibold cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-blue-50 border-blue-400 text-blue-800 shadow-xs'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRol(rItem, true)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <span>{rItem}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Facultad y Programa Académico Dinámicos en Edición */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">
                    Facultad
                  </label>
                  <input
                    type="text"
                    disabled
                    value={esSoloConsultorOPlaneacion(editRolesSeleccionados) ? 'No aplica' : 'Facultad de Ingeniería'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-400 font-semibold cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-gray-400 tracking-wider block mb-1">
                    Programa Académico {esSoloConsultorOPlaneacion(editRolesSeleccionados) ? '' : '*'}
                  </label>
                  <select
                    disabled={esSoloConsultorOPlaneacion(editRolesSeleccionados)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-gray-700 font-semibold disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    value={esSoloConsultorOPlaneacion(editRolesSeleccionados) ? '' : editIdPrograma}
                    onChange={(e) => setEditIdPrograma(Number(e.target.value))}
                  >
                    {esSoloConsultorOPlaneacion(editRolesSeleccionados) ? (
                      <option value="">Deshabilitado (Sin asignación académica)</option>
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
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="bg-gray-100 hover:bg-gray-150 text-gray-700 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md transition-colors"
                >
                  {updating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Guardar Cambios
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
                className="p-1.5 bg-white/10 hover:bg-white/15 rounded-lg transition-colors text-white"
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