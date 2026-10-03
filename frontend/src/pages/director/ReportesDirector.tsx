import { useState, useEffect, useMemo } from 'react';
import Layout from '../../components/common/Layout';
import api from '../../services/api';
import {
    BarChart3, PieChart as PieChartIcon, TrendingUp, Users, RefreshCw,
    Search, X, Filter
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#6366f1'];

export default function ReportesDirector() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [busquedaPrograma, setBusquedaPrograma] = useState('');
    const [filtroAprobacion, setFiltroAprobacion] = useState<'todos' | 'alto' | 'medio' | 'bajo'>('todos');
    const [paginaActual, setPaginaActual] = useState(1);
    const [regPorPag, setRegPorPag] = useState(10);

    const cargarReportes = async () => {
        setLoading(true);
        try {
            const res = await api.get('/director/reportes/resumen');
            setData(res.data);
        } catch (e) {
            console.error('Error cargando reportes:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarReportes();
    }, []);

    const { periodo, estadisticas_programa, distribucion_perfiles, avance_por_bloque, totales } = data || {};
    const periodoLabel = periodo ? `${periodo.anio}-${periodo.semestre === 1 ? 'I' : 'II'}` : '';

    // Filtrado y paginación de la tabla de programas
    const programasFiltrados = useMemo(() => {
        const list = estadisticas_programa || [];
        const q = busquedaPrograma.toLowerCase().trim();
        return list.filter((ep: any) => {
            const coincide = !q || (ep.nombre_programa || '').toLowerCase().includes(q);
            if (!coincide) return false;

            if (filtroAprobacion === 'todos') return true;
            const total = parseInt(ep.total_docentes) || 1;
            const aprobadas = parseInt(ep.agendas_aprobadas) || 0;
            const pct = Math.round((aprobadas / total) * 100);

            if (filtroAprobacion === 'alto') return pct >= 80;
            if (filtroAprobacion === 'medio') return pct >= 50 && pct < 80;
            if (filtroAprobacion === 'bajo') return pct < 50;
            return true;
        });
    }, [estadisticas_programa, busquedaPrograma, filtroAprobacion]);

    const totalPaginas = Math.max(1, Math.ceil(programasFiltrados.length / regPorPag));
    const paginaSegura = Math.min(paginaActual, totalPaginas);
    const inicio = (paginaSegura - 1) * regPorPag;
    const programasPagina = programasFiltrados.slice(inicio, inicio + regPorPag);

    if (loading) {
        return (
            <Layout rol="director" path="Reportes">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full" />
                </div>
            </Layout>
        );
    }

    if (!data || !data.periodo) {
        return (
            <Layout rol="director" path="Reportes">
                <div className="text-center py-16 text-gray-400">
                    <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No hay período activo</p>
                    <p className="text-sm mt-1">Se requiere un período activo para generar reportes.</p>
                </div>
            </Layout>
        );
    }

    // Datos para gráfico de torta de estados
    const datosEstados = [
        { name: 'Aprobadas', value: parseInt(totales.docentes_aprobados) || 0 },
        { name: 'Devueltas', value: parseInt(totales.docentes_devueltos) || 0 },
        { name: 'Pendientes', value: parseInt(totales.docentes_pendientes) || 0 },
    ].filter(d => d.value > 0);
    const coloresEstados = ['#10b981', '#ef4444', '#f59e0b'];

    // Datos de perfiles para bar chart
    const datosPerfiles = (distribucion_perfiles || []).map((p: any) => ({
        perfil: p.perfil.length > 25 ? p.perfil.substring(0, 22) + '...' : p.perfil,
        perfilCompleto: p.perfil,
        cantidad: p.cantidad
    }));

    // Datos de avance por bloque para bar chart comparativo
    const datosAvance = (avance_por_bloque || []).map((b: any) => ({
        bloque: b.bloque.length > 15 ? b.bloque.substring(0, 12) + '...' : b.bloque,
        bloqueCompleto: b.bloque,
        'Logro Parcial (Sem 8)': Math.round(b.logro_parcial * 100),
        'Logro Final': Math.round(b.logro_final * 100),
    }));

    return (
        <Layout rol="director" path="Reportes / Resumen">
            {/* Encabezado */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-blue-500" />
                        Reportes del Director
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Periodo: {periodoLabel} · Estadísticas generales</p>
                </div>
                <button
                    onClick={cargarReportes}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium rounded-xl transition-colors border border-blue-200 cursor-pointer"
                >
                    <RefreshCw className="w-4 h-4" /> Actualizar
                </button>
            </div>

            {/* Tarjetas totales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
                {[
                    { label: 'Total Docentes', value: totales.total_docentes || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Aprobadas', value: totales.docentes_aprobados || 0, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'Devueltas', value: totales.docentes_devueltos || 0, icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'Pendientes', value: totales.docentes_pendientes || 0, icon: TrendingUp, color: 'text-yellow-600', bg: 'bg-yellow-50' },
                ].map(m => (
                    <div key={m.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                        <div className={`w-10 h-10 ${m.bg} rounded-xl flex items-center justify-center mb-3`}>
                            <m.icon className={`w-5 h-5 ${m.color}`} />
                        </div>
                        <div className="text-2xl font-black text-gray-800">{m.value}</div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-0.5">{m.label}</div>
                    </div>
                ))}
            </div>

            {/* Gráficos en grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-7">

                {/* Gráfico: Docentes por Perfil Docente */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-blue-500" /> Docentes por Perfil Docente
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">Distribución según Acuerdo 030/2024</p>
                    {datosPerfiles.length > 0 ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={datosPerfiles} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis type="number" tick={{ fontSize: 11 }} />
                                    <YAxis dataKey="perfil" type="category" width={130} tick={{ fontSize: 10 }} />
                                    <Tooltip
                                        formatter={(v: any, _: any, props: any) => [v, props.payload.perfilCompleto]}
                                        contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)' }}
                                    />
                                    <Bar dataKey="cantidad" radius={[0, 6, 6, 0]}>
                                        {datosPerfiles.map((_: any, i: number) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Sin datos</div>
                    )}
                </div>

                {/* Gráfico: Estado de agendas (pie) */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                        <PieChartIcon className="w-4 h-4 text-purple-500" /> Estado de Agendas
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">% agendas aprobadas, devueltas y pendientes</p>
                    {datosEstados.length > 0 ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={datosEstados}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={85}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                    >
                                        {datosEstados.map((_, i) => (
                                            <Cell key={i} fill={coloresEstados[i % coloresEstados.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Sin datos</div>
                    )}
                </div>
            </div>

            {/* Gráfico de avance por bloque */}
            {datosAvance.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-7">
                    <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-500" /> Logro Parcial vs Logro Final por Bloque
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">Semana 8 (parcial) vs Semana 8+16 (final) — promedios globales</p>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={datosAvance} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="bloque" tick={{ fontSize: 10 }} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                                <Tooltip
                                    formatter={(v: any) => `${v}%`}
                                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.1)' }}
                                />
                                <Legend />
                                <Bar dataKey="Logro Parcial (Sem 8)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Logro Final" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Tabla de estadísticas por programa */}
            {estadisticas_programa && estadisticas_programa.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                <Users className="w-4 h-4 text-indigo-500" /> Estadísticas por Programa
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {programasFiltrados.length} de {estadisticas_programa.length} programas
                            </p>
                        </div>

                        {/* Filtros y búsqueda */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar programa..."
                                    value={busquedaPrograma}
                                    onChange={(e) => { setBusquedaPrograma(e.target.value); setPaginaActual(1); }}
                                    className="pl-8 pr-7 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-indigo-400 w-44"
                                />
                                {busquedaPrograma && (
                                    <button
                                        onClick={() => { setBusquedaPrograma(''); setPaginaActual(1); }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                                {[
                                    { valor: 'todos', texto: 'Todos' },
                                    { valor: 'alto', texto: '≥80%' },
                                    { valor: 'medio', texto: '50-79%' },
                                    { valor: 'bajo', texto: '<50%' },
                                ].map(op => (
                                    <button
                                        key={op.valor}
                                        onClick={() => { setFiltroAprobacion(op.valor as any); setPaginaActual(1); }}
                                        className={`px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                                            filtroAprobacion === op.valor
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        {op.texto}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Contenedor con Scroll vertical delimitado y sticky header */}
                    <div className="overflow-x-auto overflow-y-auto max-h-[440px]">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100 shadow-2xs">
                                <tr>
                                    <th className="px-5 py-3 text-left font-bold">Programa</th>
                                    <th className="px-5 py-3 text-center font-bold">Docentes</th>
                                    <th className="px-5 py-3 text-center font-bold">Prom. H. Directas</th>
                                    <th className="px-5 py-3 text-center font-bold">Aprobadas</th>
                                    <th className="px-5 py-3 text-center font-bold">Devueltas</th>
                                    <th className="px-5 py-3 text-center font-bold">Pendientes</th>
                                    <th className="px-5 py-3 text-center font-bold">% Aprobación</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {programasPagina.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-8 text-center text-gray-400 text-xs">
                                            No se encontraron programas que coincidan con la búsqueda.
                                        </td>
                                    </tr>
                                ) : (
                                    programasPagina.map((ep: any, i: number) => {
                                        const total = parseInt(ep.total_docentes) || 1;
                                        const aprobadas = parseInt(ep.agendas_aprobadas) || 0;
                                        const pct = Math.round((aprobadas / total) * 100);

                                        return (
                                            <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="px-5 py-3.5 font-medium text-gray-900">{ep.nombre_programa}</td>
                                                <td className="px-5 py-3.5 text-center font-bold text-gray-700">{ep.total_docentes}</td>
                                                <td className="px-5 py-3.5 text-center text-gray-600">{parseFloat(ep.promedio_horas_directas).toFixed(1)}h</td>
                                                <td className="px-5 py-3.5 text-center">
                                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">{ep.agendas_aprobadas}</span>
                                                </td>
                                                <td className="px-5 py-3.5 text-center">
                                                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">{ep.agendas_devueltas}</span>
                                                </td>
                                                <td className="px-5 py-3.5 text-center">
                                                    <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs font-bold">{ep.agendas_pendientes}</span>
                                                </td>
                                                <td className="px-5 py-3.5 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <div className="w-16 bg-gray-100 rounded-full h-2 overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all"
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-600">{pct}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginación */}
                    {programasFiltrados.length > 0 && (
                        <div className="px-5 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>Mostrar</span>
                                <select
                                    value={regPorPag}
                                    onChange={e => { setRegPorPag(Number(e.target.value)); setPaginaActual(1); }}
                                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-indigo-400"
                                >
                                    {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <span>programas · {programasFiltrados.length} total</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                                    disabled={paginaSegura === 1}
                                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    ‹
                                </button>
                                {Array.from({ length: totalPaginas }, (_, i) => i + 1).filter(p => p === 1 || p === totalPaginas || Math.abs(p - paginaSegura) <= 1).map((p, idx, arr) => (
                                    <span key={p}>
                                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-gray-400">…</span>}
                                        <button
                                            onClick={() => setPaginaActual(p)}
                                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                                                p === paginaSegura ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    </span>
                                ))}
                                <button
                                    onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                                    disabled={paginaSegura === totalPaginas}
                                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    ›
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Layout>
    );
}
