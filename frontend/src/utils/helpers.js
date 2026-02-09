

// ============================================
// src/utils/helpers.js
// ============================================

// Formatear fecha
export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Formatear fecha y hora
export const formatDateTime = (date) => {
  return new Date(date).toLocaleString('es-EC', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Formatear tiempo en segundos a HH:MM:SS
export const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Obtener iniciales de nombre
export const getInitials = (name) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

// Validar email
export const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Validar cédula ecuatoriana (10 dígitos)
export const isValidCedula = (cedula) => {
  return /^\d{10}$/.test(cedula);
};

// Calcular porcentaje
export const calcularPorcentaje = (valor, total) => {
  if (total === 0) return 0;
  return Math.round((valor / total) * 100);
};

// Truncar texto
export const truncateText = (text, maxLength = 50) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};