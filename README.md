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

