// ============================================
// src/services/api.js
// Axios con refresh automático de JWT + cierre seguro de sesión
// ============================================
import axios from "axios";

const baseURL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000/api";

const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

// Evitar loops de refresh
let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, token = null) => {
  refreshQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  refreshQueue = [];
};

// ===============================
// REQUEST → adjuntar access token
// ===============================
api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("access");
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ===============================
// RESPONSE → si 401, intentar refresh
// ===============================
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;

    // Si no hay request original, cortar
    if (!originalRequest) return Promise.reject(error);

    // Evitar reintentar endpoints de login/registro
    const isAuthEndpoint =
      originalRequest.url?.includes("usuarios/auth/login") ||
      originalRequest.url?.includes("usuarios/auth/registro") ||
      originalRequest.url?.includes("api/token");

    if (status !== 401 || isAuthEndpoint) {
      return Promise.reject(error);
    }

    // Evitar bucle infinito
    if (originalRequest._retry) {
      // ya lo intentó y falló
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/") window.location.href = "/";
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const refreshToken = localStorage.getItem("refresh");
    if (!refreshToken) {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/") window.location.href = "/";
      return Promise.reject(error);
    }

    // Si ya hay refresh en curso, encolar
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((newAccess) => {
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      });
    }

    isRefreshing = true;

    try {
      // Endpoint de refresh: tu backend tiene:
      // - /api/token/refresh/ (global)
      // - y también /api/usuarios/auth/refresh/ (en usuarios urls)
      // Para ser consistentes con lo que ya tienes en config/urls.py:
      const res = await axios.post(
        `${baseURL.replace(/\/$/, "")}/token/refresh/`.replace("/api/api", "/api"),
        { refresh: refreshToken },
        { headers: { "Content-Type": "application/json" } }
      );

      const newAccess = res.data?.access;
      if (!newAccess) throw new Error("No se recibió access token en refresh");

      localStorage.setItem("access", newAccess);

      processQueue(null, newAccess);
      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/") window.location.href = "/";
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
