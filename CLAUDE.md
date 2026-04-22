SIGAP — Contexto del Proyecto para Claude Code
Qué es este proyecto
Sistema de Información de Gestión de Actividad Profesoral (SIGAP). Tesis de grado, Universidad CESMAG, Pasto, Colombia. Reemplaza el flujo manual de agendas docentes (Excel + Google Drive + correo) con una app fullstack centralizada. Debe cumplir Decreto 1330/2019, Acuerdo 030/2024 y estándares CNA.
Stack

Backend: Node.js + Express (API REST) — carpeta /backend
Frontend: React 19 + TypeScript + Vite + TailwindCSS — carpeta /frontend
Base de datos: PostgreSQL 15 — scripts en /database
Analítica: Power BI via DirectQuery sobre PostgreSQL
Auth: JWT + bcrypt + Google OAuth (@react-oauth/google)

Estructura de carpetas
SIGAP/
├── backend/
│   ├── index.js                  # Entrada del servidor
│   ├── db/connection.js          # Pool de conexión PostgreSQL
│   ├── routes/                   # Rutas API
│   └── controllers/              # Lógica de negocio
├── frontend/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx               # Configuración de rutas
│       ├── context/
│       │   └── AuthContext.tsx   # usuario, token, login, logout
│       ├── components/common/
│       │   ├── ProtectedRoute.tsx
│       │   ├── Layout.tsx
│       │   ├── Sidebar.tsx
│       │   └── Topbar.tsx
│       └── pages/
│           ├── auth/Login.tsx
│           ├── planeacion/       # Dashboard, Docentes
│           └── director/         # Dashboard
└── database/                     # Scripts SQL
Variables de entorno (backend .env)
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, PORT=3000
Rutas API actuales

POST /api/auth — login
GET/POST /api/usuarios — gestión usuarios
GET/POST /api/agenda — agenda docente
GET/POST /api/funciones — funciones sustantivas

Rutas frontend

/login — pública
/planeacion/dashboard — protegida, rol Planeación
/planeacion/docentes — protegida, rol Planeación
/director/dashboard — protegida, rol Director

Autenticación

JWT guardado en localStorage como sigap_token y sigap_user
ProtectedRoute.tsx bloquea rutas sin token
Login lee el rol del usuario y redirige al dashboard correspondiente
Google OAuth disponible pero opcional

Base de datos — 27 tablas en 5 bloques
Bloque 1 — Seguridad
USUARIOS, ROLES, PERMISOS, USUARIO_ROL, ROL_PERMISO, NIVEL_ACADEMICO, USUARIO_NIVEL
Bloque 2 — Estructura Institucional
TIPO_CONTRATO, FACULTAD, PROGRAMA_ACADEMICO, PENSUL_ACADEMICO, SEMESTRES, ESPACIO_ACADEMICO, GRUPOS, SEMESTRES_GRUPOS, PERIODO, PROGRAMA_PERIODO
Bloque 3 — Agenda Docente
ASIGNACION_FUNCIONES, USUARIO_ASIGNACION, ASIGNACION_ACTIVIDADES
Bloque 4 — Seguimiento
DESCRIPCION, INDICADORES, EVIDENCIAS, SEMANA, ACTIVIDAD_SEMANA, RESULTADOS
Bloque 5 — Informe de Gestión
INFORME_GESTION, INFORME_ACTIVIDAD, INFORME_INDICADOR, INFORME_EVIDENCIA
Convenciones de la BD

PKs: id_Usuario, id_Funciones, id_AsignacionAct, id_Espacio_Aca, id_PensulAca, id_ActSemana, id_Resultados
Tablas N:N: USUARIO_ROL, ROL_PERMISO, USUARIO_NIVEL, USUARIO_ASIGNACION, SEMESTRES_GRUPOS
Campo calculado automático — NO editar manualmente: porcentaje_avance en RESULTADOS

Fórmula: porcentaje_avance = (ejecucion / meta) * 100



Roles y lo que puede hacer cada uno

Docente: crea agenda, selecciona funciones sustantivas, asigna materias, registra ejecución en Semana 8 y 16, sube evidencias
Director de Programa: aprueba/rechaza agendas y seguimientos, crea informes de gestión, gestiona periodos y programas
Planeación / Admin: gestiona usuarios, roles, estructura académica completa (facultades, programas, pensules, espacios)
consultor/planeacion: solo lectura — consulta dashboards Power BI y exporta reportes

Flujo del negocio

Admin configura periodo + programas + pensules + espacios académicos
Docente crea agenda → selecciona funciones sustantivas → asigna materias (horas vienen automáticamente de ESPACIO_ACADEMICO.horas_semana)
Docente envía agenda → Director aprueba o rechaza con observaciones
Semana 8 y Semana 16: Docente registra ejecución → sistema calcula porcentaje_avance automáticamente
Docente sube evidencias → Director aprueba seguimiento
Director crea informe de gestión → Docentes completan actividades → Director envía a Planeación
Power BI conecta via DirectQuery a PostgreSQL para dashboards en tiempo real

Comandos útiles
bash# Backend
cd backend && npm run dev      # desarrollo con nodemon
cd backend && npm start        # producción

# Frontend
cd frontend && npm run dev     # Vite dev server
cd frontend && npm run build   # build producción
cd frontend && npm run lint    # ESLint
Lo que NO hacer

No editar porcentaje_avance directamente en la BD — es calculado por el sistema
No modificar tablas N:N directamente sin pasar por los endpoints correspondientes
Power BI usa DirectQuery — no cargar datos en caché ni duplicar tablas para reportes