SIGAP — Contexto del Proyecto para Claude Code
Qué es este proyecto
Sistema de Información de Gestión de Actividad Profesoral (SIGAP). Tesis de grado, Universidad CESMAG, Pasto, Colombia. Reemplaza el flujo manual de agendas docentes (Excel + Google Drive + correo) con una app fullstack centralizada. Debe cumplir Decreto 1330/2019, Acuerdo 030/2024 y estándares CNA.
Stack

Backend: Node.js + Express (API REST) — carpeta /backend
Frontend: React 19 + TypeScript + Vite + TailwindCSS — carpeta /frontend
Base de datos: PostgreSQL 15 — scripts en /database
Analítica: nativa en React + Recharts sobre /api/analitica, con interpretación descriptiva opcional vía Gemini
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
Tablas N:N: USUARIO_ROL, ROL_PERMISO, USUARIO_NIVEL, USUARIO_ASIGNACION, SEMESTRES_GRUPOS, DIRECTOR_PROGRAMA

Directores y programas (database/director_programa.sql)

Un Director gestiona uno o varios programas y un programa puede tener varios directores: tabla N:N director_programa
usuarios.id_programa se conserva: para un docente es su programa; para un director, su programa principal
El alcance de un Director se resuelve SIEMPRE con alcanceProgramas(req) / docenteEnAlcance(req, id) de backend/utils/rolActivo.js (filtro `u.id_programa = ANY($n::int[])`)
Un Director sin programas asignados no ve nada; nunca se cae a "toda la institución" ni a un programa por defecto

Usuarios (backend/controllers/usuariosController.js)

/api/usuarios exige token; crear, editar, listar, borrar y activar es solo Planeación/Admin. El perfil (/:id, /perfil, /perfil-completo) es propio o admin
Alta y edición pasan por validarDatosUsuario (una sola función): nombres/apellidos, correo, tipo y número de documento, roles existentes, programa existente y activo, contrato, programas del director y duplicados (409). Devuelve la lista completa de errores en `errores`
Alta y edición usan una transacción real (pool.connect), no pool.query('BEGIN')
Campo calculado automático — NO editar manualmente: porcentaje_avance en RESULTADOS

Fórmula: porcentaje_avance = (ejecucion / meta) * 100



Roles y lo que puede hacer cada uno

Docente: crea agenda, selecciona funciones sustantivas, asigna materias, registra ejecución en Semana 8 y 16, sube evidencias
Director de Programa: aprueba/rechaza agendas y seguimientos, crea informes de gestión, gestiona periodos y programas
Planeación / Admin: gestiona usuarios, roles, estructura académica completa (facultades, programas, pensules, espacios)
consultor/planeacion: solo lectura — consulta el panel de analítica y exporta reportes

Flujo del negocio

Admin configura periodo + programas + pensules + espacios académicos
Docente crea agenda → selecciona funciones sustantivas → asigna materias (horas vienen automáticamente de ESPACIO_ACADEMICO.horas_semana)
Docente envía agenda → Director aprueba o rechaza con observaciones
Semana 8 y Semana 16: Docente registra ejecución → sistema calcula porcentaje_avance automáticamente
Docente sube evidencias → Director aprueba seguimiento
Director crea informe de gestión → Docentes completan actividades → Director envía a Planeación
El panel de analítica consulta /api/analitica, que agrega directamente sobre PostgreSQL

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
No usar las vistas v_analitica_* — están obsoletas y defectuosas (ver database/v_analitica_sigap.sql)
No enviar a Gemini nombres, correos ni documentos — solo métricas agregadas; IND-04 está excluido por diseño

Analítica descriptiva (React + Recharts + Gemini)

Endpoints: /api/analitica/periodos, /catalogo, /resumen, /docentes-detalle, /interpretar, /ia/estado
Catálogo de indicadores: backend/config/catalogoAnalitica.js (IND-01 a IND-07, con roles autorizados)
Consultas: backend/controllers/analiticaController.js — parametrizadas, sin vistas SQL
Interpretación IA: backend/services/geminiService.js — degrada sin romper si falta GEMINI_API_KEY
Asistente de preguntas: POST /api/analitica/preguntar { pregunta, periodoId?, programaId?, facultadId? } → services/geminiService.js responderPregunta. El SERVIDOR calcula las cifras con el alcance del usuario (armarResumen en analiticaController); el navegador nunca manda cifras. A la IA solo salen indicadores agregados (sin IND-04, sin nombres); la pregunta va marcada como texto no confiable; solo se aceptan ids de indicadores enviados; caché por pregunta+cifras; tope por usuario y día (ANALYTICS_QA_DAILY_LIMIT, 15 por omisión) y por minuto (ANALYTICS_AI_RATE_LIMIT); modelo opcional GEMINI_QA_MODEL (por omisión GEMINI_MODEL). Degrada con motivo (no_configurado, limite_diario, cuota_agotada…) sin romper el panel
IND-10 (peso de cada función en la meta y avance sin Docencia Directa), IND-11 (revisión de cortes) e IND-12 (cobertura de agendas) viven en backend/services/analiticaDescriptiva.js
Frontend: frontend/src/pages/common/Analitica.tsx + components/analitica/ + services/analiticaService.ts
El backend entrega datos sin colores ni estilos; la paleta se decide en components/analitica/paleta.ts
La analítica excluye el catálogo maestro (funciones sin docente) uniendo contra usuario_asignacion
horas_contrato puede ser 0 (Hora Cátedra, Por Definir): toda división usa NULLIF
Balance de gestión (Reportes del Director)
GET /api/director/balance-gestion?programa=&periodo= — devuelve el documento YA REDACTADO: backend/services/balanceGestion.js junta los datos y backend/services/balanceDocumento.js escribe el texto (secciones con párrafos, listas y tablas); el frontend solo lo muestra y lo convierte en Word (utils/balanceWord.ts, armado a mano con jszip) y PDF (utils/balancePdf.ts, jsPDF), cargados solo al descargar
El alcance del Director sale de alcanceProgramas (403 si el programa no es suyo). Mismas definiciones que la analítica: estado de agenda por precedencia (Devuelta > Aprobada > En revisión > Pendiente), avance = ejecución de indicadores / meta, solo funciones con docente
Cada actividad aparece con su descripción (resultado esperado), indicadores y evidencias; en Docencia Directa las descripciones repetidas por clase se agrupan. La valoración del director (logros, dificultades…) se escribe en pantalla y va al documento; no se guarda
Períodos intersemestrales: periodo.semestre 1=I, 2=II, 3=Intersemestral I, 4=Intersemestral II. El nombre sale SIEMPRE de backend/utils/periodo.js o frontend/src/utils/periodo.ts (no usar semestre === 1 ? 'I' : 'II'). En un intersemestral los cortes (internos 8 y 16) se muestran "Semana X" hasta definir las semanas

Semanas / cortes abiertos (backend/utils/semanaAbierta.js)
Una semana (0, 8 o 16) está ABIERTA solo si Planeación la dejó habilitada Y hoy (hora de Colombia) cae entre fecha_inicio y fecha_fin (extremos incluidos; una fecha vacía no limita). Pasada la de cierre el docente solo CONSULTA. El servidor lo aplica en guardar-funcion (semana 0), guardar-avance (recibe `semana`: 8 o 16, solo escribe la columna de ese corte), subir y eliminar evidencias (Planeación/Admin quedan exentos); GET /api/semanas devuelve abierta, motivo_cierre y mensaje_cierre y las pantallas solo los muestran (reportes y evidencias en modo solo lectura).

Archivos de evidencias (backend/services/almacenEvidencias.js)
En Vercel el disco es de solo lectura: los archivos NO se guardan en backend/uploads. Con un almacén de Vercel Blob conectado (BLOB_STORE_ID basta: la librería se autentica sola con OIDC; también sirve BLOB_READ_WRITE_TOKEN) van a Vercel Blob en un almacén PRIVADO (sin URL pública): se leen desde el servidor en GET /uploads/evidencias/:archivo, después de comprobar token y permiso (servirArchivo). Sin almacén y fuera de Vercel (desarrollo) se usa la carpeta local backend/uploads/evidencias (ignorada por git). Sin almacén dentro de Vercel el servidor responde 503 con un mensaje claro y los enlaces siguen funcionando. En la base solo se guarda la ruta /uploads/evidencias/<nombre>; multer recibe el archivo en memoria (tope 10 MB)

Informe de evidencias del docente (pestaña Reportes del docente, /docente/reportes)
GET /api/docente/reporte-evidencias?periodo= (token del propio docente; por omisión el período activo): backend/services/reporteDocente.js junta los datos (función → actividad → indicador: meta, ejecución semana 8/16 y evidencias) y redacta el documento con la MISMA forma del balance de gestión; el frontend lo muestra y reutiliza utils/balanceWord.ts y utils/balancePdf.ts (archivoBase cambia el nombre del archivo). Mismo permiso de página que Evidencias ("Evidencias e Indicadores"). Estructura: una sección por función (con su resumen) y una por actividad, cada una con una tabla de descripciones e indicadores (meta, ejecución, avance) y otra de sus evidencias. Cada evidencia puede traer una descripción breve (evidencias.descripcion VARCHAR(300), opcional, la escribe el docente al subirla; database/evidencias_descripcion.sql, y utils/esquemaEvidencias.js crea la columna sola si falta).

Notificaciones por correo (Gmail / Nodemailer)

Servicio central: backend/services/emailService.js (transporte SMTP, sendEmail, sendEmailAsync, verificarConexion)
Reglas de negocio: backend/services/notificacionesService.js (resuelve destinatarios y evita duplicados)
Plantillas HTML: backend/utils/emailTemplates.js (colores CESMAG #1a2744 / #00a896 / #ea580c)
Endpoints admin: /api/notificaciones/estado, /prueba, /recordatorios, /periodo/:id
Panel frontend: /planeacion/notificaciones
Bitácora: tabla notificaciones_log (database/notificaciones_log.sql) — el backend la crea si no existe
Diagnóstico: cd backend && node test_email.js correo@cesmag.edu.co

Eventos automáticos: agenda completa → director; agenda aprobada/devuelta → docente; usuario creado → bienvenida.
Observación del director (semana 8/16) → campana y correo del docente (tipo observacion_director; notificacionesService.notificarObservacionDirector + notificacionesApp.avisarObservacionDirector): un solo aviso por actividad y corte mientras el docente no lo lea (tampoco se envía otro correo), con enlace a /docente/avance-semana-8|16.
Eventos masivos (desactivados por defecto, se activan con EMAIL_AVISO_PERIODO / EMAIL_AVISO_ASIGNACIONES): apertura de período e importación de asignaciones.
Los correos nunca deben romper una transacción: siempre se disparan con notificaciones.background.* después del COMMIT.
