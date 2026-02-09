import React, { useEffect, useMemo, useState } from "react";
import { Modal, Button, Alert, Spinner, Card, Form, Row, Col, Badge } from "react-bootstrap";
import { PlusCircle, Trash, XCircle, CheckCircleFill } from "react-bootstrap-icons";
import examService from "../../services/examService";

const emptyOption = (order = 1) => ({
  texto: "",
  es_correcta: false,
  orden: order,
});

const emptyQuestion = (order = 1) => ({
  // backend usa id_pregunta (si existe)
  id_pregunta: null,
  enunciado: "",
  tipo: "OPCION_MULTIPLE",
  ponderacion: 1,
  orden: order,
  explicacion: "",
  opciones: [emptyOption(1), emptyOption(2)],
  _state: "new", // "new" | "clean" | "dirty" | "deleted"
});

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

const validateQuestion = (q, idx) => {
  if (!q.enunciado?.trim()) return `Pregunta #${idx + 1}: el enunciado es obligatorio.`;

  const p = Number(q.ponderacion);
  if (!Number.isFinite(p) || p <= 0) return `Pregunta #${idx + 1}: ponderación inválida.`;

  const optionsWithText = (q.opciones || []).filter((o) => (o.texto || "").trim().length > 0);
  if (optionsWithText.length < 2) return `Pregunta #${idx + 1}: mínimo 2 opciones con texto.`;

  const correctCount = optionsWithText.filter((o) => !!o.es_correcta).length;
  if (correctCount !== 1) return `Pregunta #${idx + 1}: marca exactamente 1 opción correcta.`;

  return null;
};

const normalizeForSave = (q, idx) => {
  const opciones = (q.opciones || [])
    .map((o, i) => ({
      texto: (o.texto || "").trim(),
      es_correcta: !!o.es_correcta,
      orden: i + 1,
    }))
    .filter((o) => o.texto.length > 0);

  return {
    enunciado: q.enunciado.trim(),
    tipo: "OPCION_MULTIPLE",
    ponderacion: Number(q.ponderacion),
    orden: idx + 1,
    explicacion: (q.explicacion || "").trim(),
    opciones,
  };
};

const GestionarPreguntasModal = ({
  show,
  onHide,
  examId, // id_examen
  canEdit = false, // docente dueño o admin
  examEstado = "BORRADOR",
  onSaved, // callback cuando guarda
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [questions, setQuestions] = useState([]);

  const disabled = useMemo(() => !canEdit || saving || loading, [canEdit, saving, loading]);

  const loadQuestions = async () => {
    if (!examId) return;
    setLoading(true);
    setErr("");
    setInfo("");
    try {
      const data = await examService.getQuestions(examId);
      const list = Array.isArray(data) ? data : (data?.preguntas || data?.results || []);

      const normalized = list
        .slice()
        .sort((a, b) => Number(a.orden) - Number(b.orden))
        .map((q, idx) => ({
          id_pregunta: q.id_pregunta ?? q.id ?? null,
          enunciado: q.enunciado ?? "",
          tipo: q.tipo ?? "OPCION_MULTIPLE",
          ponderacion: q.ponderacion ?? 1,
          orden: q.orden ?? idx + 1,
          explicacion: q.explicacion ?? "",
          opciones: Array.isArray(q.opciones)
            ? q.opciones
                .slice()
                .sort((oa, ob) => Number(oa.orden) - Number(ob.orden))
                .map((o, i) => ({
                  texto: o.texto ?? "",
                  es_correcta: !!o.es_correcta,
                  orden: o.orden ?? i + 1,
                }))
            : [emptyOption(1), emptyOption(2)],
          _state: "clean",
        }));

      setQuestions(normalized.length ? normalized : [emptyQuestion(1)]);
    } catch (e) {
      setQuestions([emptyQuestion(1)]);
      setErr(backendErrorToString(e, "No se pudieron cargar las preguntas"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!show) return;
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, examId]);

  const close = () => {
    if (saving) return;
    setErr("");
    setInfo("");
    onHide();
  };

  const markDirty = (q) => {
    if (q._state === "clean") return "dirty";
    if (q._state === "new") return "new";
    return q._state; // dirty/deleted
  };

  const setQuestionField = (index, field, value) => {
    setQuestions((prev) => {
      const next = [...prev];
      const q = next[index];
      next[index] = { ...q, [field]: value, _state: markDirty(q) };
      return next;
    });
    setErr("");
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, emptyQuestion(prev.length + 1)]);
    setErr("");
    setInfo("");
  };

  const removeQuestion = (index) => {
    setQuestions((prev) => {
      const next = [...prev];
      const q = next[index];

      // si ya existe en backend, lo marcamos deleted
      if (q.id_pregunta) {
        next[index] = { ...q, _state: "deleted" };
      } else {
        next.splice(index, 1);
      }

      // re-orden visual
      return next.map((qq, i) => ({ ...qq, orden: i + 1 }));
    });
    setErr("");
  };

  const restoreQuestion = (index) => {
    setQuestions((prev) => {
      const next = [...prev];
      const q = next[index];
      next[index] = { ...q, _state: "dirty" };
      return next;
    });
  };

  const addOption = (qIndex) => {
    setQuestions((prev) => {
      const next = [...prev];
      const q = next[qIndex];
      const opts = [...(q.opciones || []), emptyOption((q.opciones?.length || 0) + 1)];
      next[qIndex] = { ...q, opciones: opts, _state: markDirty(q) };
      return next;
    });
  };

  const removeOption = (qIndex, oIndex) => {
    setQuestions((prev) => {
      const next = [...prev];
      const q = next[qIndex];
      const opts = (q.opciones || []).filter((_, i) => i !== oIndex).map((o, i) => ({ ...o, orden: i + 1 }));
      next[qIndex] = { ...q, opciones: opts.length ? opts : [emptyOption(1), emptyOption(2)], _state: markDirty(q) };
      return next;
    });
  };

  const setOptionText = (qIndex, oIndex, texto) => {
    setQuestions((prev) => {
      const next = [...prev];
      const q = next[qIndex];
      const opts = [...(q.opciones || [])];
      opts[oIndex] = { ...opts[oIndex], texto };
      next[qIndex] = { ...q, opciones: opts, _state: markDirty(q) };
      return next;
    });
  };

  const markCorrect = (qIndex, oIndex) => {
    setQuestions((prev) => {
      const next = [...prev];
      const q = next[qIndex];
      const opts = (q.opciones || []).map((o, i) => ({ ...o, es_correcta: i === oIndex }));
      next[qIndex] = { ...q, opciones: opts, _state: markDirty(q) };
      return next;
    });
  };

  const validateAll = () => {
    const active = questions.filter((q) => q._state !== "deleted");
    if (!active.length) return "Debes tener al menos una pregunta.";

    for (let i = 0; i < active.length; i++) {
      const msg = validateQuestion(active[i], i);
      if (msg) return msg;
    }
    return null;
  };

  const saveAll = async () => {
    if (!examId) return;

    setErr("");
    setInfo("");

    if (!canEdit) {
      setErr("No tienes permisos para editar preguntas.");
      return;
    }

    // Recomendación UX: editar preguntas solo en BORRADOR
    if (examEstado !== "BORRADOR") {
      setErr("Para editar/agregar preguntas, primero vuelve el examen a BORRADOR.");
      return;
    }

    const validationMsg = validateAll();
    if (validationMsg) {
      setErr(validationMsg);
      return;
    }

    setSaving(true);

    try {
      // 1) eliminar las marcadas
      const toDelete = questions.filter((q) => q._state === "deleted" && q.id_pregunta);
      for (const q of toDelete) {
        await examService.deleteQuestion(examId, q.id_pregunta);
      }

      // 2) crear nuevas
      const active = questions.filter((q) => q._state !== "deleted");
      const toCreate = active.filter((q) => !q.id_pregunta);
      for (let idx = 0; idx < toCreate.length; idx++) {
        const q = toCreate[idx];
        const payload = normalizeForSave(q, active.indexOf(q));
        await examService.createQuestion(examId, payload);
      }

      // 3) actualizar editadas
      const toUpdate = active.filter((q) => q.id_pregunta && q._state === "dirty");
      for (const q of toUpdate) {
        const payload = normalizeForSave(q, active.indexOf(q));
        await examService.updateQuestion(examId, q.id_pregunta, payload);
      }

      setInfo("Preguntas guardadas correctamente.");
      await loadQuestions(); // recarga desde backend para quedar limpio

      if (onSaved) onSaved();
    } catch (e) {
      setErr(backendErrorToString(e, "Error guardando preguntas"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={close} size="xl" centered backdrop={saving ? "static" : true}>
      <Modal.Header closeButton={!saving}>
        <Modal.Title>Gestionar preguntas</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {!canEdit && (
          <Alert variant="warning" className="mb-3">
            No tienes permisos para editar preguntas.
          </Alert>
        )}

        {examEstado !== "BORRADOR" && canEdit && (
          <Alert variant="warning" className="mb-3">
            Para editar/agregar preguntas, el examen debe estar en <strong>BORRADOR</strong>.
          </Alert>
        )}

        {err && (
          <Alert variant="danger" dismissible={!saving} onClose={() => setErr("")}>
            <XCircle className="me-2" />
            <pre className="mb-0" style={{ whiteSpace: "pre-wrap" }}>{err}</pre>
          </Alert>
        )}

        {info && (
          <Alert variant="info" dismissible={!saving} onClose={() => setInfo("")}>
            {info}
          </Alert>
        )}

        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="text-muted">
            {loading ? "Cargando preguntas..." : `${questions.filter((q) => q._state !== "deleted").length} preguntas`}
          </div>

          <Button variant="outline-primary" onClick={addQuestion} disabled={disabled || examEstado !== "BORRADOR"}>
            <PlusCircle className="me-1" />
            Agregar pregunta
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" />
          </div>
        ) : (
          questions.map((q, qIndex) => {
            const isDeleted = q._state === "deleted";
            const badge =
              q._state === "new" ? "Nueva" :
              q._state === "dirty" ? "Editada" :
              q._state === "deleted" ? "Eliminada" : "Guardada";

            const badgeVariant =
              q._state === "new" ? "primary" :
              q._state === "dirty" ? "warning" :
              q._state === "deleted" ? "danger" : "secondary";

            return (
              <Card key={`${q.id_pregunta ?? "new"}-${qIndex}`} className="mb-3 shadow-sm" style={{ opacity: isDeleted ? 0.6 : 1 }}>
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <h6 className="mb-0">Pregunta #{qIndex + 1}</h6>
                      <Badge bg={badgeVariant}>{badge}</Badge>
                    </div>

                    <div className="d-flex gap-2">
                      {isDeleted ? (
                        <Button variant="outline-secondary" size="sm" onClick={() => restoreQuestion(qIndex)} disabled={disabled}>
                          Restaurar
                        </Button>
                      ) : (
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => removeQuestion(qIndex)}
                          disabled={disabled || examEstado !== "BORRADOR"}
                        >
                          <Trash className="me-1" />
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </div>

                  <Form.Group className="mb-2">
                    <Form.Label className="mb-1">Enunciado *</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={q.enunciado}
                      onChange={(e) => setQuestionField(qIndex, "enunciado", e.target.value)}
                      disabled={disabled || isDeleted}
                    />
                  </Form.Group>

                  <Row>
                    <Col md={3}>
                      <Form.Group className="mb-2">
                        <Form.Label className="mb-1">Ponderación</Form.Label>
                        <Form.Control
                          type="number"
                          min={1}
                          value={q.ponderacion}
                          onChange={(e) => setQuestionField(qIndex, "ponderacion", Number(e.target.value))}
                          disabled={disabled || isDeleted}
                        />
                      </Form.Group>
                    </Col>

                    <Col md={3}>
                      <Form.Group className="mb-2">
                        <Form.Label className="mb-1">Tipo</Form.Label>
                        <Form.Select value="OPCION_MULTIPLE" disabled>
                          <option value="OPCION_MULTIPLE">Opción múltiple</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group className="mb-2">
                        <Form.Label className="mb-1">Explicación (opcional)</Form.Label>
                        <Form.Control
                          type="text"
                          value={q.explicacion || ""}
                          onChange={(e) => setQuestionField(qIndex, "explicacion", e.target.value)}
                          disabled={disabled || isDeleted}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <div className="border rounded p-3 mt-2">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div className="fw-semibold">Opciones *</div>
                      <Button variant="outline-primary" size="sm" onClick={() => addOption(qIndex)} disabled={disabled || isDeleted}>
                        <PlusCircle className="me-1" />
                        Opción
                      </Button>
                    </div>

                    {(q.opciones || []).map((op, oIndex) => (
                      <Row key={oIndex} className="align-items-center mb-2">
                        <Col xs={1} className="text-muted">{oIndex + 1}</Col>

                        <Col md={7}>
                          <Form.Control
                            type="text"
                            placeholder={`Opción ${oIndex + 1}`}
                            value={op.texto || ""}
                            onChange={(e) => setOptionText(qIndex, oIndex, e.target.value)}
                            disabled={disabled || isDeleted}
                          />
                        </Col>

                        <Col md={3}>
                          <Form.Check
                            type="radio"
                            name={`correct_${qIndex}`}
                            label={
                              <>
                                Correcta{" "}
                                {op.es_correcta ? <CheckCircleFill className="ms-1" /> : null}
                              </>
                            }
                            checked={!!op.es_correcta}
                            onChange={() => markCorrect(qIndex, oIndex)}
                            disabled={disabled || isDeleted}
                          />
                        </Col>

                        <Col md={1} className="text-end">
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => removeOption(qIndex, oIndex)}
                            disabled={disabled || isDeleted || (q.opciones || []).length <= 2}
                            title="Eliminar opción"
                          >
                            <Trash />
                          </Button>
                        </Col>
                      </Row>
                    ))}

                    <small className="text-muted">
                      Mínimo 2 opciones con texto y exactamente 1 correcta.
                    </small>
                  </div>
                </Card.Body>
              </Card>
            );
          })
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={close} disabled={saving}>
          Cerrar
        </Button>

        <Button variant="success" onClick={saveAll} disabled={disabled || examEstado !== "BORRADOR"}>
          {saving ? (
            <>
              <Spinner as="span" animation="border" size="sm" className="me-2" />
              Guardando...
            </>
          ) : (
            "Guardar cambios"
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default GestionarPreguntasModal;
