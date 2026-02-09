// ============================================
// src/pages/exams/ExamDetailPage.jsx
// ============================================
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Button, Badge, Alert, Spinner } from "react-bootstrap";
import Swal from "sweetalert2";

import examService from "../../services/examService";
import attemptService from "../../services/attemptService";
import { useAuth } from "../../hooks/useAuth";

import EditExamModal from "../../components/exam/EditExamModal";
import GestionarPreguntasModal from "../../components/exam/GestionarPreguntasModal";

const backendErrorToString = (err, fallback = "Error") => {
  const backend = err?.response?.data;
  if (!backend) return err?.message || fallback;
  if (typeof backend === "string") return backend;
  if (backend.detail) return backend.detail;
  if (backend.message) return backend.message;
  try {
    return JSON.stringify(backend, null, 2);
  } catch {
    return fallback;
  }
};

const ExamDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);

  // ✅ Control de intentos del estudiante
  const [attemptInfoLoading, setAttemptInfoLoading] = useState(false);
  const [hasFinishedAttempt, setHasFinishedAttempt] = useState(false);
  const [openAttempt, setOpenAttempt] = useState(null);
  const [lastFinishedAttempt, setLastFinishedAttempt] = useState(null); 

  const isAdmin = user?.rol === "ADMIN";
  const isDocente = user?.rol === "DOCENTE";
  const isEstudiante = user?.rol === "ESTUDIANTE";

  const isOwner = useMemo(() => {
    if (!exam || !user) return false;
    const myId = user?.id_usuario ?? user?.id ?? user?.user_id;
    return Number(exam?.docente_id) === Number(myId);
  }, [exam, user]);

  const canManageExam = (isAdmin || isDocente) && (isAdmin || isOwner);

  const notifyChanges = async () => {
    await Swal.fire({
      icon: "success",
      title: "Cambios generados",
      text: "Los cambios se guardaron correctamente.",
      timer: 1700,
      showConfirmButton: false,
    });
  };

 const fetchExam = useCallback(async () => {
  try {
    setLoading(true);
    setErrorMsg("");
    setInfoMsg("");

    const data = await examService.getExamById(id);
    setExam(data);

    if (isEstudiante && data?.estado !== "ACTIVO") {
      setInfoMsg("Este examen aún no está habilitado. Vuelve más tarde.");
    }
  } catch (error) {
    setExam(null);
    setErrorMsg(error?.response?.data?.detail || "No se encontró el examen.");
  } finally {
    setLoading(false);
  }
}, [id, isEstudiante]);

  const fetchAttemptStatus = async (examenId) => {
    if (!isEstudiante) return;

    const estudiante_id = Number(user?.id_usuario);
    if (!estudiante_id || !examenId) return;

    try {
      setAttemptInfoLoading(true);
      const resp = await attemptService.listAttempts({
        estudiante_id,
        examen_id: examenId,
      });

      const intentos = resp?.intentos || [];

      const abierto =
        intentos.find((x) => x.estado === "INICIADO" || x.estado === "EN_PROGRESO") || null;

      const finalizado =
        intentos.find(
          (x) =>
            x.estado === "COMPLETADO" ||
            x.estado === "EXPULSADO" ||
            x.estado === "TIEMPO_AGOTADO"
        ) || null;

      setOpenAttempt(abierto);
      setLastFinishedAttempt(finalizado);
      setHasFinishedAttempt(Boolean(finalizado));
    } catch (e) {
      // no bloquea, solo informa
      console.warn("No se pudo consultar intentos:", e?.response?.data || e?.message);
    } finally {
      setAttemptInfoLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchExam();
    else {
      setLoading(false);
      setExam(null);
      setErrorMsg("ID de examen inválido.");
    }
    
  }, [id]);

  useEffect(() => {
    const examenId = Number(exam?.id_examen ?? id);
    if (exam && isEstudiante) fetchAttemptStatus(examenId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam, isEstudiante]);

  const publishExam = async () => {
    if (!exam) return;
    setSaving(true);
    setErrorMsg("");
    setInfoMsg("");

    try {
      const updated = await examService.updateExamStatus(id, "ACTIVO");
      setExam(updated);
      await notifyChanges();
    } catch (err) {
      setErrorMsg(backendErrorToString(err, "No se pudo habilitar el examen."));
    } finally {
      setSaving(false);
    }
  };

  const unpublishExam = async () => {
    if (!exam) return;
    setSaving(true);
    setErrorMsg("");
    setInfoMsg("");

    try {
      const updated = await examService.updateExamStatus(id, "BORRADOR");
      setExam(updated);
      await notifyChanges();
    } catch (err) {
      setErrorMsg(backendErrorToString(err, "No se pudo cambiar el estado."));
    } finally {
      setSaving(false);
    }
  };

  // Si hay intento abierto, continúas; si no, inicias flujo start
  const handleStart = () => {
    if (openAttempt?.id_intento) {
      navigate(`/intentos/${openAttempt.id_intento}/take`);
      return;
    }
    navigate(`/examenes/${id}/start`);
  };

  const handleViewResult = () => {
    if (lastFinishedAttempt?.id_intento) {
      navigate(`/intentos/${lastFinishedAttempt.id_intento}/resultado`);
    }
  };

  if (loading) return <p className="text-muted">Cargando...</p>;

  if (!exam) {
    return (
      <Alert variant="danger">
        {errorMsg || "No se encontró el examen."}
        <div className="mt-2">
          <Button variant="outline-secondary" onClick={() => navigate(-1)}>
            Volver
          </Button>
        </div>
      </Alert>
    );
  }

  const estado = exam.estado || "BORRADOR";
  const isActive = estado === "ACTIVO";
  const examId = exam.id_examen ?? Number(id);

  return (
    <>
      <Card className="shadow-sm">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">{exam.titulo}</h5>
          <Badge bg={isActive ? "success" : "secondary"}>{estado}</Badge>
        </Card.Header>

        <Card.Body>
          {errorMsg && (
            <Alert variant="danger" dismissible onClose={() => setErrorMsg("")}>
              <pre className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
                {errorMsg}
              </pre>
            </Alert>
          )}

          {infoMsg && (
            <Alert variant="info" dismissible onClose={() => setInfoMsg("")}>
              {infoMsg}
            </Alert>
          )}

          <p className="text-muted">{exam.descripcion || "Sin descripción"}</p>

          <div className="d-flex justify-content-between mb-2">
            <span>Duración:</span>
            <strong>{exam.duracion} min</strong>
          </div>

          <div className="d-flex justify-content-between mb-2">
            <span>Intentos permitidos:</span>
            <strong>{exam.intentos_permitidos}</strong>
          </div>

          <div className="d-flex justify-content-between mb-4">
            <span>Puntaje total:</span>
            <strong>{exam.puntaje_total}</strong>
          </div>

          <div className="d-flex gap-2 flex-wrap align-items-center">
            <Button variant="outline-secondary" onClick={() => navigate(-1)} disabled={saving}>
              Volver
            </Button>

            {isEstudiante && (
              <>
                <Button
                  variant={openAttempt ? "warning" : "primary"}
                  onClick={handleStart}
                  disabled={!isActive || saving || hasFinishedAttempt || attemptInfoLoading}
                >
                  {attemptInfoLoading ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" className="me-2" />
                      Verificando...
                    </>
                  ) : openAttempt ? (
                    "Continuar examen"
                  ) : (
                    "Iniciar examen"
                  )}
                </Button>

                {/* si ya finalizó, deshabilita iniciar y ofrece ver resultado */}
                {hasFinishedAttempt && (
                  <>
                    <Alert variant="warning" className="mb-0 py-2 px-3">
                      Ya rindiste este examen ({lastFinishedAttempt?.estado}). No puedes iniciarlo otra vez.
                    </Alert>
                    <Button variant="outline-success" onClick={handleViewResult}>
                      Ver resultado
                    </Button>
                  </>
                )}
              </>
            )}

            {canManageExam && (
              <>
                <Button variant="outline-primary" onClick={() => setShowEditModal(true)} disabled={saving}>
                  Editar examen
                </Button>

                <Button variant="outline-primary" onClick={() => setShowQuestionsModal(true)} disabled={saving}>
                  Gestionar preguntas
                </Button>

                {!isActive ? (
                  <Button variant="success" onClick={publishExam} disabled={saving}>
                    {saving ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                        Habilitando...
                      </>
                    ) : (
                      "Habilitar"
                    )}
                  </Button>
                ) : (
                  <Button variant="outline-danger" onClick={unpublishExam} disabled={saving}>
                    {saving ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                        Cambiando...
                      </>
                    ) : (
                      "Volver a BORRADOR"
                    )}
                  </Button>
                )}
              </>
            )}
          </div>

          {isEstudiante && !isActive && (
            <Alert variant="warning" className="mt-3">
              Este examen está en <strong>{estado}</strong>. No puedes iniciarlo todavía.
            </Alert>
          )}
        </Card.Body>
      </Card>

      <EditExamModal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        exam={exam}
        onSaved={async (updated) => {
          setExam(updated);
          setShowEditModal(false);
          await notifyChanges();
        }}
      />

      <GestionarPreguntasModal
        show={showQuestionsModal}
        onHide={() => setShowQuestionsModal(false)}
        examId={examId}
        canEdit={canManageExam}
        examEstado={estado}
        onSaved={async () => {
          await fetchExam();
          setShowQuestionsModal(false);
          await notifyChanges();
        }}
      />
    </>
  );
};

export default ExamDetailPage;
