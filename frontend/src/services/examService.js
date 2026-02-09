// ============================================
// src/services/examService.js
// ============================================
import api from "./api";

const normalizeLocalDateTime = (v) => {
  if (!v) return v;

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(v)) return v;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return `${v}:00`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)) return v;
  return v;
};

const cleanExamPayload = (payload = {}) => {
  const p = { ...payload };

  if (p.titulo != null) p.titulo = String(p.titulo).trim();
  if (p.descripcion != null) p.descripcion = String(p.descripcion).trim();
  if (p.instrucciones != null) p.instrucciones = String(p.instrucciones).trim();

  if (p.fecha_inicio != null) p.fecha_inicio = normalizeLocalDateTime(p.fecha_inicio);
  if (p.fecha_fin != null) p.fecha_fin = normalizeLocalDateTime(p.fecha_fin);

  if (p.duracion != null) p.duracion = Number(p.duracion);
  if (p.intentos_permitidos != null) p.intentos_permitidos = Number(p.intentos_permitidos);

  if (p.mostrar_respuestas != null) p.mostrar_respuestas = !!p.mostrar_respuestas;
  if (p.aleatorizar_preguntas != null) p.aleatorizar_preguntas = !!p.aleatorizar_preguntas;
  if (p.aleatorizar_opciones != null) p.aleatorizar_opciones = !!p.aleatorizar_opciones;
  if (p.requiere_camara != null) p.requiere_camara = !!p.requiere_camara;

  // materia (FK)
  if (p.materia != null) p.materia = Number(p.materia);

  // tags
  if (p.tags != null && !Array.isArray(p.tags)) p.tags = [];

  return p;
};

const cleanQuestionPayload = (payload = {}) => {
  const p = { ...payload };

  p.enunciado = (p.enunciado || "").trim();
  p.tipo = p.tipo || "OPCION_MULTIPLE";
  p.ponderacion = p.ponderacion != null ? Number(p.ponderacion) : 1;
  p.orden = p.orden != null ? Number(p.orden) : 1;
  p.explicacion = (p.explicacion || "").trim();

  if (p.respuesta_texto != null) p.respuesta_texto = String(p.respuesta_texto).trim();

  p.opciones = Array.isArray(p.opciones)
    ? p.opciones
        .map((op, idx) => ({
          texto: (op.texto || "").trim(),
          es_correcta: !!op.es_correcta,
          orden: op.orden != null ? Number(op.orden) : idx + 1,
          clave: op.clave ? String(op.clave).trim() : undefined,
        }))
        .filter((op) => op.texto.length > 0)
    : [];

  return p;
};

const examService = {
  // ============================================================
  // MATERIAS
  // ============================================================

  // GET /api/examenes/materias/
  getMaterias: async () => {
    const { data } = await api.get("/examenes/materias/");
    return Array.isArray(data) ? data : (data.materias || []);
  },

  // POST /api/examenes/materias/
  createMateria: async (payload) => {
    const body = {
      nombre: (payload?.nombre || "").trim(),
      descripcion: (payload?.descripcion || "").trim(),
      activo: payload?.activo ?? true,
    };
    const { data } = await api.post("/examenes/materias/", body);
    return data;
  },
  updateMateria: async (materiaId, payload) => {
    const { data } = await api.put(`/examenes/materias/${materiaId}/`, payload);
    return data;
  },
  

  // ============================================================
  // EXÁMENES (por materia)
  // ============================================================

  // ✅ NUEVO: GET /api/examenes/materia/<id>/
  getExamsByMateriaPath: async (materiaId, params = {}) => {
    const id = Number(materiaId);
    if (!id) throw new Error("materiaId inválido");

    const { data } = await api.get(`/examenes/materia/${id}/`, { params });
    // backend esperado: { materia: {...}, total, examenes: [...] }
    return data;
  },
// GET /api/examenes/materia/<id>/
  getExamsByMateriaPath: async (materiaId) => {
    const { data } = await api.get(`examenes/materia/${materiaId}/`);
    // esperado: { materia: {...}, examenes: [...] } o {examenes:[...]}
    return data;
  },

  // (opcional) opción antigua por query: GET /api/examenes/?materia_id=<id>
  getExamsByMateriaQuery: async (materiaId, params = {}) => {
    const id = Number(materiaId);
    if (!id) throw new Error("materiaId inválido");

    const { data } = await api.get("/examenes/", {
      params: { ...params, materia_id: id },
    });
    return data; // { total, examenes }
  },

  // GET /api/examenes/materias-con-examenes/
  getMateriasConExamenes: async () => {
    const { data } = await api.get("/examenes/materias-con-examenes/");
    return data;
  },

  // ============================================================
  // EXÁMENES (general)
  // ============================================================

  // GET /api/examenes/
  getExams: async (params = {}) => {
    const { data } = await api.get("/examenes/", { params });
    return data;
  },

  // GET /api/examenes/<id>/
  getExamById: async (id) => {
    const { data } = await api.get(`/examenes/${id}/`);
    return data;
  },

  // POST /api/examenes/crear/
  createExam: async (payload) => {
    const cleanPayload = cleanExamPayload({
      ...payload,
      estado: payload?.estado ?? "BORRADOR",
    });

    const { data } = await api.post("/examenes/crear/", cleanPayload);
    return data;
  },

  // PUT /api/examenes/<id>/
  updateExam: async (examId, payload) => {
    const cleanPayload = cleanExamPayload(payload);
    const { data } = await api.put(`/examenes/${examId}/`, cleanPayload);
    return data;
  },

  // PUT /api/examenes/<id>/ {estado:...}
  updateExamStatus: async (examId, estado) => {
    const { data } = await api.put(`/examenes/${examId}/`, { estado });
    return data;
  },

  // DELETE /api/examenes/<id>/
  deleteExam: async (examId) => {
    await api.delete(`/examenes/${examId}/`);
    return true;
  },

  // POST /api/examenes/<id>/generar-ia/
  generateExamIA: async (examId, params) => {
    const { data } = await api.post(`/examenes/${examId}/generar-ia/`, params || {});
    return data;
  },

  // ============================================================
  // PREGUNTAS
  // ============================================================

  // GET /api/examenes/<examen_id>/preguntas/
  getQuestions: async (examId) => {
    const { data } = await api.get(`/examenes/${examId}/preguntas/`);
    return data;
  },

  // POST /api/examenes/<examen_id>/preguntas/
  createQuestion: async (examId, payload) => {
    const cleanPayload = cleanQuestionPayload(payload);
    const { data } = await api.post(`/examenes/${examId}/preguntas/`, cleanPayload);
    return data;
  },

  // PUT /api/examenes/<examen_id>/preguntas/<pregunta_id>/
  updateQuestion: async (examId, questionId, payload) => {
    const cleanPayload = cleanQuestionPayload(payload);
    const { data } = await api.put(`/examenes/${examId}/preguntas/${questionId}/`, cleanPayload);
    return data;
  },

  // DELETE /api/examenes/<examen_id>/preguntas/<pregunta_id>/
  deleteQuestion: async (examId, questionId) => {
    await api.delete(`/examenes/${examId}/preguntas/${questionId}/`);
    return true;
  },
};

export default examService;
