// ============================================
// src/services/monitoringService.js
// ============================================
import api from "./api";

const monitoringService = {
  // POST /api/monitoreo/eventos/
  createEvent: async (payload) => {
    const res = await api.post("/monitoreo/eventos/", payload);
    return res.data;
  },

  // GET /api/monitoreo/detection-health/
  detectionHealth: async () => {
    const res = await api.get("/monitoreo/detection-health/");
    return res.data;
  },

  // POST /api/monitoreo/analizar-frame/  (multipart)
  analyzeFrame: async (blob) => {
    const form = new FormData();
    form.append("file", blob, "frame.jpg");

    const res = await api.post("/monitoreo/analizar-frame/", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return res.data;
  },
};

export default monitoringService;
