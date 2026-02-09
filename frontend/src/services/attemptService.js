// ============================================
// src/services/attemptService.js
// ============================================
import api from "./api";

const attemptService = {
  // Crear intento: POST /api/analisis/intentos/
  createAttempt: async (payload) => {
    const res = await api.post("/analisis/intentos/", payload);
    return res.data;
  },

  // Listar intentos: GET /api/analisis/intentos/?estudiante_id=&examen_id=&estado=
  listAttempts: async (params = {}) => {
    const res = await api.get("/analisis/intentos/", { params });
    return res.data;
  },

  // Detalle: GET /api/analisis/intentos/<id>/
  getAttempt: async (attemptId) => {
    const res = await api.get(`/analisis/intentos/${attemptId}/`);
    return res.data;
  },

  // Guardar respuesta: POST /api/analisis/intentos/<id>/respuestas/
  saveAnswer: async (attemptId, payload) => {
    const res = await api.post(`/analisis/intentos/${attemptId}/respuestas/`, payload);
    return res.data;
  },

  // Finalizar: POST /api/analisis/intentos/<id>/finalizar/
  finalizeAttempt: async (attemptId, estado = "COMPLETADO") => {
    const res = await api.post(`/analisis/intentos/${attemptId}/finalizar/`, { estado });
    return res.data;
  },
};

export default attemptService;
