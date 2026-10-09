// ================================================================
// SIGAP — Texto del balance de gestión
// ----------------------------------------------------------------
// Toma los datos que arma balanceGestion.js y redacta el documento: frases que
// explican lo que pasó en el período y cada actividad con su descripción.
// Devuelve un modelo neutro (secciones con párrafos, listas y tablas) que el
// frontend muestra, y convierte en Word y PDF, sin volver a decidir el texto.
//
//   documento = { titulo, subtitulo, portada, secciones: [{ nivel, titulo, bloques }] }
//   bloque    = { tipo: 'parrafo', texto }
//             | { tipo: 'lista', items: [{ titulo?, texto }] }
//             | { tipo: 'tabla', columnas, filas, numericas?, nota? }
// ================================================================

const num = (v) => Number(v) || 0;
const fmtNum = (n) => num(n).toLocaleString('es-CO', { maximumFractionDigits: 1 });
const fmtPct = (n) => (n === null || n === undefined ? 'sin dato' : `${fmtNum(n)} %`);
const plural = (n, uno, varios) => (num(n) === 1 ? uno : varios);

const fmtFechaLarga = (valor, zona = 'UTC') => {
    if (!valor) return null;
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: zona });
};
const fmtFechaCorta = (valor) => {
    if (!valor) return '-';
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Bogota' });
};

/** "a", "a y b", "a, b y c" */
const unir = (frases) => {
    const f = frases.filter(Boolean);
    if (f.length <= 1) return f.join('');
    return `${f.slice(0, -1).join(', ')} y ${f[f.length - 1]}`;
};

/** Hasta `max` nombres seguidos de "y N más". */
const nombres = (lista, max = 12) => {
    if (lista.length <= max) return unir(lista);
    return `${lista.slice(0, max).join(', ')} y ${lista.length - max} más`;
};

const parrafo = (texto) => ({ tipo: 'parrafo', texto });
const lista = (items) => ({ tipo: 'lista', items });
const tabla = (columnas, filas, numericas = [], nota) => ({ tipo: 'tabla', columnas, filas, numericas, nota });

// ---------------------------------------------------------------- 1. Resumen general
function seccionResumen(b) {
    const { programa, periodo, directores, resumen: r, nombresCortes: c } = b;
    const inicio = fmtFechaLarga(periodo.fechaInicio);
    const fin = fmtFechaLarga(periodo.fechaFin);
    const e = r.estados;
    const bloques = [];

    bloques.push(parrafo(
        `Este documento resume lo que se hizo en el programa de ${programa.nombre}${programa.facultad ? ` (Facultad de ${programa.facultad})` : ''} durante el período ${periodo.etiqueta}`
        + `${inicio && fin ? `, que va del ${inicio} al ${fin}` : ''}. `
        + `${directores.length > 0 ? `Lo presenta ${unir(directores)}. ` : ''}`
        + `Las cifras corresponden a lo registrado en SIGAP el ${fmtFechaLarga(b.generadoEn, 'America/Bogota')}.`));

    if (r.docentes === 0) {
        bloques.push(parrafo(`El programa no tiene docentes asignados en este período, por eso no hay agendas, avances ni evidencias que reportar.`));
        return { nivel: 1, titulo: 'Resumen general', bloques };
    }

    const estados = unir([
        e['Aprobada'] > 0 && `${e['Aprobada']} ${plural(e['Aprobada'], 'fue aprobada', 'fueron aprobadas')} (${fmtPct(r.porcentajeAprobadas)})`,
        e['En revisión'] > 0 && `${e['En revisión']} ${plural(e['En revisión'], 'está en revisión del director', 'están en revisión del director')}`,
        e['Devuelta'] > 0 && `${e['Devuelta']} ${plural(e['Devuelta'], 'fue devuelta para corrección', 'fueron devueltas para corrección')}`,
        e['Pendiente'] > 0 && `${e['Pendiente']} ${plural(e['Pendiente'], 'sigue pendiente', 'siguen pendientes')} de diligenciar`,
    ]);
    bloques.push(parrafo(
        `El programa tuvo ${r.docentes} ${plural(r.docentes, 'docente asignado', 'docentes asignados')} al período`
        + `${e['Sin agenda'] > 0 ? `, de los cuales ${e['Sin agenda']} ${plural(e['Sin agenda'], 'todavía no tiene agenda', 'todavía no tienen agenda')}` : ' y todos tienen agenda'}. `
        + `${r.docentesConAgenda > 0 ? `De ${plural(r.docentesConAgenda, 'la agenda registrada', `las ${r.docentesConAgenda} agendas registradas`)}, ${estados}.` : ''}`));

    const ocup = r.ocupacion;
    bloques.push(parrafo(
        `En las agendas se planearon ${fmtNum(r.horasAsignadas)} horas frente a ${fmtNum(r.horasContratadas)} contratadas`
        + `${ocup !== null ? ` (${fmtPct(ocup)} de ocupación)` : ''}`
        + `${ocup !== null && ocup > 100 ? ': la carga asignada supera lo contratado' : ocup !== null && ocup < 100 ? ': queda carga contratada sin asignar' : ''}.`));

    bloques.push(parrafo(r.meta > 0
        ? `Las metas de los indicadores suman ${fmtNum(r.meta)}. En ${c.corte1} se reportó una ejecución de ${fmtNum(r.ejecucionCorte1)} (${fmtPct(r.avanceCorte1)}) y, sumando ${c.corte2}, de ${fmtNum(r.ejecucionCorte1 + r.ejecucionCorte2)} (${fmtPct(r.avanceFinal)}).`
        : 'Todavía no hay metas numéricas registradas en los indicadores, por eso no se puede calcular el avance.'));

    bloques.push(parrafo(
        r.evidencias > 0
            ? `Los docentes cargaron ${fmtNum(r.evidencias)} ${plural(r.evidencias, 'evidencia', 'evidencias')} como soporte${r.indicadoresSinSoporte > 0 ? `; ${r.indicadoresSinSoporte} ${plural(r.indicadoresSinSoporte, 'indicador reporta', 'indicadores reportan')} ejecución sin ninguna evidencia` : ''}.`
            : `Todavía no se ha cargado ninguna evidencia${r.indicadoresSinSoporte > 0 ? `, y ${r.indicadoresSinSoporte} ${plural(r.indicadoresSinSoporte, 'indicador reporta', 'indicadores reportan')} ejecución` : ''}.`));

    if (r.observaciones > 0) {
        bloques.push(parrafo(`El director dejó ${r.observaciones} ${plural(r.observaciones, 'observación', 'observaciones')} sobre las actividades de los docentes.`));
    }

    bloques.push(tabla(['Concepto', 'Valor'], [
        ['Docentes asignados al período', fmtNum(r.docentes)],
        ['Agendas aprobadas', `${fmtNum(e['Aprobada'] || 0)} (${fmtPct(r.porcentajeAprobadas)})`],
        ['Agendas en revisión', fmtNum(e['En revisión'] || 0)],
        ['Agendas devueltas', fmtNum(e['Devuelta'] || 0)],
        ['Agendas pendientes', fmtNum(e['Pendiente'] || 0)],
        ['Docentes sin agenda', fmtNum(e['Sin agenda'] || 0)],
        ['Horas contratadas', fmtNum(r.horasContratadas)],
        ['Horas asignadas en las agendas', `${fmtNum(r.horasAsignadas)} (${fmtPct(r.ocupacion)})`],
        ['Meta total de los indicadores', fmtNum(r.meta)],
        [`Ejecución en ${c.corte1}`, `${fmtNum(r.ejecucionCorte1)} (${fmtPct(r.avanceCorte1)})`],
        [`Ejecución acumulada con ${c.corte2}`, `${fmtNum(r.ejecucionCorte1 + r.ejecucionCorte2)} (${fmtPct(r.avanceFinal)})`],
        ['Evidencias cargadas', fmtNum(r.evidencias)],
        ['Indicadores con ejecución y sin evidencia', fmtNum(r.indicadoresSinSoporte)],
        ['Observaciones del director', fmtNum(r.observaciones)],
    ], [1], 'Cifras clave del período.'));

    return { nivel: 1, titulo: 'Resumen general', bloques };
}

// ---------------------------------------------------------------- 2. Cortes
function seccionCortes(b) {
    const total = b.docentes.reduce((s, d) => s + d.funciones, 0);
    const frase = (k) => {
        const partes = unir([
            k.aprobadas > 0 && `${k.aprobadas} ${plural(k.aprobadas, 'fue aprobada', 'fueron aprobadas')}`,
            k.vistoBueno > 0 && `${k.vistoBueno} ${plural(k.vistoBueno, 'tiene visto bueno', 'tienen visto bueno')}`,
            k.devueltas > 0 && `${k.devueltas} ${plural(k.devueltas, 'fue devuelta', 'fueron devueltas')}`,
            k.pendientes > 0 && `${k.pendientes} ${plural(k.pendientes, 'está pendiente de revisión', 'están pendientes de revisión')}`,
        ]);
        return `En ${k.nombre}, de ${total} ${plural(total, 'función', 'funciones')} de las agendas, ${partes}.`;
    };
    const bloques = total === 0
        ? [parrafo('No hay funciones asignadas en el período, por eso no hay cortes que revisar.')]
        : [
            parrafo('Cada corte se revisa por separado y por función de cada agenda: lo aprobado en el primer corte no cuenta para el segundo.'),
            parrafo(frase(b.cortes.corte1)),
            parrafo(frase(b.cortes.corte2)),
            tabla(['Corte', 'Aprobadas', 'Con visto bueno', 'Devueltas', 'Pendientes'],
                [b.cortes.corte1, b.cortes.corte2].map((k) => [k.nombre, fmtNum(k.aprobadas), fmtNum(k.vistoBueno), fmtNum(k.devueltas), fmtNum(k.pendientes)]), [1, 2, 3, 4]),
        ];
    return { nivel: 1, titulo: 'Revisión de los cortes', bloques };
}

// ---------------------------------------------------------------- 3. Por función
function textoActividad(a, esIndirecta, b) {
    const c = b.nombresCortes;
    const partes = [];
    partes.push(`Actividad: ${a.actividad}${a.asignatura && a.asignatura !== a.actividad ? ` (${a.asignatura})` : ''}. La ${plural(a.docentes, 'reportó', 'reportaron')} ${a.docentes} ${plural(a.docentes, 'docente', 'docentes')}.`);
    if (a.indicadores.length === 0) {
        partes.push(esIndirecta ? 'Esta función no lleva indicadores.' : 'No tiene indicadores registrados.');
    } else {
        if (a.meta > 0) partes.push(`En conjunto, la meta fue ${fmtNum(a.meta)} y la ejecución, ${fmtNum(a.ejecucionCorte1 + a.ejecucionCorte2)} (${fmtPct(a.cumplimiento)}): ${fmtNum(a.ejecucionCorte1)} en ${c.corte1} y ${fmtNum(a.ejecucionCorte2)} en ${c.corte2}.`);
        for (const i of a.indicadores) {
            const ejec = i.ejecucionCorte1 + i.ejecucionCorte2;
            partes.push(`Indicador «${i.indicador}»: ${i.meta > 0 ? `meta ${fmtNum(i.meta)}, ` : ''}ejecutado ${fmtNum(ejec)}${i.cumplimiento !== null ? ` (${fmtPct(i.cumplimiento)})` : ''}, ${i.evidencias > 0 ? `${i.evidencias} ${plural(i.evidencias, 'evidencia', 'evidencias')}` : 'sin evidencias'}.`);
        }
    }
    return partes.join(' ');
}

function seccionFunciones(b) {
    const bloques = [];
    if (b.funciones.length === 0) {
        bloques.push(parrafo('No hay funciones sustantivas con docentes del programa en este período.'));
        return { nivel: 1, titulo: 'Gestión por función sustantiva', bloques };
    }
    bloques.push(parrafo(`Estas son las ${b.funciones.length} ${plural(b.funciones.length, 'función sustantiva', 'funciones sustantivas')} del programa en el período: lo que se planeó, lo que se ejecutó y cada actividad con su descripción.`));

    const subsecciones = b.funciones.map((f) => {
        const delaFuncion = b.actividadesDetalle.filter((a) => a.funcion === f.funcion);
        const esIndirecta = f.funcion === 'Docencia Indirecta';
        const sub = [];
        const frases = [
            `${plural(f.docentes, 'Participó', 'Participaron')} ${f.docentes} ${plural(f.docentes, 'docente', 'docentes')} con ${fmtNum(f.horas)} ${plural(f.horas, 'hora', 'horas')} en total${f.actividades > 0 ? `, repartidas en ${f.actividades} ${plural(f.actividades, 'actividad', 'actividades')}` : ''}.`,
        ];
        if (f.meta > 0) frases.push(`Frente a una meta de ${fmtNum(f.meta)}, la ejecución fue de ${fmtNum(f.ejecucionCorte1)} en ${b.nombresCortes.corte1} (${fmtPct(f.avanceCorte1)}) y de ${fmtNum(f.ejecucionCorte1 + f.ejecucionCorte2)} acumulada al segundo corte (${fmtPct(f.avanceFinal)}).`);
        else frases.push(esIndirecta ? 'Esta función no maneja metas ni indicadores.' : 'No tiene metas numéricas registradas.');
        if (f.evidencias > 0) frases.push(`Se cargaron ${fmtNum(f.evidencias)} ${plural(f.evidencias, 'evidencia', 'evidencias')}.`);
        else if (!esIndirecta) frases.push('No hay evidencias cargadas.');
        sub.push(parrafo(frases.join(' ')));

        if (delaFuncion.length > 0) {
            sub.push(lista(delaFuncion.map((a) => ({ titulo: a.titulo, texto: textoActividad(a, esIndirecta, b) }))));
        } else if (!esIndirecta) {
            sub.push(parrafo('Los docentes todavía no registraron descripciones ni indicadores para las actividades de esta función.'));
        }
        return { nivel: 2, titulo: f.funcion, bloques: sub };
    });
    return [{ nivel: 1, titulo: 'Gestión por función sustantiva', bloques }, ...subsecciones];
}

// ---------------------------------------------------------------- 4. Docentes
function seccionDocentes(b) {
    const bloques = [];
    if (b.docentes.length === 0) {
        bloques.push(parrafo('No hay docentes asignados al programa en este período.'));
        return { nivel: 1, titulo: 'Docentes y agendas', bloques };
    }
    bloques.push(parrafo('Así quedó la agenda de cada docente al momento de generar este documento.'));

    const grupos = [
        ['Aprobada', 'Agendas aprobadas'], ['En revisión', 'Agendas en revisión del director'], ['Devuelta', 'Agendas devueltas para corrección'],
        ['Pendiente', 'Agendas pendientes de diligenciar'], ['Sin agenda', 'Docentes sin agenda'],
    ];
    const items = [];
    for (const [estado, titulo] of grupos) {
        const dels = b.docentes.filter((d) => d.estado === estado).map((d) => d.docente);
        if (dels.length > 0) items.push({ titulo: `${titulo} (${dels.length})`, texto: nombres(dels, 15) + '.' });
    }
    const sinSoporte = b.docentes.filter((d) => d.indicadoresSinSoporte > 0);
    if (sinSoporte.length > 0) {
        items.push({
            titulo: `Con ejecución reportada y sin evidencia (${sinSoporte.length})`,
            texto: nombres(sinSoporte.map((d) => `${d.docente} (${d.indicadoresSinSoporte} ${plural(d.indicadoresSinSoporte, 'indicador', 'indicadores')})`), 12) + '.',
        });
    }
    const sobrecarga = b.docentes.filter((d) => d.horasContrato > 0 && d.horasAsignadas > d.horasContrato);
    const subcarga = b.docentes.filter((d) => d.horasContrato > 0 && d.horasAsignadas > 0 && d.horasAsignadas < d.horasContrato);
    if (sobrecarga.length > 0) items.push({ titulo: `Con más horas asignadas que contratadas (${sobrecarga.length})`, texto: nombres(sobrecarga.map((d) => d.docente), 12) + '.' });
    if (subcarga.length > 0) items.push({ titulo: `Con menos horas asignadas que contratadas (${subcarga.length})`, texto: nombres(subcarga.map((d) => d.docente), 12) + '.' });
    if (items.length > 0) bloques.push(lista(items));

    bloques.push(tabla(
        ['Docente', 'Contrato', 'H. contrato', 'H. asignadas', 'Agenda', 'Meta', 'Ejecución', 'Avance final', 'Evidencias'],
        b.docentes.map((d) => [d.docente, d.tipoContrato, fmtNum(d.horasContrato), fmtNum(d.horasAsignadas), d.estado, fmtNum(d.meta), fmtNum(d.ejecucionCorte1 + d.ejecucionCorte2), fmtPct(d.avanceFinal), fmtNum(d.evidencias)]),
        [2, 3, 5, 6, 7, 8], 'La ejecución suma los dos cortes.'));
    return { nivel: 1, titulo: 'Docentes y agendas', bloques };
}

// ---------------------------------------------------------------- 5. Evidencias
function seccionEvidencias(b) {
    const total = b.evidencias.length;
    const bloques = [];
    if (total === 0) {
        bloques.push(parrafo('Todavía no se ha cargado ninguna evidencia en este período.'));
        return { nivel: 1, titulo: 'Evidencias', bloques };
    }
    const enlaces = b.evidencias.filter((e) => e.tipo === 'Enlace').length;
    const archivos = total - enlaces;
    const detalle = archivos === 0 ? (total === 1 ? 'un enlace' : 'todas enlaces') : enlaces === 0 ? (total === 1 ? 'un archivo' : 'todas archivos') : `${archivos} ${plural(archivos, 'archivo', 'archivos')} y ${enlaces} ${plural(enlaces, 'enlace', 'enlaces')}`;
    bloques.push(parrafo(`Los docentes cargaron ${fmtNum(total)} ${plural(total, 'evidencia', 'evidencias')} (${detalle}). El listado completo está en el Anexo A.`));
    bloques.push(tabla(['Función', 'Evidencias'], b.funciones.filter((f) => f.evidencias > 0).map((f) => [f.funcion, fmtNum(f.evidencias)]), [1]));
    return { nivel: 1, titulo: 'Evidencias', bloques };
}

// ---------------------------------------------------------------- 6. Observaciones
function seccionObservaciones(b) {
    const obs = b.observaciones;
    const bloques = [];
    if (obs.length === 0) {
        bloques.push(parrafo('El director no registró observaciones en este período.'));
        return { nivel: 1, titulo: 'Observaciones del director', bloques };
    }
    const c1 = obs.filter((o) => o.corte === b.nombresCortes.corte1).length;
    const c2 = obs.length - c1;
    bloques.push(parrafo(`El director registró ${obs.length} ${plural(obs.length, 'observación', 'observaciones')}: ${unir([c1 > 0 && `${c1} en ${b.nombresCortes.corte1}`, c2 > 0 && `${c2} en ${b.nombresCortes.corte2}`])}.`));
    bloques.push(tabla(['Fecha', 'Corte', 'Docente', 'Función / actividad', 'Observación'],
        obs.map((o) => [fmtFechaCorta(o.fecha), o.corte, o.docente, [o.funcion, o.actividad].filter(Boolean).join(' / ') || '-', o.texto || '-'])));
    return { nivel: 1, titulo: 'Observaciones del director', bloques };
}

// ---------------------------------------------------------------- Anexo
function anexoEvidencias(b) {
    if (b.evidencias.length === 0) return null;
    return {
        nivel: 1,
        titulo: 'Anexo A. Evidencias cargadas',
        bloques: [tabla(['Función', 'Actividad', 'Indicador', 'Evidencia', 'Tipo', 'Corte', 'Docente', 'Fecha'],
            b.evidencias.map((e) => [e.funcion, e.descripcion || e.actividad, e.indicador || '-', e.nombre || '-', e.tipo, e.corte, e.docente, fmtFechaCorta(e.fecha)]))],
    };
}

function construirDocumento(b) {
    const secciones = [
        seccionResumen(b),
        ...(b.resumen.docentes === 0 ? [] : [seccionCortes(b), ...[].concat(seccionFunciones(b)), seccionDocentes(b), seccionEvidencias(b), seccionObservaciones(b), anexoEvidencias(b)]),
    ].filter(Boolean);

    return {
        titulo: `Balance de gestión del período ${b.periodo.etiqueta}`,
        subtitulo: b.programa.nombre,
        portada: {
            programa: b.programa.nombre,
            facultad: b.programa.facultad,
            periodo: b.periodo.etiqueta,
            directores: b.directores,
            generadoEn: b.generadoEn,
        },
        secciones,
    };
}

module.exports = { construirDocumento, unir, nombres, fmtNum, fmtPct };
