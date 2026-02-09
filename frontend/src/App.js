// ============================================
// src/App.js
// ============================================
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { ExamProvider } from "./context/ExamContext";
import { AttemptProvider } from "./context/AttemptContext";

import MainLayout from "./components/layout/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import DashboardPage from "./pages/dashboard/DashboardPage";

import ExamListPage from "./pages/exams/ExamListPage";
import ExamDetailPage from "./pages/exams/ExamDetailPage";
import MateriaPage from "./pages/exams/MateriaPage";

import StartExamPage from "./pages/exams/StartExamPage";
import TakeExamPage from "./pages/exams/TakeExamPage";
import AttemptResultPage from "./pages/exams/AttemptResultPage";
import ReportsPage from "./pages/reports/ReportsPage";
import ReportDetail from "./pages/reports/ReportDetail";
import UserListPage from "./pages/users/UserListPage";
import MyProfile from "./pages/profile/MyProfile";
import CameraMonitoringDemoPage from "./pages/monitoring/CameraMonitoringDemoPage";

import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ExamProvider>
          <AttemptProvider>
            <Routes>
              {/* Públicas */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protegidas con layout */}
              <Route
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />

                <Route
                  path="/examenes"
                  element={
                    <ProtectedRoute allowedRoles={["ADMIN", "DOCENTE", "ESTUDIANTE"]}>
                      <ExamListPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/materias"
                  element={
                    <ProtectedRoute allowedRoles={["ADMIN", "DOCENTE", "ESTUDIANTE"]}>
                      <MateriaPage />
                    </ProtectedRoute>
                  }
                />

                {/* ✅ Ruta correcta para "Ver exámenes" */}
                <Route
                  path="/materias/:materiaId/examenes"
                  element={
                    <ProtectedRoute allowedRoles={["ADMIN", "DOCENTE", "ESTUDIANTE"]}>
                      <ExamListPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/examenes/:id"
                  element={
                    <ProtectedRoute allowedRoles={["ADMIN", "DOCENTE", "ESTUDIANTE"]}>
                      <ExamDetailPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/examenes/:id/start"
                  element={
                    <ProtectedRoute allowedRoles={["ESTUDIANTE"]}>
                      <StartExamPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/intentos/:attemptId/take"
                  element={
                    <ProtectedRoute allowedRoles={["ESTUDIANTE"]}>
                      <TakeExamPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/intentos/:attemptId/resultado"
                  element={
                    <ProtectedRoute allowedRoles={["ESTUDIANTE"]}>
                      <AttemptResultPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/usuarios"
                  element={
                    <ProtectedRoute allowedRoles={["ADMIN", "DOCENTE"]}>
                      <UserListPage />
                    </ProtectedRoute>
                  }
                />

                <Route path="/mi-perfil" element={<MyProfile />} />
                <Route path="/reportes" element={<ReportsPage />} />
                <Route path="/reportes/:id" element={<ReportDetail />} />
                <Route path="/monitoreo/demo" element={<CameraMonitoringDemoPage />} />

                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Route>

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AttemptProvider>
        </ExamProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
