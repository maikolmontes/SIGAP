import { useState, useEffect } from 'react';
import Layout from '../../components/common/Layout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Mail,
  Send,
  BellRing,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ServerCog
} from 'lucide-react';

interface EstadoCorreo {
  habilitado: boolean;
  conexion_smtp: boolean;
  host: string;
  puerto: string;
  remitente: string | null;
  redireccion_pruebas: string | null;
  frontend_url: string;
}

type Mensaje = { tipo: 'exito' | 'error'; texto: string } | null;

// Extrae el mensaje que devuelve el backend sin recurrir a `any`
const errorBackend = (error: unknown, porDefecto: string): string => {
  const respuesta = (error as { response?: { data?: { error?: string } } })?.response;
  return respuesta?.data?.error || porDefecto;
};

export default function Notificaciones() {
  const { user } = useAuth();
  const [estado, setEstado] = useState<EstadoCorreo | null>(null);
  const [loading, setLoading] = useState(true);
  const [enviandoPrueba, setEnviandoPrueba] = useState(false);
  const [enviandoRecordatorios, setEnviandoRecordatorios] = useState(false);
  const [correoPrueba, setCorreoPrueba] = useState('');
  const [mensaje, setMensaje] = useState<Mensaje>(null);

  useEffect(() => {
    cargarEstado();
    if (user?.correo) setCorreoPrueba(user.correo);
  }, [user?.correo]);

  const mostrar = (tipo: 'exito' | 'error', texto: string) => {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 6000);
  };

  const cargarEstado = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notificaciones/estado');
      setEstado(res.data);
    } catch (error: unknown) {
      console.error('Error al consultar el estado del correo:', error);
      mostrar('error', errorBackend(error, 'No se pudo consultar el estado del servicio de correo.'));
    } finally {
      setLoading(false);
    }
  };

  const enviarPrueba = async () => {
    if (!correoPrueba.trim()) {
      mostrar('error', 'Escriba el correo al que desea enviar la prueba.');
      return;
    }
    try {
      setEnviandoPrueba(true);
      const res = await api.post('/notificaciones/prueba', { correo: correoPrueba.trim() });
      mostrar('exito', res.data.mensaje || `Correo de prueba enviado a ${correoPrueba}.`);
    } catch (error: unknown) {
      console.error('Error al enviar correo de prueba:', error);
      mostrar('error', errorBackend(error, 'No se pudo enviar el correo de prueba.'));
    } finally {
      setEnviandoPrueba(false);
    }
  };

  const enviarRecordatorios = async () => {
    const confirmar = window.confirm(
      'Se enviará un recordatorio por correo a todos los docentes con la agenda del período activo aún pendiente o devuelta. ¿Desea continuar?'
    );
    if (!confirmar) return;

    try {
      setEnviandoRecordatorios(true);
      const res = await api.post('/notificaciones/recordatorios', {});
      mostrar('exito', res.data.mensaje || 'Recordatorios enviados.');
    } catch (error: unknown) {
      console.error('Error al enviar recordatorios:', error);
      mostrar('error', errorBackend(error, 'No se pudieron enviar los recordatorios.'));
    } finally {
      setEnviandoRecordatorios(false);
    }
  };

  const Indicador = ({ ok, texto }: { ok: boolean; texto: string }) => (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
        ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
      }`}
    >
      {ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
      {texto}
    </span>
  );

  return (
    <Layout rol="planeacion" path="Seguridad y Accesos / Notificaciones">
      <div className="bg-[#1a2744] rounded-xl px-6 py-6 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Mail className="w-6 h-6 text-[#00a896]" />
              Notificaciones por Correo
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              Verifique la configuración del servicio de correo y envíe recordatorios de radicación de agendas.
            </p>
          </div>
          <button
            onClick={cargarEstado}
            disabled={loading}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-bold transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar estado
          </button>
        </div>
      </div>

      {mensaje && (
        <div
          className={`p-4 mb-6 rounded-xl flex items-start gap-3 border ${
            mensaje.tipo === 'exito'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {mensaje.tipo === 'exito' ? (
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <p className="font-medium text-sm">{mensaje.texto}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estado del servicio */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
            <ServerCog className="w-5 h-5 text-[#1a2744]" />
            Estado del servicio
          </h2>

          {loading ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-6">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Consultando configuración...
            </div>
          ) : estado ? (
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Servicio activo</dt>
                <dd>
                  <Indicador ok={estado.habilitado} texto={estado.habilitado ? 'Habilitado' : 'Desactivado'} />
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Conexión SMTP</dt>
                <dd>
                  <Indicador ok={estado.conexion_smtp} texto={estado.conexion_smtp ? 'Verificada' : 'Sin conexión'} />
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Servidor</dt>
                <dd className="font-medium text-gray-900">{estado.host}:{estado.puerto}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Cuenta emisora</dt>
                <dd className="font-medium text-gray-900">{estado.remitente || 'Sin configurar'}</dd>
              </div>
              {estado.redireccion_pruebas && (
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">Modo pruebas</dt>
                  <dd className="font-medium text-orange-600">Todo se envía a {estado.redireccion_pruebas}</dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Enlaces apuntan a</dt>
                <dd className="font-medium text-gray-900 truncate max-w-[55%]">{estado.frontend_url}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-500">No se pudo obtener el estado del servicio.</p>
          )}

          {estado && !estado.conexion_smtp && (
            <div className="mt-5 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 leading-relaxed">
              Configure <strong>EMAIL_USER</strong> y <strong>EMAIL_PASS</strong> en el archivo
              <strong> backend/.env</strong> con la contraseña de aplicación de Google y reinicie el servidor.
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-2">
              <Send className="w-5 h-5 text-[#00a896]" />
              Enviar correo de prueba
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Envía un mensaje de verificación para comprobar el formato y que no llegue a la carpeta de spam.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={correoPrueba}
                onChange={(e) => setCorreoPrueba(e.target.value)}
                placeholder="correo@cesmag.edu.co"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a896]/40"
              />
              <button
                onClick={enviarPrueba}
                disabled={enviandoPrueba || !estado?.habilitado}
                className="flex items-center justify-center gap-2 bg-[#00a896] hover:bg-[#00897b] disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-bold transition-colors"
              >
                {enviandoPrueba ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {enviandoPrueba ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-2">
              <BellRing className="w-5 h-5 text-[#ea580c]" />
              Recordatorio de radicación
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Notifica a los docentes cuya agenda del período activo sigue en borrador o fue devuelta con observaciones.
            </p>
            <button
              onClick={enviarRecordatorios}
              disabled={enviandoRecordatorios || !estado?.habilitado}
              className="w-full flex items-center justify-center gap-2 bg-[#ea580c] hover:bg-[#c2410c] disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-bold transition-colors"
            >
              {enviandoRecordatorios ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <BellRing className="w-4 h-4" />
              )}
              {enviandoRecordatorios ? 'Enviando recordatorios...' : 'Enviar recordatorios ahora'}
            </button>
          </div>
        </div>
      </div>

      {/* Referencia de eventos automáticos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Correos que el sistema envía automáticamente</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Evento</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Destinatario</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Cuándo se envía</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ['Agenda lista para revisión', 'Director del programa', 'Cuando el docente termina de diligenciar todas sus funciones'],
                ['Agenda aprobada', 'Docente', 'Cuando el director aprueba la agenda'],
                ['Agenda devuelta', 'Docente', 'Cuando el director devuelve la agenda con observaciones'],
                ['Bienvenida', 'Nuevo usuario', 'Al crear el usuario desde Docentes y Usuarios'],
                ['Apertura de período', 'Docentes y directores', 'Al crear o habilitar un período (si está activado en el .env)'],
                ['Carga académica disponible', 'Docentes importados', 'Al importar asignaciones (si está activado en el .env)'],
                ['Recordatorio de radicación', 'Docentes pendientes', 'Manual, desde el botón de esta página']
              ].map(([evento, destino, cuando]) => (
                <tr key={evento} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{evento}</td>
                  <td className="px-4 py-3 text-gray-700">{destino}</td>
                  <td className="px-4 py-3 text-gray-500">{cuando}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
