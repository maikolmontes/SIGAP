const pool = require('../db/connection');
const path = require('path');
const fs = require('fs');

// Obtener evidencias por docente (organizadas por función y actividad)
const obtenerEvidenciasDocente = async (req, res) => {
    const { id_usuario } = req.params;

    try {
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
                e.fecha_carga
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
                fecha_carga: row.fecha_carga
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
    const { id_indicador, tipo_evidencia, enlace_texto } = req.body;

    if (!id_indicador) {
        return res.status(400).json({ error: 'Se requiere el id del indicador' });
    }

    try {
        let nombreArchivo = null;
        let rutaArchivo = null;
        let tipoArchivo = null;
        let tamanioKb = null;

        if (tipo_evidencia === 'link') {
            if (!enlace_texto) {
                return res.status(400).json({ error: 'El enlace está vacío' });
            }
            nombreArchivo = enlace_texto; // Guardar el link como nombre
            rutaArchivo = enlace_texto;
            tipoArchivo = 'enlace';
            tamanioKb = 0;
        } else {
            if (!req.file) {
                return res.status(400).json({ error: 'No se subió ningún archivo' });
            }
            // Para archivos
            nombreArchivo = req.file.originalname;
            // Guardamos ruta relativa accesible desde el frontend
            rutaArchivo = `/uploads/evidencias/${req.file.filename}`;
            tipoArchivo = req.file.mimetype;
            tamanioKb = Math.round(req.file.size / 1024);
        }

        const query = `
            INSERT INTO evidencias (id_indicadores, nombre_archivo, ruta_archivo, tipo_archivo, tamanio_archivo_kb)
            VALUES ($1, $2, $3, $4, $5) RETURNING id_evidencias
        `;

        const values = [id_indicador, nombreArchivo, rutaArchivo, tipoArchivo, tamanioKb];
        const result = await pool.query(query, values);

        res.json({ success: true, id_evidencias: result.rows[0].id_evidencias, mensaje: 'Evidencia subida correctamente' });
    } catch (error) {
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

        const { ruta_archivo, tipo_archivo } = result.rows[0];

        // Si es un archivo físico, intentar eliminarlo del disco
        if (tipo_archivo !== 'enlace' && ruta_archivo) {
            const filePath = path.join(__dirname, '..', ruta_archivo);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
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
