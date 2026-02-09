import React, { createContext, useState, useCallback, useMemo } from "react";
import examService from "../services/examService";

export const ExamContext = createContext(null);

export const ExamProvider = ({ children }) => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadExams = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const data = await examService.getExams(params);

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.examenes)
          ? data.examenes
          : Array.isArray(data?.results)
            ? data.results
            : [];

      setExams(list);
      return list;
    } catch (error) {
      console.error("Error loading exams", error);
      setExams([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getExamById = useCallback(async (id) => {
    return await examService.getExamById(id);
  }, []);

  const createExam = useCallback(
    async (payload, { refreshList = true } = {}) => {
      setLoading(true);
      try {
        const created = await examService.createExam(payload);

        if (refreshList) {
          await loadExams();
        } else {
          setExams((prev) => [created, ...prev]);
        }

        return created;
      } catch (error) {
        console.error("Error creating exam", error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [loadExams]
  );

  // =========================
  // PREGUNTAS
  // =========================
  const getQuestions = useCallback(async (examId) => {
    try {
      return await examService.getQuestions(examId);
    } catch (error) {
      console.error("Error loading questions", error);
      throw error;
    }
  }, []);

  const createQuestion = useCallback(async (examId, payload) => {
    setLoading(true);
    try {
      const created = await examService.createQuestion(examId, payload);
      return created;
    } catch (error) {
      console.error("Error creating question", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      exams,
      loadExams,
      getExamById,
      createExam,
      getQuestions,
      createQuestion,
      loading,
    }),
    [exams, loadExams, getExamById, createExam, getQuestions, createQuestion, loading]
  );

  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>;
};
