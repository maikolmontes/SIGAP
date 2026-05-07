# SIGAP - Sistema de Información de Gestión de Actividad Profesoral

## Descripció
**SIGAP** es una solución integral para la **Universidad CESMAG** (Pasto, Colombia) diseñada para reemplazar el flujo manual de agendas docentes (Excel, Google Drive, correos) por una aplicación web centralizada. El sistema asegura el cumplimiento de normativas como el Decreto 1330/2019 y el Acuerdo 030/2024.

## Tecnologías Utilizadas
*   **Frontend:** React 19, TypeScript, Vite, TailwindCSS.
*   **Backend:** Node.js, Express (API REST).
*   **Base de Datos:** PostgreSQL 15.
*   **Autenticación:** JWT + bcrypt + Google OAuth.
*   **Analítica:** Power BI via DirectQuery sobre PostgreSQL.

## Estructura del Proyecto
*   `/backend`: Servidor API, controladores de negocio y conexión a base de datos.
*   `/frontend`: Aplicación cliente con interfaz para Docentes, Directores y Planeación.

## Instalación y Configuración

### Prerrequisitos
*   Node.js (v18+)
*   PostgreSQL 15

### Pasos para Ejecutar
1.  **Clonar el repositorio.**
2.  **Configurar el Backend:**
    *   `cd backend`
    *   `npm install`
    *   Crear un archivo `.env` basado en las variables: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `PORT=3000`.
    *   Ejecutar: `npm run dev`
3.  **Configurar el Frontend:**
    *   `cd frontend`
    *   `npm install`
    *   Ejecutar: `npm run dev`

---

## Consultas SQL de Base de Datos

### Consulta Detallada de Agenda Docente
Esta consulta permite obtener la información completa de un usuario, incluyendo sus funciones sustantivas, actividades asignadas, descripciones de resultados e indicadores de seguimiento:

```sql
SELECT 
    u.nombres || ' ' || u.apellidos AS nombre_docente,
    af.funcion_sustantiva,
    af.horas_funcion,
    aa.rol_seleccionado AS actividad_rol,
    ea.nombre_espacio AS espacio_academico,
    d.resultado_esperado,
    d.meta,
    i.nombre_indicador,
    i.ejecucion_8 AS avance_semana_8,
    i.ejecucion_16 AS avance_semana_16,
    i.observaciones
FROM usuarios u
JOIN usuario_asignacion ua ON u.id_usuario = ua.id_usuario
JOIN asignacion_funciones af ON ua.id_funciones = af.id_funciones
JOIN asignacion_actividades aa ON af.id_funciones = aa.id_funciones
LEFT JOIN espacio_academico ea ON aa.id_espacio_aca = ea.id_espacio_aca
LEFT JOIN descripcion d ON aa.id_asignacionact = d.id_asignacionact
LEFT JOIN indicadores i ON d.id_descripcion = i.id_descripcion
WHERE u.id_usuario = $1 -- Reemplazar con el ID del usuario
ORDER BY af.id_funciones, aa.id_asignacionact, d.id_descripcion;
```

### Tablas Principales del Sistema
El sistema se organiza en bloques funcionales:
*   **Seguridad:** `usuarios`, `roles`, `permisos`, `usuario_rol`, `nivel_academico`.
*   **Estructura:** `tipo_contrato`, `facultad`, `programa_academico`, `periodo`.
*   **Agenda:** `asignacion_funciones`, `usuario_asignacion`, `asignacion_actividades`.
*   **Seguimiento:** `descripcion`, `indicadores`, `evidencias`, `semana`, `actividad_semana`, `resultados`.
