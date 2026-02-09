// ============================================
// src/services/userService.js (COMPLETO)
// ============================================
import api from "./api";

const userService = {
  // =========================
  // USUARIOS (ADMIN/DOCENTE)
  // =========================
  getUsers: async () => {
    // GET /api/usuarios/usuarios/
    const { data } = await api.get("/usuarios/usuarios/");
    return data; // {total, usuarios} o lista según backend
  },

  register: async (userData) => {
    // POST /api/usuarios/auth/registro/
    const payload = {
      cedula: userData?.cedula || "",
      nombres: userData?.nombres || "",
      apellidos: userData?.apellidos || "",
      correo_electronico: userData?.correo_electronico || "",
      password: userData?.password || "",
      password_confirmacion: userData?.password_confirmacion || "",
      rol: userData?.rol || "ESTUDIANTE",
    };

    const { data } = await api.post("/usuarios/auth/registro/", payload, {
      headers: { "Content-Type": "application/json" },
    });

    return data;
  },

  deleteUser: async (userId) => {
    // DELETE /api/usuarios/usuarios/<id>/eliminar/
    await api.delete(`/usuarios/usuarios/${userId}/eliminar/`);
    return true;
  },

  activateUser: async (userId) => {
    // POST /api/usuarios/usuarios/<id>/activar/
    await api.post(`/usuarios/usuarios/${userId}/activar/`);
    return true;
  },

  updateUser: async (userId, updatedData) => {
    // PUT /api/usuarios/usuarios/<id>/actualizar/
    const payload = { ...(updatedData || {}) };

    // si no hay password, no lo mandes
    if (!payload.password) {
      delete payload.password;
      delete payload.password_confirmacion;
    }

    const { data } = await api.put(`/usuarios/usuarios/${userId}/actualizar/`, payload, {
      headers: { "Content-Type": "application/json" },
    });

    return data;
  },

  // =========================
  // PERFIL
  // =========================
  getPerfil: async () => {
    // GET /api/usuarios/perfil/
    const { data } = await api.get("/usuarios/perfil/");
    return data;
  },

  // =========================
  // FOTO VALIDACIÓN
  // =========================
  uploadFotoValidacion: async (file) => {
    // POST /api/usuarios/foto-perfil/validacion/
    if (!file) {
      throw new Error("Debes seleccionar una imagen para subir.");
    }

    const form = new FormData();
    form.append("foto_validacion", file);

    const { data } = await api.post("/usuarios/foto-perfil/validacion/", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return data;
  },
};

export default userService;
