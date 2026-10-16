import { useState, useEffect } from 'react';
import Layout from '../../components/common/Layout';
import { BookOpen, ClipboardList, Target, Flag, Plus, Trash2, Save, CheckCircle2, AlertTriangle, Clock, Lock, CalendarX, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getPeriodoActivo } from '../../services/periodosService';
import { ordenarPorFuncion } from '../../utils/ordenFunciones';

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
    // Observaciones del director cuando devolvió la agenda
    observaciones?: string;
    actividades: Actividad[];
}

// Orden en que se presentan las funciones (compartido con el avance semanal): utils/ordenFunciones.ts
const ordenarFunciones = <T extends { funcionSustantiva: string }>(lista: T[]): T[] =>
    ordenarPorFuncion(lista, (f) => f.funcionSustantiva);

// La meta que escribe el docente es un número de entregas, no un porcentaje: de 0 a 20
const META_MAXIMA = 20;

// Si el docente marca "No volver a mostrar", se guarda en este navegador
const CLAVE_AVISO_INICIO = 'sigap_aviso_agenda_visto';

// Una función cuenta como lista cuando el docente ya la aceptó o el director ya la aprobó
const cuentaComoAceptada = (f: FuncionBloque) => f.estadoAgenda === 'Aceptado' || f.estadoAgenda === 'Aprobada';

type VistaEstado = 'pendiente' | 'aceptada' | 'aprobada' | 'devuelta';
const vistaEstado = (f: FuncionBloque): VistaEstado =>
    f.estadoAgenda === 'Aprobada' ? 'aprobada'
        : f.estadoAgenda === 'Devuelta' ? 'devuelta'
        : f.estadoAgenda === 'Aceptado' ? 'aceptada'
        : 'pendiente';

// Qué le falta a una actividad para poder aceptar su función (las mismas reglas de aceptarFuncion),
// para marcar los campos en rojo apenas el docente intenta aceptar
const faltasDeActividad = (nombreFuncion: string, a: Actividad) => {
    if (nombreFuncion === 'Docencia Directa') return { actividad: false, descripcion: false, meta: false, indicador: false };
    const indirecta = nombreFuncion === 'Docencia Indirecta';
    return {
        actividad: !a.actividadLibre,
        descripcion: !a.resultadoEsperado,
        meta: !indirecta && ((!a.meta && a.meta !== 0) || Number(a.meta) > META_MAXIMA),
        indicador: !a.indicadores.some(i => i.nombre_indicador && i.nombre_indicador.trim() !== ''),
    };
};

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
    // Función en la que el docente intentó aceptar con datos incompletos: sus campos faltantes se marcan en rojo
    const [intentoAceptar, setIntentoAceptar] = useState<number | null>(null);
    // Funciones editadas desde la última vez que se guardaron (la barra de abajo ofrece guardarlas)
    const [idsModificados, setIdsModificados] = useState<(string | number)[]>([]);

    const [semanaActiva, setSemanaActiva] = useState(false);
    const [periodoAbierto, setPeriodoAbierto] = useState(true);
    const [tiempoRestanteTexto, setTiempoRestanteTexto] = useState('');
    // Plazo de la Semana 0 mientras está abierta: fecha de cierre y lo que falta
    const [plazo, setPlazo] = useState<{ fecha: string; dias: number; horas: number } | null>(null);

    // "Otro/Cuál" (Académico-Administrativo) y "Otro, ¿Cuál?" (Vicerrectoría para la Evangelización de las Culturas): la
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
                            setTiempoRestanteTexto('Plazo abierto');
                            setPlazo({ fecha: fin.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), dias, horas });
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
                            observaciones: f.observaciones_generales || '',
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

    const marcarModificada = (funcIndex: number) => {
        const id = funciones[funcIndex]?.id;
        if (id !== undefined) setIdsModificados(prev => (prev.includes(id) ? prev : [...prev, id]));
    };

    const cambiarFuncion = (funcIndex: number, campo: keyof FuncionBloque, valor: any) => {
        const nuevas = [...funciones];
        nuevas[funcIndex] = { ...nuevas[funcIndex], [campo]: valor };
        setFunciones(nuevas);
    };

    const cambiarActividad = (funcIndex: number, actIndex: number, campo: keyof Actividad, valor: any) => {
        marcarModificada(funcIndex);
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
        marcarModificada(funcIndex);
        const nuevas = [...funciones];
        nuevas[funcIndex].actividades[actIndex].indicadores[indIndex].nombre_indicador = valor;
        setFunciones(nuevas);
    };

    const agregarIndicador = (funcIndex: number, actIndex: number) => {
        marcarModificada(funcIndex);
        const nuevas = [...funciones];
        nuevas[funcIndex].actividades[actIndex].indicadores.push({ id: generarId(), nombre_indicador: '' });
        setFunciones(nuevas);
    }
    const eliminarIndicador = (funcIndex: number, actIndex: number, indIndex: number) => {
        marcarModificada(funcIndex);
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
            setIntentoAceptar(fIndex);
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
            setIntentoAceptar(null);
            setIdsModificados(prev => prev.filter(x => x !== funcion.id));
            
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
            .find(k => k !== desde && !cuentaComoAceptada(lista[k])) ?? null;

    // Abre una función y deja la pantalla al inicio de ella (las tarjetas de funciones);
    // window.scrollTo no mueve el contenedor con scroll del Layout, por eso scrollIntoView
    const irAFuncion = (indice: number) => {
        setActiveFunctionIndex(indice);
        setTimeout(() => document.getElementById('funciones-agenda')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    };

    // Al cerrar el aviso de campos incompletos, la pantalla baja al primero que falta
    const cerrarMensaje = () => {
        setMensaje(null);
        setTimeout(() => document.querySelector('[data-falta="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
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

    // Acción principal de la barra: guardar la función que se está viendo (si falta aceptarla o la editaron)
    // o, si ya está al día, pasar a la siguiente. El texto dice qué pasa: "Guardar y enviar agenda" cuando es la última.
    const funcionActiva = funciones[activeFunctionIndex];
    const activaPorAceptar = !!funcionActiva && !cuentaComoAceptada(funcionActiva);
    const activaModificada = !!funcionActiva && idsModificados.includes(funcionActiva.id);
    const quedanOtrasPorAceptar = funciones.some((fn, i) => i !== activeFunctionIndex && !cuentaComoAceptada(fn));
    const hayQueGuardar = activaPorAceptar || activaModificada;
    const textoGuardar = activaPorAceptar
        ? (quedanOtrasPorAceptar ? 'Aceptar función' : 'Guardar y enviar agenda')
        : (quedanOtrasPorAceptar ? 'Guardar cambios' : 'Guardar agenda');

    // Se muestra una vez cargada la agenda, si todavía se puede editar y quedan funciones por aceptar
    const hayPorAceptar = funciones.some(f => !cuentaComoAceptada(f));
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
                            Completa cada función con el catálogo oficial y pulsa <strong>Aceptar</strong>. Cuando todas estén aceptadas, tu agenda se envía a tu director.
                        </p>
                    </div>
                    {semanaActiva && plazo ? (
                        <div className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-4 py-3 sm:text-right">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-200 sm:justify-end">
                                <Clock className="w-3.5 h-3.5" />
                                Plazo para completar la agenda
                            </div>
                            <div className="text-white font-semibold text-sm mt-1">Cierra el {plazo.fecha}</div>
                            <span
                                className={`inline-block mt-2 text-xs font-bold px-2.5 py-1 rounded-full ${
                                    plazo.dias <= 1 ? 'bg-red-500/30 text-red-100'
                                        : plazo.dias <= 7 ? 'bg-amber-400/25 text-amber-100'
                                        : 'bg-white/15 text-blue-100'
                                }`}
                            >
                                {plazo.dias >= 2 ? `Faltan ${plazo.dias} días`
                                    : plazo.dias === 1 ? 'Falta 1 día'
                                    : plazo.horas >= 1 ? `Cierra hoy · faltan ${plazo.horas} h`
                                    : 'Cierra en menos de 1 hora'}
                            </span>
                        </div>
                    ) : tiempoRestanteTexto ? (
                        <div className={`px-4 py-2 rounded-lg font-bold text-sm shrink-0 ${semanaActiva ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                {tiempoRestanteTexto}
                            </div>
                        </div>
                    ) : null}
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
                    onClick={cerrarMensaje}
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
                            onClick={cerrarMensaje}
                            className="w-full px-4 py-2.5 rounded-xl bg-[#1a2744] text-white font-semibold text-sm hover:bg-[#243560] transition-colors"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}

            {/* Estado de la agenda: dónde está y qué sigue, siempre a la vista */}
            {periodoAbierto && !cargandoEspacios && funciones.length > 0 && (() => {
                const idxDevuelta = funciones.findIndex(f => f.estadoAgenda === 'Devuelta');
                const todasAprobadas = funciones.every(f => f.estadoAgenda === 'Aprobada');
                const todasAceptadas = funciones.every(cuentaComoAceptada);
                const faltan = funciones.filter(f => !cuentaComoAceptada(f));

                if (idxDevuelta >= 0) {
                    const f = funciones[idxDevuelta];
                    return (
                        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4 flex flex-col sm:flex-row sm:items-start gap-3" role="status">
                            <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-orange-900">Tu director devolvió tu agenda para correcciones</p>
                                {f.observaciones && (
                                    <p className="text-sm text-orange-900/90 mt-1 whitespace-pre-line max-h-28 overflow-y-auto">{f.observaciones}</p>
                                )}
                                <p className="text-xs text-orange-800/80 mt-1">
                                    Corrige lo que se indica y vuelve a aceptar la función. Por aceptar: {faltan.map(x => `«${x.funcionSustantiva}»`).join(', ')}.
                                </p>
                            </div>
                            <button
                                onClick={() => irAFuncion(idxDevuelta)}
                                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors"
                            >
                                Ir a «{f.funcionSustantiva}» <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                }
                if (todasAprobadas) {
                    return (
                        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 flex items-start gap-3" role="status">
                            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-green-900"><span className="font-bold">Tu agenda fue aprobada.</span> No necesitas hacer nada más en la planificación; sigue con los reportes de avance cuando se abran las semanas.</p>
                        </div>
                    );
                }
                if (todasAceptadas) {
                    return (
                        <div className="mb-6 rounded-xl border border-teal-200 bg-teal-50 p-4 flex items-start gap-3" role="status">
                            <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-teal-900">
                                <span className="font-bold">Tu agenda está completa y ya fue enviada a tu director para revisión.</span>{' '}
                                Si cambias algo, pulsa <strong>Guardar cambios</strong> en esa función.
                            </p>
                        </div>
                    );
                }
                return (
                    <div className="mb-6 rounded-xl border border-blue-100 bg-white p-4 shadow-sm" role="status">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <p className="text-sm font-bold text-[#1a2744]">
                                Agenda en borrador · {funciones.length - faltan.length} de {funciones.length} funciones aceptadas
                            </p>
                            <p className="text-xs text-gray-500">
                                Falta aceptar: {faltan.map(x => `«${x.funcionSustantiva}»`).join(', ')}. Al aceptar la última, se envía a tu director.
                            </p>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
                            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${((funciones.length - faltan.length) / funciones.length) * 100}%` }} />
                        </div>
                    </div>
                );
            })()}

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
                            const vista = vistaEstado(f);
                            const aceptada = vista === 'aceptada' || vista === 'aprobada';
                            const devuelta = vista === 'devuelta';
                            return (
                            <button
                                key={f.id}
                                onClick={() => { setActiveFunctionIndex(i); setIntentoAceptar(null); }}
                                className={`text-left p-4 rounded-xl border-2 transition-all flex flex-col gap-2 relative overflow-hidden group ${
                                    activeFunctionIndex === i 
                                    ? 'border-transparent bg-[#1a2744] shadow-lg shadow-blue-900/20 scale-[1.02]' 
                                    : aceptada 
                                        ? 'border-green-300 bg-green-50/60 hover:bg-green-100/70 hover:border-green-400'
                                        : devuelta
                                            ? 'border-orange-300 bg-orange-50/70 hover:bg-orange-100/70 hover:border-orange-400'
                                        : 'border-blue-100/50 bg-blue-50/40 hover:bg-blue-100/50 hover:border-blue-300'
                                }`}
                            >
                                <div className="flex justify-between items-start w-full">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${activeFunctionIndex === i ? 'text-blue-300' : aceptada ? 'text-green-600' : 'text-blue-500/70'}`}>
                                        Función {i + 1}
                                    </span>
                                    {devuelta && activeFunctionIndex !== i ? (
                                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                                    ) : aceptada && activeFunctionIndex !== i ? (
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
                                    {activeFunctionIndex !== i && (
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${devuelta ? 'text-orange-700 bg-orange-200' : vista === 'pendiente' ? 'text-gray-600 bg-gray-200' : vista === 'aprobada' ? 'text-green-800 bg-green-300' : 'text-green-700 bg-green-200'}`}>{devuelta ? 'DEVUELTA' : vista === 'pendiente' ? 'PENDIENTE' : vista === 'aprobada' ? 'APROBADA' : 'ACEPTADA'}</span>
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
                            <div className="bg-blue-50/50 px-6 py-4 border-b border-blue-100 flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-blue-500">Función {fIndex + 1} de {funciones.length}</p>
                                    <h2 className="text-lg font-black text-[#1a2744] flex items-center gap-2">
                                        <Flag className="w-4 h-4 text-blue-600 shrink-0" />
                                        {funcion.funcionSustantiva || 'No asignada'}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-900 bg-white border border-blue-100 px-2.5 py-1 rounded-full">
                                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                                        {funcion.horasFuncion} horas asignadas
                                    </span>
                                    {(() => {
                                        const v = vistaEstado(funcion);
                                        const estilo = v === 'devuelta' ? 'text-orange-700 bg-orange-100 border-orange-200'
                                            : v === 'pendiente' ? 'text-gray-600 bg-gray-100 border-gray-200'
                                            : 'text-green-700 bg-green-100 border-green-200';
                                        const texto = v === 'devuelta' ? 'Devuelta' : v === 'pendiente' ? 'Pendiente de aceptar' : v === 'aprobada' ? 'Aprobada' : 'Aceptada';
                                        return <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${estilo}`}>{texto}</span>;
                                    })()}
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
                                            const faltas = faltasDeActividad(funcion.funcionSustantiva, actividad);
                                            const marcar = intentoAceptar === fIndex;

                                            return (
                                            <div key={actividad.id} className="bg-white border border-gray-200 border-b-4 border-b-gray-300 rounded-xl p-6 shadow-sm relative group hover:border-b-blue-400 transition-all">
                                                <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-gray-100">
                                                    <span className="inline-flex items-center gap-2 text-sm font-bold text-[#1a2744]">
                                                        <span className="w-6 h-6 rounded-full bg-[#1a2744] text-white text-xs flex items-center justify-center">{aIndex + 1}</span>
                                                        {esDocenciaDirecta ? 'Asignatura' : 'Actividad'} {aIndex + 1} de {funcion.actividades.length}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-md" title="Las horas las define tu director">
                                                        <Lock className="w-3 h-3 text-gray-400" />
                                                        {actividad.horasActividad || 0} h asignadas por tu director
                                                    </span>
                                                </div>
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
                                                                    data-falta={marcar && faltas.actividad ? 'true' : undefined}
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
                                                                        data-falta={marcar && faltas.descripcion ? 'true' : undefined}
                                                                        className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none bg-white resize-y min-h-[60px] disabled:opacity-60 disabled:bg-gray-100${marcar && faltas.descripcion ? ' !border-red-400 !bg-red-50' : ''}`}
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
                                                                        data-falta={marcar && faltas.indicador ? 'true' : undefined}
                                                                        className={`w-full border border-cyan-200 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none bg-white resize-y min-h-[60px] disabled:opacity-60 disabled:bg-gray-100${marcar && faltas.indicador ? ' !border-red-400 !bg-red-50' : ''}`}
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
                                                                        data-falta={marcar && faltas.descripcion ? 'true' : undefined}
                                                                        className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none bg-white resize-y min-h-[60px] disabled:opacity-60 disabled:bg-gray-100${marcar && faltas.descripcion ? ' !border-red-400 !bg-red-50' : ''}`}
                                                                        rows={2}
                                                                        placeholder="Escribe cuál es la actividad y el resultado esperado..."
                                                                        value={actividad.resultadoEsperado}
                                                                        onChange={(e) => cambiarActividad(fIndex, aIndex, 'resultadoEsperado', e.target.value)}
                                                                        disabled={!semanaActiva || !periodoAbierto}
                                                                    />
                                                                ) : (
                                                                    <select
                                                                        data-falta={marcar && faltas.descripcion ? 'true' : undefined}
                                                                        className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none bg-white transition-colors disabled:opacity-60 disabled:bg-gray-100${marcar && faltas.descripcion ? ' !border-red-400 !bg-red-50' : ''}`}
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
                                                                        data-falta={marcar && faltas.meta ? 'true' : undefined}
                                                                        className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none bg-white disabled:opacity-60 disabled:bg-gray-100${marcar && faltas.meta ? ' !border-red-400 !bg-red-50' : ''}`}
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
                                                            <div data-falta={marcar && faltas.indicador ? 'true' : undefined} className={`bg-orange-50/50 rounded-lg p-4 border ${marcar && faltas.indicador ? 'border-red-400 ring-1 ring-red-300' : 'border-orange-100'}`}>
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

                                                                {marcar && faltas.indicador && <p className="text-xs font-semibold text-red-600 mb-2">Falta al menos un indicador.</p>}
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

                                    {!esDeshabilitado && (activaPorAceptar || activaModificada) && (
                                        <p className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500">
                                            Cuando termines esta función, pulsa <strong className="text-gray-700">{textoGuardar}</strong> en el botón de abajo.
                                        </p>
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
                                    {funciones.filter(cuentaComoAceptada).length}/{funciones.length} funciones aceptadas
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
            
            {/* Botón fijo abajo: la acción que toca (el progreso de la agenda se ve arriba) */}
            {periodoAbierto && !cargandoEspacios && funciones.length > 0 && (
                <div className="sticky bottom-4 z-30 mt-6 flex justify-end pointer-events-none" role="region" aria-label="Acción de la agenda">
                    {hayQueGuardar ? (
                        <button
                            onClick={() => aceptarFuncion(activeFunctionIndex)}
                            disabled={guardando || !semanaActiva}
                            className="pointer-events-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold shadow-lg shadow-green-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {guardando
                                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <CheckCircle2 className="w-4 h-4" />}
                            {textoGuardar}
                        </button>
                    ) : siguientePendiente !== null ? (
                        <button
                            onClick={() => irAFuncion(siguientePendiente)}
                            className="pointer-events-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#1a2744] hover:bg-[#243560] text-white text-sm font-bold shadow-lg shadow-blue-900/20 transition-colors"
                        >
                            Siguiente por aceptar: {funciones[siguientePendiente].funcionSustantiva}
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={verResumenAgenda}
                            className="pointer-events-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold shadow-lg shadow-green-900/20 transition-colors"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Agenda completa · Ver resumen
                        </button>
                    )}
                </div>
            )}

            <div className="h-20"></div>
        </Layout>
    );
}
