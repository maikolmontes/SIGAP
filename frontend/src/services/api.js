import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const API_BASE_URL = API_URL.endsWith('/api') 
    ? API_URL 
    : `${API_URL}/api`;

export const SERVER_URL = API_BASE_URL.replace(/\/api\/?$/, '');

export const getArchivoUrl = (ruta) => {
    if (!ruta) return '';
    if (ruta.startsWith('http://') || ruta.startsWith('https://')) return ruta;
    const cleanRuta = ruta.startsWith('/') ? ruta : `/${ruta}`;
    return `${SERVER_URL}${cleanRuta}`;
};

export const getStaticFileUrl = getArchivoUrl;

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('sigap_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Un usuario puede tener varios roles. El backend necesita saber con cuál
    // está trabajando para calcular el alcance (facultad / programa / todo).
    // El backend valida esta cabecera contra los roles del token.
    try {
        const activeRole = localStorage.getItem('sigap_active_role');
        if (activeRole) {
            const nombreRol = JSON.parse(activeRole)?.nombre_rol;
            if (nombreRol) {
                config.headers['X-Rol-Activo'] = nombreRol;
            }
        }
    } catch { /* si no se puede leer, el backend usa todos los roles del token */ }

    return config;
}, (error) => {
    return Promise.reject(error);
});

export default api;