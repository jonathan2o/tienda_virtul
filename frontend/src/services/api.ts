import axios from 'axios';
import { getAccessToken, logout } from './authService';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api/',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            logout();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
