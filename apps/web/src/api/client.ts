import axios from 'axios';
import { clearStoredUserSession, readStoredUserSession } from '../features/user/storage';
import { withAppBase } from '../lib/base';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const userSession = readStoredUserSession();
  const token = userSession?.token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const adminRoot = withAppBase('/admin');
    const userRoot = withAppBase('/me');
    const userLogin = withAppBase('/login');

    if (error.response?.status === 401 && window.location.pathname.startsWith(adminRoot)) {
      clearStoredUserSession();
      if (window.location.pathname !== userLogin) {
        window.location.href = userLogin;
      }
    }

    if (error.response?.status === 401 && window.location.pathname.startsWith(userRoot)) {
      clearStoredUserSession();
      if (window.location.pathname !== userLogin) {
        window.location.href = userLogin;
      }
    }
    return Promise.reject(error);
  },
);
