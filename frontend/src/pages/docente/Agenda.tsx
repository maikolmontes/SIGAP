import { useState, useEffect } from 'react';
import Layout from '../../components/common/Layout';
import { BookOpen, ClipboardList, Target, Flag, Plus, Trash2, Save, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

// ==========================================
// INTERFACES (Basadas en DIAGRAMAER.md)
// ==========================================
interface EspacioAcademico {
    id_espacio_aca: number;
    codigo_espacio: string;
    nombre_espacio: string;
    creditos: number;
}

interface Indicador {
    id: string;
    nombre_indicador: string;
}

interface Actividad {
    id: string;
    idEspacioAcademico: number | '';
    actividadLibre: string;
    horasActividad: number | '';
    resultadoEsperado: string;
    meta: number | '';
    indicadores: Indicador[];
}

interface FuncionBloque {
    id: string;
    funcionSustantiva: string;
    horasFuncion: number | '';
    actividades: Actividad[];
}

export default function AgendaDocente() {
    const FUNCIONES_SUSTANTIVAS = [
        'Docencia Directa',
        'Investigación',
        'Proyección Social',
        'Gestión Académica'
    ];

    const ACTIVIDADES_POR_FUNCION: Record<string, string[]> = {
        'Investigación': ['Líder de Semillero', 'Investigador Principal', 'Coinvestigador', 'Asesor de Tesis'],
        'Proyección Social': ['Coordinador de Prácticas', 'Líder de Proyecto Comunitario', 'Docente Asesor Externo'],
        'Gestión Académica': ['Director de Programa', 'Coordinador de Área', 'Representante Docente', 'Tutor Académico']
    };

    // Simulamos la tabla de catálogo a nivel de ACTIVIDAD
    const CATALOGO_DB: Record<string, { descripciones: string[], indicadores: string[] }> = {
        'Líder de Semillero': {
            descripciones: ['Orientar y dirigir a estudiantes en procesos de investigación formativa'],
            indicadores: ['Plan de trabajo del semillero', 'Informe final de actividades']
        },
        'Investigador Principal': {
            descripciones: ['Desarrollar y ejecutar macroproyectos de investigación formal'],
            indicadores: ['Artículo científico Q1/Q2', 'Prototipo de software registrado']
        },
        'Coinvestigador': {
            descripciones: ['Apoyar en la investigación y desarrollo del macroproyecto'],
            indicadores: ['Constancia de participación', 'Capítulo de libro publicado']
        },
        'Asesor de Tesis': {
            descripciones: ['Asesorar y evaluar el documento final de trabajo de grado'],
            indicadores: ['Acta de sustentación firmada', 'Formato de aval del director']
        },
        'Coordinador de Prácticas': {
            descripciones: ['Vincular al ciclo de prácticas exitosamente a estudiantes'],
            indicadores: ['Convenio con entidad externa', 'Certificados de culminación de práctica']
        },
        'Líder de Proyecto Comunitario': {
            descripciones: ['Desarrollo social inclusivo en comunidades vulnerables'],
            indicadores: ['Lista de asistencia a brigadas', 'Informe de impacto poblacional']
        },
        'Docente Asesor Externo': {
            descripciones: ['Brindar consultoría gratuita a pymes de la región'],
            indicadores: ['Certificado de asesoría de la empresa', 'Informe técnico de consultoría']
        },
        'Director de Programa': {
            descripciones: ['Garantizar la calidad académica y la renovación de registro calificado'],
            indicadores: ['Documento maestro de autoevaluación', 'Plan operativo del programa']
        },
        'Coordinador de Área': {
            descripciones: ['Supervisar y alinear los contenidos de los cursos del núcleo común'],
            indicadores: ['Acta de comité de área', 'Microcurrículos unificados']
        },
        'Representante Docente': {
            descripciones: ['Participar activamente en los comités institucionales'],
            indicadores: ['Acta de nombramiento', 'Asistencia a comités']
        },
        'Tutor Académico': {
            descripciones: ['Mejorar la retención estudiantil brindando apoyo extra-clase'],
            indicadores: ['Reporte en plataforma de tutorías', 'Lista de asistencia de tutorados']
        }
    };

    const CATALOGO_DOCENCIA = {
        descripciones: [
            'Impartir el 100% de la formación presencial según microcurrículo',
            'Dirigir laboratorios prácticos de la asignatura'
        ],
        indicadores: [
            'Planilla de notas',
            'Evidencia del uso del aula virtual',
            'Acta de concertación con estudiantes'
        ]
    };

    const generarId = () => Math.random().toString(36).substring(2, 9);

    const nuevaActividad = (): Actividad => ({
        id: generarId(),
        idEspacioAcademico: '',
        actividadLibre: '',
        horasActividad: '',
        resultadoEsperado: '',
        meta: '',
        indicadores: [{ id: generarId(), nombre_indicador: '' }]
    });

    const [funciones, setFunciones] = useState<FuncionBloque[]>([{
        id: generarId(),
        funcionSustantiva: '',
        horasFuncion: '',
        actividades: [nuevaActividad()]
    }]);

    const [espaciosAcademicos, setEspaciosAcademicos] = useState<EspacioAcademico[]>([]);
    const [cargandoEspacios, setCargandoEspacios] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error', texto: string } | null>(null);

    useEffect(() => {
        const fetchEspacios = async () => {
            setCargandoEspacios(true);
            try {
                // TODO: Reemplazar por endpoint real
                setTimeout(() => {
                    setEspaciosAcademicos([
                        { id_espacio_aca: 1, codigo_espacio: 'SIS101', nombre_espacio: 'Programación Orientada a Objetos', creditos: 4 },
                        { id_espacio_aca: 2, codigo_espacio: 'SIS102', nombre_espacio: 'Bases de Datos I', creditos: 3 },
                        { id_espacio_aca: 3, codigo_espacio: 'SIS103', nombre_espacio: 'Ingeniería de Software', creditos: 4 },
                    ]);
                    setCargandoEspacios(false);
                }, 500);
            } catch (error) {
                console.error(error);
                setCargandoEspacios(false);
            }
        };
        fetchEspacios();
    }, []);

    // -------------------------------------------------------------
    // MANEJADORES DE FUNCIONES (Bloques Principales)
    // -------------------------------------------------------------
    const agregarFuncion = () => {
        setFunciones([...funciones, {
            id: generarId(),
            funcionSustantiva: '',
            horasFuncion: '',
            actividades: [nuevaActividad()]
        }]);
    };

    const cambiarFuncion = (funcIndex: number, campo: keyof FuncionBloque, valor: any) => {
        const nuevasFunciones = [...funciones];
        if (campo === 'funcionSustantiva' && nuevasFunciones[funcIndex].funcionSustantiva !== valor) {
            // Resetear actividades si cambia la función principal
            nuevasFunciones[funcIndex].actividades = [nuevaActividad()];
        }
        nuevasFunciones[funcIndex] = { ...nuevasFunciones[funcIndex], [campo]: valor };
        setFunciones(nuevasFunciones);
    };

    const eliminarFuncion = (funcIndex: number) => {
        if (funciones.length > 1) {
            setFunciones(funciones.filter((_, i) => i !== funcIndex));
        }
    };

    // -------------------------------------------------------------
    // MANEJADORES DE ACTIVIDADES
    // -------------------------------------------------------------
    const agregarActividad = (funcIndex: number) => {
        const nuevasFunciones = [...funciones];
        nuevasFunciones[funcIndex].actividades.push(nuevaActividad());
        setFunciones(nuevasFunciones);
    };

    const cambiarActividad = (funcIndex: number, actIndex: number, campo: keyof Actividad, valor: any) => {
        const nuevasFunciones = [...funciones];
        nuevasFunciones[funcIndex].actividades[actIndex] = {
            ...nuevasFunciones[funcIndex].actividades[actIndex],
            [campo]: valor
        };
        setFunciones(nuevasFunciones);
    };

    const eliminarActividad = (funcIndex: number, actIndex: number) => {
        const nuevasFunciones = [...funciones];
        if (nuevasFunciones[funcIndex].actividades.length > 1) {
            nuevasFunciones[funcIndex].actividades.splice(actIndex, 1);
            setFunciones(nuevasFunciones);
        }
    };

    // -------------------------------------------------------------
    // MANEJADORES DE INDICADORES
    // -------------------------------------------------------------
    const agregarIndicador = (funcIndex: number, actIndex: number) => {
        const nuevasFunciones = [...funciones];
        nuevasFunciones[funcIndex].actividades[actIndex].indicadores.push({ id: generarId(), nombre_indicador: '' });
        setFunciones(nuevasFunciones);
    };

    const cambiarIndicador = (funcIndex: number, actIndex: number, indIndex: number, valor: string) => {
        const nuevasFunciones = [...funciones];
        nuevasFunciones[funcIndex].actividades[actIndex].indicadores[indIndex].nombre_indicador = valor;
        setFunciones(nuevasFunciones);
    };

    const eliminarIndicador = (funcIndex: number, actIndex: number, indIndex: number) => {
        const nuevasFunciones = [...funciones];
        if (nuevasFunciones[funcIndex].actividades[actIndex].indicadores.length > 1) {
            nuevasFunciones[funcIndex].actividades[actIndex].indicadores.splice(indIndex, 1);
            setFunciones(nuevasFunciones);
        }
    };

    // -------------------------------------------------------------
    // GUARDADO
    // -------------------------------------------------------------
    const guardarAgenda = async () => {
        // Validación básica
        let esInvalido = false;
        funciones.forEach(f => {
            if (!f.funcionSustantiva || !f.horasFuncion) esInvalido = true;
            f.actividades.forEach(a => {
                if ((f.funcionSustantiva === 'Docencia Directa' && !a.idEspacioAcademico) ||
                    (f.funcionSustantiva !== 'Docencia Directa' && !a.actividadLibre) ||
                    !a.horasActividad || !a.resultadoEsperado) {
                    esInvalido = true;
                }
                a.indicadores.forEach(i => {
                    if (!i.nombre_indicador.trim()) esInvalido = true;
                });
            });
        });

        if (esInvalido) {
            setMensaje({ tipo: 'error', texto: 'Por favor completa todos los campos obligatorios (*).' });
            return;
        }

        setGuardando(true);
        setMensaje(null);
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            setMensaje({ tipo: 'exito', texto: 'Tu agenda ha sido guardada en la base de datos exitosamente.' });
        } catch (error) {
            setMensaje({ tipo: 'error', texto: 'Error al comunicarse con el servidor al guardar.' });
        } finally {
            setGuardando(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <Layout rol="docente" path="Agenda / Crear Agenda">
            {/* Cabecera Principal */}
            <div className="bg-[#1a2744] rounded-xl px-6 py-6 mb-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-blue-400" />
                        Planificación de Agenda
                    </h1>
                    <p className="text-blue-100 text-sm mt-1">
                        Crea funciones sustantivas y añade múltiples actividades dentro de cada una.
                    </p>
                </div>
                <button
                    onClick={guardarAgenda}
                    disabled={guardando}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                    {guardando ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Save className="w-5 h-5" />
                    )}
                    Registrar Agenda
                </button>
            </div>

            {mensaje && (
                <div className={`p-4 mb-6 rounded-xl flex items-center gap-3 border ${mensaje.tipo === 'exito' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {mensaje.tipo === 'exito' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                    <p className="font-medium text-sm">{mensaje.texto}</p>
                </div>
            )}

            {/* Listado de Funciones Sustantivas */}
            <div className="space-y-8">
                {funciones.map((funcion, fIndex) => (
                    <div key={funcion.id} className="bg-white rounded-xl shadow-sm border-2 border-blue-100 overflow-hidden relative">
                        {/* Cabecera de la Función */}
                        <div className="bg-blue-50/50 px-6 py-5 border-b border-blue-100 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                            <div className="flex-1 w-full flex flex-col sm:flex-row gap-4">
                                <div className="flex-1">
                                    <label className="flex items-center gap-2 text-sm font-bold text-blue-900 mb-1.5">
                                        <Flag className="w-4 h-4 text-blue-600" />
                                        Función Sustantiva <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        className="w-full border-2 border-blue-200 focus:border-blue-500 rounded-lg px-4 py-2 text-sm font-medium outline-none bg-white transition-colors"
                                        value={funcion.funcionSustantiva}
                                        onChange={(e) => cambiarFuncion(fIndex, 'funcionSustantiva', e.target.value)}
                                    >
                                        <option value="">Selecciona una función principal...</option>
                                        {FUNCIONES_SUSTANTIVAS.map(f => (
                                            <option key={f} value={f}>{f}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="sm:w-48">
                                    <label className="flex items-center gap-2 text-sm font-bold text-blue-900 mb-1.5">
                                        <Clock className="w-4 h-4 text-blue-600" />
                                        Horas Totales <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="Ej: 20"
                                        min="1"
                                        className="w-full border-2 border-blue-200 focus:border-blue-500 rounded-lg px-4 py-2 text-sm outline-none bg-white transition-colors"
                                        value={funcion.horasFuncion}
                                        onChange={(e) => cambiarFuncion(fIndex, 'horasFuncion', parseInt(e.target.value) || '')}
                                    />
                                </div>
                            </div>

                            {funciones.length > 1 && (
                                <button
                                    onClick={() => eliminarFuncion(fIndex)}
                                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors border border-transparent hover:border-red-200"
                                    title="Eliminar función completa"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        {/* Listado de Actividades dentro de esta Función */}
                        {funcion.funcionSustantiva && (
                            <div className="p-6 bg-gray-50/30">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4" />
                                    Actividades Asignadas a {funcion.funcionSustantiva}
                                </h3>

                                <div className="space-y-4">
                                    {funcion.actividades.map((actividad, aIndex) => (
                                        <div key={actividad.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm relative group">
                                            
                                            {/* Botón borrar actividad */}
                                            {funcion.actividades.length > 1 && (
                                                <button
                                                    onClick={() => eliminarActividad(fIndex, aIndex)}
                                                    className="absolute top-4 right-4 text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                                                    title="Eliminar actividad"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}

                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="bg-gray-100 text-gray-600 font-bold w-6 h-6 rounded flex items-center justify-center text-xs">
                                                    {aIndex + 1}
                                                </div>
                                                <h4 className="font-semibold text-gray-800 text-sm">Detalles de Actividad</h4>
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                                {/* Izquierda: Selector de Actividad / Espacio y Horas */}
                                                <div className="lg:col-span-5 space-y-4">
                                                    {funcion.funcionSustantiva === 'Docencia Directa' ? (
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                                Espacio Académico (Materia) <span className="text-red-500">*</span>
                                                            </label>
                                                            <select
                                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none bg-white"
                                                                value={actividad.idEspacioAcademico}
                                                                onChange={(e) => cambiarActividad(fIndex, aIndex, 'idEspacioAcademico', parseInt(e.target.value) || '')}
                                                            >
                                                                <option value="">Seleccionar curso...</option>
                                                                {cargandoEspacios ? (
                                                                    <option disabled>Cargando espacios...</option>
                                                                ) : (
                                                                    espaciosAcademicos.map(esp => (
                                                                        <option key={esp.id_espacio_aca} value={esp.id_espacio_aca}>
                                                                            [{esp.codigo_espacio}] {esp.nombre_espacio}
                                                                        </option>
                                                                    ))
                                                                )}
                                                            </select>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                                Actividad según Base de Datos <span className="text-red-500">*</span>
                                                            </label>
                                                            <select
                                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none bg-white"
                                                                value={actividad.actividadLibre}
                                                                onChange={(e) => cambiarActividad(fIndex, aIndex, 'actividadLibre', e.target.value)}
                                                            >
                                                                <option value="">Seleccionar actividad...</option>
                                                                {ACTIVIDADES_POR_FUNCION[funcion.funcionSustantiva]?.map(act => (
                                                                    <option key={act} value={act}>{act}</option>
                                                                ))}
                                                                <option value="otra">Otra actividad...</option>
                                                            </select>
                                                            {actividad.actividadLibre === 'otra' && (
                                                                <input
                                                                    type="text"
                                                                    placeholder="Escribe la actividad"
                                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                                                                    onChange={(e) => cambiarActividad(fIndex, aIndex, 'actividadLibre', e.target.value)}
                                                                />
                                                            )}
                                                            <p className="text-[10px] text-gray-400 mt-1">Actividades extraídas de BD para {funcion.funcionSustantiva}.</p>
                                                        </div>
                                                    )}

                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                                Horas Dedicadas <span className="text-red-500">*</span>
                                                            </label>
                                                            {/* Las horas pueden dejarse a mano o seleccionarse */}
                                                            <input
                                                                type="number"
                                                                placeholder="Ej: 4"
                                                                className="w-full sm:w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none bg-white transition-colors"
                                                                value={actividad.horasActividad}
                                                                onChange={(e) => cambiarActividad(fIndex, aIndex, 'horasActividad', parseInt(e.target.value) || '')}
                                                            />
                                                        </div>
                                                </div>

                                                {/* Derecha: Descripción, Meta e Indicadores */}
                                                <div className="lg:col-span-7 space-y-4">
                                                    <div className="flex flex-col sm:flex-row gap-4">
                                                        <div className="flex-1">
                                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                                Resultado Esperado / Descripción <span className="text-red-500">*</span>
                                                            </label>
                                                            <select
                                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none bg-white transition-colors"
                                                                value={actividad.resultadoEsperado}
                                                                onChange={(e) => cambiarActividad(fIndex, aIndex, 'resultadoEsperado', e.target.value)}
                                                                disabled={funcion.funcionSustantiva !== 'Docencia Directa' && !actividad.actividadLibre}
                                                            >
                                                                <option value="">
                                                                    {funcion.funcionSustantiva !== 'Docencia Directa' && !actividad.actividadLibre 
                                                                        ? 'Primero selecciona una actividad arriba' 
                                                                        : 'Seleccionar resultado desde la Base de Datos...'}
                                                                </option>
                                                                {(funcion.funcionSustantiva === 'Docencia Directa' ? CATALOGO_DOCENCIA.descripciones : CATALOGO_DB[actividad.actividadLibre]?.descripciones || []).map(desc => (
                                                                    <option key={desc} value={desc}>{desc}</option>
                                                                ))}
                                                                <option value="otro">Otro (Escribir manualmente...)</option>
                                                            </select>
                                                            
                                                            {actividad.resultadoEsperado === 'otro' && (
                                                                <textarea
                                                                    rows={2}
                                                                    placeholder="Describe tu resultado esperado manualmente..."
                                                                    className="w-full mt-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none resize-none"
                                                                    onChange={(e) => cambiarActividad(fIndex, aIndex, 'resultadoEsperado', e.target.value)}
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="w-full sm:w-24">
                                                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                                                Meta (%) <span className="text-red-500">*</span>
                                                            </label>
                                                            <input
                                                                type="number"
                                                                placeholder="100"
                                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                                                                value={actividad.meta}
                                                                onChange={(e) => cambiarActividad(fIndex, aIndex, 'meta', parseInt(e.target.value) || '')}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Sección Indicadores */}
                                                    <div className="bg-orange-50/50 rounded-lg p-4 border border-orange-100">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <label className="flex items-center gap-1.5 text-xs font-bold text-orange-800">
                                                                <Target className="w-3.5 h-3.5" />
                                                                Indicadores (Entregables)
                                                            </label>
                                                            <button
                                                                type="button"
                                                                onClick={() => agregarIndicador(fIndex, aIndex)}
                                                                className="text-[11px] font-bold text-orange-600 bg-orange-100 hover:bg-orange-200 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                                            >
                                                                <Plus className="w-3 h-3" /> Añadir 
                                                            </button>
                                                        </div>

                                                        <div className="space-y-2.5">
                                                            {actividad.indicadores.map((ind, iIndex) => (
                                                                <div key={ind.id} className="flex gap-2 items-center">
                                                                    <div className="relative flex-1">
                                                                        <div className="absolute left-3 top-2.5 w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                                                                        <select
                                                                            className="w-full border border-orange-200 rounded-md pl-7 pr-3 py-1.5 text-xs focus:border-orange-400 focus:ring-1 focus:ring-orange-400 outline-none bg-white font-medium text-orange-900 overflow-hidden text-ellipsis"
                                                                            value={ind.nombre_indicador}
                                                                            onChange={(e) => cambiarIndicador(fIndex, aIndex, iIndex, e.target.value)}
                                                                            disabled={funcion.funcionSustantiva !== 'Docencia Directa' && !actividad.actividadLibre}
                                                                        >
                                                                            <option value="">
                                                                                {funcion.funcionSustantiva !== 'Docencia Directa' && !actividad.actividadLibre 
                                                                                    ? 'Selecciona actividad primero...' 
                                                                                    : 'Seleccionar indicador desde BD...'}
                                                                            </option>
                                                                            {(funcion.funcionSustantiva === 'Docencia Directa' ? CATALOGO_DOCENCIA.indicadores : CATALOGO_DB[actividad.actividadLibre]?.indicadores || []).map(indic => (
                                                                                <option key={indic} value={indic}>{indic}</option>
                                                                            ))}
                                                                            <option value="otro">Ingresar otro distinto...</option>
                                                                        </select>
                                                                        
                                                                        {ind.nombre_indicador === 'otro' && (
                                                                            <input
                                                                                type="text"
                                                                                placeholder="Escribe el indicador manualmente"
                                                                                className="w-full border border-orange-200 mt-1 rounded-md px-3 py-1.5 text-xs focus:border-orange-400 focus:ring-1 focus:ring-orange-400 outline-none bg-white"
                                                                                onChange={(e) => cambiarIndicador(fIndex, aIndex, iIndex, e.target.value)}
                                                                            />
                                                                        )}
                                                                    </div>
                                                                    {actividad.indicadores.length > 1 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => eliminarIndicador(fIndex, aIndex, iIndex)}
                                                                            className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded self-start mt-0.5"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Botón añadir actividad */}
                                <button
                                    onClick={() => agregarActividad(fIndex)}
                                    className="mt-4 px-4 py-2 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors w-full justify-center sm:w-auto"
                                >
                                    <Plus className="w-4 h-4" /> Agregar otra actividad a {funcion.funcionSustantiva}
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Añadir nueva Función Sustantiva */}
            <button
                onClick={agregarFuncion}
                className="mt-8 w-full py-5 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 flex flex-col items-center justify-center gap-2 transition-all group"
            >
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors shadow-sm">
                    <Flag className="w-5 h-5" />
                </div>
                <span className="font-bold text-sm tracking-wide">AÑADIR OTRA FUNCIÓN SUSTANTIVA A LA AGENDA</span>
            </button>
            
            <div className="h-20"></div>
        </Layout>
    );
}
