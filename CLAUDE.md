# SIGAP - Sistema de Información de Gestión de Aprendizaje

## Descripción del Proyecto

SIGAP es una aplicación fullstack para la gestión institucional educativa. Desarrollado con Node.js/Express en el backend y React/Vite en el frontend.

## Estructura del Proyecto

```
SIGAP/
├── backend/          # API REST con Node.js + Express
├── frontend/         # SPA con React 19 + Vite + TypeScript + TailwindCSS
```

## Backend

**Stack:** Node.js, Express, PostgreSQL, JWT

- **`backend/index.js`**: Punto de entrada del servidor
- **`backend/db/connection.js`**: Configuración de conexión a PostgreSQL (pool)
- **`backend/routes/`**: Definición de rutas API
  - `/api/auth` - Autenticación
  - `/api/usuarios` - Gestión de usuarios
  - `/api/agenda` - Agenda institucional
  - `/api/funciones` - Funciones del sistema
- **`backend/controllers/`**: Lógica de negocio
- **Variables de entorno**: `.env` con `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `PORT`

**Comandos:**
- `npm run dev` - Inicia con nodemon (desarrollo)
- `npm start` - Inicia servidor producción

## Frontend

**Stack:** React 19, TypeScript, Vite, React Router DOM, TailwindCSS, Axios

- **`frontend/src/main.tsx`**: Punto de entrada
- **`frontend/src/App.tsx`**: Configuración de rutas
- **`frontend/src/context/AuthContext.tsx`**: Contexto de autenticación (usuario, token, login/logout)
- **`frontend/src/components/common/`**: Componentes compartidos
  - `ProtectedRoute.tsx` - Ruta protegida por autenticación
  - `Layout.tsx` - Layout principal con Sidebar/Topbar
  - `Sidebar.tsx`, `Topbar.tsx` - Navegación
- **`frontend/src/pages/`**: Páginas por rol
  - `auth/Login.tsx` - Inicio de sesión
  - `planeacion/` - Dashboard Planeacion, Docentes
  - `director/` - Dashboard Director

**Rutas principales:**
- `/login` - Login (pública)
- `/planeacion/dashboard` - Dashboard planeación (protegida)
- `/planeacion/docentes` - Gestión docentes (protegida)
- `/director/dashboard` - Dashboard director (protegida)

**Comandos:**
- `npm run dev` - Inicia Vite en desarrollo
- `npm run build` - Build de producción
- `npm run lint` - Ejecuta ESLint

## Autenticación

- JWT almacenado en localStorage (`sigap_token`, `sigap_user`)
- `ProtectedRoute` verifica autenticación antes de renderizar rutas
- Login determina rol del usuario y redirige al dashboard correspondiente

## Consideraciones de Desarrollo

- El frontend usa proxy o conexión directa al backend en `http://localhost:3000`
- TailwindCSS configurado para estilos
- Iconos con `lucide-react`
- Google OAuth disponible vía `@react-oauth/google`
