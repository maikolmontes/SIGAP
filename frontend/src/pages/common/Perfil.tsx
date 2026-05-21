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
  AlertCircle
} from 'lucide-react'

export default function Perfil() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const isDirector = user?.roles?.toLowerCase().includes('director');
    const layoutRol = isDirector ? 'director' : 'planeacion';

    useEffect(() => {
        const fetchProfile = async () => {
            const userId = user?.id || (user as any)?.id_usuario;
            if (!userId) {
                setLoading(false);
                return;
            }
            try {
                setLoading(true);
                setError(null);
                const response = await api.get(`/usuarios/${userId}`);
                setProfile(response.data);
            } catch (err: any) {
                console.error('Error fetching profile:', err);
                setError('No se pudo cargar la información detallada del perfil.');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [user]);

    const nombres = profile?.nombres || user?.nombres || '';
    const apellidos = profile?.apellidos || user?.apellidos || '';
    const correo = profile?.correo || user?.correo || '';
    const roles = profile?.roles || user?.roles || 'Rol no definido';
    const imagen_perfil = profile?.imagen_perfil || user?.imagen_perfil;

    return (
        <Layout rol={layoutRol} path="Ajustes / Mi Perfil">
            <div className="max-w-4xl mx-auto mt-4 sm:mt-8">
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
                                    {nombres ? nombres.charAt(0).toUpperCase() : 'U'}
                                </div>
                            )}
                            <span className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 border-4 border-white rounded-full shadow-sm" title="Activo"></span>
                        </div>

                        <div className="flex-1 text-center sm:text-left">
                            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2 tracking-tight">
                                {nombres} {apellidos}
                            </h1>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4 text-gray-600 text-sm font-medium">
                                <span className="flex items-center justify-center sm:justify-start gap-2">
                                    <Mail className="w-4 h-4 text-gray-400" />
                                    {correo || 'Cargando correo...'}
                                </span>
                            </div>

                            <div className="inline-flex items-center gap-2 bg-indigo-50/80 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-bold border border-indigo-100/50 shadow-sm uppercase tracking-wider">
                                <Shield className="w-3.5 h-3.5" />
                                {roles}
                            </div>
                        </div>
                    </div>

                    {/* Personal Data Form */}
                    <div className="mt-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <User className="w-5 h-5 text-indigo-500" />
                                Información Institucional
                            </h3>
                            {loading && (
                                <span className="text-xs text-indigo-600 animate-pulse font-semibold">
                                    Actualizando...
                                </span>
                            )}
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                            {/* Documento */}
                            <div className="bg-slate-50/60 p-4.5 rounded-xl border border-slate-100 transition-all duration-200 hover:border-slate-200">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
                                    Documento de Identidad
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={
                                        loading 
                                            ? 'Cargando...' 
                                            : profile?.numero_documento 
                                                ? `${profile.tipo_documento || 'CC'} ${profile.numero_documento}` 
                                                : 'No registrado'
                                    }
                                    className="w-full bg-slate-50 text-gray-800 font-medium rounded-lg border border-gray-200/60 py-2 px-3 focus:outline-none text-sm cursor-not-allowed"
                                />
                            </div>

                            {/* Facultad */}
                            <div className="bg-slate-50/60 p-4.5 rounded-xl border border-slate-100 transition-all duration-200 hover:border-slate-200">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                    Facultad
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={loading ? 'Cargando...' : profile?.facultad || 'No asignada'}
                                    className="w-full bg-slate-50 text-gray-800 font-medium rounded-lg border border-gray-200/60 py-2 px-3 focus:outline-none text-sm cursor-not-allowed"
                                />
                            </div>

                            {/* Programa */}
                            <div className="bg-slate-50/60 p-4.5 rounded-xl border border-slate-100 transition-all duration-200 hover:border-slate-200">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                                    Programa Académico
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={loading ? 'Cargando...' : profile?.programa || 'No asignado'}
                                    className="w-full bg-slate-50 text-gray-800 font-medium rounded-lg border border-gray-200/60 py-2 px-3 focus:outline-none text-sm cursor-not-allowed"
                                />
                            </div>

                            {/* Tipo de Contrato */}
                            <div className="bg-slate-50/60 p-4.5 rounded-xl border border-slate-100 transition-all duration-200 hover:border-slate-200">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                                    Tipo de Contrato
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={
                                        loading 
                                            ? 'Cargando...' 
                                            : profile?.tipo_contrato 
                                                ? `${profile.tipo_contrato}${profile.horas_contrato ? ` (${profile.horas_contrato} horas)` : ''}` 
                                                : 'No asignado'
                                    }
                                    className="w-full bg-slate-50 text-gray-800 font-medium rounded-lg border border-gray-200/60 py-2 px-3 focus:outline-none text-sm cursor-not-allowed"
                                />
                            </div>
                        </div>

                        {/* Additional info badge: Nivel Académico (optional footer) */}
                        {profile?.nivel_academico && (
                            <div className="mt-6 pt-5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                                <span className="text-xs text-gray-400 font-medium">Nivel de formación académica:</span>
                                <span className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50/50 px-3 py-1 rounded-lg border border-indigo-100/30">
                                    <Award className="w-3.5 h-3.5" />
                                    {profile.nivel_academico}
                                </span>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </Layout>
    )
}
