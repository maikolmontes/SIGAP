// ================================================================
// SIGAP — Informe de evidencias del docente (los datos y el texto)
// ----------------------------------------------------------------
// Reúne, para UN docente y UN período, lo que registró en su agenda, en el mismo orden en que lo diligenció:
// función → actividad → descripción (resultado esperado) → indicador → evidencias, cada evidencia con la breve
// descripción de lo que contiene. No guarda nada.
//
// El resultado tiene la misma forma que el balance de gestión del director (portada + secciones con párrafos,
// listas y tablas), así el frontend lo muestra y lo convierte a Word y PDF con las mismas utilidades.
//
// Definiciones iguales a las del resto del sistema: solo cuentan funciones con docente asignado, y
// avance = (ejecución del corte 8 + corte 16) / meta de la descripción.
// ================================================================
const { etiquetaPeriodo, etiquetaCorte } = require('../utils/periodo');
const { asegurarDescripcionEvidencias } = require('../utils/esquemaEvidencias');

class ReporteDocenteError extends Error {
    constructor(mensaje, estado = 400) {
        super(mensaje);
        this.estado = estado;
    }
}

const num = (v) => Number(v) || 0;
const redondear = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const fmtNum = (v) => {
    const n = num(v);
    return Number.isInteger(n) ? String(n) : String(redondear(n, 2)).replace('.', ',');
};
const porcentaje = (ejecutado, meta) => (num(meta) > 0 ? Math.min(100, Math.round((num(ejecutado) * 100) / num(meta))) : null);
const fmtPct = (p) => (p === null ? '—' : `${p} %`);
const fmtFecha = (valor) => {
    if (!valor) return '';
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
};
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

const TIPO_EVIDENCIA = (tipo) => {
    const t = String(tipo || '').toLowerCase();
    if (t === 'enlace') return 'Enlace';
    if (t.includes('pdf')) return 'PDF';
    if (t.includes('word') || t.includes('document')) return 'Word';
    if (t.includes('sheet') || t.includes('excel')) return 'Excel';
    if (t.startsWith('image/')) return 'Imagen';
    if (t.includes('zip') || t.includes('rar') || t.includes('compressed')) return 'Comprimido';
    return 'Archivo';
};

/**
 * Agrupa las filas planas de la consulta en función → actividad → descripción → indicador → evidencias.
 * Cada fila trae una evidencia (o ninguna) de un indicador.
 */
const agrupar = (filas) => {
    const funciones = [];
    for (const f of filas) {
        let funcion = funciones.find((x) => x.id === f.id_funciones);
        if (!funcion) {
            funcion = { id: f.id_funciones, nombre: f.funcion_sustantiva, horas: num(f.horas_funcion), actividades: [] };
            funciones.push(funcion);
        }
        let actividad = funcion.actividades.find((x) => x.id === f.id_asignacionact);
        if (!actividad) {
            actividad = { id: f.id_asignacionact, nombre: f.actividad || f.funcion_sustantiva, grupo: f.nombre_grupo || null, horas: num(f.horas_rol), descripciones: [] };
            funcion.actividades.push(actividad);
        }
        // Sin id de descripción (datos viejos o pruebas) todo cae en una sola descripción sin texto
        const idDescripcion = f.id_descripcion ?? null;
        let descripcion = actividad.descripciones.find((x) => x.id === idDescripcion);
        if (!descripcion) {
            descripcion = { id: idDescripcion, texto: f.resultado_esperado || '', indicadores: [] };
            actividad.descripciones.push(descripcion);
        }
        let indicador = descripcion.indicadores.find((x) => x.id === f.id_indicadores);
        if (!indicador) {
            indicador = { id: f.id_indicadores, nombre: f.nombre_indicador, meta: num(f.meta), ejec8: num(f.ejecucion_8), ejec16: num(f.ejecucion_16), evidencias: [] };
            descripcion.indicadores.push(indicador);
        }
        if (f.id_evidencias !== null && f.id_evidencias !== undefined) {
            indicador.evidencias.push({ id: f.id_evidencias, nombre: f.nombre_archivo, tipo: f.tipo_archivo, semana: f.semana, fecha: f.fecha_carga, descripcion: f.evidencia_descripcion || '' });
        }
    }
    return funciones;
};

const indicadoresDe = (funcion) => funcion.actividades.flatMap((a) => a.descripciones.flatMap((d) => d.indicadores));
// Lo ejecutado de cada indicador cuenta hasta su meta, para que sobrepasar una no tape a otra
const cumplidoDe = (indicadores) => indicadores.reduce((s, i) => s + Math.min(i.ejec8 + i.ejec16, i.meta > 0 ? i.meta : i.ejec8 + i.ejec16), 0);

/** Texto del documento. `datos` = { docente, programa, facultad, periodo, filas, generadoEn }. Función pura. */
const redactarReporte = (datos) => {
    const { periodo } = datos;
    const funciones = agrupar(datos.filas || []);
    const corte = (s) => etiquetaCorte(Number(s) === 16 ? 16 : 8, periodo.semestre);

    const indicadores = funciones.flatMap(indicadoresDe);
    const totalEvidencias = indicadores.reduce((s, i) => s + i.evidencias.length, 0);
    const conEvidencia = indicadores.filter((i) => i.evidencias.length > 0).length;
    const metaTotal = indicadores.reduce((s, i) => s + i.meta, 0);

    const secciones = [];

    // ---- 1. Resumen ----
    const filasResumen = funciones.map((f) => {
        const inds = indicadoresDe(f);
        return [
            f.nombre, fmtNum(f.horas), String(inds.length),
            String(inds.filter((i) => i.evidencias.length > 0).length),
            String(inds.reduce((s, i) => s + i.evidencias.length, 0)),
            fmtPct(porcentaje(cumplidoDe(inds), inds.reduce((s, i) => s + i.meta, 0))),
        ];
    });
    filasResumen.push(['Total', fmtNum(funciones.reduce((s, f) => s + f.horas, 0)), String(indicadores.length), String(conEvidencia), String(totalEvidencias), fmtPct(porcentaje(cumplidoDe(indicadores), metaTotal))]);

    secciones.push({
        nivel: 1,
        titulo: 'Resumen del período',
        bloques: [
            {
                tipo: 'parrafo',
                texto: `Este informe reúne el avance y las evidencias que ${datos.docente} registró en SIGAP durante el período ${periodo.etiqueta}. `
                    + `Comprende ${plural(funciones.length, 'función sustantiva', 'funciones sustantivas')}, ${plural(indicadores.length, 'indicador', 'indicadores')} `
                    + `y ${plural(totalEvidencias, 'evidencia', 'evidencias')}; ${plural(conEvidencia, 'indicador tiene', 'indicadores tienen')} al menos una evidencia.`,
            },
            { tipo: 'tabla', columnas: ['Función sustantiva', 'Horas', 'Indicadores', 'Con evidencia', 'Evidencias', 'Avance'], filas: filasResumen, numericas: [1, 2, 3, 4, 5] },
        ],
    });

    // ---- 2. Detalle: una sección por función y, dentro, una por actividad ----
    // Cada actividad lleva UNA tabla con sus descripciones e indicadores (meta, ejecución, avance) y, debajo, UNA tabla
    // con las evidencias de esos indicadores y lo que contiene cada una.
    for (const f of funciones) {
        const inds = indicadoresDe(f);
        const evidenciasFuncion = inds.reduce((s, i) => s + i.evidencias.length, 0);
        secciones.push({
            nivel: 1,
            titulo: `${f.nombre} · ${fmtNum(f.horas)} h`,
            bloques: [{
                tipo: 'parrafo',
                texto: `${plural(f.actividades.length, 'actividad', 'actividades')} · ${plural(inds.length, 'indicador', 'indicadores')} · ${plural(evidenciasFuncion, 'evidencia', 'evidencias')} · `
                    + `avance ${fmtPct(porcentaje(cumplidoDe(inds), inds.reduce((s, i) => s + i.meta, 0)))}`,
            }],
        });

        for (const a of f.actividades) {
            const partes = [a.nombre, a.grupo && `Grupo ${a.grupo}`, a.horas > 0 && `${fmtNum(a.horas)} h`].filter(Boolean);
            const filasIndicadores = [];
            const filasEvidencias = [];
            for (const d of a.descripciones) {
                for (const i of d.indicadores) {
                    filasIndicadores.push([d.texto || '—', i.nombre, fmtNum(i.meta), fmtNum(i.ejec8), fmtNum(i.ejec16), fmtPct(porcentaje(i.ejec8 + i.ejec16, i.meta)), String(i.evidencias.length)]);
                    for (const e of i.evidencias) {
                        filasEvidencias.push([i.nombre, corte(e.semana), TIPO_EVIDENCIA(e.tipo), e.nombre || '', e.descripcion || 'Sin descripción', fmtFecha(e.fecha)]);
                    }
                }
            }
            const bloques = [{
                tipo: 'tabla',
                columnas: ['Descripción', 'Indicador', 'Meta', `Ejecución ${corte(8)}`, `Ejecución ${corte(16)}`, 'Avance', 'Evidencias'],
                filas: filasIndicadores,
                numericas: [2, 3, 4, 5, 6],
            }];
            if (filasEvidencias.length > 0) {
                bloques.push({ tipo: 'tabla', columnas: ['Indicador', 'Corte', 'Tipo', 'Evidencia', 'Qué contiene', 'Fecha'], filas: filasEvidencias });
            } else {
                bloques.push({ tipo: 'parrafo', texto: 'Esta actividad todavía no tiene evidencias registradas.' });
            }
            secciones.push({ nivel: 2, titulo: partes.join(' · '), bloques });
        }
    }

    secciones.push({
        nivel: 1,
        titulo: 'Nota',
        bloques: [{
            tipo: 'parrafo',
            texto: 'Los archivos subidos permanecen guardados en SIGAP y aquí se identifican por su nombre; de los enlaces se muestra la dirección completa. '
                + 'La descripción de cada evidencia es la que escribió el docente al subirla. '
                + 'El avance de cada indicador es lo ejecutado en los dos cortes frente a su meta, con un tope de 100 %.',
        }],
    });

    return {
        titulo: 'Informe de evidencias del docente',
        subtitulo: `Docente: ${datos.docente}`,
        portada: { programa: datos.programa, facultad: datos.facultad || '', periodo: periodo.etiqueta, directores: [], generadoEn: datos.generadoEn },
        secciones,
    };
};

/** Consulta los datos del docente en el período y arma el informe completo (misma forma que el balance de gestión). */
const construirReporteDocente = async (db, { idUsuario, idPeriodo }) => {
    const periodo = (await db.query(
        'SELECT id_periodo, anio, semestre, fecha_inicio, fecha_fin, activo FROM periodo WHERE id_periodo = $1', [idPeriodo])).rows[0];
    if (!periodo) throw new ReporteDocenteError('El período no existe.', 404);

    const docente = (await db.query(
        `SELECT TRIM(u.nombres || ' ' || u.apellidos) AS nombre, pa.nombre_programa, f.nombre_facultad
         FROM usuarios u
         LEFT JOIN programa_academico pa ON pa.id_programa = u.id_programa
         LEFT JOIN facultad f ON f.id_facultad = pa.id_facultad
         WHERE u.id_usuario = $1`, [idUsuario])).rows[0];
    if (!docente) throw new ReporteDocenteError('El usuario no existe.', 404);

    await asegurarDescripcionEvidencias(db);
    const filas = (await db.query(`
        SELECT af.id_funciones, af.funcion_sustantiva, af.horas_funcion,
               aa.id_asignacionact, aa.horas_rol,
               COALESCE(NULLIF(TRIM(ea.nombre_espacio), ''), NULLIF(TRIM(aa.rol_seleccionado), ''), af.funcion_sustantiva) AS actividad,
               g.nombre_grupo,
               d.id_descripcion, d.resultado_esperado,
               i.id_indicadores, i.nombre_indicador, d.meta, i.ejecucion_8, i.ejecucion_16,
               e.id_evidencias, e.nombre_archivo, e.tipo_archivo, e.semana, e.fecha_carga, e.descripcion AS evidencia_descripcion
        FROM usuario_asignacion ua
        JOIN asignacion_funciones af ON af.id_funciones = ua.id_funciones AND af.id_periodo = $2
        JOIN asignacion_actividades aa ON aa.id_funciones = af.id_funciones
        LEFT JOIN espacio_academico ea ON ea.id_espacio_aca = aa.id_espacio_aca
        LEFT JOIN grupos g ON g.id_grupos = aa.id_grupos
        JOIN descripcion d ON d.id_asignacionact = aa.id_asignacionact AND COALESCE(d.activo, TRUE) = TRUE
        JOIN indicadores i ON i.id_descripcion = d.id_descripcion AND COALESCE(i.activo, TRUE) = TRUE
        LEFT JOIN evidencias e ON e.id_indicadores = i.id_indicadores
        WHERE ua.id_usuario = $1
        ORDER BY af.id_funciones, aa.orden NULLS LAST, aa.id_asignacionact, d.id_descripcion, i.id_indicadores, e.fecha_carga, e.id_evidencias
    `, [idUsuario, idPeriodo])).rows;
    if (filas.length === 0) throw new ReporteDocenteError('No tienes una agenda con indicadores en ese período.', 404);

    const generadoEn = new Date().toISOString();
    const etiqueta = etiquetaPeriodo(periodo);
    const infoPeriodo = {
        id: periodo.id_periodo, etiqueta, semestre: periodo.semestre,
        fechaInicio: periodo.fecha_inicio ? new Date(periodo.fecha_inicio).toISOString() : null,
        fechaFin: periodo.fecha_fin ? new Date(periodo.fecha_fin).toISOString() : null,
        activo: !!periodo.activo,
    };
    const programa = docente.nombre_programa || 'Sin programa';
    return {
        generadoEn,
        programa: { id: 0, nombre: programa, facultad: docente.nombre_facultad || '' },
        periodo: infoPeriodo,
        directores: [],
        // Nombre del archivo descargado (el frontend lo usa en lugar del de "Balance de gestión")
        archivoBase: `Informe_de_evidencias_${docente.nombre}`,
        documento: redactarReporte({ docente: docente.nombre, programa, facultad: docente.nombre_facultad, periodo: infoPeriodo, filas, generadoEn }),
    };
};

module.exports = { construirReporteDocente, redactarReporte, ReporteDocenteError };
