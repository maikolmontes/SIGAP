import { useState, useEffect } from 'react';
import Layout from '../../components/common/Layout';
import { BookOpen, ClipboardList, Target, Flag, Plus, Trash2, Save, CheckCircle2, AlertTriangle, Clock, Lock, CalendarX, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getPeriodoActivo } from '../../services/periodosService';

interface Indicador {
    id: string;
    nombre_indicador: string;
}

interface Actividad {
    id: string | number;
    idEspacioAcademico: number | '';
    actividadLibre: string;
    horasActividad: number | '';
    resultadoEsperado: string;
    meta: number | '';
    indicadores: Indicador[];
    semestre?: string;
    grupo?: string;
    nombreEspacio?: string;
}

interface FuncionBloque {
    id: string | number;
    funcionSustantiva: string;
    horasFuncion: number | '';
    estadoAgenda: string;
    actividades: Actividad[];
}

// Orden en que se presentan las funciones: Docencia Directa, luego Docencia Indirecta y después
// las demás en el orden en que llegan de la base (sort estable: no mueve las que empatan).
const PRIORIDAD_FUNCION: Record<string, number> = { 'Docencia Directa': 0, 'Docencia Indirecta': 1 };
const ordenarFunciones = <T extends { funcionSustantiva: string }>(lista: T[]): T[] =>
    [...lista].sort((a, b) => (PRIORIDAD_FUNCION[a.funcionSustantiva] ?? 2) - (PRIORIDAD_FUNCION[b.funcionSustantiva] ?? 2));

// La meta que escribe el docente es un número de entregas, no un porcentaje: de 0 a 20
const META_MAXIMA = 20;

// Si el docente marca "No volver a mostrar", se guarda en este navegador
const CLAVE_AVISO_INICIO = 'sigap_aviso_agenda_visto';

export default function AgendaDocente() {
    const { user } = useAuth();
    
    const generarId = () => Math.random().toString(36).substring(2, 9);

    const [funciones, setFunciones] = useState<FuncionBloque[]>([]);
    const [catalogoGlobal, setCatalogoGlobal] = useState<any[]>([]);
    
    const [cargandoEspacios, setCargandoEspacios] = useState(false);
    const [guardando, setGuardando] = useState(false);
    // Errores al aceptar una función (campos incompletos o fallo al guardar): se muestran en un modal
    const [mensaje, setMensaje] = useState<{ titulo: string; detalles: string[] } | null>(null);
    const [activeFunctionIndex, setActiveFunctionIndex] = useState(0);
    // Aviso al entrar: la agenda se completa función por función y cada una se confirma con "Aceptar"
    const [avisoInicio, setAvisoInicio] = useState(false);
    const [noMostrarAviso, setNoMostrarAviso] = useState(false);
    // Aviso al aceptar una función: cuál se aceptó y cuál sigue (null si ya no quedan por aceptar)
    const [confirmacion, setConfirmacion] = useState<{ nombre: string; siguiente: number | null } | null>(null);

    const [semanaActiva, setSemanaActiva] = useState(false);
    const [periodoAbierto, setPeriodoAbierto] = useState(true);
    const [tiempoRestanteTexto, setTiempoRestanteTexto] = useState('');

    // "Otro/Cuál" (Académico-Administrativo) y "Otro, ¿Cuál?" (Vicerrectoría): la
    // actividad no está en el catálogo, así que el docente escribe la descripción y
    // los indicadores en lugar de elegirlos de una lista.
    const esActividadOtro = (rol: string) => /^otro/i.test((rol || '').trim());

    // Mapeo dinámico del catálogo
    const getActividadesDelCatalogo = (funcionNombre: string, sourceCatalogo = catalogoGlobal) => {
        const funcItem = sourceCatalogo.find((c: any) => c.funcion_sustantiva === funcionNombre);
        return funcItem ? funcItem.actividades : [];
    };

    const getDescripcionesDeActividad = (funcionNombre: string, nombreActividad: string, sourceCatalogo = catalogoGlobal) => {
        const actividades = getActividadesDelCatalogo(funcionNombre, sourceCatalogo);
        const actItem = actividades.find((a: any) => a.rol_seleccionado === nombreActividad);
        return actItem ? actItem.descripciones : [];
    };
    
    const getIndicadoresDeDescripcion = (funcionNombre: string, nombreActividad: string, resultadoEsperado: string, sourceCatalogo = catalogoGlobal) => {
        const descripciones = getDescripcionesDeActividad(funcionNombre, nombreActividad, sourceCatalogo);
        const descItem = descripciones.find((d: any) => d.resultado_esperado === resultadoEsperado);
        return descItem ? descItem.indicadores : [];
    };

    useEffect(() => {
        const cargarData = async () => {
            setCargandoEspacios(true);
            try {
                // Verificar periodo activo
                try {
                    const resPeriodo = await getPeriodoActivo();
                    setPeriodoAbierto(!!resPeriodo.data);
                } catch (err) {
                    console.error("Error al verificar periodo:", err);
                    setPeriodoAbierto(false);
                }

                try {
                    const semanasRes = await api.get('/semanas');
                    const semanaCero = semanasRes.data.find((s: any) => s.numero_semana === '0');
                    if (semanaCero && semanaCero.habilitada && semanaCero.fecha_inicio && semanaCero.fecha_fin) {
                        const ahora = new Date();
                        const inicio = new Date(semanaCero.fecha_inicio);
                        inicio.setHours(0, 0, 0, 0);
                        const fin = new Date(semanaCero.fecha_fin);
                        fin.setHours(23, 59, 59, 999);
                        
                        if (ahora >= inicio && ahora <= fin) {
                            setSemanaActiva(true);
                            const diffMs = fin.getTime() - ahora.getTime();
                            const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                            const horas = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            setTiempoRestanteTexto(`Tiempo restante: ${dias} días / ${horas} horas`);
                        } else {
                            setSemanaActiva(false);
                            setTiempoRestanteTexto('Semana finalizada');
                        }
                    } else {
                        setSemanaActiva(false);
                        setTiempoRestanteTexto(semanaCero ? 'Semana 0 Deshabilitada' : 'Semana finalizada');
                    }
                } catch (error) {
                    console.error("Error al cargar semanas:", error);
                    setSemanaActiva(true); // Fallback en caso de error
                }

                const catRes = await api.get('/funciones/catalogo');
                const catalogoData = catRes.data;
                setCatalogoGlobal(catalogoData);

                const baseRes = await api.get(`/agenda/base/${(user as any)?.id_usuario || user?.id}`);
                const { funciones: dbFunciones, actividades: dbActs } = baseRes.data;

                if (dbFunciones && dbFunciones.length > 0) {
                    const mappedFunciones = dbFunciones.map((f: any) => {
                        const misActs = dbActs.filter((a: any) => a.id_funciones === f.id_funciones);
                        
                        const uniqueActs: any[] = [];
                        const actMap = new Map();
                        for (let act of misActs) {
                            if (!actMap.has(act.id_asignacionact)) {
                                actMap.set(act.id_asignacionact, {
                                    id: act.id_asignacionact,
                                    idEspacioAcademico: act.id_espacio_aca || '',
                                    actividadLibre: act.rol_seleccionado || '',
                                    horasActividad: parseFloat(act.horas_rol) || '',
                                    resultadoEsperado: act.resultado_esperado || '',
                                    meta: act.meta ? parseInt(act.meta) : '',
                                    indicadores: [],
                                    semestre: act.semestre_nombre,
                                    grupo: act.grupo_nombre,
                                    nombreEspacio: act.nombre_espacio
                                });
                            }
                            const mappedA = actMap.get(act.id_asignacionact);
                            if (act.id_indicador && !mappedA.indicadores.find((i:any)=>i.id === act.id_indicador)) {
                                mappedA.indicadores.push({
                                    id: String(act.id_indicador),
                                    nombre_indicador: act.nombre_indicador
                                });
                            }
                        }

                        const finalActs = Array.from(actMap.values()).map((a: any) => {
                            if (a.indicadores.length === 0) {
                                a.indicadores.push({ id: generarId(), nombre_indicador: '' });
                            }

                            // Auto-selección en la carga inicial
                            if (a.actividadLibre && !esActividadOtro(a.actividadLibre) && !a.resultadoEsperado && f.funcion_sustantiva) {
                                const descs = getDescripcionesDeActividad(f.funcion_sustantiva, a.actividadLibre, catalogoData);
                                if (descs.length === 1) {
                                    a.resultadoEsperado = descs[0].resultado_esperado;
                                }
                            }
                            // Re-validar indicadores si ya hay un resultado esperado
                            if (a.actividadLibre && !esActividadOtro(a.actividadLibre) && a.resultadoEsperado && f.funcion_sustantiva) {
                                const inds = getIndicadoresDeDescripcion(f.funcion_sustantiva, a.actividadLibre, a.resultadoEsperado, catalogoData);
                                if (inds.length === 1 && (!a.indicadores[0] || !a.indicadores[0].nombre_indicador)) {
                                    a.indicadores[0].nombre_indicador = inds[0].nombre_indicador;
                                }
                            }

                            return a;
                        });

                        return {
                            id: f.id_funciones,
                            funcionSustantiva: f.funcion_sustantiva,
                            horasFuncion: parseFloat(f.horas_funcion),
                            estadoAgenda: f.estado_agenda || 'Pendiente',
                            actividades: finalActs.length > 0 ? finalActs : [{
                                id: generarId(), idEspacioAcademico: '', actividadLibre: '', horasActividad: '', resultadoEsperado: '', meta: '', indicadores: [{ id: generarId(), nombre_indicador: '' }]
                            }]
                        };
                    });
                    setFunciones(ordenarFunciones(mappedFunciones));
                    setActiveFunctionIndex(0); // Seleccionar la primera por defecto
                } else {
                    setFunciones([]);
                }
            } catch (error) {
                console.error("Error al cargar la agenda:", error);
            } finally {
                setCargandoEspacios(false);
            }
        };

        cargarData();
    }, [user]);

    const cambiarFuncion = (funcIndex: number, campo: keyof FuncionBloque, valor: any) => {
        const nuevas = [...funciones];
        nuevas[funcIndex] = { ...nuevas[funcIndex], [campo]: valor };
        setFunciones(nuevas);
    };

    const cambiarActividad = (funcIndex: number, actIndex: number, campo: keyof Actividad, valor: any) => {
        const nuevas = [...funciones];
        nuevas[funcIndex].actividades[actIndex] = {
            ...nuevas[funcIndex].actividades[actIndex],
            [campo]: valor
        };
        
        const funcionSust = nuevas[funcIndex].funcionSustantiva;

        if (campo === 'actividadLibre') {
            nuevas[funcIndex].actividades[actIndex].resultadoEsperado = '';
            nuevas[funcIndex].actividades[actIndex].indicadores = [{ id: generarId(), nombre_indicador: '' }];
            
            // Auto seleccionar Descripción e Indicador (en "Otro" los escribe el docente)
            if (valor && !esActividadOtro(valor)) {
                const descs = getDescripcionesDeActividad(funcionSust, valor);
                if (descs.length === 1) {
                    nuevas[funcIndex].actividades[actIndex].resultadoEsperado = descs[0].resultado_esperado;
                    
                    const inds = getIndicadoresDeDescripcion(funcionSust, valor, descs[0].resultado_esperado);
                    if (inds.length === 1) {
                        nuevas[funcIndex].actividades[actIndex].indicadores[0].nombre_indicador = inds[0].nombre_indicador;
                    }
                }
            }
        } else if (campo === 'resultadoEsperado') {
            nuevas[funcIndex].actividades[actIndex].indicadores = [{ id: generarId(), nombre_indicador: '' }];
            
            // Auto seleccionar Indicador
            if (valor && !esActividadOtro(nuevas[funcIndex].actividades[actIndex].actividadLibre)) {
                const actLibre = nuevas[funcIndex].actividades[actIndex].actividadLibre;
                const inds = getIndicadoresDeDescripcion(funcionSust, actLibre, valor);
                if (inds.length === 1) {
                    nuevas[funcIndex].actividades[actIndex].indicadores[0].nombre_indicador = inds[0].nombre_indicador;
                }
            }
        }
        
        setFunciones(nuevas);
    };

    const cambiarIndicador = (funcIndex: number, actIndex: number, indIndex: number, valor: string) => {
        const nuevas = [...funciones];
        nuevas[funcIndex].actividades[actIndex].indicadores[indIndex].nombre_indicador = valor;
        setFunciones(nuevas);
    };

    const agregarIndicador = (funcIndex: number, actIndex: number) => {
        const nuevas = [...funciones];
        nuevas[funcIndex].actividades[actIndex].indicadores.push({ id: generarId(), nombre_indicador: '' });
        setFunciones(nuevas);
    }
    const eliminarIndicador = (funcIndex: number, actIndex: number, indIndex: number) => {
        const nuevas = [...funciones];
        if (nuevas[funcIndex].actividades[actIndex].indicadores.length > 1) {
            nuevas[funcIndex].actividades[actIndex].indicadores.splice(indIndex, 1);
            setFunciones(nuevas);
        }
    }

    const aceptarFuncion = async (fIndex: number) => {
        const funcion = funciones[fIndex];
        
        // Validación: verificar que todos los campos estén llenos
        const erroresValidacion: string[] = [];
        funcion.actividades.forEach((act, i) => {
            const num = i + 1;
            const esIndirecta = funcion.funcionSustantiva === 'Docencia Indirecta';
            const esDirecta = funcion.funcionSustantiva === 'Docencia Directa';
            
            if (!esDirecta) {
                if (!act.actividadLibre) erroresValidacion.push(`Actividad ${num}: Falta seleccionar la actividad del catálogo.`);
                if (!act.resultadoEsperado) erroresValidacion.push(`Actividad ${num}: Falta seleccionar la descripción/resultado esperado.`);
                if (!esIndirecta && !act.meta && act.meta !== 0) erroresValidacion.push(`Actividad ${num}: Falta ingresar la meta.`);
                if (!esIndirecta && Number(act.meta) > META_MAXIMA) erroresValidacion.push(`Actividad ${num}: La meta no puede ser mayor a ${META_MAXIMA}.`);
                const tieneIndicador = act.indicadores.some(ind => ind.nombre_indicador && ind.nombre_indicador.trim() !== '');
                if (!tieneIndicador) erroresValidacion.push(`Actividad ${num}: Falta al menos un indicador (entregable).`);
            }
        });

        if (erroresValidacion.length > 0) {
            setMensaje({
                titulo: `No se puede aceptar "${funcion.funcionSustantiva}"`,
                detalles: erroresValidacion
            });
            return;
        }

        setGuardando(true);
        setMensaje(null);
        try {
            const payload = {
                id_funciones: funcion.id,
                actividades: funcion.actividades.map(a => {
                    const esDirecta = funcion.funcionSustantiva === 'Docencia Directa';
                    if (esDirecta) {
                            // Obtener las descripciones reales de Docencia Directa desde el catálogo de la BD
                            const catActs = getActividadesDelCatalogo('Docencia Directa');
                            const descripciones: any[] = catActs.flatMap((act: any) =>
                                (act.descripciones || []).map((desc: any) => ({
                                    resultadoEsperado: desc.resultado_esperado,
                                    meta: desc.meta,
                                    indicadores: (desc.indicadores || []).map((ind: any) => ({ nombre_indicador: ind.nombre_indicador }))
                                }))
                            );
                            return {
                                id_asignacionact: a.id,
                                actividadLibre: a.nombreEspacio || a.actividadLibre || 'Espacio Académico',
                                // Si el catálogo de la BD tiene datos, usarlos; si no, usar los valores por defecto
                                descripciones: descripciones.length > 0 ? descripciones : [
                                    { resultadoEsperado: 'Microcurrículo y ficha temática actualizados', meta: 2, indicadores: [{ nombre_indicador: 'Microcurrículo y ficha aprobados y cargados en el sistema institucional' }] },
                                    { resultadoEsperado: 'Desarrollo de espacio académico', meta: 16, indicadores: [{ nombre_indicador: 'Registros de seguimiento semana a semana en el sistema académico institucional' }] },
                                    { resultadoEsperado: 'Registro de calificaciones', meta: 3, indicadores: [{ nombre_indicador: 'Registros de calificaciones en el sistema académico institucional' }] },
                                    { resultadoEsperado: 'Entrega física de notas finales firmadas por el docente', meta: 1, indicadores: [{ nombre_indicador: 'Evidencia de entrega de notas finales' }] }
                                ]
                            };
                        }
                    return {
                        id_asignacionact: a.id,
                        actividadLibre: a.actividadLibre,
                        resultadoEsperado: a.resultadoEsperado,
                        meta: funcion.funcionSustantiva === 'Docencia Indirecta' ? 1 : a.meta,
                        indicadores: a.indicadores
                    };
                })
            };
            await api.post('/agenda/guardar-funcion', payload);
            
            // Actualizar estado local
            const nuevas = [...funciones];
            nuevas[fIndex].estadoAgenda = 'Aceptado';
            setFunciones(nuevas);
            
            setConfirmacion({ nombre: funcion.funcionSustantiva, siguiente: siguienteSinAceptar(fIndex, nuevas) });
        } catch (error: any) {
            console.error('Error al guardar función:', error);
            setMensaje({ titulo: 'No se pudo guardar la función', detalles: [error.response?.data?.error || error.message] });
        } finally {
            setGuardando(false);
        }
    };

    // La siguiente función sin aceptar, empezando por la que sigue a `desde` y dando la vuelta
    const siguienteSinAceptar = (desde: number, lista: FuncionBloque[]): number | null =>
        lista.map((_, k) => (desde + 1 + k) % lista.length)
            .find(k => k !== desde && lista[k].estadoAgenda !== 'Aceptado') ?? null;

    // Abre una función y deja la pantalla al inicio de ella (las tarjetas de funciones);
    // window.scrollTo no mueve el contenedor con scroll del Layout, por eso scrollIntoView
    const irAFuncion = (indice: number) => {
        setActiveFunctionIndex(indice);
        setTimeout(() => document.getElementById('funciones-agenda')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    };

    const cerrarAvisoInicio = () => {
        if (noMostrarAviso) {
            try { localStorage.setItem(CLAVE_AVISO_INICIO, '1'); } catch { /* sin almacenamiento: se mostrará de nuevo */ }
        }
        setAvisoInicio(false);
    };

    const irASiguienteFuncion = () => {
        if (confirmacion?.siguiente != null) irAFuncion(confirmacion.siguiente);
        setConfirmacion(null);
    };

    // "Quedarme aquí": cierra el aviso y lleva al resumen de la agenda, al final de la página
    const verResumenAgenda = () => {
        setConfirmacion(null);
        setTimeout(() => document.getElementById('resumen-agenda')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    };

    // Desglose fijo de Docencia Directa (el mismo para todas las asignaturas): del catálogo, o el de respaldo
    const desgloseDirecta = (): { descripcion: string; meta: number | string; indicadores: string[] }[] => {
        type DescCatalogo = { resultado_esperado: string; meta?: number | null; indicadores?: { nombre_indicador: string }[] };
        const actividades: { descripciones?: DescCatalogo[] }[] = getActividadesDelCatalogo('Docencia Directa');
        const delCatalogo = actividades.flatMap(a => a.descripciones || []);
        if (delCatalogo.length > 0) {
            return delCatalogo.map(d => ({
                descripcion: d.resultado_esperado,
                meta: d.meta ?? '—',
                indicadores: (d.indicadores || []).map(i => i.nombre_indicador).filter(Boolean),
            }));
        }
        return [
            { descripcion: 'Microcurrículo y ficha temática actualizados', meta: 2, indicadores: ['Microcurrículo y ficha aprobados y cargados en el sistema institucional'] },
            { descripcion: 'Desarrollo de espacio académico', meta: 16, indicadores: ['Registros de seguimiento semana a semana en el sistema académico institucional'] },
            { descripcion: 'Registro de calificaciones', meta: 3, indicadores: ['Registros de calificaciones en el sistema académico institucional'] },
            { descripcion: 'Entrega física de notas finales firmadas por el docente', meta: 1, indicadores: ['Evidencia de entrega de notas finales'] },
        ];
    };

    // Siguiente función por aceptar a partir de la que se está viendo (botón del resumen)
    const siguientePendiente = siguienteSinAceptar(activeFunctionIndex, funciones);

    // Se muestra una vez cargada la agenda, si todavía se puede editar y quedan funciones por aceptar
    const hayPorAceptar = funciones.some(f => f.estadoAgenda !== 'Aceptado');
    useEffect(() => {
        if (cargandoEspacios || !periodoAbierto || !semanaActiva || !hayPorAceptar || funciones.length === 0) return;
        let oculto = false;
        try { oculto = localStorage.getItem(CLAVE_AVISO_INICIO) === '1'; } catch { /* sin almacenamiento */ }
        if (!oculto) setAvisoInicio(true);
        // Solo al terminar de cargar: aceptar funciones después no vuelve a abrirlo
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargandoEspacios, periodoAbierto, semanaActiva, funciones.length]);

    return (
        <Layout rol="docente" path="Agenda / Crear Agenda">
            <div className="bg-[#1a2744] rounded-xl px-6 py-6 mb-6 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <BookOpen className="w-6 h-6 text-blue-400" />
                            Planificación de Agenda
                        </h1>
                        <p className="text-blue-100 text-sm mt-1">
                            Completa la información importada por tu director utilizando el catálogo oficial. Presiona <strong>Aceptar</strong> en cada función para confirmar.
                        </p>
                    </div>
                    {tiempoRestanteTexto && (
                        <div className={`px-4 py-2 rounded-lg font-bold text-sm shrink-0 ${semanaActiva ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                {tiempoRestanteTexto}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {!periodoAbierto && !cargandoEspacios && (
                <div className="flex flex-col items-center justify-center py-20 px-6">
                    <div className="bg-white rounded-2xl shadow-lg border border-amber-200 max-w-lg w-full text-center p-10">
                        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 mx-auto mb-6">
                            <CalendarX className="w-10 h-10 text-amber-500" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-800 mb-3">
                            Periodo Académico Cerrado
                        </h2>
                        <p className="text-gray-500 text-sm leading-relaxed mb-6">
                            El periodo académico actual se encuentra <strong className="text-amber-600">cerrado</strong>. No hay agendas disponibles para creación o modificación en este momento.
                        </p>
                        <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                            <p className="text-xs text-amber-700 font-medium">
                                Cuando Planeación habilite un nuevo periodo, tu agenda estará disponible automáticamente.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {periodoAbierto && !semanaActiva && !cargandoEspacios && tiempoRestanteTexto && (
                <div className="p-4 mb-6 rounded-xl flex items-start gap-3 bg-red-50 border border-red-200 text-red-800">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="font-medium text-sm">La Semana 0 está cerrada. Ya no es posible modificar la agenda.</p>
                </div>
            )}

            {avisoInicio && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="titulo-aviso-inicio"
                    onClick={cerrarAvisoInicio}
                >
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mx-auto mb-5">
                            <ClipboardList className="w-9 h-9 text-blue-600" />
                        </div>
                        <h2 id="titulo-aviso-inicio" className="text-xl font-bold text-[#1a2744] mb-2 text-center">Antes de empezar</h2>
                        <p className="text-sm text-gray-600 mb-4 text-center">
                            Tu agenda se completa <strong>función por función</strong>. Para que quede registrada debes:
                        </p>
                        <ol className="text-sm text-gray-700 space-y-2 mb-5 bg-blue-50 border border-blue-100 rounded-xl p-4 list-decimal list-inside">
                            <li>Completar todas las actividades, descripciones, metas e indicadores de cada función.</li>
                            <li>Presionar <strong>Aceptar</strong> al terminar cada una: sin ese paso la función no se guarda.</li>
                            <li>Repetirlo hasta que <strong>todas las funciones</strong> aparezcan como aceptadas.</li>
                        </ol>
                        <label className="flex items-center gap-2 text-xs text-gray-500 mb-5 cursor-pointer select-none">
                            <input type="checkbox" checked={noMostrarAviso} onChange={(e) => setNoMostrarAviso(e.target.checked)} className="rounded border-gray-300" />
                            No volver a mostrar este aviso
                        </label>
                        <button
                            autoFocus
                            onClick={cerrarAvisoInicio}
                            className="w-full px-4 py-2.5 rounded-xl bg-[#1a2744] text-white font-semibold text-sm hover:bg-[#243560] transition-colors"
                        >
                            Entendido, comenzar
                        </button>
                    </div>
                </div>
            )}

            {confirmacion && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="titulo-funcion-aceptada"
                    onClick={() => setConfirmacion(null)}
                >
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto mb-5">
                            <CheckCircle2 className="w-9 h-9 text-green-600" />
                        </div>
                        <h2 id="titulo-funcion-aceptada" className="text-xl font-bold text-[#1a2744] mb-2">
                            {confirmacion.siguiente === null ? '¡Todas las funciones aceptadas!' : 'Función aceptada'}
                        </h2>
                        <p className="text-sm text-gray-600 mb-6">
                            Tu función <strong>"{confirmacion.nombre}"</strong> quedó guardada correctamente.
                            {confirmacion.siguiente !== null
                                ? <> ¿Quieres continuar con <strong>"{funciones[confirmacion.siguiente]?.funcionSustantiva}"</strong>?</>
                                : ' Ya completaste tu agenda.'}
                        </p>
                        {confirmacion.siguiente !== null ? (
                            <div className="flex flex-col-reverse sm:flex-row gap-3">
                                <button
                                    onClick={verResumenAgenda}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
                                >
                                    Quedarme aquí
                                </button>
                                <button
                                    autoFocus
                                    onClick={irASiguienteFuncion}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#1a2744] text-white font-semibold text-sm hover:bg-[#243560] transition-colors"
                                >
                                    Sí, continuar
                                </button>
                            </div>
                        ) : (
                            <button
                                autoFocus
                                onClick={verResumenAgenda}
                                className="w-full px-4 py-2.5 rounded-xl bg-[#1a2744] text-white font-semibold text-sm hover:bg-[#243560] transition-colors"
                            >
                                Entendido
                            </button>
                        )}
                    </div>
                </div>
            )}

            {mensaje && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="titulo-error-funcion"
                    onClick={() => setMensaje(null)}
                >
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-5">
                            <AlertTriangle className="w-9 h-9 text-red-600" />
                        </div>
                        <h2 id="titulo-error-funcion" className="text-xl font-bold text-[#1a2744] mb-3 text-center">{mensaje.titulo}</h2>
                        {mensaje.detalles.length > 1 && <p className="text-sm text-gray-600 mb-2 text-center">Faltan estos campos:</p>}
                        <ul className="text-sm text-gray-700 space-y-1.5 mb-6 max-h-60 overflow-y-auto bg-red-50 border border-red-100 rounded-xl p-4">
                            {mensaje.detalles.map((d, i) => (
                                <li key={i} className="flex gap-2"><span className="text-red-500">•</span><span>{d}</span></li>
                            ))}
                        </ul>
                        <button
                            autoFocus
                            onClick={() => setMensaje(null)}
                            className="w-full px-4 py-2.5 rounded-xl bg-[#1a2744] text-white font-semibold text-sm hover:bg-[#243560] transition-colors"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}

            {/* Solo renderizar el formulario si el periodo está abierto */}
            {periodoAbierto ? (
                cargandoEspacios ? (
                    <div className="flex justify-center p-12 text-gray-500">
                        Cargando tu agenda...
                    </div>
                ) : funciones.length === 0 ? (
                    <div className="flex justify-center p-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-xl">
                        No tienes funciones sustantivas asignadas en este momento.
                    </div>
                ) : (
                    <div className="space-y-6">
                    {/* Selector de Tarjetas (Tabs) */}
                    <div id="funciones-agenda" className="scroll-mt-20 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-2">
                        {funciones.map((f, i) => {
                            const aceptada = f.estadoAgenda === 'Aceptado';
                            return (
                            <button
                                key={f.id}
                                onClick={() => setActiveFunctionIndex(i)}
                                className={`text-left p-4 rounded-xl border-2 transition-all flex flex-col gap-2 relative overflow-hidden group ${
                                    activeFunctionIndex === i 
                                    ? 'border-transparent bg-[#1a2744] shadow-lg shadow-blue-900/20 scale-[1.02]' 
                                    : aceptada 
                                        ? 'border-green-300 bg-green-50/60 hover:bg-green-100/70 hover:border-green-400'
                                        : 'border-blue-100/50 bg-blue-50/40 hover:bg-blue-100/50 hover:border-blue-300'
                                }`}
                            >
                                <div className="flex justify-between items-start w-full">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${activeFunctionIndex === i ? 'text-blue-300' : aceptada ? 'text-green-600' : 'text-blue-500/70'}`}>
                                        Función {i + 1}
                                    </span>
                                    {aceptada && activeFunctionIndex !== i ? (
                                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    ) : (
                                        <Clock className={`w-3.5 h-3.5 ${activeFunctionIndex === i ? 'text-blue-400' : 'text-blue-300 group-hover:text-blue-500 transition-colors'}`} />
                                    )}
                                </div>
                                <h3 className={`font-bold text-sm leading-tight ${activeFunctionIndex === i ? 'text-white' : 'text-blue-900'}`}>
                                    {f.funcionSustantiva || 'No asignada'}
                                </h3>
                                <div className="flex items-center justify-between w-full mt-auto">
                                    <p className={`text-xs font-medium ${activeFunctionIndex === i ? 'text-blue-200' : 'text-blue-700'}`}>
                                        {f.horasFuncion} horas
                                    </p>
                                    {aceptada && activeFunctionIndex !== i && (
                                        <span className="text-[9px] font-bold text-green-700 bg-green-200 px-1.5 py-0.5 rounded">ACEPTADA</span>
                                    )}
                                </div>
                            </button>
                            );
                        })}
                    </div>

                    {/* Detalle de la Función Seleccionada */}
                    {funciones[activeFunctionIndex] && (() => {
                        const funcion = funciones[activeFunctionIndex];
                        const fIndex = activeFunctionIndex;
                        const esDocenciaDirecta = funcion.funcionSustantiva === 'Docencia Directa';
                        const esIndirecta = funcion.funcionSustantiva === 'Docencia Indirecta';
                        const esDeshabilitado = !periodoAbierto;

                        return (
                        <div className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden relative ${esDeshabilitado ? 'border-gray-200 opacity-60' : 'border-blue-100'}`}>
                            <div className="bg-blue-50/50 px-6 py-5 border-b border-blue-100 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                <div className="flex-1 w-full flex flex-col sm:flex-row gap-4">
                                    <div className="flex-1">
                                        <label className="flex items-center gap-2 text-sm font-bold text-blue-900 mb-1.5">
                                            <Flag className="w-4 h-4 text-blue-600" />
                                            Función Sustantiva (Actual)
                                        </label>
                                        <input
                                            readOnly
                                            className="w-full border-2 border-transparent bg-gray-100 rounded-lg px-4 py-2 text-sm font-bold outline-none text-gray-700"
                                            value={funcion.funcionSustantiva || 'No asignada'}
                                        />
                                    </div>
                                    <div className="sm:w-48">
                                        <label className="flex items-center gap-2 text-sm font-bold text-blue-900 mb-1.5">
                                            <Clock className="w-4 h-4 text-blue-600" />
                                            Horas Totales Asignadas
                                        </label>
                                        <input
                                            type="text"
                                            readOnly
                                            className="w-full border-2 border-transparent bg-gray-100 rounded-lg px-4 py-2 text-sm outline-none font-bold text-gray-800"
                                            value={funcion.horasFuncion}
                                        />
                                    </div>
                                </div>
                            </div>

                            {funcion.funcionSustantiva && (
                                <div className="p-6 bg-gray-50/30">
                                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <ClipboardList className="w-4 h-4" />
                                        Actividades ({funcion.actividades.length})
                                        {esDeshabilitado && <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">En Desarrollo / Pendiente</span>}
                                        {esIndirecta && <span className="ml-2 text-[10px] bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded">Campos de texto libre</span>}
                                    </h3>

                                    {/* Scroll propio cuando hay muchas actividades (p. ej. Docencia Directa con una por asignatura) */}
                                    <div className="space-y-8 max-h-[75vh] overflow-y-auto -mx-2 px-2 pb-1">
                                        {funcion.actividades.map((actividad, aIndex) => {
                                            const catsActs = getActividadesDelCatalogo(funcion.funcionSustantiva);
                                            const catsDescs = getDescripcionesDeActividad(funcion.funcionSustantiva, actividad.actividadLibre);
                                            const catsInds = getIndicadoresDeDescripcion(funcion.funcionSustantiva, actividad.actividadLibre, actividad.resultadoEsperado);

                                            return (
                                            <div key={actividad.id} className="bg-white border border-gray-200 border-b-4 border-b-gray-300 rounded-xl p-6 shadow-sm relative group hover:border-b-blue-400 transition-all">
                                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                                    
                                                    <div className="lg:col-span-12 xl:col-span-5 space-y-4">
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex justify-between">
                                                                <span>{esDocenciaDirecta ? 'Espacio Académico (Asignatura)' : 'Actividad según la función'}</span>
                                                                {!actividad.actividadLibre && !esDeshabilitado && !esIndirecta && !esDocenciaDirecta && <span className="text-red-500 font-normal">Falta Seleccionar</span>}
                                                            </label>
                                                            {esDocenciaDirecta ? (
                                                                <div>
                                                                    <input 
                                                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 font-semibold text-blue-900 mb-2"
                                                                        readOnly
                                                                        value={
                                                                            actividad.nombreEspacio && actividad.nombreEspacio.trim() !== ''
                                                                                ? actividad.nombreEspacio
                                                                                : actividad.actividadLibre && actividad.actividadLibre.trim() !== ''
                                                                                    ? actividad.actividadLibre
                                                                                    : '(Sin espacio académico asignado)'
                                                                        }
                                                                    />
                                                                    <div className="flex gap-2">
                                                                        <span className="text-xs bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-md font-medium border border-indigo-200">Semestre: {actividad.semestre || 'N/A'}</span>
                                                                        <span className="text-xs bg-purple-100 text-purple-800 px-2.5 py-1 rounded-md font-medium border border-purple-200">Grupo: {actividad.grupo || 'N/A'}</span>
                                                                    </div>
                                                                </div>
                                                            ) : esDeshabilitado ? (
                                                                <input 
                                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 italic"
                                                                    readOnly
                                                                    value={actividad.actividadLibre || 'Docencia Directa - A Completar Próximamente'}    
                                                                />
                                                            ) : esIndirecta ? (
                                                                <input 
                                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 font-semibold"
                                                                    readOnly
                                                                    value={actividad.actividadLibre || 'DOCENCIA INDIRECTA'}    
                                                                />
                                                            ) : (
                                                                <select
                                                                    className={`w-full border ${!actividad.actividadLibre ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'} rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none disabled:opacity-60 disabled:bg-gray-100`}
                                                                    value={actividad.actividadLibre}
                                                                    onChange={(e) => cambiarActividad(fIndex, aIndex, 'actividadLibre', e.target.value)}
                                                                    disabled={!semanaActiva || !periodoAbierto}
                                                                >
                                                                    <option value="">Seleccionar actividad del catálogo...</option>
                                                                    {catsActs.map((act:any) => (
                                                                        <option key={act.id_asignacionact} value={act.rol_seleccionado}>{act.rol_seleccionado}</option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex justify-between">
                                                                <span>Horas Asignadas (Director)</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                readOnly
                                                                className="w-full sm:w-1/3 border border-gray-300 bg-gray-100 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 outline-none"
                                                                value={actividad.horasActividad}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="lg:col-span-12 xl:col-span-7 space-y-4">
                                                        {/* === LAYOUT DOCENCIA DIRECTA === */}
                                                        {esDocenciaDirecta ? (
                                                            <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100">
                                                                <h4 className="text-sm font-bold text-blue-900 mb-4 flex items-center gap-2">
                                                                    <BookOpen className="w-4 h-4" /> Desglose Fijo de Actividades
                                                                </h4>
                                                                <div className="space-y-3">
                                                                    {(() => {
                                                                        // Leer las descripciones del catálogo de la BD para esta actividad
                                                                        const catDescs = getActividadesDelCatalogo('Docencia Directa');
                                                                        // Aplanar todas las descripciones del catálogo de Docencia Directa
                                                                        const allDescs: any[] = catDescs.flatMap((act: any) => act.descripciones || []);
                                                                        if (allDescs.length > 0) {
                                                                            return allDescs.map((desc: any, idx: number) => (
                                                                                <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 text-xs">
                                                                                    <div className="flex justify-between items-start mb-2">
                                                                                        <span className="font-bold text-gray-800">{desc.resultado_esperado}</span>
                                                                                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold whitespace-nowrap ml-2">Meta: {desc.meta ?? 'N/A'}</span>
                                                                                    </div>
                                                                                    {(desc.indicadores || []).map((ind: any, iIdx: number) => (
                                                                                        <div key={iIdx} className="text-gray-600 flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
                                                                                            <Target className="w-3.5 h-3.5 text-gray-400" /> {ind.nombre_indicador}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ));
                                                                        }
                                                                        // Fallback si el catálogo aún no cargó
                                                                        return [
                                                                            { d: 'Microcurrículo y ficha temática actualizados', m: 2, i: 'Microcurrículo y ficha aprobados y cargados en el sistema institucional' },
                                                                            { d: 'Desarrollo de espacio académico', m: 16, i: 'Registros de seguimiento semana a semana en el sistema académico institucional' },
                                                                            { d: 'Registro de calificaciones', m: 3, i: 'Registros de calificaciones en el sistema académico institucional' },
                                                                            { d: 'Entrega física de notas finales firmadas por el docente', m: 1, i: 'Evidencia de entrega de notas finales' }
                                                                        ].map((item, idx) => (
                                                                            <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 text-xs">
                                                                                <div className="flex justify-between items-start mb-2">
                                                                                    <span className="font-bold text-gray-800">{item.d}</span>
                                                                                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold whitespace-nowrap ml-2">Meta: {item.m}</span>
                                                                                </div>
                                                                                <div className="text-gray-600 flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
                                                                                    <Target className="w-3.5 h-3.5 text-gray-400" /> {item.i}
                                                                                </div>
                                                                            </div>
                                                                        ));
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        ) : esIndirecta ? (
                                                            <>
                                                                <div>
                                                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                                        Descripción de Resultados <span className="text-gray-400 font-normal">(Escribe libremente)</span>
                                                                    </label>
                                                                    <textarea
                                                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none bg-white resize-y min-h-[60px] disabled:opacity-60 disabled:bg-gray-100"
                                                                        rows={2}
                                                                        placeholder="Describe qué actividades realizarás en docencia indirecta..."
                                                                        value={actividad.resultadoEsperado}
                                                                        onChange={(e) => cambiarActividad(fIndex, aIndex, 'resultadoEsperado', e.target.value)}
                                                                        disabled={!semanaActiva || !periodoAbierto}
                                                                    />
                                                                </div>

                                                                <div className="bg-cyan-50/50 rounded-lg p-4 border border-cyan-100">
                                                                    <label className="flex items-center gap-1.5 text-xs font-bold text-cyan-800 mb-2">
                                                                        <Target className="w-3.5 h-3.5" /> Construcción de Fichas de Desarrollo Temático
                                                                    </label>
                                                                    <textarea
                                                                        className="w-full border border-cyan-200 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none bg-white resize-y min-h-[60px] disabled:opacity-60 disabled:bg-gray-100"
                                                                        rows={2}
                                                                        placeholder="Describe las fichas de desarrollo temático..."
                                                                        value={actividad.indicadores[0]?.nombre_indicador || ''}
                                                                        onChange={(e) => cambiarIndicador(fIndex, aIndex, 0, e.target.value)}
                                                                        disabled={!semanaActiva || !periodoAbierto}
                                                                    />
                                                                </div>
                                                            </>
                                                        ) : (
                                                        /* === LAYOUT NORMAL (CATÁLOGO) === */
                                                        <>
                                                        <div className="flex flex-col sm:flex-row gap-4">
                                                            <div className="flex-1">
                                                                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                                    Descripción / Resultado Esperado
                                                                </label>
                                                                {esDeshabilitado ? (
                                                                     <input 
                                                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 italic"
                                                                        readOnly
                                                                        value="Pendiente de implementación jerárquica"    
                                                                    />
                                                                ) : esActividadOtro(actividad.actividadLibre) ? (
                                                                    <textarea
                                                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none bg-white resize-y min-h-[60px] disabled:opacity-60 disabled:bg-gray-100"
                                                                        rows={2}
                                                                        placeholder="Escribe cuál es la actividad y el resultado esperado..."
                                                                        value={actividad.resultadoEsperado}
                                                                        onChange={(e) => cambiarActividad(fIndex, aIndex, 'resultadoEsperado', e.target.value)}
                                                                        disabled={!semanaActiva || !periodoAbierto}
                                                                    />
                                                                ) : (
                                                                    <select
                                                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none bg-white transition-colors disabled:opacity-60 disabled:bg-gray-100"
                                                                        value={actividad.resultadoEsperado}
                                                                        onChange={(e) => cambiarActividad(fIndex, aIndex, 'resultadoEsperado', e.target.value)}
                                                                        disabled={!semanaActiva || !actividad.actividadLibre}
                                                                    >
                                                                        <option value="">
                                                                            {!actividad.actividadLibre 
                                                                                ? 'Primero selecciona la Actividad' 
                                                                                : 'Seleccionar resultado esperado...'}
                                                                        </option>
                                                                        {catsDescs.map((desc:any) => (
                                                                            <option key={desc.id_descripcion} value={desc.resultado_esperado}>{desc.resultado_esperado}</option>
                                                                        ))}
                                                                    </select>
                                                                )}
                                                            </div>
                                                            {!esDeshabilitado && (
                                                                <div className="w-full sm:w-24">
                                                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                                        Meta
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        max={META_MAXIMA}
                                                                        title={`Máximo ${META_MAXIMA}`}
                                                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none bg-white disabled:opacity-60 disabled:bg-gray-100"
                                                                        value={actividad.meta}
                                                                        onChange={(e) => {
                                                                            // La meta es el denominador del avance: nunca negativa ni mayor al máximo
                                                                            const v = parseInt(e.target.value);
                                                                            cambiarActividad(fIndex, aIndex, 'meta', isNaN(v) ? '' : Math.min(META_MAXIMA, Math.max(0, v)));
                                                                        }}
                                                                        placeholder={`Máx. ${META_MAXIMA}`}
                                                                        disabled={!semanaActiva || !periodoAbierto}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>

                                                        {!esDeshabilitado && (
                                                            <div className="bg-orange-50/50 rounded-lg p-4 border border-orange-100">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <label className="flex items-center gap-1.5 text-xs font-bold text-orange-800">
                                                                        <Target className="w-3.5 h-3.5" /> Indicadores (Entregables)
                                                                    </label>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => agregarIndicador(fIndex, aIndex)}
                                                                        className="text-[11px] font-bold text-orange-600 bg-orange-100 hover:bg-orange-200 px-2 py-1 rounded transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        disabled={!semanaActiva || !periodoAbierto}
                                                                    >
                                                                        <Plus className="w-3 h-3" /> Añadir 
                                                                    </button>
                                                                </div>

                                                                <div className="space-y-2.5">
                                                                    {actividad.indicadores.map((ind, iIndex) => (
                                                                        <div key={ind.id} className="flex gap-2 items-center">
                                                                            <div className="relative flex-1">
                                                                                <div className="absolute left-3 top-2.5 w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                                                                                {esActividadOtro(actividad.actividadLibre) ? (
                                                                                <input
                                                                                    type="text"
                                                                                    className="w-full border border-orange-200 rounded-md pl-7 pr-3 py-1.5 text-xs outline-none bg-white font-medium text-orange-900 focus:border-orange-400 disabled:opacity-60 disabled:bg-gray-100"
                                                                                    placeholder="Escribe el indicador o entregable..."
                                                                                    value={ind.nombre_indicador}
                                                                                    onChange={(e) => cambiarIndicador(fIndex, aIndex, iIndex, e.target.value)}
                                                                                    disabled={!semanaActiva || !periodoAbierto}
                                                                                />
                                                                                ) : (
                                                                                <select
                                                                                    className="w-full border border-orange-200 rounded-md pl-7 pr-3 py-1.5 text-xs outline-none bg-white font-medium text-orange-900 disabled:opacity-60 disabled:bg-gray-100"
                                                                                    value={ind.nombre_indicador}
                                                                                    onChange={(e) => cambiarIndicador(fIndex, aIndex, iIndex, e.target.value)}
                                                                                    disabled={!semanaActiva || !actividad.resultadoEsperado}
                                                                                >
                                                                                    <option value="">
                                                                                        {!actividad.resultadoEsperado 
                                                                                            ? 'Selecciona descripción primero...' 
                                                                                            : 'Seleccionar indicador...'}
                                                                                    </option>
                                                                                    {catsInds.map((indic:any) => (
                                                                                        <option key={indic.id_indicador} value={indic.nombre_indicador}>{indic.nombre_indicador}</option>
                                                                                    ))}
                                                                                </select>
                                                                                )}
                                                                            </div>
                                                                            {actividad.indicadores.length > 1 && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => eliminarIndicador(fIndex, aIndex, iIndex)}
                                                                                    className="text-gray-400 hover:text-red-500 p-1.5 rounded self-start mt-0.5 disabled:opacity-50 disabled:hover:text-gray-400 disabled:cursor-not-allowed"
                                                                                    disabled={!semanaActiva || !periodoAbierto}
                                                                                >
                                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>

                                    {!esDeshabilitado && (
                                        <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between">
                                            {funcion.estadoAgenda === 'Aceptado' && (
                                                <span className="flex items-center gap-2 text-green-700 text-sm font-bold">
                                                    <CheckCircle2 className="w-5 h-5" />
                                                    Función Aceptada
                                                </span>
                                            )}
                                            <div className="ml-auto">
                                                <button
                                                    onClick={() => aceptarFuncion(fIndex)}
                                                    disabled={guardando || !semanaActiva || !periodoAbierto}
                                                    className={`px-6 py-2.5 font-bold rounded-lg shadow-md flex items-center gap-2 transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed ${
                                                        funcion.estadoAgenda === 'Aceptado'
                                                            ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/20'
                                                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                                                    }`}
                                                >
                                                    {guardando ? (
                                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    ) : (
                                                        <CheckCircle2 className="w-5 h-5" />
                                                    )}
                                                    {funcion.estadoAgenda === 'Aceptado' ? 'Actualizar' : 'Aceptar'} ({funcion.actividades.length} Actividades)
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        );
                    })()}
                </div>
            )) : null}

            {/* Panel de Resumen - Estado en la Base de Datos */}
            {funciones.length > 0 && (
                <div id="resumen-agenda" className="mt-10 scroll-mt-20 bg-[#0f1b2d] rounded-xl border border-blue-900/50 overflow-hidden">
                    <div className="px-6 py-4 bg-[#1a2744] border-b border-blue-800/40">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-white font-bold text-sm flex items-center gap-2">
                                <ClipboardList className="w-4 h-4 text-blue-400" />
                                Resumen de tu agenda
                            </h2>
                            <div className="flex items-center gap-3">
                                <span className="text-blue-300 text-xs">
                                    {funciones.filter(f => f.estadoAgenda === 'Aceptado').length}/{funciones.length} funciones aceptadas
                                </span>
                                {siguientePendiente !== null && (
                                    <button
                                        onClick={() => irAFuncion(siguientePendiente)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00a896] hover:bg-[#009383] text-white text-xs font-bold transition-colors cursor-pointer"
                                    >
                                        Pasar a la siguiente función
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-6 text-xs">
                            <span className="text-blue-200">
                                <span className="text-blue-400 font-bold">Docente:</span> {(user as any)?.nombres || ''} {(user as any)?.apellidos || ''}
                            </span>
                            <span className="text-blue-200">
                                <span className="text-blue-400 font-bold">Total Horas:</span> {funciones.reduce((sum, f) => sum + (Number(f.horasFuncion) || 0), 0)}h
                            </span>
                        </div>
                    </div>
                    <div className="p-6 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left border-b border-blue-800/30">
                                    <th className="pb-3 text-blue-300 font-bold text-xs uppercase tracking-wider">Función</th>
                                    <th className="pb-3 text-blue-300 font-bold text-xs uppercase tracking-wider">Estado</th>
                                    <th className="pb-3 text-blue-300 font-bold text-xs uppercase tracking-wider">Horas Func.</th>
                                    <th className="pb-3 text-blue-300 font-bold text-xs uppercase tracking-wider">Actividad</th>
                                    <th className="pb-3 text-blue-300 font-bold text-xs uppercase tracking-wider">Horas Act.</th>
                                    <th className="pb-3 text-blue-300 font-bold text-xs uppercase tracking-wider">Descripción</th>
                                    <th className="pb-3 text-blue-300 font-bold text-xs uppercase tracking-wider">Indicador</th>
                                    <th className="pb-3 text-blue-300 font-bold text-xs uppercase tracking-wider">Meta</th>
                                </tr>
                            </thead>
                            <tbody>
                                {funciones.map((f) => (
                                    f.actividades.map((act, ai) => (
                                        <tr key={`${f.id}-${act.id}`} className={`border-b border-blue-900/20 ${ai === 0 ? 'border-t border-blue-700/30' : ''}`}>
                                            {ai === 0 && (
                                                <>
                                                    <td rowSpan={f.actividades.length} className="py-3 pr-3 text-white font-medium align-top">
                                                        {f.funcionSustantiva}
                                                    </td>
                                                    <td rowSpan={f.actividades.length} className="py-3 pr-3 align-top">
                                                        <span className={`text-xs font-bold px-2 py-1 rounded ${f.estadoAgenda === 'Aceptado' ? 'bg-green-900/50 text-green-300' : 'bg-yellow-900/50 text-yellow-300'}`}>
                                                            {f.estadoAgenda}
                                                        </span>
                                                    </td>
                                                    <td rowSpan={f.actividades.length} className="py-3 pr-3 text-blue-200 font-bold align-top">
                                                        {f.horasFuncion}h
                                                    </td>
                                                </>
                                            )}
                                            <td className="py-3 pr-3 text-blue-100">
                                                {act.actividadLibre || <span className="text-gray-500 italic">Sin seleccionar</span>}
                                            </td>
                                            <td className="py-3 pr-3 text-blue-200 text-center font-semibold">
                                                {act.horasActividad || '—'}
                                            </td>
                                            {f.funcionSustantiva === 'Docencia Directa' ? (
                                                ai === 0 && (
                                                    // Una sola celda para Descripción, Indicador y Meta: evita repetir lo mismo en cada asignatura
                                                    <td colSpan={3} rowSpan={f.actividades.length} className="py-3 align-top border-l border-blue-900/40 pl-3">
                                                        <p className="text-[10px] uppercase tracking-wider text-blue-400 font-bold mb-1.5">Igual para cada asignatura</p>
                                                        <div className="space-y-1.5">
                                                            {desgloseDirecta().map((d, k) => (
                                                                <div key={k} className="grid grid-cols-[1fr_1fr_auto] gap-x-4 text-xs text-blue-200 pb-1.5 border-b border-blue-900/30 last:border-b-0">
                                                                    <span>{d.descripcion}</span>
                                                                    <span className="text-blue-300/80">{d.indicadores.join(', ') || '—'}</span>
                                                                    <span className="font-semibold text-blue-100 text-right min-w-[2rem]">{d.meta}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                )
                                            ) : (
                                                <>
                                            <td className="py-3 pr-3 text-blue-200 text-xs max-w-[200px] truncate" title={act.resultadoEsperado}>
                                                    {act.resultadoEsperado || <span className="text-gray-500 italic">—</span>}
                                                </td>
                                                <td className="py-3 pr-3 text-blue-200 text-xs max-w-[200px] truncate" title={act.indicadores.map(i => i.nombre_indicador).join(', ')}>
                                                    {act.indicadores.filter(i => i.nombre_indicador).length > 0 
                                                        ? act.indicadores.filter(i => i.nombre_indicador).map(i => i.nombre_indicador).join(', ')
                                                        : <span className="text-gray-500 italic">—</span>
                                                    }
                                                </td>
                                                <td className="py-3 text-blue-200 text-center">
                                                    {act.meta || <span className="text-gray-500">—</span>}
                                                </td>
                                                </>
                                            )}
                                        </tr>
                                    ))
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            
            <div className="h-20"></div>
        </Layout>
    );
}
