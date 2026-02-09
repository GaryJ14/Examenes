
// ============================================
// src/context/AttemptContext.jsx
// ============================================
import React, { createContext, useState, useCallback, useEffect } from 'react';
import attemptService from '../services/attemptService';

export const AttemptContext = createContext(null);

export const AttemptProvider = ({ children }) => {
  const [currentAttempt, setCurrentAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Timer para tiempo restante
  useEffect(() => {
    if (!currentAttempt || currentAttempt.estado !== 'EN_PROGRESO') {
      return;
    }

    const timer = setInterval(() => {
      const remaining = currentAttempt.tiempo_restante();
      setTimeRemaining(remaining);

      // Si se acaba el tiempo, finalizar automáticamente
      if (remaining <= 0) {
        finishAttempt('TIEMPO_AGOTADO');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentAttempt]);

  // Iniciar intento
  const startAttempt = useCallback(async (examId) => {
    try {
      setLoading(true);
      setError(null);
      const data = await attemptService.startAttempt(examId);
      setCurrentAttempt(data);
      setAnswers({});
      setTimeRemaining(data.tiempo_restante);
      return data;
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Error al iniciar intento';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Responder pregunta
  const answerQuestion = useCallback(async (questionId, answerId) => {
    try {
      setError(null);
      
      // Actualizar respuestas localmente
      setAnswers((prev) => ({
        ...prev,
        [questionId]: answerId,
      }));

      // Enviar al servidor
      await attemptService.answerQuestion(currentAttempt.id, {
        pregunta_id: questionId,
        opcion_id: answerId,
      });
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Error al guardar respuesta';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  }, [currentAttempt]);

  // Finalizar intento
  const finishAttempt = useCallback(async (estado = 'COMPLETADO') => {
    try {
      setLoading(true);
      setError(null);
      const data = await attemptService.finishAttempt(currentAttempt.id);
      setCurrentAttempt(data);
      return data;
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Error al finalizar intento';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [currentAttempt]);

  // Limpiar intento
  const clearAttempt = useCallback(() => {
    setCurrentAttempt(null);
    setAnswers({});
    setTimeRemaining(null);
    setError(null);
  }, []);

  const value = {
    currentAttempt,
    answers,
    timeRemaining,
    loading,
    error,
    startAttempt,
    answerQuestion,
    finishAttempt,
    clearAttempt,
  };

  return <AttemptContext.Provider value={value}>{children}</AttemptContext.Provider>;
};