const pool = require('../db/connection');
const path = require('path');
const { rolesEfectivos } = require('../utils/rolActivo');
const { verificarSemana } = require('../utils/semanaAbierta');
const {
    idUsuarioDe, puedeVerDocente, duenoDeIndicador, duenoDeEvidencia,
} = require('../middleware/accesoEvidencias');
const almacen = require('../services/almacenEvidencias');

// Obtener evidencias por docente (organizadas por función y actividad)
const obtenerEvidenciasDocente = async (req, res) => {
    const { id_usuario } = req.params;

    try {
        if (!(await puedeVerDocente(req, id_usuario))) {
            return res.status(403).json({ error: 'No tienes permiso para ver las evidencias de este docente.' });
        }

        const query = `
            SELECT 
                af.funcion_sustantiva,
                aa.rol_seleccionado,
                aa.id_asignacionact,
                g.nombre_grupo,
                s.nombre_sem,
                i.id_indicadores,
                i.nombre_indicador,
                e.id_evidencias,
                e.nombre_archivo,
                e.ruta_archivo,
                e.tipo_archivo,
                e.tamanio_archivo_kb,
                e.fecha_carga
            FROM evidencias e
            JOIN indicadores i ON e.id_indicadores = i.id_indicadores
            JOIN descripcion d ON i.id_descripcion = d.id_descripcion
            JOIN asignacion_actividades aa ON d.id_asignacionact = aa.id_asignacionact
            JOIN asignacion_funciones af ON aa.id_funciones = af.id_funciones
            JOIN usuario_asignacion ua ON af.id_funciones = ua.id_funciones
            LEFT JOIN grupos g ON aa.id_grupos = g.id_grupos
            LEFT JOIN semestres s ON aa.id_semestregrupo = s.id_semestre -- Adjust if necessary based on real DB
            WHERE ua.id_usuario = $1
            ORDER BY af.funcion_sustantiva, aa.rol_seleccionado, e.fecha_carga DESC
        `;

        // Fix for semestre, usually aa.id_espacio_aca can link to semestre, or just use aa.rol_seleccionado
        const queryFixed = `
            SELECT 
                af.funcion_sustantiva,
                aa.rol_seleccionado,
                aa.id_asignacionact,
                COALESCE(g.nombre_grupo, '') as nombre_grupo,
                i.id_indicadores,
                i.nombre_indicador,
                e.id_evidencias,
                e.nombre_archivo,
                e.ruta_archivo,
                e.tipo_archivo,
                e.tamanio_archivo_kb,
                e.fecha_carga,
                e.semana,
                af.id_periodo
            FROM evidencias e
            JOIN indicadores i ON e.id_indicadores = i.id_indicadores
            JOIN descripcion d ON i.id_descripcion = d.id_descripcion
            JOIN asignacion_actividades aa ON d.id_asignacionact = aa.id_asignacionact
            JOIN asignacion_funciones af ON aa.id_funciones = af.id_funciones
            JOIN usuario_asignacion ua ON af.id_funciones = ua.id_funciones
            LEFT JOIN grupos g ON aa.id_grupos = g.id_grupos
            WHERE ua.id_usuario = $1
            ORDER BY af.funcion_sustantiva, aa.rol_seleccionado, e.fecha_carga DESC
        `;

        const result = await pool.query(queryFixed, [id_usuario]);

        // Estructurar la data en forma de cascada: Función -> Actividad -> Indicador -> Evidencias
        const estructurado = [];

        result.rows.forEach(row => {
            let func = estructurado.find(f => f.funcionSustantiva === row.funcion_sustantiva);
            if (!func) {
                func = { funcionSustantiva: row.funcion_sustantiva, actividades: [] };
                estructurado.push(func);
            }

            let act = func.actividades.find(a => a.id_asignacionact === row.id_asignacionact);
            if (!act) {
                act = {
                    id_asignacionact: row.id_asignacionact,
                    rol_seleccionado: row.rol_seleccionado,
                    nombre_grupo: row.nombre_grupo,
                    indicadores: []
                };
                func.actividades.push(act);
            }

            let ind = act.indicadores.find(i => i.id_indicadores === row.id_indicadores);
            if (!ind) {
                ind = {
                    id_indicadores: row.id_indicadores,
                    nombre_indicador: row.nombre_indicador,
                    evidencias: []
                };
                act.indicadores.push(ind);
            }

            ind.evidencias.push({
                id_evidencias: row.id_evidencias,
                nombre_archivo: row.nombre_archivo,
                ruta_archivo: row.ruta_archivo,
                tipo_archivo: row.tipo_archivo,
                tamanio_archivo_kb: row.tamanio_archivo_kb,
                fecha_carga: row.fecha_carga,
                semana: row.semana,
                id_periodo: row.id_periodo
            });
        });

        res.json(estructurado);
    } catch (error) {
        console.error('Error al obtener evidencias:', error);
        res.status(500).json({ error: 'Error interno del servidor al obtener evidencias' });
    }
};

// Subir una evidencia (archivo o link)
const subirEvidencia = async (req, res) => {
    const { id_indicador, tipo_evidencia, enlace_texto, semana } = req.body;

    if (!id_indicador) {
        return res.status(400).json({ error: 'Se requiere el id del indicador' });
    }

    // Se declara fuera del try: el catch lo necesita para no dejar un archivo huérfano
    let guardadoEnAlmacen = null;

    try {
        // Solo el docente dueño del indicador puede subirle evidencias
        const dueno = await duenoDeIndicador(id_indicador);
        if (!dueno) {
                return res.status(404).json({ error: 'El indicador no existe.' });
        }
        if (dueno !== idUsuarioDe(req)) {
                return res.status(403).json({ error: 'Solo el docente dueño del indicador puede subir evidencias.' });
        }

        // Solo cortes de evidencia válidos y habilitados por Planeación
        const semanaNum = String(semana || '8');
        if (!['8', '16'].includes(semanaNum)) {
                return res.status(400).json({ error: 'La semana debe ser 8 o 16.' });
        }
        // Abierta = habilitada por Planeación y dentro de sus fechas (pasada la de cierre solo se consulta)
        const corte = await verificarSemana(semanaNum);
        if (!corte.abierta) {
                return res.status(403).json({ error: corte.mensaje || `La Semana ${semanaNum} no está abierta para cargar evidencias.` });
        }

        let nombreArchivo = null;
        let rutaArchivo = null;
        let tipoArchivo = null;
        let tamanioKb = null;

        if (tipo_evidencia === 'link') {
            if (!enlace_texto) {
                return res.status(400).json({ error: 'El enlace está vacío' });
            }
            let protocolo = '';
            try { protocolo = new URL(String(enlace_texto).trim()).protocol; } catch { /* URL inválida */ }
            if (protocolo !== 'http:' && protocolo !== 'https:') {
                return res.status(400).json({ error: 'El enlace debe comenzar con http:// o https://' });
            }
            nombreArchivo = enlace_texto; // Guardar el link como nombre
            rutaArchivo = enlace_texto;
            tipoArchivo = 'enlace';
            tamanioKb = 0;
        } else {
            if (!req.file) {
                return res.status(400).json({ error: 'No se subió ningún archivo' });
            }
            // Para archivos: el contenido va al almacén (Vercel Blob en producción) y en la base
            // queda la ruta pública, que el servidor sirve después de comprobar el permiso
            const extension = path.extname(req.file.originalname).toLowerCase();
            const nombreEnAlmacen = `evidencia-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
            await almacen.guardar({ buffer: req.file.buffer, nombre: nombreEnAlmacen, tipo: req.file.mimetype });
            guardadoEnAlmacen = nombreEnAlmacen;

            nombreArchivo = req.file.originalname;
            rutaArchivo = `/uploads/evidencias/${nombreEnAlmacen}`;
            tipoArchivo = req.file.mimetype;
            tamanioKb = Math.round(req.file.size / 1024);
        }

        const query = `
            INSERT INTO evidencias (id_indicadores, nombre_archivo, ruta_archivo, tipo_archivo, tamanio_archivo_kb, semana)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_evidencias
        `;

        const values = [id_indicador, nombreArchivo, rutaArchivo, tipoArchivo, tamanioKb, semanaNum];
        const result = await pool.query(query, values);

        res.json({ success: true, id_evidencias: result.rows[0].id_evidencias, mensaje: 'Evidencia subida correctamente' });
    } catch (error) {
        // Si el archivo ya se había guardado pero falló la base, no se deja huérfano
        if (guardadoEnAlmacen) await almacen.eliminar(guardadoEnAlmacen);
        if (error instanceof almacen.AlmacenNoConfigurado) {
            console.error('Error al subir evidencia: falta configurar el almacenamiento de archivos (BLOB_READ_WRITE_TOKEN).');
            return res.status(503).json({ error: 'El almacenamiento de archivos aún no está configurado en el servidor. Mientras tanto puedes subir la evidencia como enlace.' });
        }
        console.error('Error al subir evidencia:', error);
        res.status(500).json({ error: 'Error interno del servidor al guardar la evidencia' });
    }
};

// Eliminar evidencia
const eliminarEvidencia = async (req, res) => {
    const { id_evidencia } = req.params;

    try {
        const query = 'SELECT ruta_archivo, tipo_archivo FROM evidencias WHERE id_evidencias = $1';
        const result = await pool.query(query, [id_evidencia]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Evidencia no encontrada' });
        }

        // Solo el dueño (o Planeación/Admin) puede borrarla
        const dueno = await duenoDeEvidencia(id_evidencia);
        const esAdmin = rolesEfectivos(req).some(r => r === 'planeacion' || r === 'admin');
        if (dueno !== idUsuarioDe(req) && !esAdmin) {
            return res.status(403).json({ error: 'No tienes permiso para eliminar esta evidencia.' });
        }

        // Una evidencia solo se borra mientras su semana está abierta (Planeación y Admin pueden siempre)
        if (!esAdmin) {
            const origen = (await pool.query(`
                SELECT e.semana, af.id_periodo
                FROM evidencias e
                JOIN indicadores i ON i.id_indicadores = e.id_indicadores
                JOIN descripcion d ON d.id_descripcion = i.id_descripcion
                JOIN asignacion_actividades aa ON aa.id_asignacionact = d.id_asignacionact
                JOIN asignacion_funciones af ON af.id_funciones = aa.id_funciones
                WHERE e.id_evidencias = $1
                LIMIT 1
            `, [id_evidencia])).rows[0];
            if (origen && origen.semana) {
                const corte = await verificarSemana(origen.semana, origen.id_periodo);
                if (!corte.abierta) {
                    return res.status(403).json({ error: corte.mensaje || 'La semana de esta evidencia ya no está abierta.' });
                }
            }
        }

        const { ruta_archivo, tipo_archivo } = result.rows[0];

        // Si es un archivo (no un enlace), también se borra del almacén
        if (tipo_archivo !== 'enlace' && ruta_archivo) {
            await almacen.eliminar(path.basename(ruta_archivo));
        }

        await pool.query('DELETE FROM evidencias WHERE id_evidencias = $1', [id_evidencia]);

        res.json({ success: true, mensaje: 'Evidencia eliminada correctamente' });
    } catch (error) {
        console.error('Error al eliminar evidencia:', error);
        res.status(500).json({ error: 'Error interno del servidor al eliminar la evidencia' });
    }
};

module.exports = {
    obtenerEvidenciasDocente,
    subirEvidencia,
    eliminarEvidencia
};
