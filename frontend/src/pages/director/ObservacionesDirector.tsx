import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/common/Layout';
import api from '../../services/api';
import { MessageSquare, Search, Eye, Filter, ChevronDown, Calendar, BookOpen, Clock, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ObservacionesDirector() {
    const [observaciones, setObservaciones] = useState<any[]>([]);
    const [periodo, setPeriodo] = useState<any>(null);
    const [totalObs, setTotalObs] = useState(0);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroSemana, setFiltroSemana] = useState('');
    const [filtroFuncion, setFiltroFuncion] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const navigate = useNavigate();

    const cargarObservaciones = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (filtroSemana) params.semana = filtroSemana;
            const res = await api.get('/observaciones/todas', { params });
            setObservaciones(res.data.observaciones || []);
            setPeriodo(res.data.periodo || null);
            setTotalObs(res.data.total || 0);
        } catch (e) {
            console.error('Error cargando observaciones:', e);
        } finally {
            setLoading(false);
        }
    }, [filtroSemana]);

    useEffect(() => {
        cargarObservaciones();
    }, [cargarObservaciones]);

    const funciones = [...new Set(observaciones.map(o => o.funcion_sustantiva).filter(Boolean))];

    const observacionesFiltradas = observaciones.filter(o => {
        const coincideBusqueda =
            o.docente_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
            o.funcion_sustantiva?.toLowerCase().includes(busqueda.toLowerCase()) ||
            o.texto?.toLowerCase().includes(busqueda.toLowerCase()) ||
            o.rol_seleccionado?.toLowerCase().includes(busqueda.toLowerCase());
        const coincideFuncion = filtroFuncion ? o.funcion_sustantiva === filtroFuncion : true;
        return coincideBusqueda && coincideFuncion;
    });

    const periodoLabel = periodo
        ? `${periodo.anio}-${periodo.semestre === 1 ? 'I' : 'II'}`
        : 'Sin periodo activo';

    // Contadores rápidos
    const obsSem8 = observaciones.filter(o => o.semana === 8).length;
    const obsSem16 = observaciones.filter(o => o.semana === 16).length;
    const docentesUnicos = new Set(observaciones.map(o => o.id_usuario)).size;

    return (
        <Layout rol="director" path="Supervisión / Observaciones">
            {/* Encabezado */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
                        <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Observaciones Realizadas</h1>
                        <p className="text-sm text-gray-500">
                            Periodo activo: <span className="font-semibold text-indigo-600">{periodoLabel}</span>
                            {' · '}Ingeniería de Sistemas
                        </p>
                    </div>
                </div>
            </div>

            {/* Tarjetas resumen */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total', value: observacionesFiltradas.length, icon: MessageSquare, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
                    { label: 'Corte I (Sem 8)', value: obsSem8, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                    { label: 'Corte II (Sem 16)', value: obsSem16, icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                    { label: 'Docentes', value: docentesUnicos, icon: User, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
                ].map(m => (
                    <div key={m.label} className={`bg-white rounded-2xl p-4 shadow-sm border ${m.border} hover:shadow-md transition-all`}>
                        <div className={`w-9 h-9 ${m.bg} rounded-xl flex items-center justify-center mb-2`}>
                            <m.icon className={`w-4 h-4 ${m.color}`} />
                        </div>
                        <div className="text-2xl font-black text-gray-800">{m.value}</div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{m.label}</div>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
                <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar docente, función o texto..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        <Filter className="w-4 h-4" />
                        Filtros
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {showFilters && (
                    <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100 flex flex-wrap gap-3">
                        <select
                            value={filtroSemana}
                            onChange={(e) => setFiltroSemana(e.target.value)}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-400"
                        >
                            <option value="">Todas las semanas</option>
                            <option value="8">Corte I — Semana 8</option>
                            <option value="16">Corte II — Semana 16</option>
                        </select>
                        <select
                            value={filtroFuncion}
                            onChange={(e) => setFiltroFuncion(e.target.value)}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-400"
                        >
                            <option value="">Todas las funciones</option>
                            {funciones.map(f => (
                                <option key={f} value={f}>{f}</option>
                            ))}
                        </select>
                        {(filtroSemana || filtroFuncion) && (
                            <button
                                onClick={() => { setFiltroSemana(''); setFiltroFuncion(''); }}
                                className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Listado */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
                </div>
            ) : observacionesFiltradas.length === 0 ? (
                <div className="text-center py-16 text-gray-400 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No se encontraron observaciones</p>
                    <p className="text-sm mt-1">
                        {totalObs === 0
                            ? 'Realiza observaciones desde el detalle de la agenda de cada docente.'
                            : 'Ajusta los filtros para ver más resultados.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {observacionesFiltradas.map((obs) => (
                        <div key={obs.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                            <div className="flex flex-col md:flex-row gap-4 justify-between">
                                <div className="flex-1">
                                    {/* Encabezado de la observación */}
                                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                                            obs.semana === 8
                                                ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        }`}>
                                            {obs.semana === 8 ? 'Corte I · Semana 8' : 'Corte II · Semana 16'}
                                        </span>
                                        <span className="text-xs font-medium px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg flex items-center gap-1">
                                            <BookOpen className="w-3 h-3" />
                                            {obs.funcion_sustantiva}
                                        </span>
                                        <span className="text-xs text-gray-400 flex items-center gap-1 ml-auto">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {obs.ultima_edicion
                                                ? `${new Date(obs.ultima_edicion).toLocaleDateString('es-CO')} a las ${new Date(obs.ultima_edicion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                                : '—'}
                                        </span>
                                    </div>

                                    {/* Texto de la observación */}
                                    <p className="text-gray-800 text-sm mb-3 font-medium bg-gray-50 p-3 rounded-xl border border-gray-100 italic">
                                        "{obs.texto}"
                                    </p>

                                    {/* Metadata */}
                                    <div className="text-xs text-gray-500 flex flex-wrap gap-x-5 gap-y-1.5">
                                        <p><strong className="text-gray-700">Docente:</strong> {obs.docente_nombre}</p>
                                        <p><strong className="text-gray-700">Actividad:</strong> {obs.rol_seleccionado} ({parseFloat(obs.horas_rol || 0).toFixed(0)}h)</p>
                                        <p><strong className="text-gray-700">Programa:</strong> {obs.nombre_programa || 'Ingeniería de Sistemas'}</p>
                                        {obs.director_nombre && (
                                            <p><strong className="text-gray-700">Observado por:</strong> {obs.director_nombre}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Acción */}
                                <div className="flex flex-col justify-center items-end">
                                    <button
                                        onClick={() => navigate(`/director/agendas/${obs.id_usuario}`)}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-100 whitespace-nowrap"
                                    >
                                        <Eye className="w-4 h-4" />
                                        Ver Agenda Completa
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Layout>
    );
}
