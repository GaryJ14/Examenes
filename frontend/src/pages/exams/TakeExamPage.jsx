// ============================================
// src/pages/exams/TakeExamPage.jsx
// ============================================
// ✅ Anti-spam robusto:
// - Dedup por tipo_evento (cada tipo tiene su propio timestamp).
// ✅ Expulsión real:
// - Si CameraMonitor avisa expulsado:true → finalizar + navegar.
// - Si por cualquier motivo el backend expulsa, no dependemos del contador local.
// ============================================

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Badge, Button, Card, Form, ProgressBar, Spinner } from "react-bootstrap";
import Swal from "sweetalert2";

import attemptService from "../../services/attemptService";
import examService from "../../services/examService";
import CameraMonitor from "../../components/exam/CameraMonitor";

const LS_KEY = (attemptId) => `attempt_answers_${attemptId}`;

const TakeExamPage = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState(null);
  const [exam, setExam] = useState(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [idx, setIdx] = useState(0);

  const [answers, setAnswers] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY(attemptId)) || "{}");
    } catch {
      return {};
    }
  });

  const [warningsCount, setWarningsCount] = useState(0);
  const MAX_WARNINGS = 3;

  // ✅ Anti-spam POR TIPO (no global)
  const lastViolationByTypeRef = useRef({}); // { [tipo_evento]: timestamp }
  const DUPLICATE_WINDOW_MS = 15000; // 15s

  // ✅ Evitar doble navegación/expulsión
  const expelledRef = useRef(false);

  // ===============================
  // Cargar intento y examen
  // ===============================
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErr("");

        const intento = await attemptService.getAttempt(attemptId);
        setAttempt(intento);

        const examenId = intento?.examen_id;
        const ex = await examService.getExamById(examenId);
        setExam(ex);

        const preguntasLocal = ex?.preguntas || ex?.questions || [];
        if (!preguntasLocal.length) {
          setErr("Este examen no trae preguntas en el endpoint. Ajusta examService para traerlas.");
        }
      } catch (e) {
        setErr(e?.response?.data?.detail || "No se pudo cargar el examen/intento.");
      } finally {
        setLoading(false);
      }
    };

    if (attemptId) load();
  }, [attemptId]);

  // Persistir respuestas en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY(attemptId), JSON.stringify(answers));
    } catch {}
  }, [answers, attemptId]);

  const preguntas = useMemo(() => exam?.preguntas || exam?.questions || [], [exam]);
  const total = preguntas.length;

  const current = preguntas[idx];
  const progress = total ? Math.round(((idx + 1) / total) * 100) : 0;

  // ===============================
  // Selección de respuestas
  // ===============================
  const pickSingle = (preguntaId, opcionId) => {
    setAnswers((prev) => ({
      ...prev,
      [preguntaId]: { type: "single", opcionId: Number(opcionId) },
    }));
  };

  const toggleMulti = (preguntaId, opcionId) => {
    setAnswers((prev) => {
      const currentIds = prev[preguntaId]?.opcionesIds || [];
      const set = new Set(currentIds.map(Number));
      const oid = Number(opcionId);

      if (set.has(oid)) set.delete(oid);
      else set.add(oid);

      return {
        ...prev,
        [preguntaId]: { type: "multi", opcionesIds: Array.from(set) },
      };
    });
  };

  // ===============================
  // ✅ Guardar TODAS las respuestas en backend
  // ===============================
  const sendAllAnswersToBackend = useCallback(async () => {
    const qIdsInOrder = preguntas.map((q) => Number(q.id_pregunta ?? q.id ?? q.pregunta_id));

    for (let i = 0; i < qIdsInOrder.length; i++) {
      const qId = qIdsInOrder[i];
      const ans = answers[qId];
      if (!ans) continue;

      const payload = {
        pregunta_id: Number(qId),
        tiempo_respuesta: 0,
        numero_orden: i + 1,
      };

      if (ans.type === "single") {
        if (ans.opcionId == null) continue;
        payload.opcion_id = Number(ans.opcionId);
      } else if (ans.type === "multi") {
        const ids = (ans.opcionesIds || []).map(Number).filter((x) => Number.isFinite(x));
        if (!ids.length) continue;
        payload.opciones_ids = ids;
      } else {
        continue;
      }

      await attemptService.saveAnswer(attemptId, payload);
    }
  }, [answers, attemptId, preguntas]);

  // ===============================
  // Nota local (pruebas)
  // ===============================
  const computeScoreClientSide = () => {
    let score = 0;
    let totalPoints = 0;

    for (const q of preguntas) {
      const qId = q.id_pregunta ?? q.id ?? q.pregunta_id;
      const ponderacion = Number(q.ponderacion ?? q.puntaje ?? q.puntos ?? 1);
      totalPoints += ponderacion;

      const userAns = answers[qId];
      if (!userAns) continue;

      const opts = q.opciones || q.options || [];
      const correctIds = opts
        .filter((o) => o.es_correcta === true)
        .map((o) => Number(o.id_opcion ?? o.id));

      if (userAns.type === "single") {
        if (correctIds.includes(Number(userAns.opcionId))) score += ponderacion;
      } else if (userAns.type === "multi") {
        const a = new Set((userAns.opcionesIds || []).map(Number));
        const b = new Set(correctIds.map(Number));
        const same = a.size === b.size && [...a].every((x) => b.has(x));
        if (same) score += ponderacion;
      }
    }

    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 10000) / 100 : 0;
    return { score, totalPoints, percentage };
  };

  // ===============================
  // ✅ Finalize expulsado (centralizado)
  // ===============================
  const finalizeByExpulsion = useCallback(
    async (message = "Se alcanzó el máximo de advertencias (3).") => {
      if (expelledRef.current) return;
      expelledRef.current = true;

      try {
        await Swal.fire({
          icon: "error",
          title: "Examen expulsado",
          text: message,
        });

        try {
          await sendAllAnswersToBackend();
        } catch {}

        try {
          await attemptService.finalizeAttempt(attemptId, "EXPULSADO");
        } catch {}

        navigate(`/intentos/${attemptId}/resultado`);
      } catch {}
    },
    [attemptId, navigate, sendAllAnswersToBackend]
  );

  // ===============================
  // ✅ handleViolation (anti-spam por tipo + expulsión backend)
  // ===============================
  const handleViolation = useCallback(
    (payload = {}) => {
      // payload esperado:
      // { msg, tipo_evento, expulsado, backend }
      const msg = payload?.msg || "Comportamiento sospechoso detectado";
      const tipo = payload?.tipo_evento || "EVENTO";

      // ✅ Si viene expulsión desde backend → expulsar ya
      if (payload?.expulsado === true || tipo === "EXPULSION") {
        finalizeByExpulsion("Se alcanzó el máximo de advertencias.");
        return;
      }

      const now = Date.now();
      const lastTs = lastViolationByTypeRef.current[tipo] ?? 0;

      // ✅ Anti-spam por tipo: mismo evento dentro de ventana NO cuenta
      if (now - lastTs < DUPLICATE_WINDOW_MS) {
        return;
      }
      lastViolationByTypeRef.current[tipo] = now;

      setWarningsCount((c) => {
        const next = c + 1;

        Swal.fire({
          icon: "warning",
          title: `Advertencia ${next}/${MAX_WARNINGS}`,
          text: msg,
          timer: 1400,
          showConfirmButton: false,
        });

        if (next >= MAX_WARNINGS) {
          // respaldo local (si por alguna razón backend no expulsó)
          finalizeByExpulsion();
        }
        return next;
      });
    },
    [finalizeByExpulsion]
  );

  // ===============================
  // ✅ Finalizar normal
  // ===============================
  const finish = async () => {
    const confirm = await Swal.fire({
      icon: "question",
      title: "Finalizar examen",
      text: "¿Seguro que deseas finalizar? Se guardarán tus respuestas.",
      showCancelButton: true,
      confirmButtonText: "Sí, finalizar",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    setBusy(true);
    setErr("");

    try {
      const result = computeScoreClientSide();
      localStorage.setItem(`${LS_KEY(attemptId)}_result`, JSON.stringify(result));

      await sendAllAnswersToBackend();
      await attemptService.finalizeAttempt(attemptId, "COMPLETADO");

      navigate(`/intentos/${attemptId}/resultado`);
    } catch (e) {
      console.error(e);
      setErr(
        e?.response?.data?.detail ||
          e?.response?.data?.error ||
          "No se pudo guardar respuestas o finalizar."
      );
    } finally {
      setBusy(false);
    }
  };

  const next = () => setIdx((i) => Math.min(i + 1, total - 1));
  const prev = () => setIdx((i) => Math.max(i - 1, 0));

  // ===============================
  // Render
  // ===============================
  if (loading) {
    return (
      <p className="text-muted">
        <Spinner size="sm" animation="border" className="me-2" />
        Cargando...
      </p>
    );
  }

  if (err) return <Alert variant="danger">{err}</Alert>;
  if (!current) return <Alert variant="warning">No hay preguntas para mostrar.</Alert>;

  const qId = current.id_pregunta ?? current.id ?? current.pregunta_id;
  const qText = current.enunciado ?? current.texto ?? current.question ?? "Pregunta";
  const opts = current.opciones || current.options || [];
  const isMulti = (current.tipo || "").toUpperCase().includes("MULTI");

  const saved = answers[qId];
  const selectedSingle = saved?.opcionId;
  const selectedMulti = saved?.opcionesIds || [];

  return (
    <>
      <CameraMonitor intentoId={attemptId} onViolation={handleViolation} />

      <Card className="shadow-sm">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <div>
            <div className="fw-bold">{exam?.titulo || "Examen"}</div>
            <div className="small text-muted">
              Pregunta {idx + 1} de {total}{" "}
              <Badge bg={warningsCount >= 2 ? "danger" : "warning"} className="ms-2">
                Advertencias: {warningsCount}/{MAX_WARNINGS}
              </Badge>
            </div>
          </div>

          <div className="d-flex gap-2">
            <Button variant="outline-secondary" onClick={() => navigate(-1)} disabled={busy}>
              Salir
            </Button>
            <Button variant="success" onClick={finish} disabled={busy}>
              {busy ? (
                <>
                  <Spinner size="sm" animation="border" className="me-2" />
                  Finalizando...
                </>
              ) : (
                "Finalizar"
              )}
            </Button>
          </div>
        </Card.Header>

        <Card.Body>
          <ProgressBar now={progress} label={`${progress}%`} className="mb-3" />
          <h6 className="mb-3">{qText}</h6>

          <Form>
            {!isMulti ? (
              opts.map((o) => {
                const oid = o.id_opcion ?? o.id;
                return (
                  <Form.Check
                    key={oid}
                    type="radio"
                    name={`q_${qId}`}
                    label={o.texto ?? o.opcion_texto ?? o.label}
                    checked={Number(selectedSingle) === Number(oid)}
                    onChange={() => pickSingle(qId, oid)}
                    className="mb-2"
                  />
                );
              })
            ) : (
              opts.map((o) => {
                const oid = o.id_opcion ?? o.id;
                const checked = selectedMulti.map(Number).includes(Number(oid));
                return (
                  <Form.Check
                    key={oid}
                    type="checkbox"
                    label={o.texto ?? o.opcion_texto ?? o.label}
                    checked={checked}
                    onChange={() => toggleMulti(qId, oid)}
                    className="mb-2"
                  />
                );
              })
            )}
          </Form>

          <div className="d-flex justify-content-between mt-4">
            <Button variant="outline-primary" onClick={prev} disabled={idx === 0 || busy}>
              Anterior
            </Button>
            <Button variant="primary" onClick={next} disabled={idx === total - 1 || busy}>
              Siguiente
            </Button>
          </div>
        </Card.Body>
      </Card>
    </>
  );
};

export default TakeExamPage;
