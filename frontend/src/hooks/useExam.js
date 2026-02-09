

// ============================================
// src/hooks/useExam.js
// ============================================
import { useContext } from 'react';
import { ExamContext } from '../context/ExamContext';

export const useExam = () => {
  const context = useContext(ExamContext);
  
  if (!context) {
    throw new Error('useExam debe usarse dentro de un ExamProvider');
  }
  
  return context;
};

