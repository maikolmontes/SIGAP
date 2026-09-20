import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/common/Layout';
import api from '../../services/api';
import { Search, Eye, Clock, CheckCircle2, AlertTriangle, ClipboardList, RefreshCw } from 'lucide-react';

const badgeEstado = (estado: string) => {
    switch (estado) {
        case 'Aprobada':  return 'bg-green-100 text-green-700';
        case 'Aceptado':  return 'bg-blue-100 text-blue-700';
        case 'Parcial':   return 'bg-violet-100 text-violet-700';
        case 'Devuelta':  return 'bg-orange-100 text-orange-700';
        case 'Pendiente': return 'bg-red-100 text-red-700';
        default:          return 'bg-gray-100 text-gray-600';
    }
};

const leerRolActivo = () => {
    try {
        const stored = localStorage.getItem('sigap_active_role');
        if (stored) {
            const p = JSON.parse(stored);
            return { nombre: p.nombre_rol || 'Revisión', funciones: p.funciones_revisa || [] };
        }
    } catch { /* sin rol guardado */ }
    return { nombre: 'Revisión', funciones: [] as string[] };
};

// ─────────────────────────────────────────────────────────────
// Bandeja de trabajo del revisor de una función sustantiva.
// Lista solo docentes que tienen su función y prioriza los que
// ya diligenciaron y están esperando decisión.
// ─────────────────────────────────────────────────────────────
export default function AgendasRevision() {
    const [agendas, setAgendas] = useState<any[]>([]);
    const [periodo, setPeriodo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroPrograma, setFiltroPrograma] = useState('');
    const [soloPendientes, setSoloPendientes] = useState(false);
    const navigate = useNavigate();

    const { nombre: rolLabel, funciones } = useMemo(leerRolActivo, []);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/director/agendas');
            setAgendas(res.data.agendas || []);
            setPeriodo(res.data.periodo || null);
        } catch (e) {
            console.error('Error cargando agendas:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const programas = useMemo(
        () => [...new Set(agendas.map(a => a.nombre_programa).filter(Boolean))].sort(),
        [agendas]
    );

    const pendiente = (a: any) => ['Pendiente', 'Aceptado', 'Devuelta', 'Parcial'].includes(a.estado_mi_revision);

    const filtradas = agendas.filter(a => {
        const coincide = a.nombre_docente?.toLowerCase().includes(busqueda.toLowerCase())
            || a.correo?.toLowerCase().includes(busqueda.toLowerCase());
        const delPrograma = !filtroPrograma || a.nombre_programa === filtroPrograma;
        return coincide && delPrograma && (!soloPendientes || pendiente(a));
    });

    const periodoLabel = periodo
        ? `${periodo.anio}-${periodo.semestre === 1 ? 'I' : 'II'}`
        : 'Sin periodo';

    const totalPorRevisar = agendas.filter(pendiente).length;
    const totalAprobadas = agendas.filter(a => a.estado_mi_revision === 'Aprobada').length;

    return (
        <Layout rol="revision" path="Supervisión / Agendas por Revisar">
            <div className="mb-6">
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Agendas por Revisar</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Periodo: {periodoLabel} · Revisas <strong>{funciones.join(', ') || 'tu función'}</strong> como {rolLabel}
                </p>
            </div>

            {/* Aviso de alcance */}
            <div className="mb-5 flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <ClipboardList className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 leading-relaxed">
                    Solo ves y apruebas <strong>{funciones.join(', ') || 'tu función'}</strong>. Las demás funciones
                    de cada agenda las revisa su propio responsable y no se muestran aquí.
                </p>
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Docentes a mi cargo', value: agendas.length, icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                    { label: 'Por revisar', value: totalPorRevisar, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
                    { label: 'Aprobadas por mí', value: totalAprobadas, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
                ].map(m => (
                    <div key={m.label} className={`bg-white rounded-2xl p-4 shadow-sm border ${m.border}`}>
                        <div className={`w-9 h-9 ${m.bg} rounded-xl flex items-center justify-center mb-2`}>
                            <m.icon className={`w-4 h-4 ${m.color}`} />
                        </div>
                        <div className="text-2xl font-black text-gray-800">{m.value}</div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{m.label}</div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div className="relative flex-1 max-w-md w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar docente..."
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                        />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={filtroPrograma}
                            onChange={e => setFiltroPrograma(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-400"
                        >
                            <option value="">Todos los programas</option>
                            {programas.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <button
                            onClick={() => setSoloPendientes(v => !v)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                                soloPendientes
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            <AlertTriangle className="w-3.5 h-3.5" /> Solo por revisar
                        </button>
                        <button
                            onClick={cargar}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                        </div>
                    ) : filtradas.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">
                                {agendas.length === 0
                                    ? 'Ningún docente tiene asignada tu función en este periodo'
                                    : 'No hay agendas con esos filtros'}
                            </p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                                <tr>
                                    <th className="px-5 py-3 text-left font-bold">Docente</th>
                                    <th className="px-5 py-3 text-left font-bold">Programa</th>
                                    {/* El nombre sale del rol activo: con otro revisor dirá "Horas Docencia", etc. */}
                                    <th className="px-5 py-3 text-center font-bold">Horas {funciones.join(' / ') || 'de mi función'}</th>
                                    <th className="px-5 py-3 text-center font-bold">Mi revisión</th>
                                    <th className="px-5 py-3 text-center font-bold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtradas.map(a => {
                                    const mias = (a.funciones || []).filter((f: any) => f.en_alcance);
                                    const horasMias = mias.reduce((s: number, f: any) => s + (f.horas_funcion || 0), 0);
                                    return (
                                        <tr key={a.id_usuario} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                        {a.nombre_docente?.charAt(0)}{a.nombre_docente?.split(' ')[1]?.charAt(0) || ''}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-900 text-sm">{a.nombre_docente}</p>
                                                        <p className="text-xs text-gray-400">{a.tipo_contrato}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-sm text-gray-600">{a.nombre_programa}</td>
                                            <td className="px-5 py-3.5 text-center">
                                                <span className="font-bold text-blue-700">{horasMias}h</span>
                                                <div className="text-[10px] text-gray-400">
                                                    {mias.map((f: any) => f.funcion_sustantiva).join(', ')}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${badgeEstado(a.estado_mi_revision)}`}>
                                                    {a.estado_mi_revision}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <button
                                                    onClick={() => navigate(`/revision/agendas/${a.id_usuario}`)}
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
                    )}
                </div>
            </div>
        </Layout>
    );
}
