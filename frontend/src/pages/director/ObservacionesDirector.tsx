import { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../../components/common/Layout';
import api from '../../services/api';
import {
    MessageSquare, Search, Eye, Filter, ChevronDown, Calendar,
    BookOpen, Clock, User, X, LayoutGrid, List
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { etiquetaSemestre, rotularCortes } from '../../utils/periodo'

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

// Normaliza nombres a Tipo Título
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
    const [paginaActual, setPaginaActual] = useState(1);
    const [regPorPag, setRegPorPag] = useState(10);
    const [modoVista, setModoVista] = useState<'tarjetas' | 'lista'>('tarjetas');
    const [filtroCorteDocente, setFiltroCorteDocente] = useState<Record<number, string>>({});
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

    const totalPaginas = Math.max(1, Math.ceil(grupos.length / regPorPag));
    const paginaSegura = Math.min(paginaActual, totalPaginas);
    const gruposPagina = grupos.slice((paginaSegura - 1) * regPorPag, paginaSegura * regPorPag);

    const abiertoPorDefecto = grupos.length <= 4;

    const expandirTodos = () => {
        const nuevo: Record<number, boolean> = {};
        gruposPagina.forEach(g => { nuevo[g.id_usuario] = true; });
        setDocentesAbiertos(prev => ({ ...prev, ...nuevo }));
    };

    const colapsarTodos = () => {
        const nuevo: Record<number, boolean> = {};
        gruposPagina.forEach(g => { nuevo[g.id_usuario] = false; });
        setDocentesAbiertos(prev => ({ ...prev, ...nuevo }));
    };

    const periodoLabel = periodo
        ? `${periodo.anio}-${etiquetaSemestre(periodo.semestre)}`
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

            {/* Resumen interactivo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                    { label: 'Total', value: totalObs, icon: MessageSquare, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', active: !filtroSemana, onClick: () => setFiltroSemana('') },
                    { label: rotularCortes('Corte I · Sem 8', periodo?.semestre), value: obsSem8, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', active: filtroSemana === '8', onClick: () => setFiltroSemana(filtroSemana === '8' ? '' : '8') },
                    { label: rotularCortes('Corte II · Sem 16', periodo?.semestre), value: obsSem16, icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', active: filtroSemana === '16', onClick: () => setFiltroSemana(filtroSemana === '16' ? '' : '16') },
                    { label: 'Docentes', value: docentesUnicos, icon: User, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', active: false, onClick: undefined },
                ].map(m => (
                    <div
                        key={m.label}
                        onClick={m.onClick}
                        className={`bg-white rounded-2xl px-4 py-3 shadow-xs border transition-all ${m.border} flex items-center gap-3 ${
                            m.onClick ? 'cursor-pointer hover:shadow-md hover:border-indigo-300' : ''
                        } ${m.active && m.onClick ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : ''}`}
                    >
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

            {/* Buscador + filtro rápido de corte + alternador de vista */}
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
                        {/* Corte como botones: filtro rápido */}
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

                        {/* Filtro función sustantiva */}
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

                        {/* Alternador de Modo de Vista */}
                        <div className="hidden sm:inline-flex rounded-xl border border-gray-200 p-0.5 bg-gray-50">
                            <button
                                onClick={() => setModoVista('tarjetas')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    modoVista === 'tarjetas'
                                        ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                                        : 'text-gray-500 hover:text-gray-800'
                                }`}
                                title="Vista en tarjetas organizadas"
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                <span>Tarjetas</span>
                            </button>
                            <button
                                onClick={() => setModoVista('lista')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    modoVista === 'lista'
                                        ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                                        : 'text-gray-500 hover:text-gray-800'
                                }`}
                                title="Vista en lista compacta estructurada"
                            >
                                <List className="w-3.5 h-3.5" />
                                <span>Lista</span>
                            </button>
                        </div>

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

            {/* Barra de control de acordeones */}
            {grupos.length > 0 && !loading && (
                <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-xs font-medium text-gray-500">
                        Mostrando <strong className="text-gray-800">{gruposPagina.length}</strong> de {grupos.length} docentes con observaciones
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={expandirTodos}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                        >
                            Expandir todos
                        </button>
                        <span className="text-gray-300">·</span>
                        <button
                            onClick={colapsarTodos}
                            className="text-xs font-semibold text-gray-500 hover:text-gray-700 hover:underline cursor-pointer"
                        >
                            Colapsar todos
                        </button>
                    </div>
                </div>
            )}

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
                <>
                    <div className="space-y-4">
                        {gruposPagina.map(grupo => {
                            const abierto = docentesAbiertos[grupo.id_usuario] ?? abiertoPorDefecto;
                            const subfiltro = filtroCorteDocente[grupo.id_usuario] || '';
                            const observacionesVisibles = grupo.observaciones.filter(o => {
                                if (!subfiltro) return true;
                                return String(o.semana) === subfiltro;
                            });

                            return (
                                <div key={grupo.id_usuario} className="bg-white rounded-2xl shadow-xs border border-gray-200/80 overflow-hidden transition-all">

                                    {/* Cabecera del docente */}
                                    <div className={`flex items-center gap-3 px-4 py-3.5 ${abierto ? 'border-b border-gray-100 bg-slate-50/70' : 'hover:bg-gray-50/50'}`}>
                                        <button
                                            onClick={() => setDocentesAbiertos(prev => ({ ...prev, [grupo.id_usuario]: !abierto }))}
                                            className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer group"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-black flex items-center justify-center shadow-xs shrink-0">
                                                {iniciales(grupo.docente_nombre)}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-extrabold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                                                    {grupo.docente_nombre}
                                                </h3>
                                                <p className="text-xs text-gray-500 font-medium">
                                                    {grupo.observaciones.length} {grupo.observaciones.length === 1 ? 'observación registrada' : 'observaciones registradas'}
                                                </p>
                                            </div>
                                        </button>

                                        <div className="hidden sm:flex items-center gap-2 shrink-0">
                                            {grupo.sem8 > 0 && (
                                                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/80">
                                                    Corte I · {grupo.sem8}
                                                </span>
                                            )}
                                            {grupo.sem16 > 0 && (
                                                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                                                    Corte II · {grupo.sem16}
                                                </span>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => navigate(`/director/agendas/${grupo.id_usuario}`)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200/70 whitespace-nowrap cursor-pointer shrink-0"
                                            title="Abrir la agenda completa de este docente"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span className="hidden md:inline">Ver agenda</span>
                                        </button>

                                        <button
                                            onClick={() => setDocentesAbiertos(prev => ({ ...prev, [grupo.id_usuario]: !abierto }))}
                                            className="w-8 h-8 rounded-lg hover:bg-gray-200/60 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors cursor-pointer shrink-0"
                                            title={abierto ? 'Plegar' : 'Desplegar'}
                                        >
                                            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${abierto ? '' : '-rotate-90'}`} />
                                        </button>
                                    </div>

                                    {/* Observaciones del docente */}
                                    {abierto && (
                                        <div className="p-4 bg-gray-50/40">
                                            {/* Sub-filtro de corte interno cuando tiene de ambos cortes */}
                                            {grupo.sem8 > 0 && grupo.sem16 > 0 && (
                                                <div className="flex items-center gap-1.5 mb-3.5 pb-2.5 border-b border-gray-100">
                                                    <span className="text-xs font-semibold text-gray-500 mr-1">Filtrar:</span>
                                                    <button
                                                        onClick={() => setFiltroCorteDocente(prev => ({ ...prev, [grupo.id_usuario]: '' }))}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                                            !subfiltro
                                                                ? 'bg-indigo-600 text-white shadow-2xs'
                                                                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                                        }`}
                                                    >
                                                        Todas ({grupo.observaciones.length})
                                                    </button>
                                                    <button
                                                        onClick={() => setFiltroCorteDocente(prev => ({ ...prev, [grupo.id_usuario]: '8' }))}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                                            subfiltro === '8'
                                                                ? 'bg-blue-600 text-white shadow-2xs'
                                                                : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
                                                        }`}
                                                    >
                                                        Corte I ({grupo.sem8})
                                                    </button>
                                                    <button
                                                        onClick={() => setFiltroCorteDocente(prev => ({ ...prev, [grupo.id_usuario]: '16' }))}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                                            subfiltro === '16'
                                                                ? 'bg-emerald-600 text-white shadow-2xs'
                                                                : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                                                        }`}
                                                    >
                                                        Corte II ({grupo.sem16})
                                                    </button>
                                                </div>
                                            )}

                                            {/* Contenedor con Scroll vertical si son muchas */}
                                            <div className="max-h-[540px] overflow-y-auto pr-1">
                                                {modoVista === 'tarjetas' ? (
                                                    /* Vista Cuadrícula de Tarjetas */
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                                                        {observacionesVisibles.map(obs => {
                                                            const esCorteI = Number(obs.semana) === 8;
                                                            return (
                                                                <div
                                                                    key={obs.id}
                                                                    className={`bg-white rounded-xl border p-4 flex flex-col justify-between shadow-xs hover:shadow-sm transition-all relative overflow-hidden ${
                                                                        esCorteI
                                                                            ? 'border-blue-200/70 hover:border-blue-300'
                                                                            : 'border-emerald-200/70 hover:border-emerald-300'
                                                                    }`}
                                                                >
                                                                    {/* Borde lateral indicativo de corte */}
                                                                    <div
                                                                        className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                                                                            esCorteI ? 'bg-blue-500' : 'bg-emerald-500'
                                                                        }`}
                                                                    />

                                                                    <div className="pl-1">
                                                                        {/* Encabezado de la tarjeta: Actividad y Corte */}
                                                                        <div className="flex items-start justify-between gap-2 mb-2.5">
                                                                            <div className="min-w-0 flex-1">
                                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                                    <span className="font-extrabold text-sm text-gray-900 truncate">
                                                                                        {obs.rol_seleccionado || 'Actividad sin nombre'}
                                                                                    </span>
                                                                                    {obs.horas_rol != null && (
                                                                                        <span className="px-1.5 py-0.5 text-[11px] font-bold bg-gray-100 text-gray-600 rounded">
                                                                                            {parseFloat(String(obs.horas_rol)).toFixed(0)}h
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                {obs.funcion_sustantiva && (
                                                                                    <div className="flex items-center gap-1 text-[11px] font-medium text-gray-500 mt-0.5">
                                                                                        <BookOpen className="w-3 h-3 text-gray-400 shrink-0" />
                                                                                        <span>{obs.funcion_sustantiva}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg border shrink-0 ${
                                                                                esCorteI
                                                                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                            }`}>
                                                                                {rotularCortes(esCorteI ? 'Corte I · Sem 8' : 'Corte II · Sem 16', periodo?.semestre)}
                                                                            </span>
                                                                        </div>

                                                                        {/* Caja con el texto de la observación */}
                                                                        <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 text-sm text-gray-800 leading-relaxed font-normal mb-3 whitespace-pre-line">
                                                                            {obs.texto}
                                                                        </div>
                                                                    </div>

                                                                    {/* Pie de la tarjeta: Autor y Fecha */}
                                                                    <div className="pl-1 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 gap-2">
                                                                        <div className="flex items-center gap-1.5 truncate">
                                                                            <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[9px] shrink-0">
                                                                                D
                                                                            </div>
                                                                            <span className="truncate">
                                                                                {obs.director_nombre ? formatearNombre(obs.director_nombre) : 'Director'}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1 shrink-0 text-gray-400">
                                                                            <Calendar className="w-3 h-3" />
                                                                            <span>{formatearFecha(obs.ultima_edicion)}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    /* Vista Lista Compacta estructurada */
                                                    <div className="divide-y divide-gray-100 bg-white rounded-xl border border-gray-200/80 overflow-hidden">
                                                        {observacionesVisibles.map(obs => {
                                                            const esCorteI = Number(obs.semana) === 8;
                                                            return (
                                                                <div
                                                                    key={obs.id}
                                                                    className={`p-3.5 hover:bg-gray-50/60 transition-colors border-l-4 ${
                                                                        esCorteI ? 'border-l-blue-500' : 'border-l-emerald-500'
                                                                    }`}
                                                                >
                                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1.5">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                                                                                esCorteI
                                                                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                            }`}>
                                                                                {rotularCortes(esCorteI ? 'Corte I · Sem 8' : 'Corte II · Sem 16', periodo?.semestre)}
                                                                            </span>
                                                                            <span className="font-bold text-xs text-gray-900">
                                                                                {obs.rol_seleccionado || 'Actividad sin nombre'}
                                                                            </span>
                                                                            {obs.horas_rol != null && (
                                                                                <span className="text-[11px] text-gray-500 font-medium">
                                                                                    ({parseFloat(String(obs.horas_rol)).toFixed(0)}h)
                                                                                </span>
                                                                            )}
                                                                            {obs.funcion_sustantiva && (
                                                                                <span className="text-[11px] text-gray-400">
                                                                                    · {obs.funcion_sustantiva}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className="text-[11px] text-gray-400 flex items-center gap-1 shrink-0">
                                                                            <Calendar className="w-3 h-3" />
                                                                            {formatearFecha(obs.ultima_edicion)}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs sm:text-sm text-gray-800 leading-relaxed font-normal whitespace-pre-line pl-0.5">
                                                                        {obs.texto}
                                                                    </p>
                                                                    <div className="mt-1.5 text-[11px] text-gray-400 pl-0.5">
                                                                        Emitida por <span className="text-gray-600 font-medium">{obs.director_nombre ? formatearNombre(obs.director_nombre) : 'Director'}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Paginación */}
                    {grupos.length > 0 && (
                        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>Mostrar</span>
                                <select
                                    value={regPorPag}
                                    onChange={e => { setRegPorPag(Number(e.target.value)); setPaginaActual(1); }}
                                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-indigo-400"
                                >
                                    {[5, 10, 15, 20, 25].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <span>docentes · {grupos.length} total</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                                    disabled={paginaSegura === 1}
                                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
                                >
                                    ‹
                                </button>
                                {Array.from({ length: totalPaginas }, (_, i) => i + 1).filter(p => p === 1 || p === totalPaginas || Math.abs(p - paginaSegura) <= 1).map((p, idx, arr) => (
                                    <span key={p}>
                                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-gray-400">…</span>}
                                        <button
                                            onClick={() => setPaginaActual(p)}
                                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                                                p === paginaSegura
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    </span>
                                ))}
                                <button
                                    onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                                    disabled={paginaSegura === totalPaginas}
                                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
                                >
                                    ›
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </Layout>
    );
}
