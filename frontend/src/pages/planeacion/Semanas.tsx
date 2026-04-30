import { useState, useEffect } from 'react';
import Layout from '../../components/common/Layout';
import { Calendar, Save, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import api from '../../services/api';

interface Semana {
  id_semana: number;
  numero_semana: string;
  etiqueta: string;
  habilitada: boolean;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export default function Semanas() {
  const [semanas, setSemanas] = useState<Semana[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error', texto: string } | null>(null);

  useEffect(() => {
    cargarSemanas();
  }, []);

  const cargarSemanas = async () => {
    try {
      setLoading(true);
      const res = await api.get('/semanas');
      setSemanas(res.data);
    } catch (error) {
      console.error('Error al cargar semanas:', error);
      setMensaje({ tipo: 'error', texto: 'Error al cargar las semanas desde la base de datos.' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (id: number) => {
    setSemanas(prev => prev.map(s => s.id_semana === id ? { ...s, habilitada: !s.habilitada } : s));
  };

  const handleDateChange = (id: number, field: 'fecha_inicio' | 'fecha_fin', value: string) => {
    setSemanas(prev => prev.map(s => s.id_semana === id ? { ...s, [field]: value } : s));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/semanas', { semanas });
      setMensaje({ tipo: 'exito', texto: 'Configuración de semanas guardada correctamente.' });
      setTimeout(() => setMensaje(null), 3000);
    } catch (error) {
      console.error('Error al guardar semanas:', error);
      setMensaje({ tipo: 'error', texto: 'Error al guardar los cambios en la base de datos.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout rol="planeacion" path="Gestión Institucional / Semanas">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 font-medium flex items-center gap-2">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Cargando semanas...
          </div>
        </div>
      </Layout>
    );
  }

  if (!loading && semanas.length === 0 && !mensaje) {
    return (
      <Layout rol="planeacion" path="Gestión Institucional / Semanas">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md mx-auto text-center mt-10">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Sin Período Activo</h2>
          <p className="text-gray-600 mb-4">
            No se encontró un período académico activo. Para gestionar las semanas, primero debes crear o habilitar un período desde la ventana de Períodos.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout rol="planeacion" path="Gestión Institucional / Semanas">
      <div className="bg-[#1a2744] rounded-xl px-6 py-6 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-400" />
              Gestión de Semanas de Planeación
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              Habilita o deshabilita semanas para permitir a los docentes enviar sus evidencias en esos cortes.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-bold shadow-md transition-colors"
          >
            {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      {mensaje && (
        <div className={`p-4 mb-6 rounded-xl flex items-start gap-3 border ${mensaje.tipo === 'exito' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {mensaje.tipo === 'exito' ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
          <p className="font-medium text-sm">{mensaje.texto}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Número de Semana</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Fechas del Corte</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Estado de Habilitación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {semanas.map((semana) => (
                <tr key={semana.id_semana} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-bold text-gray-900">Semana {semana.numero_semana}</span>
                    <div className="text-xs text-gray-500 mt-1">{semana.etiqueta || `Corte de evaluación ${semana.numero_semana}`}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                      <div className="flex flex-col gap-1 w-full sm:w-auto">
                         <label className="text-[10px] uppercase font-bold text-gray-400">Inicio</label>
                         <input 
                           type="date" 
                           className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                           value={semana.fecha_inicio ? semana.fecha_inicio.substring(0, 10) : ''}
                           onChange={(e) => handleDateChange(semana.id_semana, 'fecha_inicio', e.target.value)}
                         />
                      </div>
                      <span className="text-gray-300 hidden sm:block">-</span>
                      <div className="flex flex-col gap-1 w-full sm:w-auto">
                         <label className="text-[10px] uppercase font-bold text-gray-400">Cierre</label>
                         <input 
                           type="date" 
                           className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                           value={semana.fecha_fin ? semana.fecha_fin.substring(0, 10) : ''}
                           onChange={(e) => handleDateChange(semana.id_semana, 'fecha_fin', e.target.value)}
                         />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={semana.habilitada}
                        onChange={() => handleToggle(semana.id_semana)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                      <span className={`ml-3 text-sm font-bold ${semana.habilitada ? 'text-green-600' : 'text-gray-400'}`}>
                        {semana.habilitada ? 'Habilitada' : 'Cerrada'}
                      </span>
                    </label>
                  </td>
                </tr>
              ))}
              {semanas.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No hay semanas configuradas en la base de datos.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
