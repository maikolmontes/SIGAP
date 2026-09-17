import { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../../components/common/Layout';
import api from '../../services/api';
import {
    MessageSquare, Search, Eye, Filter, ChevronDown, Calendar,
    BookOpen, Clock, User, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Observacion {
    id: number;
    semana: number;
    texto: string;
    ultima_edicion: string;
    id_usuario: number;
    docente_nombre: string;
    director_nombre?: string;
    funcion_sustantiva?: string;
    rol_seleccionado?: string;
    horas_rol?: number | string;
    nombre_programa?: string;
}

interface GrupoDocente {
    id_usuario: number;
    docente_nombre: string;
    observaciones: Observacion[];
    sem8: number;
    sem16: number;
}

// Nombres que llegan en MAYÚSCULAS o en minúsculas se normalizan
// a "Tipo Título" para que la lista se vea pareja.
const formatearNombre = (nombre: string) =>
    (nombre || '')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');

const iniciales = (nombre: string) => {
    const partes = (nombre || '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '??';
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
};

const formatearFecha = (valor: string) => {
    if (!valor) return '—';
    const d = new Date(valor);
    if (isNaN(d.getTime())) return '—';
    return `${d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
};

export default function ObservacionesDirector() {
    const [observaciones, setObservaciones] = useState<Observacion[]>([]);
    const [periodo, setPeriodo] = useState<{ anio: number; semestre: number } | null>(null);
    const [totalObs, setTotalObs] = useState(0);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroSemana, setFiltroSemana] = useState('');
    const [filtroFuncion, setFiltroFuncion] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [docentesAbiertos, setDocentesAbiertos] = useState<Record<number, boolean>>({});
    const navigate = useNavigate();

    const cargarObservaciones = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
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

    const funciones = [...new Set(observaciones.map(o => o.funcion_sustantiva).filter(Boolean))] as string[];

    const observacionesFiltradas = useMemo(() => {
        const q = busqueda.toLowerCase().trim();
        return observaciones.filter(o => {
            const coincideBusqueda = !q ||
                o.docente_nombre?.toLowerCase().includes(q) ||
                o.funcion_sustantiva?.toLowerCase().includes(q) ||
                o.texto?.toLowerCase().includes(q) ||
                o.rol_seleccionado?.toLowerCase().includes(q);
            const coincideFuncion = filtroFuncion ? o.funcion_sustantiva === filtroFuncion : true;
            return coincideBusqueda && coincideFuncion;
        });
    }, [observaciones, busqueda, filtroFuncion]);

    // Las observaciones se agrupan por docente: así el director lee la
    // retroalimentación de una persona junta, en vez de saltar entre
    // tarjetas sueltas que repiten el mismo nombre y programa.
    const grupos = useMemo<GrupoDocente[]>(() => {
        const mapa = new Map<number, GrupoDocente>();

        observacionesFiltradas.forEach(o => {
            if (!mapa.has(o.id_usuario)) {
                mapa.set(o.id_usuario, {
                    id_usuario: o.id_usuario,
                    docente_nombre: formatearNombre(o.docente_nombre),
                    observaciones: [],
                    sem8: 0,
                    sem16: 0
                });
            }
            const grupo = mapa.get(o.id_usuario)!;
            grupo.observaciones.push(o);
            if (Number(o.semana) === 8) grupo.sem8++;
            else grupo.sem16++;
        });

        return [...mapa.values()].sort((a, b) => a.docente_nombre.localeCompare(b.docente_nombre, 'es'));
    }, [observacionesFiltradas]);

    // Con pocos docentes se muestran abiertos; con muchos, plegados para
    // que la lista completa quepa en pantalla sin desplazarse.
    const abiertoPorDefecto = grupos.length <= 4;

    const periodoLabel = periodo
        ? `${periodo.anio}-${periodo.semestre === 1 ? 'I' : 'II'}`
        : 'Sin periodo activo';

    const programaLabel = observaciones[0]?.nombre_programa || 'Programa académico';

    const obsSem8 = observaciones.filter(o => Number(o.semana) === 8).length;
    const obsSem16 = observaciones.filter(o => Number(o.semana) === 16).length;
    const docentesUnicos = new Set(observaciones.map(o => o.id_usuario)).size;

    const hayFiltros = !!(filtroSemana || filtroFuncion || busqueda);

    const limpiarTodo = () => {
        setFiltroSemana('');
        setFiltroFuncion('');
        setBusqueda('');
    };

    return (
        <Layout rol="director" path="Supervisión / Observaciones">
            {/* Encabezado */}
            <div className="mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shrink-0">
                        <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Observaciones Realizadas</h1>
                        <p className="text-sm text-gray-500 truncate">
                            Periodo activo: <span className="font-semibold text-indigo-600">{periodoLabel}</span>
                            {' · '}{programaLabel}
                        </p>
                    </div>
                </div>
            </div>

            {/* Resumen compacto */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                    { label: 'Total', value: totalObs, icon: MessageSquare, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
                    { label: 'Corte I · Sem 8', value: obsSem8, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                    { label: 'Corte II · Sem 16', value: obsSem16, icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                    { label: 'Docentes', value: docentesUnicos, icon: User, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
                ].map(m => (
                    <div key={m.label} className={`bg-white rounded-2xl px-4 py-3 shadow-xs border ${m.border} flex items-center gap-3`}>
                        <div className={`w-9 h-9 ${m.bg} rounded-xl flex items-center justify-center shrink-0`}>
                            <m.icon className={`w-4 h-4 ${m.color}`} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xl font-black text-gray-800 leading-none">{m.value}</div>
                            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider truncate">{m.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Buscador + filtro rápido de corte */}
            <div className="bg-white rounded-2xl shadow-xs border border-gray-100 mb-5">
                <div className="px-4 py-3 flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar docente, actividad o texto..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className="w-full pl-10 pr-9 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                        />
                        {busqueda && (
                            <button
                                onClick={() => setBusqueda('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                                title="Limpiar búsqueda"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Corte como botones: el filtro más usado, a un clic */}
                        <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden">
                            {[
                                { valor: '', texto: 'Todos' },
                                { valor: '8', texto: 'Corte I' },
                                { valor: '16', texto: 'Corte II' },
                            ].map(op => (
                                <button
                                    key={op.valor || 'todos'}
                                    onClick={() => setFiltroSemana(op.valor)}
                                    className={`px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                                        filtroSemana === op.valor
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {op.texto}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer border ${
                                filtroFuncion
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border-transparent'
                            }`}
                        >
                            <Filter className="w-3.5 h-3.5" />
                            Función
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                        </button>

                        {hayFiltros && (
                            <button
                                onClick={limpiarTodo}
                                className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            >
                                Limpiar
                            </button>
                        )}
                    </div>
                </div>

                {showFilters && (
                    <div className="px-4 py-3 bg-gray-50/70 border-t border-gray-100 flex flex-wrap gap-2">
                        <button
                            onClick={() => setFiltroFuncion('')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                                !filtroFuncion
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            Todas las funciones
                        </button>
                        {funciones.map(f => (
                            <button
                                key={f}
                                onClick={() => setFiltroFuncion(filtroFuncion === f ? '' : f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                                    filtroFuncion === f
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Listado agrupado por docente */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
                </div>
            ) : grupos.length === 0 ? (
                <div className="text-center py-16 text-gray-400 bg-white rounded-2xl shadow-xs border border-gray-100">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium text-gray-600">No se encontraron observaciones</p>
                    <p className="text-sm mt-1">
                        {totalObs === 0
                            ? 'Escribe observaciones desde el detalle de la agenda de cada docente.'
                            : 'Ajusta los filtros para ver más resultados.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {grupos.map(grupo => {
                        const abierto = docentesAbiertos[grupo.id_usuario] ?? abiertoPorDefecto;

                        return (
                            <div key={grupo.id_usuario} className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden">

                                {/* Cabecera del docente */}
                                <div className={`flex items-center gap-3 px-4 py-3 ${abierto ? 'border-b border-gray-100 bg-gray-50/60' : ''}`}>
                                    <button
                                        onClick={() => setDocentesAbiertos(prev => ({ ...prev, [grupo.id_usuario]: !abierto }))}
                                        className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer group"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                                            {iniciales(grupo.docente_nombre)}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-extrabold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
                                                {grupo.docente_nombre}
                                            </h3>
                                            <p className="text-xs text-gray-500">
                                                {grupo.observaciones.length} {grupo.observaciones.length === 1 ? 'observación' : 'observaciones'}
                                            </p>
                                        </div>
                                    </button>

                                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                                        {grupo.sem8 > 0 && (
                                            <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                                                Corte I · {grupo.sem8}
                                            </span>
                                        )}
                                        {grupo.sem16 > 0 && (
                                            <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                Corte II · {grupo.sem16}
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => navigate(`/director/agendas/${grupo.id_usuario}`)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-100 whitespace-nowrap cursor-pointer shrink-0"
                                        title="Abrir la agenda completa de este docente"
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span className="hidden md:inline">Ver agenda</span>
                                    </button>

                                    <button
                                        onClick={() => setDocentesAbiertos(prev => ({ ...prev, [grupo.id_usuario]: !abierto }))}
                                        className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors cursor-pointer shrink-0"
                                        title={abierto ? 'Plegar' : 'Desplegar'}
                                    >
                                        <ChevronDown className={`w-4 h-4 transition-transform ${abierto ? '' : '-rotate-90'}`} />
                                    </button>
                                </div>

                                {/* Observaciones del docente */}
                                {abierto && (
                                    <div className="divide-y divide-gray-100">
                                        {grupo.observaciones.map(obs => {
                                            const esCorteI = Number(obs.semana) === 8;
                                            return (
                                                <div
                                                    key={obs.id}
                                                    className={`px-4 py-3.5 border-l-4 hover:bg-gray-50/60 transition-colors ${
                                                        esCorteI ? 'border-l-blue-400' : 'border-l-emerald-400'
                                                    }`}
                                                >
                                                    {/* Etiquetas y fecha */}
                                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                                                            esCorteI
                                                                ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                        }`}>
                                                            {esCorteI ? 'Corte I · Semana 8' : 'Corte II · Semana 16'}
                                                        </span>
                                                        {obs.funcion_sustantiva && (
                                                            <span className="text-[11px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md flex items-center gap-1">
                                                                <BookOpen className="w-3 h-3" />
                                                                {obs.funcion_sustantiva}
                                                            </span>
                                                        )}
                                                        <span className="text-[11px] text-gray-400 flex items-center gap-1 ml-auto shrink-0">
                                                            <Calendar className="w-3 h-3" />
                                                            {formatearFecha(obs.ultima_edicion)}
                                                        </span>
                                                    </div>

                                                    {/* Texto de la observación */}
                                                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                                                        {obs.texto}
                                                    </p>

                                                    {/* Contexto: actividad y autor */}
                                                    <div className="mt-1.5 text-[11px] text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                        <span className="font-semibold text-gray-600 truncate max-w-full">
                                                            {obs.rol_seleccionado || 'Actividad sin nombre'}
                                                        </span>
                                                        {obs.horas_rol != null && (
                                                            <>
                                                                <span className="text-gray-300">·</span>
                                                                <span>{parseFloat(String(obs.horas_rol)).toFixed(0)}h</span>
                                                            </>
                                                        )}
                                                        {obs.director_nombre && (
                                                            <>
                                                                <span className="text-gray-300">·</span>
                                                                <span>por {formatearNombre(obs.director_nombre)}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </Layout>
    );
}
