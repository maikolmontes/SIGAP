import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import {
    Search, CheckCircle2, AlertTriangle, Pencil, Save, XCircle,
    Clock, ClipboardList, RefreshCw, Info, Lock
} from 'lucide-react';

interface Actividad {
    id_asignacionact: number;
    nombre: string;
    codigo_espacio: string | null;
    grupo: string | null;
    horas_rol: number;
}

interface Funcion {
    id_funciones: number;
    funcion_sustantiva: string;
    horas_funcion: number;
    estado_agenda: string;
    diligenciada: boolean;
    actividades: Actividad[];
}

interface Asignacion {
    id_usuario: number;
    nombre_docente: string;
    correo: string;
    nombre_programa: string;
    tipo_contrato: string;
    horas_contrato: number;
    funciones: Funcion[];
    total_horas: number;
    diferencia: number;
    coincide: boolean;
    estado_carga: string;
}

const iniciales = (nombre: string) =>
    `${nombre?.charAt(0) || ''}${nombre?.split(' ')[1]?.charAt(0) || ''}`;

// ─────────────────────────────────────────────────────────────
// Tarjeta de un docente. En modo lectura muestra el resumen de
// funciones; en modo edición permite corregir las horas de cada
// actividad, con el total recalculándose en vivo.
// ─────────────────────────────────────────────────────────────
function TarjetaAsignacion({
    asignacion,
    puedeEditar,
    onGuardado,
    onError,
}: {
    asignacion: Asignacion;
    puedeEditar: boolean;
    onGuardado: (mensaje: string) => void;
    onError: (mensaje: string) => void;
}) {
    const [editando, setEditando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    // Borrador de horas por actividad: { [id_asignacionact]: valor como texto }
    const [borrador, setBorrador] = useState<Record<number, string>>({});

    const abrirEdicion = () => {
        const inicial: Record<number, string> = {};
        for (const f of asignacion.funciones) {
            for (const a of f.actividades) {
                inicial[a.id_asignacionact] = String(a.horas_rol);
            }
        }
        setBorrador(inicial);
        setEditando(true);
    };

    const cancelar = () => {
        setEditando(false);
        setBorrador({});
    };

    // Total en vivo mientras el director edita
    const totalEditado = useMemo(() => {
        if (!editando) return asignacion.total_horas;
        return Object.values(borrador).reduce((sum, v) => {
            const n = parseFloat(v);
            return sum + (isNaN(n) ? 0 : n);
        }, 0);
    }, [editando, borrador, asignacion.total_horas]);

    const diferenciaEditada = totalEditado - asignacion.horas_contrato;
    const coincideEditado = Math.abs(diferenciaEditada) < 0.001;

    const hayValoresInvalidos = useMemo(
        () => Object.values(borrador).some(v => {
            const n = parseFloat(v);
            return v.trim() === '' || isNaN(n) || n < 0;
        }),
        [borrador]
    );

    const sinActividades = asignacion.funciones.every(f => f.actividades.length === 0);

    const guardar = async () => {
        const actividades = Object.entries(borrador).map(([id, valor]) => ({
            id_asignacionact: Number(id),
            horas_rol: parseFloat(valor),
        }));
        if (actividades.length === 0) return;

        setGuardando(true);
        try {
            const res = await api.put(`/director/asignaciones/${asignacion.id_usuario}`, { actividades });
            setEditando(false);
            setBorrador({});
            onGuardado(
                `Horas de ${asignacion.nombre_docente} actualizadas: ${res.data.total_horas}h de ${res.data.horas_contrato}h.`
            );
        } catch (err: any) {
            onError(err.response?.data?.error || 'No se pudieron guardar las correcciones.');
        } finally {
            setGuardando(false);
        }
    };

    const coincideActual = editando ? coincideEditado : asignacion.coincide;
    const diferenciaActual = editando ? diferenciaEditada : asignacion.diferencia;

    return (
        <div
            className={`bg-white rounded-2xl shadow-sm border transition-all ${
                editando
                    ? 'border-blue-300 ring-2 ring-blue-100 md:col-span-2'
                    : coincideActual
                        ? 'border-gray-100 hover:shadow-md'
                        : 'border-amber-200 hover:shadow-md'
            }`}
        >
            {/* Cabecera */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {iniciales(asignacion.nombre_docente)}
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm leading-tight truncate">{asignacion.nombre_docente}</p>
                        <p className="text-xs text-gray-400 truncate">{asignacion.nombre_programa}</p>
                        <span className="inline-block mt-1 text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold border border-blue-100">
                            {asignacion.tipo_contrato}
                        </span>
                    </div>
                </div>

                {/* Contraste de horas */}
                <div className="text-right shrink-0">
                    <div className={`text-lg font-black leading-none ${coincideActual ? 'text-green-600' : 'text-amber-600'}`}>
                        {totalEditado % 1 === 0 ? totalEditado : totalEditado.toFixed(1)}
                        <span className="text-xs font-bold text-gray-400">/{asignacion.horas_contrato}h</span>
                    </div>
                    <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        coincideActual
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                        {coincideActual
                            ? <><CheckCircle2 className="w-3 h-3" /> Coinciden</>
                            : <><AlertTriangle className="w-3 h-3" />
                                {diferenciaActual > 0
                                    ? `Sobran ${Math.abs(diferenciaActual).toFixed(diferenciaActual % 1 === 0 ? 0 : 1)}h`
                                    : `Faltan ${Math.abs(diferenciaActual).toFixed(diferenciaActual % 1 === 0 ? 0 : 1)}h`}
                              </>
                        }
                    </span>
                </div>
            </div>

            {/* Cuerpo */}
            <div className="px-5 py-4">
                {!editando ? (
                    /* ── MODO LECTURA ── */
                    <ul className="space-y-2">
                        {asignacion.funciones.length === 0 ? (
                            <li className="text-sm text-gray-400 italic text-center py-3">Sin funciones asignadas</li>
                        ) : asignacion.funciones.map(f => (
                            <li key={f.id_funciones} className="flex items-center justify-between gap-3 text-sm">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                    <span className="text-gray-700 truncate">{f.funcion_sustantiva}</span>
                                    {f.diligenciada && (
                                        <span
                                            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0"
                                            title="El docente ya diligenció esta función"
                                        >
                                            DILIGENCIADA
                                        </span>
                                    )}
                                </div>
                                <span className="font-bold text-gray-800 shrink-0">
                                    {f.horas_funcion % 1 === 0 ? f.horas_funcion : f.horas_funcion.toFixed(1)}h
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    /* ── MODO EDICIÓN ── */
                    <div className="space-y-4">
                        {asignacion.funciones.map(f => (
                            <div key={f.id_funciones} className="border border-gray-100 rounded-xl overflow-hidden">
                                <div className="bg-gray-50 px-3 py-2 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-xs font-bold text-gray-700 truncate">{f.funcion_sustantiva}</span>
                                        {f.diligenciada && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                                YA DILIGENCIADA
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs font-bold text-gray-500 shrink-0">
                                        {f.actividades.reduce((s, a) => {
                                            const n = parseFloat(borrador[a.id_asignacionact]);
                                            return s + (isNaN(n) ? 0 : n);
                                        }, 0)}h
                                    </span>
                                </div>

                                {f.actividades.length === 0 ? (
                                    <p className="px-3 py-3 text-xs text-gray-400 italic">
                                        Esta función no tiene actividades cargadas. Planeación debe importarlas.
                                    </p>
                                ) : (
                                    <ul className="divide-y divide-gray-50">
                                        {f.actividades.map(a => {
                                            const valor = borrador[a.id_asignacionact] ?? '';
                                            const invalido = valor.trim() === '' || isNaN(parseFloat(valor)) || parseFloat(valor) < 0;
                                            return (
                                                <li key={a.id_asignacionact} className="flex items-center justify-between gap-3 px-3 py-2">
                                                    <div className="min-w-0">
                                                        <p className="text-xs text-gray-700 truncate">{a.nombre}</p>
                                                        {(a.codigo_espacio || a.grupo) && (
                                                            <p className="text-[10px] text-gray-400 truncate">
                                                                {[a.codigo_espacio, a.grupo].filter(Boolean).join(' · ')}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={60}
                                                            step={0.5}
                                                            value={valor}
                                                            onChange={(e) => setBorrador(prev => ({
                                                                ...prev,
                                                                [a.id_asignacionact]: e.target.value
                                                            }))}
                                                            className={`w-20 text-right border rounded-lg px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-1 ${
                                                                invalido
                                                                    ? 'border-red-300 focus:border-red-400 focus:ring-red-100 bg-red-50'
                                                                    : 'border-gray-200 focus:border-blue-400 focus:ring-blue-100'
                                                            }`}
                                                        />
                                                        <span className="text-xs text-gray-400 font-medium">h</span>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        ))}

                        {/* Resumen en vivo */}
                        <div className={`rounded-xl px-4 py-3 flex items-center justify-between gap-3 border ${
                            coincideEditado
                                ? 'bg-green-50 border-green-200'
                                : 'bg-amber-50 border-amber-200'
                        }`}>
                            <div className="flex items-center gap-2">
                                {coincideEditado
                                    ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                                    : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                }
                                <span className={`text-xs font-bold ${coincideEditado ? 'text-green-800' : 'text-amber-800'}`}>
                                    {coincideEditado
                                        ? 'Las horas coinciden con el contrato'
                                        : diferenciaEditada > 0
                                            ? `Sobran ${Math.abs(diferenciaEditada).toFixed(1)}h sobre el contrato`
                                            : `Faltan ${Math.abs(diferenciaEditada).toFixed(1)}h para completar el contrato`}
                                </span>
                            </div>
                            <span className={`text-sm font-black shrink-0 ${coincideEditado ? 'text-green-700' : 'text-amber-700'}`}>
                                {totalEditado % 1 === 0 ? totalEditado : totalEditado.toFixed(1)}/{asignacion.horas_contrato}h
                            </span>
                        </div>

                        {asignacion.funciones.some(f => f.diligenciada) && (
                            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
                                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                Este docente ya diligenció parte de su agenda. Si cambias las horas, revisa con él que sus
                                metas e indicadores sigan teniendo sentido.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Acciones */}
            <div className="px-5 py-3 bg-gray-50/70 border-t border-gray-100 flex justify-end gap-2">
                {!editando ? (
                    puedeEditar ? (
                        <button
                            onClick={abrirEdicion}
                            disabled={sinActividades}
                            title={sinActividades ? 'Este docente no tiene actividades que corregir' : 'Corregir las horas de las actividades'}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            Corregir horas
                        </button>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                            <Lock className="w-3.5 h-3.5" />
                            Solo lectura
                        </span>
                    )
                ) : (
                    <>
                        <button
                            onClick={cancelar}
                            disabled={guardando}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-600 text-xs font-bold rounded-lg transition-colors"
                        >
                            <XCircle className="w-3.5 h-3.5" />
                            Cancelar
                        </button>
                        <button
                            onClick={guardar}
                            disabled={guardando || hayValoresInvalidos}
                            title={hayValoresInvalidos ? 'Hay horas vacías o inválidas' : 'Guardar las correcciones'}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                        >
                            {guardando
                                ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <Save className="w-3.5 h-3.5" />
                            }
                            {guardando ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Listado de asignaciones cargadas por Planeación.
// El Director no aprueba ni rechaza: solo corrige las horas
// cuando la importación trajo algo mal.
// ─────────────────────────────────────────────────────────────
export default function AsignacionesPorCorregir({ puedeEditar = true }: { puedeEditar?: boolean }) {
    const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
    const [periodo, setPeriodo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [soloInconsistentes, setSoloInconsistentes] = useState(false);
    const [toast, setToast] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/director/asignaciones');
            setAsignaciones(res.data.asignaciones || []);
            setPeriodo(res.data.periodo || null);
        } catch (e) {
            console.error('Error cargando asignaciones:', e);
            setToast({ tipo: 'error', mensaje: 'No se pudieron cargar las asignaciones.' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 5000);
        return () => clearTimeout(t);
    }, [toast]);

    const filtradas = asignaciones.filter(a => {
        const coincideBusqueda =
            a.nombre_docente.toLowerCase().includes(busqueda.toLowerCase()) ||
            a.nombre_programa?.toLowerCase().includes(busqueda.toLowerCase()) ||
            a.correo?.toLowerCase().includes(busqueda.toLowerCase());
        if (soloInconsistentes) return coincideBusqueda && !a.coincide;
        return coincideBusqueda;
    }).sort((a, b) => (a.nombre_docente || '').localeCompare(b.nombre_docente || '', 'es', { sensitivity: 'base' }));

    const totalInconsistentes = asignaciones.filter(a => !a.coincide).length;
    const totalCorrectas = asignaciones.length - totalInconsistentes;

    const manejarGuardado = (mensaje: string) => {
        setToast({ tipo: 'exito', mensaje });
        cargar();
    };

    return (
        <div>
            {/* Aviso de flujo */}
            <div className="mb-5 flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 leading-relaxed">
                    Estas son las asignaciones que <strong>Planeación</strong> cargó desde Excel. Ya están visibles para
                    los docentes. Si alguna quedó con las horas mal, corrígelas aquí — no requieren tu aprobación.
                </p>
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Docentes con asignación', value: asignaciones.length, icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                    { label: 'Horas correctas', value: totalCorrectas, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
                    { label: 'Requieren corrección', value: totalInconsistentes, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
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

            {/* Búsqueda y filtros */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-5">
                <div className="relative flex-1 max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar docente o programa..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSoloInconsistentes(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                            soloInconsistentes
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Solo con inconsistencias
                    </button>
                    <button
                        onClick={cargar}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </button>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className={`mb-5 flex items-start gap-2.5 rounded-xl px-4 py-3 border ${
                    toast.tipo === 'exito'
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    {toast.tipo === 'exito'
                        ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    }
                    <p className="text-xs font-semibold leading-relaxed flex-1">{toast.mensaje}</p>
                    <button onClick={() => setToast(null)} className="text-current opacity-50 hover:opacity-100 shrink-0">✕</button>
                </div>
            )}

            {/* Tarjetas */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                </div>
            ) : !periodo ? (
                <div className="text-center py-16 text-gray-400">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No hay un período académico activo</p>
                    <p className="text-sm mt-1">Planeación debe abrir un período para cargar asignaciones.</p>
                </div>
            ) : filtradas.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">
                        {asignaciones.length === 0
                            ? 'Aún no hay asignaciones cargadas'
                            : soloInconsistentes
                                ? 'Ninguna asignación tiene inconsistencias'
                                : 'No se encontraron docentes'}
                    </p>
                    <p className="text-sm mt-1">
                        {asignaciones.length === 0
                            ? 'Planeación debe importar el Excel de asignaciones.'
                            : 'Ajusta la búsqueda o los filtros.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {filtradas.map(a => (
                        <TarjetaAsignacion
                            key={a.id_usuario}
                            asignacion={a}
                            puedeEditar={puedeEditar}
                            onGuardado={manejarGuardado}
                            onError={(m) => setToast({ tipo: 'error', mensaje: m })}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
