# SIGAP — Sistema de Información de Gestión de Actividad Profesoral

Aplicación web de la **Universidad CESMAG** (Pasto, Colombia) que reemplaza el flujo manual de agendas docentes (Excel, Google Drive y correo) por un sistema centralizado. Apoya el cumplimiento del Decreto 1330/2019, el Acuerdo 030/2024 y los lineamientos del CNA.

## Qué hace

1. **Planeación** configura el período, las semanas, los programas y los parámetros, y carga docentes y asignaciones.
2. El **docente** crea su agenda (funciones, actividades, indicadores) y la envía.
3. El **director** la aprueba o la devuelve con observaciones.
4. En las **semanas 8 y 16** el docente registra su avance y sube evidencias (archivos o enlaces); el sistema calcula el porcentaje.
5. El director revisa cada corte y genera el balance de gestión en Word o PDF.
6. El panel de **analítica** resume el período, con interpretación opcional con IA.

Roles: Docente, Director de programa, Planeación/Admin, Consultor (solo lectura) y Revisión.

## Tecnologías

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express
- **Base de datos:** PostgreSQL 15
- **Acceso:** Google OAuth + JWT
- **Despliegue:** Vercel (frontend y backend por separado), Neon (base) y Vercel Blob (evidencias)

## Estructura

```
SIGAP/
├── backend/    API Express: routes, controllers, services, middleware, tests
├── frontend/   Aplicación React: pages, components, services
└── database/   Scripts SQL y migraciones
```

## Puesta en marcha

Requisitos: Node.js 20+, PostgreSQL 15 y un Client ID de Google OAuth.

```bash
git clone https://github.com/maikolmontes/SIGAP.git
cd SIGAP

# Backend
cd backend
npm install
cp .env.example .env        # completa los valores
npm run dev                 # http://localhost:3000

# Frontend (otra terminal)
cd frontend
npm install
cp .env.example .env        # completa los valores
npm run dev                 # http://localhost:5173
```

El inicio de sesión es solo con cuenta de Google: el correo debe estar registrado y activo en el sistema.

## Variables de entorno esenciales

**Backend (`backend/.env`)**

| Variable | Para qué |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Conexión a PostgreSQL |
| `JWT_SECRET` | Firma de sesiones (largo y aleatorio; obligatorio en producción) |
| `EMAIL_USER`, `EMAIL_PASS` | Cuenta de Gmail y su contraseña de aplicación, para los correos |
| `GEMINI_API_KEY` | IA opcional; sin ella el panel funciona igual |

El resto (modelos de IA, avisos y recordatorios por correo, almacén de archivos, límites) está documentado en `backend/.env.example`.

**Frontend (`frontend/.env`)**

| Variable | Para qué |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Client ID de Google OAuth |
| `VITE_API_URL` | URL del backend (en local puede omitirse) |

Los archivos `.env` contienen secretos y no se suben al repositorio.

## Comandos

```bash
cd backend  && npm test           # pruebas automáticas
cd backend  && npm run respaldo   # respaldo de la base y los archivos
cd frontend && npm run build      # compilación de producción
cd frontend && npm run lint       # ESLint
```

## Despliegue

Se trabaja en `dev` y se integra a `main`; cada push a `main` despliega en Vercel. Al cambiar variables de entorno hay que redesplegar, y los scripts de `database/` se aplican a Neon junto con el despliegue del código que los usa.

## Más información

El contexto técnico detallado (modelo de datos, reglas de negocio y convenciones) está en [`CLAUDE.md`](CLAUDE.md).
