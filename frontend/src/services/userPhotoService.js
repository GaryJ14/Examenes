// ============================================
// src/services/userPhotoService.js
// ============================================
import api from "./api";

const VALIDATION_ENDPOINT = "/usuarios/foto-perfil/validacion/";

const userPhotoService = {
  uploadValidationPhoto: async (file) => {
    const form = new FormData();
    form.append("foto_validacion", file);

    const res = await api.post(VALIDATION_ENDPOINT, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return res.data;
  },
};

export default userPhotoService;
