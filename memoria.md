# Memoria de Trabajo - SIGAP (Dashboard Docente)

## Progreso Reciente

1.  **Frontend (`Dashboard.tsx`)**:
    *   Se completó la interfaz gráfica del Dashboard del Docente siguiendo el diseño propuesto (Sidebar, header, barra de progreso, tarjetas de métricas).
    *   Se implementó la conexión con el backend a través de Axios llamando al endpoint `/api/docente/dashboard`.
    *   Se utilizó `recharts` para la gráfica circular de distribución de horas y estilo responsivo utilizando Tailwind CSS.
    *   **Mejoras recientes:** Se optimizó la barra de estado inferior para reflejar claramente los cortes de seguimiento académico (`Corte 1 (Sem 8)` y `Corte 2 (Sem 16)`), contar correctamente el número de evidencias pendientes por adjuntar y cambiar la redacción de las funciones a "distribuidas / por distribuir".

2.  **Backend (API Docente)**:
    *   Se creó/configuró el endpoint y controlador necesarios (`/api/docente/dashboard`) que obtienen datos desde PostgreSQL.
    *   La respuesta del backend unifica la información del docente, métricas generales, distribución de horas, avance de la Semana 8 y estado de la agenda para ser consumidos directamente por la interfaz.
    *   La base de datos interactúa validando que el docente está en un período activo y cruzando correctamente los datos de avance.

3.  **Documentación (`DIAGRAMAER.md`)**:
    *   Se actualizaron las especificaciones con los principales Roles del sistema y sus casos de uso:
        *   **Docente:** Registra actividades, su agenda y sube evidencias.
        *   **Director de Programa:** Valida las agendas, las aprueba y realiza seguimiento a las semanas 8 y 16.
        *   **Planeación / Administrador:** Configura el sistema, maneja usuarios, períodos y estructura académica.
        *   **Consultor / Auditor:** Rol de solo lectura para auditoría y evaluación.

## Pendientes / Siguientes Pasos
*(Añadir aquí las tareas con las que se continuará la próxima vez)*
*   Página de sub-ítems (`/docente/docencia-directa`, etc.).
*   Verificar si `frontend/src/components/common/Sidebar.tsx` actualiza dinámicamente o si el sidebar de `Dashboard.tsx` es temporal.
*   Conectar completamente los formularios para subir evidencias y editar agendas académicas.
