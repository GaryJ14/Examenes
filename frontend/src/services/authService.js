// ============================================
// src/services/authService.js
// Login/Registro/Logout con claves consistentes (access/refresh)
// ============================================
import api from "./api";

const authService = {
  login: async (correo_electronico, password) => {
    const res = await api.post("usuarios/auth/login/", { correo_electronico, password });

    if (res.data?.access && res.data?.refresh) {
      localStorage.setItem("access", res.data.access);
      localStorage.setItem("refresh", res.data.refresh);
      localStorage.setItem("user", JSON.stringify(res.data.usuario));
    }

    return res.data;
  },

  register: async (userData) => {
    const payload = {
      cedula: userData.cedula || "",
      nombres: userData.nombres || "",
      apellidos: userData.apellidos || "",
      correo_electronico: userData.correo_electronico || "",
      password: userData.password || "",
      password_confirmacion: userData.password_confirmacion || "",
      rol: userData.rol || "ESTUDIANTE",
    };

    const res = await api.post("usuarios/auth/registro/", payload, {
      headers: { "Content-Type": "application/json" },
    });

    return res.data;
  },

  logout: async () => {
    // Si implementas logout seguro en backend (blacklist), envía refresh:
    const refresh = localStorage.getItem("refresh");

    try {
      if (refresh) {
        await api.post("usuarios/auth/logout/", { refresh });
      }
    } catch (e) {
      // Si falla, igual limpiamos local
      // (No ocultamos el error; simplemente no bloqueamos el cierre de sesión)
    } finally {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("user");
    }
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  },
};

export default authService;
