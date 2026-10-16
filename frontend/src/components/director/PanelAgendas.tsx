import { useState, useEffect, useCallback, useMemo } from 'react';

import api from '../../services/api';
import { agendaDiligenciada } from './agendaDiligenciada';
import { Info, Clock, ClipboardList, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BarraConsulta, { CampoFiltro } from './BarraConsulta';
import { CLASE_SELECT, useVistaAgendas } from './vistaAgendas';

const badgeEstado = (estado: string) => {
    switch (estado) {
        case 'Aprobada':  return 'bg-green-100 text-green-700 border-green-200';
        case 'Aceptado':  return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'Parcial':   return 'bg-violet-100 text-violet-700 border-violet-200';
        case 'Devuelta':  return 'bg-orange-100 text-orange-700 border-orange-200';
        default:          return 'bg-gray-100 text-gray-600 border-gray-200';
    }
};

const iniciales = (nombre: string) =>
    `${nombre?.charAt(0) || ''}${nombre?.split(' ')[1]?.charAt(0) || ''}`;

// ─────────────────────────────────────────────────────────────
// Agendas — tarjetas de los docentes que ya completaron su agenda.
// Se usa como pestaña dentro de "Agendas por Revisar".
// Cada tarjeta abre la revisión de la agenda (aprobar, devolver y observaciones).
// ─────────────────────────────────────────────────────────────
export default function PanelAgendas() {
    const navigate = useNavigate();
    const [agendas, setAgendas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroPrograma, setFiltroPrograma] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');
    const [filtroContrato, setFiltroContrato] = useState('');
    const [vista, setVista] = useVistaAgendas();
    const [paginaActual, setPaginaActual] = useState(1);
    const [regPorPag, setRegPorPag] = useState(10);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/director/agendas');
            setAgendas(res.data.agendas || []);
        } catch (e) {
            console.error('Error cargando agendas completadas:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    // Solo las que el docente ya terminó de diligenciar. Mismo criterio que
    // usan los cortes 8 y 16, para que los tres paneles muestren los mismos
    // docentes.
    const completadas = useMemo(() => agendas.filter(agendaDiligenciada), [agendas]);

    const programas = useMemo(
        () => [...new Set(completadas.map(a => a.nombre_programa).filter(Boolean))].sort(),
        [completadas]
    );

    const contratos = useMemo(
        () => [...new Set(completadas.map(a => a.tipo_contrato).filter(Boolean))].sort(),
        [completadas]
    );

    const filtradas = useMemo(() => completadas.filter(a => {
        const q = busqueda.toLowerCase().trim();
        const coincide = !q
            || a.nombre_docente?.toLowerCase().includes(q)
            || a.nombre_programa?.toLowerCase().includes(q)
            || a.correo?.toLowerCase().includes(q);
        const delPrograma = !filtroPrograma || a.nombre_programa === filtroPrograma;
        const delEstado = !filtroEstado || a.estado_general === filtroEstado;
        const delContrato = !filtroContrato || a.tipo_contrato === filtroContrato;
        return coincide && delPrograma && delEstado && delContrato;
    }), [completadas, busqueda, filtroPrograma, filtroEstado, filtroContrato]);

    const hayFiltros = !!(filtroPrograma || filtroEstado || filtroContrato);
    const limpiarFiltros = () => { setFiltroPrograma(''); setFiltroEstado(''); setFiltroContrato(''); setPaginaActual(1); };
    const revisar = (id: number) => navigate(`/director/agendas/${id}`, { state: { tab: 'agendas' } });

    const totalPaginas = Math.max(1, Math.ceil(filtradas.length / regPorPag));
    const paginaSegura = Math.min(paginaActual, totalPaginas);
    const filtPagina = filtradas.slice((paginaSegura - 1) * regPorPag, paginaSegura * regPorPag);

    return (
        <div>

            <div className="mb-5 flex items-start gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-700 leading-relaxed">
                    Docentes de tus programas que ya aceptaron <strong>todas</strong> sus funciones.
                    Haz clic en una tarjeta para revisar su agenda: ahí puedes aprobarla, devolverla con observaciones o dejar observaciones por actividad.
                </p>
            </div>

            <BarraConsulta
                busqueda={busqueda}
                onBusqueda={(v) => { setBusqueda(v); setPaginaActual(1); }}
                vista={vista}
                onVista={setVista}
                hayFiltros={hayFiltros}
                onLimpiar={limpiarFiltros}
                cargando={loading}
                onActualizar={cargar}
            >
                <CampoFiltro etiqueta="Programa">
                    <select value={filtroPrograma} onChange={e => { setFiltroPrograma(e.target.value); setPaginaActual(1); }} className={CLASE_SELECT}>
                        <option value="">Todos los programas</option>
                        {programas.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </CampoFiltro>
                <CampoFiltro etiqueta="Estado de la agenda">
                    <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPaginaActual(1); }} className={CLASE_SELECT}>
                        <option value="">Todos</option>
                        <option value="Aceptado">Aceptada (por revisar)</option>
                        <option value="Parcial">Revisión parcial</option>
                        <option value="Aprobada">Aprobada</option>
                    </select>
                </CampoFiltro>
                <CampoFiltro etiqueta="Contrato">
                    <select value={filtroContrato} onChange={e => { setFiltroContrato(e.target.value); setPaginaActual(1); }} className={CLASE_SELECT}>
                        <option value="">Todos los contratos</option>
                        {contratos.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </CampoFiltro>
            </BarraConsulta>

            {/* Tarjetas */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                </div>
            ) : filtradas.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">
                        {completadas.length === 0
                            ? 'Ningún docente ha completado su agenda todavía'
                            : 'No hay agendas con esos filtros'}
                    </p>
                    {completadas.length === 0 && (
                        <p className="text-sm mt-1">
                            Aparecerán aquí cuando acepten todas sus funciones.
                        </p>
                    )}
                </div>
            ) : (
                <>
                    {vista === 'tarjetas' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {filtPagina.map(a => {
                            const cuadra = Math.round(a.total_horas) === Math.round(a.horas_contrato);
                            return (
                                <button
                                    key={a.id_usuario}
                                    onClick={() => navigate(`/director/agendas/${a.id_usuario}`, { state: { tab: 'agendas' } })}
                                    className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 transition-all text-left overflow-hidden group"
                                >
                                    <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                                {iniciales(a.nombre_docente)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-900 text-sm leading-tight truncate group-hover:text-blue-700 transition-colors">
                                                    {a.nombre_docente}
                                                </p>
                                                <p className="text-xs text-gray-400 truncate">{a.nombre_programa}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badgeEstado(a.estado_general)}`}>
                                            {a.estado_general}
                                        </span>
                                    </div>

                                    <div className="px-5 py-4">
                                        <ul className="space-y-1.5">
                                            {(a.funciones || []).map((f: any) => (
                                                <li key={f.id_funciones} className="flex items-center justify-between gap-2 text-sm">
                                                    <span className="flex items-center gap-2 min-w-0">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                                        <span className="text-gray-700 truncate">{f.funcion_sustantiva}</span>
                                                    </span>
                                                    <span className="font-bold text-gray-800 shrink-0">
                                                        {Math.round(f.horas_funcion)}h
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="px-5 py-3 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between">
                                        <span className="text-xs text-gray-500 flex items-center gap-1.5">
                                            <ClipboardList className="w-3.5 h-3.5" />
                                            {a.tipo_contrato}
                                        </span>
                                        <span className={`text-sm font-black ${cuadra ? 'text-green-600' : 'text-amber-600'}`}>
                                            {Math.round(a.total_horas)}
                                            <span className="text-xs text-gray-400 font-bold">/{a.horas_contrato}h</span>
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                                <tr>
                                    <th className="px-5 py-3 text-left font-bold">Docente</th>
                                    <th className="px-5 py-3 text-left font-bold">Programa</th>
                                    <th className="px-5 py-3 text-left font-bold">Contrato</th>
                                    <th className="px-5 py-3 text-center font-bold">Horas</th>
                                    <th className="px-5 py-3 text-center font-bold">Estado</th>
                                    <th className="px-5 py-3 text-center font-bold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtPagina.map(a => {
                                    const cuadra = Math.round(a.total_horas) === Math.round(a.horas_contrato);
                                    return (
                                        <tr key={a.id_usuario} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                        {iniciales(a.nombre_docente)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-900 text-sm truncate">{a.nombre_docente}</p>
                                                        <p className="text-xs text-gray-400 truncate">{a.correo}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-sm text-gray-600">{a.nombre_programa}</td>
                                            <td className="px-5 py-3 text-sm text-gray-600">{a.tipo_contrato}</td>
                                            <td className={`px-5 py-3 text-center text-sm font-black ${cuadra ? 'text-green-600' : 'text-amber-600'}`}>
                                                {Math.round(a.total_horas)}<span className="text-xs text-gray-400 font-bold">/{a.horas_contrato}h</span>
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeEstado(a.estado_general)}`}>{a.estado_general}</span>
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <button
                                                    onClick={() => revisar(a.id_usuario)}
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                                                >
                                                    <Eye className="w-3.5 h-3.5" /> Revisar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    )}

                    {/* Paginación */}
                    {filtradas.length > 0 && (
                        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>Mostrar</span>
                                <select value={regPorPag} onChange={e => { setRegPorPag(Number(e.target.value)); setPaginaActual(1); }}
                                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-400">
                                    {[5, 10, 15, 20, 25].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <span>registros · {filtradas.length} total</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setPaginaActual(p => Math.max(1, p - 1))} disabled={paginaSegura === 1}
                                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">‹</button>
                                {Array.from({ length: totalPaginas }, (_, i) => i + 1).filter(p => p === 1 || p === totalPaginas || Math.abs(p - paginaSegura) <= 1).map((p, idx, arr) => (
                                    <span key={p}>
                                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-gray-400">…</span>}
                                        <button onClick={() => setPaginaActual(p)}
                                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${p === paginaSegura ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}>{p}</button>
                                    </span>
                                ))}
                                <button onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))} disabled={paginaSegura === totalPaginas}
                                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">›</button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
