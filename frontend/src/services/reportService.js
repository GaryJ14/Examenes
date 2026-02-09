import api from "./api";

const base = "/reportes/reportes/";

const reportService = {
  createReport: async (payload) => {
    const { data } = await api.post(base, payload);
    return data;
  },

  generateReport: async (id_reporte) => {
    const { data } = await api.post(`${base}${id_reporte}/generar/`);
    return data;
  },

  getReportById: async (id_reporte) => {
    const { data } = await api.get(`${base}${id_reporte}/`);
    return data;
  },

  listReports: async (queryString = "") => {
    const url = queryString ? `${base}?${queryString}` : base;
    const { data } = await api.get(url);
    return data;
  },
};

export default reportService;
