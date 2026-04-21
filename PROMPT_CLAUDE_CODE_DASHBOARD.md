# Prompt para Claude Code — Dashboard Docente SIGAP

## Objetivo
Reconstruye completamente la página `frontend/src/pages/docente/Dashboard.tsx` para que coincida con el diseño de referencia adjunto y esté completamente conectada a la base de datos PostgreSQL a través de la API REST del backend.

---

## Diseño visual de referencia

El dashboard tiene este layout exacto:

**Sidebar izquierdo (fijo):**
- Logo SIGAP + "Período 2024-2" arriba
- Ítem activo: Dashboard
- Sección "Mi agenda" con subitems: Docencia directa, Docencia indirecta, Investigación, Acad. administrativo
- Sección: Evidencias
- Sección: Seguimiento
- Sección: Observaciones
- Abajo: avatar + nombre del docente + "Cerrar Sesión"

**Header superior:**
- Breadcrumb: Inicio / Dashboard
- Chip de usuario: nombre + rol (ej: "Docente")
- Chip de período activo: "DV · 2025 IIP"
- Ícono de notificaciones

**Banner de bienvenida (azul oscuro, ancho completo):**
- "Bienvenido, [Nombre Docente]"
- Subtítulo: Período · Programa · Tipo contrato
- Botón derecho: "Descargar Informe Académico"

**Fila de 4 tarjetas de métricas:**
1. Reloj → "40h / Total horas contrato"
2. Flecha tendencia → "58% / Avance promedio sem. 8"
3. Edificio → "4 / Funciones sustantivas"
4. Advertencia roja → "3 / Evidencias pendientes"

**Dos columnas inferiores:**

*Columna izquierda — "Distribución de horas":*
- 4 celdas: DOCENCIA DIRECTA (9h TC), DOCENCIA INDIRECTA (3h 30%), INVESTIGACIÓN (6h), ACAD. ADMINISTRATIVO (22h)
- Total asignado: 40h / 40h
- Gráfico de dona (circular) mostrando proporción

*Columna derecha — "Avance General Semana 8":*
- Lista de ítems con barra de progreso y porcentaje:
  - IS101 · Introducción Ing. Sistemas → 58%
  - IS102 · Prog. Entornos Gráficos → 58%
  - Investigación → 40%
  - Acad. Administrativo → 40%

**Barra de estado inferior (ancho completo):**
- Ícono calendario + "Estado de la agenda"
- Chips de estado: "Semana 8: Revisado" (verde), "Semana 16: Pendiente" (gris), "3 evidencias sin cargar" (rojo), "Funciones asignadas" (gris)
- Botón "Ver detalles →"

---

## Conexión a base de datos

### Endpoint nuevo a crear en el backend
Crea `backend/routes/docente.js` y `backend/controllers/docenteController.js` con este endpoint:

```
GET /api/docente/dashboard
Headers: Authorization: Bearer <token>
```

El controller debe hacer las siguientes consultas PostgreSQL usando el `id_Usuario` extraído del JWT:

**1. Datos del docente y período activo:**
```sql
SELECT 
  u.nombre, u.apellido,
  pa.nombre AS programa,
  tc.nombre AS tipo_contrato,
  p.nombre AS periodo,
  p.fecha_fin AS cierre,
  ea.horas_semana AS total_horas_contrato
FROM USUARIOS u
JOIN USUARIO_ROL ur ON ur.id_Usuario = u.id_Usuario
JOIN PROGRAMA_PERIODO pp ON pp.id_programa = ur.id_programa
JOIN PERIODO p ON p.id_periodo = pp.id_periodo AND p.activo = true
JOIN PROGRAMA_ACADEMICO pa ON pa.id_programa = pp.id_programa
JOIN TIPO_CONTRATO tc ON tc.id_tipo_contrato = u.id_tipo_contrato
JOIN ESPACIO_ACADEMICO ea ON ea.id_programa = pa.id_programa
WHERE u.id_Usuario = $1
LIMIT 1;
```

**2. Distribución de horas por función sustantiva:**
```sql
SELECT 
  af.nombre AS funcion,
  ua.horas_asignadas
FROM USUARIO_ASIGNACION ua
JOIN ASIGNACION_FUNCIONES af ON af.id_Funciones = ua.id_Funciones
JOIN PERIODO p ON p.id_periodo = ua.id_periodo AND p.activo = true
WHERE ua.id_Usuario = $1;
```

**3. Avance por actividad en Semana 8:**
```sql
SELECT 
  aa.nombre AS actividad,
  r.porcentaje_avance
FROM RESULTADOS r
JOIN ASIGNACION_ACTIVIDADES aa ON aa.id_AsignacionAct = r.id_AsignacionAct
JOIN SEMANA s ON s.id_Semana = r.id_Semana AND s.numero = 8
JOIN USUARIO_ASIGNACION ua ON ua.id_AsignacionAct = aa.id_AsignacionAct
WHERE ua.id_Usuario = $1;
```

**4. Evidencias pendientes:**
```sql
SELECT COUNT(*) AS pendientes
FROM EVIDENCIAS e
JOIN ASIGNACION_ACTIVIDADES aa ON aa.id_AsignacionAct = e.id_AsignacionAct
JOIN USUARIO_ASIGNACION ua ON ua.id_AsignacionAct = aa.id_AsignacionAct
WHERE ua.id_Usuario = $1 AND e.estado = 'pendiente';
```

**5. Estado de la agenda (semanas 8 y 16):**
```sql
SELECT 
  s.numero AS semana,
  r.estado
FROM RESULTADOS r
JOIN SEMANA s ON s.id_Semana = r.id_Semana
JOIN ASIGNACION_ACTIVIDADES aa ON aa.id_AsignacionAct = r.id_AsignacionAct
JOIN USUARIO_ASIGNACION ua ON ua.id_AsignacionAct = aa.id_AsignacionAct
WHERE ua.id_Usuario = $1 AND s.numero IN (8, 16)
GROUP BY s.numero, r.estado;
```

El endpoint debe retornar un JSON así:
```json
{
  "docente": {
    "nombre": "Diego Javier",
    "programa": "Ingeniería de Sistemas",
    "tipoContrato": "Tiempo Completo",
    "periodo": "2025 IIP",
    "cierre": "2025-12-06",
    "totalHorasContrato": 40
  },
  "metricas": {
    "totalHoras": 40,
    "avancePromedioSemana8": 58,
    "funcionesSustantivas": 4,
    "evidenciasPendientes": 3
  },
  "distribucionHoras": [
    { "funcion": "Docencia Directa", "horas": 9 },
    { "funcion": "Docencia Indirecta", "horas": 3 },
    { "funcion": "Investigación", "horas": 6 },
    { "funcion": "Acad. Administrativo", "horas": 22 }
  ],
  "avanceSemana8": [
    { "actividad": "IS101 · Introducción Ing. Sistemas", "porcentaje": 58 },
    { "actividad": "IS102 · Prog. Entornos Gráficos", "porcentaje": 58 },
    { "actividad": "Investigación", "porcentaje": 40 },
    { "actividad": "Acad. Administrativo", "porcentaje": 40 }
  ],
  "estadoAgenda": {
    "semana8": "Revisado",
    "semana16": "Pendiente",
    "funcionesAsignadas": true
  }
}
```

---

## Implementación del frontend

### Archivo: `frontend/src/pages/docente/Dashboard.tsx`

- Usa `axios` con el token de `AuthContext` para llamar `GET /api/docente/dashboard`
- Muestra un skeleton loader mientras carga
- Maneja errores con un mensaje visible
- El gráfico de dona úsalo con `recharts` (`PieChart` + `Pie` + `Cell`)
- Las barras de progreso son divs con `width: X%` y transition CSS
- Usa `lucide-react` para los íconos: `Clock`, `TrendingUp`, `Building2`, `AlertTriangle`, `Calendar`, `Download`, `Bell`, `ChevronRight`
- Colores del diseño:
  - Sidebar: `#1e293b` (azul oscuro)
  - Banner: `#1e3a5f`
  - Acento principal: `#3b82f6` (azul)
  - Verde estado: `#22c55e`
  - Rojo alerta: `#ef4444`
  - Fondo general: `#f8fafc`

### Archivo: `frontend/src/components/common/Sidebar.tsx`

Actualiza el sidebar para que muestre dinámicamente el nombre del docente desde `AuthContext` y los subitems de "Mi agenda" como links con `react-router-dom`.

### Registrar la ruta en `backend/index.js`
```js
const docenteRoutes = require('./routes/docente');
app.use('/api/docente', docenteRoutes);
```

---

## Consideraciones importantes
- Protege el endpoint con el middleware JWT existente
- El `id_Usuario` se extrae del token decodificado (`req.user.id`)
- Si no hay período activo, retorna 404 con mensaje claro
- Todos los porcentajes se redondean a entero
- El campo `porcentaje_avance` en RESULTADOS es calculado por el sistema — NO lo calcules en el frontend, úsalo directo de la BD
