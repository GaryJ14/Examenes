

// ============================================
// src/utils/constants.js
// ============================================
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export const ROLES = {
  ADMIN: 'ADMIN',
  DOCENTE: 'DOCENTE',
  ESTUDIANTE: 'ESTUDIANTE',
};

export const ESTADOS_EXAMEN = {
  BORRADOR: 'BORRADOR',
  PUBLICADO: 'PUBLICADO',
  ACTIVO: 'ACTIVO',
  FINALIZADO: 'FINALIZADO',
  ARCHIVADO: 'ARCHIVADO',
};

export const ESTADOS_INTENTO = {
  INICIADO: 'INICIADO',
  EN_PROGRESO: 'EN_PROGRESO',
  COMPLETADO: 'COMPLETADO',
  EXPULSADO: 'EXPULSADO',
  ABANDONADO: 'ABANDONADO',
  TIEMPO_AGOTADO: 'TIEMPO_AGOTADO',
};

export const TIPOS_PREGUNTA = {
  OPCION_MULTIPLE: 'OPCION_MULTIPLE',
  VERDADERO_FALSO: 'VERDADERO_FALSO',
  SELECCION_MULTIPLE: 'SELECCION_MULTIPLE',
};
