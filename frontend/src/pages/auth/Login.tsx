import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
// @ts-ignore
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, BookOpen, AlertCircle } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    try {
      setErrorMsg(null);
      // Enviar el token recibido de Google al backend
      const response = await api.post('/auth/google', {
        credential: credentialResponse.credential,
      });

      // El backend retorna token y user
      const { token, user } = response.data;
      login(token, user);
    } catch (error: any) {
      console.error('Error durante login:', error);
      if (error.code === 'ERR_NETWORK') {
        setErrorMsg('No se pudo conectar con el servidor (Error de Red). Verifique que el backend esté ejecutándose.');
      } else if (error.response && error.response.data && error.response.data.error) {
        setErrorMsg(error.response.data.error);
      } else {
        setErrorMsg('Ocurrió un error al intentar iniciar sesión. Inténtelo más tarde.');
      }
    }
  };

  return (
    <div className="flex h-screen w-full font-sans bg-gray-50">
      {/* Lado izquierdo - Panel de Información (Oculto en móviles) */}
      <div className="hidden lg:flex w-1/2 relative bg-[#172554] text-white flex-col justify-between overflow-hidden shadow-2xl">
        {/* Capa base por si falla la imagen */}
        <div className="absolute inset-0 bg-[#172554]"></div>

        {/* Fondo con la imagen del edificio (opacidad alta para mejor visibilidad) */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50 transition-opacity duration-700"
          style={{ backgroundImage: 'url("/edificio.jpg")' }}
        ></div>

        {/* Overlay degradado suave para garantizar lectura de textos, pero resaltando la imagen */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/90 via-[#0f172a]/40 to-transparent pointer-events-none"></div>

        <div className="relative z-10 p-16 xl:p-24 flex flex-col h-full justify-center">
          <div className="mb-10">
            <span className="bg-white/10 border border-white/20 text-blue-100 text-xs font-bold px-4 py-1.5 uppercase tracking-widest rounded-full backdrop-blur-md shadow-lg">
              Excelencia Académica
            </span>
          </div>

          <h1 className="text-5xl xl:text-6xl font-extrabold leading-tight mb-8 tracking-tight">
            Sistema de <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-200">Gestión</span> <br />
            Profesoral.
          </h1>

          <div className="w-20 h-1.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full mb-8"></div>

          <p className="text-xl text-blue-100/80 max-w-lg mb-16 font-light leading-relaxed">
            Plataforma centralizada para el desarrollo, seguimiento y fortalecimiento de nuestra comunidad docente.
          </p>

          <div className="flex gap-16 mt-auto bg-white/5 p-8 rounded-2xl backdrop-blur-sm border border-white/10">
            <div>
              <h3 className="text-4xl font-black mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">24+</h3>
              <p className="text-sm text-blue-200/70 font-medium uppercase tracking-wider">Docentes</p>
            </div>
            <div>
              <h3 className="text-4xl font-black mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">98%</h3>
              <p className="text-sm text-blue-200/70 font-medium uppercase tracking-wider">Eficiencia</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lado derecho - Formulario de Login */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white/80 backdrop-blur-xl transition-all">
        <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 relative">

          {/* Logo o Marca */}
          <div className="flex items-center gap-3 mb-16">
            <div className="bg-gradient-to-br from-[#172554] to-blue-800 p-2.5 rounded-xl shadow-lg shadow-blue-900/20">
              <BookOpen className="text-white h-7 w-7" />
            </div>
            <span className="text-[#172554] font-black text-3xl tracking-tight">SIGAP</span>
          </div>

          <div className="mb-10">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">Bienvenido(a)</h2>
            <p className="text-gray-500 text-lg font-medium leading-relaxed">
              Al Sistema de Gestión Profesoral.<br /> Ingrese sus credenciales institucionales.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-start gap-3 rounded-r-md">
              <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{errorMsg}</p>
            </div>
          )}

          <div className="bg-white p-1 rounded-xl mb-10 inline-block w-full max-w-[400px]">
            <div className="flex justify-center border border-gray-200 hover:border-gray-300 rounded-lg py-1 shadow-sm hover:shadow-md transition-all">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => {
                  setErrorMsg('Se produjo un error al conectar con Google.');
                }}
                theme="outline"
                size="large"
                shape="rectangular"
                text="continue_with"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-400 mt-2">
            <ShieldCheck className="h-5 w-5 text-green-500" />
            <span className="font-medium text-gray-500">Acceso seguro mediante cuenta institucional de Google.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 sm:px-16 lg:px-24 py-8 text-sm font-medium text-gray-400 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50">
          <div className="flex gap-4">
            <a href="#" className="hover:text-gray-600 transition-colors">Aviso de Privacidad</a>
            <span>•</span>
            <a href="#" className="hover:text-gray-600 transition-colors">Términos y Condiciones</a>
          </div>
          <p className="hover:text-gray-600 transition-colors">© 2026 SIGAP - Sistema de Gestión Académica.</p>
        </div>
      </div>
    </div>
  );
}
