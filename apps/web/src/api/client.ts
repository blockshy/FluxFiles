import axios from 'axios';
import { clearStoredSession, readStoredSession } from '../features/admin/storage';
import { withAppBase } from '../lib/base';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const session = readStoredSession();
  if (session?.token) {
    config.headers.Authorization = `Bearer ${session.token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const adminRoot = withAppBase('/admin');
    const adminLogin = withAppBase('/admin/login');

    if (error.response?.status === 401 && window.location.pathname.startsWith(adminRoot)) {
      clearStoredSession();
      if (window.location.pathname !== adminLogin) {
        window.location.href = adminLogin;
      }
    }
    return Promise.reject(error);
  },
);
