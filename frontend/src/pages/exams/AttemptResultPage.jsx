// ============================================
// src/pages/exams/AttemptResultPage.jsx
// ============================================
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Badge, Button, Card, Spinner } from "react-bootstrap";
import attemptService from "../../services/attemptService";

const LS_KEY = (attemptId) => `attempt_answers_${attemptId}`;

const AttemptResultPage = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [localResult, setLocalResult] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErr("");

        const data = await attemptService.getAttempt(attemptId);
        setAttempt(data);

        const r = localStorage.getItem(`${LS_KEY(attemptId)}_result`);
        setLocalResult(r ? JSON.parse(r) : null);
      } catch (e) {
        setErr(e?.response?.data?.detail || "No se pudo cargar el resultado.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [attemptId]);

  if (loading) {
    return (
      <p className="text-muted">
        <Spinner size="sm" animation="border" className="me-2" />
        Cargando...
      </p>
    );
  }

  if (err) return <Alert variant="danger">{err}</Alert>;
  if (!attempt) return <Alert variant="warning">No existe intento.</Alert>;

  const estado = attempt.estado || "—";
  const pct = localResult?.percentage ?? 0;
  const score = localResult?.score ?? 0;
  const total = localResult?.totalPoints ?? attempt.puntaje_total ?? 0;

  return (
    <Card className="shadow-sm">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <div>
          <div className="fw-bold">Resultado</div>
          <div className="small text-muted">
            Estado: <Badge bg={estado === "EXPULSADO" ? "danger" : "secondary"}>{estado}</Badge>
          </div>
        </div>

        <div className="text-end">
          <div className="small text-muted">Nota</div>
          <div className="fs-4 fw-bold">{pct}%</div>
        </div>
      </Card.Header>

      <Card.Body>
        <div className="mb-3">
          Puntaje: <strong>{score}</strong> / {total}
        </div>

        <div className="d-flex gap-2">
          <Button variant="primary" onClick={() => navigate("/examenes")}>
            Volver a exámenes
          </Button>
          <Button variant="outline-secondary" onClick={() => navigate("/dashboard")}>
            Dashboard
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export default AttemptResultPage;
