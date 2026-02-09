
// ============================================
// src/hooks/useAttempt.js
// ============================================
import { useContext } from 'react';
import { AttemptContext } from '../context/AttemptContext';

export const useAttempt = () => {
  const context = useContext(AttemptContext);
  
  if (!context) {
    throw new Error('useAttempt debe usarse dentro de un AttemptProvider');
  }
  
  return context;
};

