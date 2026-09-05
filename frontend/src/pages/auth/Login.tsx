import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
// @ts-ignore
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck, BookOpen, AlertCircle, Clock,
  GraduationCap, Users, BarChart3, X, Lock, FileText
} from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const location = useLocation();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showPrivacidad, setShowPrivacidad] = useState(false);
  const [showTerminos, setShowTerminos] = useState(false);

  useEffect(() => {
    if (location.state?.mensajeInactividad) {
      setInfoMsg(location.state.mensajeInactividad);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    try {
      setErrorMsg(null);
      const response = await api.post('/auth/google', {
        credential: credentialResponse.credential,
      });
      const { token, user } = response.data;
      login(token, user);
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK') {
        setErrorMsg('No se pudo conectar con el servidor.');
      } else if (error.response?.data?.error) {
        setErrorMsg(error.response.data.error);
      } else {
        setErrorMsg('Ocurrió un error al iniciar sesión. Inténtelo más tarde.');
      }
    }
  };

  return (
    <>
      {/* ═══════════════════════════════════════
          PÁGINA PRINCIPAL DE LOGIN
      ═══════════════════════════════════════ */}
      <div
        className="flex flex-col lg:flex-row w-full"
        style={{ height: '100dvh', fontFamily: "'Inter','Segoe UI',sans-serif", overflow: 'hidden' }}
      >
        {/* Panel izquierdo / superior */}
        <div className="relative flex-shrink-0 w-full h-[28vh] lg:h-full lg:w-1/2 overflow-hidden bg-[#0f1f4b]">
          <div className="absolute inset-0 flex flex-col">

            {/* Imagen edificio */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: 'url("/edificio.jpg")', opacity: 0.4 }}
            />
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1f4b]/90 via-[#0f1f4b]/40 to-transparent" />

            {/* ── Móvil ── */}
            <div className="lg:hidden relative z-10 h-full flex flex-col justify-between p-4 sm:p-6">
              <div className="flex items-center gap-2.5">
                <img src="/logo_cesmag.png" alt="CESMAG"
                  className="h-8 w-8 rounded-lg object-contain bg-white/10 p-0.5" />
                <div>
                  <div className="text-white font-black text-sm leading-none tracking-tight">CESMAG</div>
                  <div className="text-blue-200/60 text-[9px] font-semibold uppercase tracking-widest">Pasto · Colombia</div>
                </div>
              </div>
              <div>
                <h2 className="text-white font-extrabold text-xl sm:text-2xl leading-tight">
                  Sistema de <span className="text-cyan-300">Gestión</span> Profesoral
                </h2>
                <p className="text-blue-200/70 text-xs mt-0.5">Facultad de Ingeniería · CESMAG</p>
              </div>
            </div>

            {/* ── Desktop ── */}
            <div className="hidden lg:flex relative z-10 h-full flex-col justify-between p-14 xl:p-20">
              <div className="flex items-center gap-3">
                <img src="/logo_cesmag.png" alt="CESMAG"
                  className="h-11 w-11 rounded-xl object-contain bg-white/10 p-1" />
                <div>
                  <div className="text-white font-black text-xl leading-none tracking-tight">CESMAG</div>
                  <div className="text-blue-200/60 text-[11px] font-semibold uppercase tracking-widest">Pasto · Colombia</div>
                </div>
              </div>

              <div>
                <span className="inline-block bg-white/10 border border-white/20 text-blue-100 text-[10px] font-bold px-4 py-1.5 uppercase tracking-widest rounded-full backdrop-blur-md mb-6">
                  Excelencia Académica
                </span>
                <h1 className="text-5xl xl:text-6xl font-extrabold leading-tight tracking-tight text-white mb-6">
                  Sistema de <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300">
                    Gestión
                  </span>{' '}<br />Profesoral.
                </h1>
                <div className="w-20 h-1.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full mb-6" />
                <p className="text-xl text-blue-100/80 max-w-lg font-light leading-relaxed">
                  Plataforma centralizada para el desarrollo, seguimiento y fortalecimiento de nuestra comunidad docente.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                {[
                  { icon: Users, value: '24+', label: 'Docentes' },
                  { icon: GraduationCap, value: '4', label: 'Programas' },
                  { icon: BarChart3, value: '98%', label: 'Eficiencia' },
                ].map(({ icon: Icon, value, label }, i) => (
                  <div key={label} className={`text-center ${i === 1 ? 'border-x border-white/10' : ''}`}>
                    <Icon className="w-5 h-5 text-cyan-300 mx-auto mb-1.5" />
                    <div className="text-3xl font-black text-white">{value}</div>
                    <div className="text-[11px] text-blue-200/60 font-semibold uppercase tracking-wider mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Panel derecho / inferior — formulario */}
        <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-16 xl:px-24 py-4 lg:py-0 min-h-0 overflow-auto">

            {/* Logo SIGAP — solo desktop */}
            <div className="hidden lg:flex items-center gap-3 mb-10">
              <div className="bg-gradient-to-br from-[#0f1f4b] to-blue-700 p-2.5 rounded-xl shadow-lg shadow-blue-900/20">
                <BookOpen className="text-white h-7 w-7" />
              </div>
              <div>
                <span className="text-[#0f1f4b] font-black text-3xl tracking-tight">SIGAP</span>
                <div className="text-gray-400 text-[10px] font-semibold uppercase tracking-widest">v2.0 · 2026</div>
              </div>
            </div>

            {/* Bienvenida */}
            <div className="mb-5 lg:mb-8">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">
                Bienvenido(a)
              </h2>
              <p className="text-gray-500 text-sm sm:text-base lg:text-lg font-medium leading-snug">
                Al Sistema de Gestión Profesoral.{' '}
                <span className="hidden lg:inline"><br /></span>
                Ingrese con sus credenciales institucionales.
              </p>
            </div>

            {/* Alertas */}
            {infoMsg && (
              <div className="mb-4 p-3 lg:p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-800 flex items-start gap-3 rounded-r-xl shadow-sm">
                <Clock className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-bold">Sesión Cerrada</p>
                  <p className="text-xs text-amber-700 mt-0.5">{infoMsg}</p>
                </div>
              </div>
            )}
            {errorMsg && (
              <div className="mb-4 p-3 lg:p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-start gap-3 rounded-r-xl">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium">{errorMsg}</p>
              </div>
            )}

            {/* Botón Google */}
            <div className="mb-4 lg:mb-6">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 lg:mb-3">Continuar con</p>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setErrorMsg('Error al conectar con Google.')}
                theme="outline"
                size="large"
                shape="rectangular"
                text="continue_with"
              />
            </div>

            {/* Seguridad */}
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 lg:h-5 lg:w-5 text-emerald-500 flex-shrink-0" />
              <span className="text-gray-500 text-xs lg:text-sm font-medium">
                Acceso seguro mediante cuenta institucional de Google.
              </span>
            </div>

            {/* Chips roles — solo desktop */}
            <div className="hidden lg:flex flex-wrap gap-2 mt-6">
              {['Planeación', 'Docentes', 'Directores', 'Consultores'].map(rol => (
                <span key={rol} className="text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-3 py-1 rounded-full">
                  {rol}
                </span>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 sm:px-10 lg:px-16 py-3 lg:py-5 text-[11px] font-medium text-gray-400 flex flex-col sm:flex-row justify-between items-center gap-2 bg-gray-50 border-t border-gray-100 flex-shrink-0">
            <div className="flex gap-4">
              <button
                onClick={() => setShowPrivacidad(true)}
                className="hover:text-gray-600 transition-colors hover:underline underline-offset-2"
              >
                Aviso de Privacidad
              </button>
              <span>•</span>
              <button
                onClick={() => setShowTerminos(true)}
                className="hover:text-gray-600 transition-colors hover:underline underline-offset-2"
              >
                Términos y Condiciones
              </button>
            </div>
            <p>© 2026 SIGAP — Sistema de Gestión Académica.</p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          MODAL: AVISO DE PRIVACIDAD
      ═══════════════════════════════════════ */}
      {showPrivacidad && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowPrivacidad(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-[#0f1f4b] text-white flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <Lock className="w-5 h-5 text-cyan-300" />
                <h2 className="font-bold text-base">Aviso de Privacidad</h2>
              </div>
              <button onClick={() => setShowPrivacidad(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-4 text-sm text-gray-600 leading-relaxed">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-blue-800 text-xs font-medium">
                Última actualización: 1 de enero de 2026 · CESMAG — Pasto, Colombia
              </div>
              <h3 className="font-bold text-gray-800 text-base">1. Responsable del tratamiento</h3>
              <p>La <strong>Universidad CESMAG</strong>, con domicilio en la ciudad de San Juan de Pasto, Nariño, Colombia, es responsable del tratamiento de los datos personales recolectados a través del <strong>Sistema de Gestión Académica Profesoral (SIGAP)</strong>.</p>
              <h3 className="font-bold text-gray-800 text-base">2. Datos recolectados</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Nombre completo y número de identificación.</li>
                <li>Correo electrónico institucional (Google OAuth).</li>
                <li>Rol asignado: Docente, Director, Consultor, Planeación.</li>
                <li>Información académica: programa, tipo de contrato, horas asignadas.</li>
                <li>Registros de actividad y avances semanales subidos al sistema.</li>
              </ul>
              <h3 className="font-bold text-gray-800 text-base">3. Finalidad del tratamiento</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Autenticación y control de acceso al sistema.</li>
                <li>Seguimiento y evaluación del desempeño docente.</li>
                <li>Generación de reportes académicos internos.</li>
                <li>Notificaciones institucionales relacionadas con la gestión profesoral.</li>
              </ul>
              <h3 className="font-bold text-gray-800 text-base">4. Seguridad de los datos</h3>
              <p>SIGAP implementa autenticación JWT, cifrado HTTPS y acceso basado en roles (RBAC) para proteger la confidencialidad e integridad de los datos.</p>
              <h3 className="font-bold text-gray-800 text-base">5. Derechos del titular</h3>
              <p>Los usuarios podrán ejercer sus derechos ARCO comunicándose con la Oficina de Planeación Académica de CESMAG.</p>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end flex-shrink-0">
              <button
                onClick={() => setShowPrivacidad(false)}
                className="px-5 py-2 bg-[#0f1f4b] hover:bg-blue-900 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          MODAL: TÉRMINOS Y CONDICIONES
      ═══════════════════════════════════════ */}
      {showTerminos && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowTerminos(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-[#0f1f4b] text-white flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-cyan-300" />
                <h2 className="font-bold text-base">Términos y Condiciones</h2>
              </div>
              <button onClick={() => setShowTerminos(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-4 text-sm text-gray-600 leading-relaxed">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-blue-800 text-xs font-medium">
                Vigentes desde el 1 de enero de 2026 · SIGAP v2.0
              </div>
              <h3 className="font-bold text-gray-800 text-base">1. Aceptación</h3>
              <p>Al acceder al <strong>Sistema de Gestión Académica Profesoral (SIGAP)</strong>, el usuario acepta los presentes términos establecidos por la Oficina de Planeación de la <strong>Universidad CESMAG</strong>.</p>
              <h3 className="font-bold text-gray-800 text-base">2. Uso autorizado</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Personal docente activo de la Facultad de Ingeniería de CESMAG.</li>
                <li>Directores de programa académico debidamente registrados.</li>
                <li>Personal de Planeación y Consultores autorizados.</li>
              </ul>
              <h3 className="font-bold text-gray-800 text-base">3. Responsabilidades del usuario</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Mantener la confidencialidad de su cuenta Google Institucional.</li>
                <li>Registrar información veraz en los avances y evidencias.</li>
                <li>No compartir sus credenciales con terceros.</li>
                <li>Reportar cualquier uso no autorizado al administrador.</li>
              </ul>
              <h3 className="font-bold text-gray-800 text-base">4. Propiedad intelectual</h3>
              <p>El SIGAP, su código, diseño y contenido son propiedad de CESMAG. Queda prohibida su reproducción sin autorización expresa.</p>
              <h3 className="font-bold text-gray-800 text-base">5. Sanciones</h3>
              <p>El uso indebido del sistema podrá acarrear sanciones disciplinarias conforme al reglamento interno de CESMAG y la legislación colombiana vigente.</p>
              <h3 className="font-bold text-gray-800 text-base">6. Modificaciones</h3>
              <p>CESMAG se reserva el derecho de modificar estos términos en cualquier momento, notificando los cambios mediante el propio sistema SIGAP.</p>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end flex-shrink-0">
              <button
                onClick={() => setShowTerminos(false)}
                className="px-5 py-2 bg-[#0f1f4b] hover:bg-blue-900 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
