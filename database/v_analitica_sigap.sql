-- ==============================================================================
-- SIGAP - Vistas Analíticas para Power BI (DirectQuery) y Dashboard Web
-- Universidad CESMAG - Sistema de Información de Gestión de Actividad Profesoral
-- ==============================================================================

-- 1. VISTA: Cumplimiento Docente General y Carga Horaria
CREATE OR REPLACE VIEW v_analitica_cumplimiento_docente AS
SELECT 
    u.id_usuario,
    TRIM(CONCAT(u.nombres, ' ', COALESCE(u.apellidos, ''))) AS docente_nombre,
    u.correo AS docente_correo,
    u.numero_documento,
    COALESCE(tc.tipo, 'Hora Cátedra') AS tipo_contrato,
    COALESCE(tc.horas_contrato, 40) AS horas_contrato,
    p.id_periodo,
    CONCAT(p.anio, ' - ', CASE WHEN p.semestre = 1 THEN 'I' ELSE 'II' END) AS periodo_academico,
    af.id_funciones,
    af.funcion_sustantiva,
    COALESCE(af.estado_agenda, 'Pendiente') AS estado_agenda,
    COALESCE(SUM(aa.horas_rol), 0) AS horas_asignadas,
    COALESCE(SUM(acs.ejecucion), 0) AS ejecucion_total,
    COALESCE(ROUND(AVG(r.porcentaje_avance)::numeric, 2), 0.00) AS porcentaje_avance_calculado
FROM usuarios u
LEFT JOIN tipo_contrato tc ON u.id_contrato = tc.id_contrato
LEFT JOIN usuario_asignacion ua ON u.id_usuario = ua.id_usuario
LEFT JOIN asignacion_funciones af ON ua.id_funciones = af.id_funciones
LEFT JOIN periodo p ON af.id_periodo = p.id_periodo
LEFT JOIN asignacion_actividades aa ON af.id_funciones = aa.id_funciones
LEFT JOIN actividad_semana acs ON aa.id_asignacionact = acs.id_asignacionact
LEFT JOIN resultados r ON acs.id_resultados = r.id_resultados
GROUP BY 
    u.id_usuario, u.nombres, u.apellidos, u.correo, u.numero_documento, tc.tipo, tc.horas_contrato,
    p.id_periodo, p.anio, p.semestre, af.id_funciones, af.funcion_sustantiva, af.estado_agenda;


-- 2. VISTA: Distribución de Horas por Función Sustantiva (Docencia, Investigación, Proyección, Gestión)
CREATE OR REPLACE VIEW v_analitica_distribucion_funciones AS
SELECT 
    p.id_periodo,
    CONCAT(p.anio, ' - ', CASE WHEN p.semestre = 1 THEN 'I' ELSE 'II' END) AS periodo_academico,
    af.funcion_sustantiva,
    COALESCE(aa.rol_seleccionado, 'Docente') AS rol_actividad,
    COUNT(DISTINCT u.id_usuario) AS total_docentes,
    COALESCE(SUM(aa.horas_rol), 0) AS total_horas
FROM asignacion_funciones af
JOIN periodo p ON af.id_periodo = p.id_periodo
LEFT JOIN usuario_asignacion ua ON af.id_funciones = ua.id_funciones
LEFT JOIN usuarios u ON ua.id_usuario = u.id_usuario
LEFT JOIN asignacion_actividades aa ON af.id_funciones = aa.id_funciones
GROUP BY p.id_periodo, p.anio, p.semestre, af.funcion_sustantiva, aa.rol_seleccionado;


-- 3. VISTA: Avance de Metas e Indicadores por Cortes (Semana 8 vs Semana 16)
CREATE OR REPLACE VIEW v_analitica_seguimiento_cortes AS
SELECT 
    u.id_usuario,
    TRIM(CONCAT(u.nombres, ' ', COALESCE(u.apellidos, ''))) AS docente_nombre,
    af.funcion_sustantiva,
    s.numero_semana,
    CASE 
        WHEN s.numero_semana::text = '8' THEN 'Corte I (Semana 8)'
        WHEN s.numero_semana::text = '16' THEN 'Corte II (Semana 16)'
        ELSE CONCAT('Semana ', s.numero_semana)
    END AS nombre_corte,
    acs.ejecucion,
    COALESCE(r.porcentaje_avance, 0) AS porcentaje_avance
FROM actividad_semana acs
JOIN semana s ON acs.id_semana = s.id_semana
JOIN resultados r ON acs.id_resultados = r.id_resultados
JOIN asignacion_actividades aa ON acs.id_asignacionact = aa.id_asignacionact
JOIN asignacion_funciones af ON aa.id_funciones = af.id_funciones
JOIN usuario_asignacion ua ON af.id_funciones = ua.id_funciones
JOIN usuarios u ON ua.id_usuario = u.id_usuario;


-- 4. VISTA: Resumen Ejecutivo de KPIs por Período Académico
CREATE OR REPLACE VIEW v_analitica_kpis_programa AS
SELECT 
    p.id_periodo,
    CONCAT(p.anio, ' - ', CASE WHEN p.semestre = 1 THEN 'I' ELSE 'II' END) AS periodo_academico,
    COUNT(DISTINCT u.id_usuario) AS docentes_totales,
    COUNT(DISTINCT CASE WHEN LOWER(af.estado_agenda) = 'aprobada' OR LOWER(af.estado_agenda) = 'aceptada' THEN u.id_usuario END) AS docentes_aprobados,
    COUNT(DISTINCT CASE WHEN LOWER(af.estado_agenda) = 'pendiente' OR LOWER(af.estado_agenda) = 'en revision' THEN u.id_usuario END) AS docentes_pendientes,
    COUNT(DISTINCT CASE WHEN LOWER(af.estado_agenda) = 'devuelta' OR LOWER(af.estado_agenda) = 'rechazada' THEN u.id_usuario END) AS docentes_devueltos,
    COALESCE(SUM(aa.horas_rol), 0) AS horas_totales_asignadas
FROM periodo p
LEFT JOIN asignacion_funciones af ON p.id_periodo = af.id_periodo
LEFT JOIN usuario_asignacion ua ON af.id_funciones = ua.id_funciones
LEFT JOIN usuarios u ON ua.id_usuario = u.id_usuario
LEFT JOIN asignacion_actividades aa ON af.id_funciones = aa.id_funciones
GROUP BY p.id_periodo, p.anio, p.semestre;
