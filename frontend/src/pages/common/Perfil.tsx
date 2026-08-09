import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/common/Layout'
import { useState, useEffect } from 'react'
import api from '../../services/api'
import {
  User,
  Mail,
  Shield,
  Fingerprint,
  GraduationCap,
  Building2,
  Briefcase,
  Award,
  AlertCircle,
  CheckCircle,
  Save,
  Calendar,
  FileCheck
} from 'lucide-react'

interface PerfilData {
  id_usuario: number;
  nombres: string;
  apellidos: string;
  tipo_documento: string;
  numero_documento: string;
  correo: string;
  id_contrato: number | null;
  id_programa: number | null;
  tipo_contrato: string;
  horas_contrato: number;
  programa: string;
  facultad: string;
  roles: string;
  titulo_pregrado: { id_nivelaca: number; nombre_titulo: string } | null;
  titulo_posgrado: { id_nivelaca: number; nombre_titulo: string } | null;
  titulo_convalidado: { id_nivelaca: number; nombre_titulo: string } | null;
  contratos: { id_contrato: number; tipo: string; horas_contrato: number }[];
  programas: { id_programa: number; nombre_programa: string }[];
  periodo_activo: { id_periodo: number; anio: number; semestre: number } | null;
  perfil_completo: boolean;
}

export default function Perfil() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<PerfilData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [mensaje, setMensaje] = useState<{ tipo: string; texto: string } | null>(null);

    // Form state
    const [form, setForm] = useState({
        nombres: '',
        apellidos: '',
        tipo_documento: 'CC',
        numero_documento: '',
        id_contrato: 0,
        id_programa: 0,
        titulo_pregrado: '',
        titulo_posgrado: '',
        titulo_convalidado: ''
    });

    const activeRole = (() => {
        try {
            const stored = localStorage.getItem('sigap_active_role');
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed.nombre_rol?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
            }
        } catch { /* ignore */ }
        return user?.roles?.toLowerCase() || '';
    })();

    const isDocente = activeRole.includes('docente');
    const layoutRol = activeRole.includes('director') ? 'director' 
                    : activeRole.includes('planeacion') || activeRole.includes('admin') ? 'planeacion'
                    : activeRole.includes('consultor') ? 'consultor'
                    : 'docente';

    useEffect(() => {
        fetchProfile();
    }, [user]);

    const fetchProfile = async () => {
        const userId = user?.id || (user as any)?.id_usuario;
        if (!userId) { setLoading(false); return; }
        try {
            setLoading(true);
            const response = await api.get(`/usuarios/${userId}/perfil-completo`);
            const data = response.data;
            setProfile(data);
            setForm({
                nombres: data.nombres || '',
                apellidos: data.apellidos || '',
                tipo_documento: data.tipo_documento || 'CC',
                numero_documento: data.numero_documento === '0000000000' ? '' : (data.numero_documento || ''),
                id_contrato: data.id_contrato || 0,
                id_programa: data.id_programa || 0,
                titulo_pregrado: data.titulo_pregrado?.nombre_titulo || '',
                titulo_posgrado: data.titulo_posgrado?.nombre_titulo || '',
                titulo_convalidado: data.titulo_convalidado?.nombre_titulo || ''
            });
        } catch (err: any) {
            console.error('Error fetching profile:', err);
            setMensaje({ tipo: 'error', texto: 'No se pudo cargar la información del perfil.' });
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: string, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const isFormComplete = () => {
        return (
            form.nombres.trim() !== '' &&
            form.apellidos.trim() !== '' &&
            form.tipo_documento.trim() !== '' &&
            form.numero_documento.trim() !== '' &&
            form.id_contrato > 0 && form.id_contrato !== 4 &&
            form.id_programa > 0 &&
            form.titulo_pregrado.trim() !== ''
        );
    };

    const handleSave = async () => {
        const userId = user?.id || (user as any)?.id_usuario;
        if (!userId) return;

        if (!isFormComplete()) {
            setMensaje({ tipo: 'error', texto: 'Por favor completa todos los campos obligatorios antes de guardar.' });
            return;
        }

        try {
            setSaving(true);
            setMensaje(null);

            await api.put(`/usuarios/${userId}/perfil`, {
                nombres: form.nombres,
                apellidos: form.apellidos,
                tipo_documento: form.tipo_documento,
                numero_documento: form.numero_documento,
                id_contrato: form.id_contrato,
                id_programa: form.id_programa,
                titulo_pregrado: form.titulo_pregrado,
                titulo_posgrado: form.titulo_posgrado || null,
                titulo_convalidado: form.titulo_convalidado || null
            });

            setMensaje({ tipo: 'exito', texto: '¡Perfil actualizado correctamente!' });
            
            // Refresh profile data
            await fetchProfile();
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || 'Error al guardar el perfil.';
            setMensaje({ tipo: 'error', texto: errorMsg });
        } finally {
            setSaving(false);
        }
    };

    const imagen_perfil = user?.imagen_perfil;

    if (loading) {
        return (
            <Layout rol={layoutRol} path="Ajustes / Mi Perfil">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                </div>
            </Layout>
        );
    }

    return (
        <Layout rol={layoutRol} path="Ajustes / Mi Perfil">
            <div className="max-w-4xl mx-auto mt-4 sm:mt-8">

                {/* Banner de perfil incompleto */}
                {isDocente && profile && !profile.perfil_completo && (
                    <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-start gap-3 animate-in fade-in">
                        <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-bold text-amber-800 text-sm">Completa tu perfil para continuar</h3>
                            <p className="text-amber-700 text-xs mt-1">Debes completar toda tu información institucional antes de acceder al sistema. Los campos marcados con <span className="text-red-600 font-bold">*</span> son obligatorios.</p>
                        </div>
                    </div>
                )}

                {/* Mensaje de éxito/error */}
                {mensaje && (
                    <div className={`p-4 mb-6 rounded-xl flex items-start gap-3 border animate-in fade-in ${
                        mensaje.tipo === 'exito' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                    }`}>
                        {mensaje.tipo === 'exito' ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                        <p className="font-medium text-sm">{mensaje.texto}</p>
                    </div>
                )}

                {/* Main Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10 transition-all duration-300 hover:shadow-md">
                    
                    {/* Header: Avatar, Name, Role */}
                    <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 pb-8 border-b border-gray-100">
                        <div className="flex-shrink-0 relative">
                            {imagen_perfil ? (
                                <img
                                    src={imagen_perfil}
                                    alt="Perfil"
                                    className="w-28 h-28 sm:w-36 sm:h-36 rounded-full shadow-lg object-cover ring-4 ring-indigo-50/50"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gradient-to-tr from-indigo-100 to-blue-100 flex items-center justify-center text-indigo-600 text-5xl font-black shadow-md ring-4 ring-indigo-50/30">
                                    {form.nombres ? form.nombres.charAt(0).toUpperCase() : 'U'}
                                </div>
                            )}
                            {profile?.perfil_completo && (
                                <span className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 border-4 border-white rounded-full shadow-sm" title="Perfil completo"></span>
                            )}
                        </div>

                        <div className="flex-1 text-center sm:text-left">
                            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2 tracking-tight">
                                {form.nombres || 'Tu'} {form.apellidos || 'Nombre'}
                            </h1>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4 text-gray-600 text-sm font-medium">
                                <span className="flex items-center justify-center sm:justify-start gap-2">
                                    <Mail className="w-4 h-4 text-gray-400" />
                                    {profile?.correo || user?.correo || 'Cargando correo...'}
                                </span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-2 bg-indigo-50/80 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-bold border border-indigo-100/50 shadow-sm uppercase tracking-wider">
                                    <Shield className="w-3.5 h-3.5" />
                                    {profile?.roles || user?.roles || 'Rol no definido'}
                                </span>
                                {profile?.perfil_completo ? (
                                    <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-xs font-bold border border-green-200">
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        Perfil Completo
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-xs font-bold border border-amber-200">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        Perfil Incompleto
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Formulario editable */}
                    <div className="mt-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <User className="w-5 h-5 text-indigo-500" />
                                Información Institucional
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">

                            {/* Nombres */}
                            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                    Nombres <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.nombres}
                                    onChange={(e) => handleChange('nombres', e.target.value)}
                                    placeholder="Ingresa tus nombres"
                                    className="w-full bg-white text-gray-800 font-medium rounded-lg border border-gray-200 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 text-sm transition-colors"
                                />
                            </div>

                            {/* Apellidos */}
                            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                    Apellidos <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.apellidos}
                                    onChange={(e) => handleChange('apellidos', e.target.value)}
                                    placeholder="Ingresa tus apellidos"
                                    className="w-full bg-white text-gray-800 font-medium rounded-lg border border-gray-200 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 text-sm transition-colors"
                                />
                            </div>

                            {/* Tipo de Contrato */}
                            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                                    Tipo de Contrato <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={form.id_contrato}
                                    onChange={(e) => handleChange('id_contrato', parseInt(e.target.value, 10))}
                                    className="w-full bg-white text-gray-800 font-medium rounded-lg border border-gray-200 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 text-sm transition-colors"
                                >
                                    <option value={0}>Selecciona tipo de contrato</option>
                                    {profile?.contratos?.map(c => (
                                        <option key={c.id_contrato} value={c.id_contrato}>
                                            {c.tipo} ({c.horas_contrato}h)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Tipo y Número de Documento */}
                            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
                                    Documento de Identidad <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-2">
                                    <select
                                        value={form.tipo_documento}
                                        onChange={(e) => handleChange('tipo_documento', e.target.value)}
                                        className="w-28 bg-white text-gray-800 font-medium rounded-lg border border-gray-200 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 text-sm transition-colors"
                                    >
                                        <option value="CC">CC</option>
                                        <option value="CE">CE</option>
                                    </select>
                                    <input
                                        type="text"
                                        value={form.numero_documento}
                                        onChange={(e) => handleChange('numero_documento', e.target.value.replace(/\D/g, ''))}
                                        placeholder="Número de documento"
                                        className="flex-1 bg-white text-gray-800 font-medium rounded-lg border border-gray-200 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 text-sm transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Programa Académico */}
                            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                                    Programa Académico <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={form.id_programa}
                                    onChange={(e) => handleChange('id_programa', parseInt(e.target.value, 10))}
                                    className="w-full bg-white text-gray-800 font-medium rounded-lg border border-gray-200 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 text-sm transition-colors"
                                >
                                    <option value={0}>Selecciona un programa</option>
                                    {profile?.programas?.map(p => (
                                        <option key={p.id_programa} value={p.id_programa}>
                                            {p.nombre_programa}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Periodo Activo (Bloqueado) */}
                            <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    Periodo Activo
                                    <span className="ml-1 px-1.5 py-0.5 bg-gray-200 text-gray-500 text-[9px] rounded font-bold uppercase">Bloqueado</span>
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={profile?.periodo_activo ? `${profile.periodo_activo.anio}-${profile.periodo_activo.semestre}` : 'No hay periodo activo'}
                                    className="w-full bg-gray-100 text-gray-600 font-medium rounded-lg border border-gray-200 py-2 px-3 focus:outline-none text-sm cursor-not-allowed"
                                />
                            </div>
                        </div>

                        {/* Sección de Títulos Académicos */}
                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-6">
                                <Award className="w-5 h-5 text-indigo-500" />
                                Formación Académica
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">

                                {/* Título de Pregrado */}
                                <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                                        Título de Pregrado <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.titulo_pregrado}
                                        onChange={(e) => handleChange('titulo_pregrado', e.target.value)}
                                        placeholder="Ej: Ingeniero de Sistemas"
                                        className="w-full bg-white text-gray-800 font-medium rounded-lg border border-gray-200 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 text-sm transition-colors"
                                    />
                                </div>

                                {/* Título de Posgrado */}
                                <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Award className="w-3.5 h-3.5 text-slate-400" />
                                        Título de Posgrado
                                    </label>
                                    <input
                                        type="text"
                                        value={form.titulo_posgrado}
                                        onChange={(e) => handleChange('titulo_posgrado', e.target.value)}
                                        placeholder="Ej: Magíster en Ingeniería de Software"
                                        className="w-full bg-white text-gray-800 font-medium rounded-lg border border-gray-200 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 text-sm transition-colors"
                                    />
                                </div>

                                {/* Título Convalidado */}
                                <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100 sm:col-span-2">
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <FileCheck className="w-3.5 h-3.5 text-slate-400" />
                                        Título Convalidado
                                    </label>
                                    <input
                                        type="text"
                                        value={form.titulo_convalidado}
                                        onChange={(e) => handleChange('titulo_convalidado', e.target.value)}
                                        placeholder="Ej: Título convalidado por el MEN (si aplica)"
                                        className="w-full bg-white text-gray-800 font-medium rounded-lg border border-gray-200 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 text-sm transition-colors"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Botón Guardar */}
                        <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                            {!isFormComplete() && (
                                <p className="text-xs text-amber-600 font-medium flex items-center gap-1.5">
                                    <AlertCircle className="w-4 h-4" />
                                    Completa los campos obligatorios (*) para guardar tu perfil.
                                </p>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className={`flex items-center gap-2 px-8 py-2.5 rounded-lg font-bold transition-all shadow-sm text-sm ml-auto ${
                                    isFormComplete()
                                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                {saving ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {saving ? 'Guardando...' : 'Guardar Perfil'}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </Layout>
    )
}
