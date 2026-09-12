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
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default api;
