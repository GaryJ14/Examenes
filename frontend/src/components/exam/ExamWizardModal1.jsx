import React, { useState } from "react";
import { Modal, Form, Button, Alert, Row, Col, Spinner, Card } from "react-bootstrap";
import { XCircle, PlusCircle, Trash } from "react-bootstrap-icons";
import examService from "../../services/examService";

const emptyQuestion = (order = 1) => ({
  enunciado: "",
  tipo: "OPCION_MULTIPLE",
  ponderacion: 1,
  orden: order,
  explicacion: "",
  opciones: [
    { texto: "", es_correcta: false, orden: 1 },
    { texto: "", es_correcta: false, orden: 2 },
  ],
});

const normalizeLocalDateTime = (v) => {
  if (!v) return v;
  // datetime-local: "YYYY-MM-DDTHH:mm" -> "YYYY-MM-DDTHH:mm:00"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return `${v}:00`;
  return v;
};

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

const ExamWizardModal = ({
  show,
  onHide,
  onSuccess,
  defaultEstado = "BORRADOR",
  title = "Crear Examen con Preguntas",
}) => {
  const [step, setStep] = useState(1);

  const [exam, setExam] = useState({
    titulo: "",
    descripcion: "",
    fecha_inicio: "",
    fecha_fin: "",
    duracion: 60,
    instrucciones: "",
    intentos_permitidos: 1,
    aleatorizar_preguntas: false,
    requiere_camara: true,
    mostrar_respuestas: false,
    estado: defaultEstado,
  });

  const [questions, setQuestions] = useState([emptyQuestion(1)]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const resetAll = () => {
    setStep(1);
    setExam({
      titulo: "",
      descripcion: "",
      fecha_inicio: "",
      fecha_fin: "",
      duracion: 60,
      instrucciones: "",
      intentos_permitidos: 1,
      aleatorizar_preguntas: false,
      requiere_camara: true,
      mostrar_respuestas: false,
      estado: defaultEstado,
    });
    setQuestions([emptyQuestion(1)]);
    setSaving(false);
    setSuccess(false);
    setError(null);
  };

  const handleClose = () => {
    if (saving) return;
    resetAll();
    onHide();
  };

  // ====== EXAM HANDLERS ======
  const setExamField = (e) => {
    const { name, value, type, checked } = e.target;

    setExam((prev) => {
      if (type === "checkbox") return { ...prev, [name]: checked };
      if (name === "duracion" || name === "intentos_permitidos") return { ...prev, [name]: Number(value) };
      return { ...prev, [name]: value };
    });

    setError(null);
  };

  const validateExam = () => {
    if (!exam.titulo.trim()) return setError("El título del examen es obligatorio."), false;
    if (!exam.fecha_inicio || !exam.fecha_fin) return setError("Fecha inicio y fin son obligatorias."), false;

    const inicio = new Date(exam.fecha_inicio);
    const fin = new Date(exam.fecha_fin);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return setError("Fechas inválidas."), false;
    if (inicio >= fin) return setError("La fecha de inicio debe ser anterior a la fecha de fin."), false;

    const d = Number(exam.duracion);
    if (!Number.isFinite(d) || d < 5) return setError("Duración mínima: 5 minutos."), false;

    const i = Number(exam.intentos_permitidos);
    if (!Number.isFinite(i) || i < 1) return setError("Intentos permitidos inválidos."), false;

    return true;
  };

  // ====== QUESTIONS HANDLERS ======
  const validateQuestion = (q, index) => {
    if (!q.enunciado.trim()) return `Pregunta #${index + 1}: el enunciado es obligatorio.`;

    const validOptions = q.opciones.filter((o) => (o.texto || "").trim().length > 0);
    if (validOptions.length < 2) return `Pregunta #${index + 1}: mínimo 2 opciones con texto.`;

    const correctCount = validOptions.filter((o) => o.es_correcta).length;
    if (correctCount !== 1) return `Pregunta #${index + 1}: marca exactamente 1 opción correcta.`;

    const p = Number(q.ponderacion);
    if (!Number.isFinite(p) || p <= 0) return `Pregunta #${index + 1}: ponderación inválida.`;

    return null;
  };

  const validateQuestions = () => {
    if (!questions.length) return setError("Debes agregar al menos una pregunta."), false;

    for (let idx = 0; idx < questions.length; idx++) {
      const msg = validateQuestion(questions[idx], idx);
      if (msg) return setError(msg), false;
    }
    return true;
  };

  const goNext = () => {
    setError(null);
    if (step === 1) {
      if (!validateExam()) return;
      setStep(2);
    }
  };

  const goBack = () => {
    setError(null);
    if (step === 2) setStep(1);
  };

  const addQuestion = () => setQuestions((prev) => [...prev, emptyQuestion(prev.length + 1)]);

  const removeQuestion = (qIndex) => {
    setQuestions((prev) => {
      const next = prev.filter((_, i) => i !== qIndex);
      return next.map((q, i) => ({ ...q, orden: i + 1 }));
    });
  };

  const updateQuestionField = (qIndex, field, value) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex] = { ...next[qIndex], [field]: field === "ponderacion" ? Number(value) : value };
      return next;
    });
    setError(null);
  };

  const addOption = (qIndex) => {
    setQuestions((prev) => {
      const next = [...prev];
      const q = next[qIndex];
      next[qIndex] = {
        ...q,
        opciones: [...q.opciones, { texto: "", es_correcta: false, orden: q.opciones.length + 1 }],
      };
      return next;
    });
  };

  const removeOption = (qIndex, oIndex) => {
    setQuestions((prev) => {
      const next = [...prev];
      const q = next[qIndex];
      const opts = q.opciones.filter((_, i) => i !== oIndex).map((o, i) => ({ ...o, orden: i + 1 }));
      next[qIndex] = { ...q, opciones: opts };
      return next;
    });
  };

  const updateOption = (qIndex, oIndex, patch) => {
    setQuestions((prev) => {
      const next = [...prev];
      const q = next[qIndex];
      const opts = [...q.opciones];
      opts[oIndex] = { ...opts[oIndex], ...patch };
      next[qIndex] = { ...q, opciones: opts };
      return next;
    });
    setError(null);
  };

  const markCorrect = (qIndex, oIndex) => {
    setQuestions((prev) => {
      const next = [...prev];
      const q = next[qIndex];
      const opts = q.opciones.map((o, i) => ({ ...o, es_correcta: i === oIndex }));
      next[qIndex] = { ...q, opciones: opts };
      return next;
    });
    setError(null);
  };

  // ====== SAVE ALL (EXAM + QUESTIONS) ======
  const handleSaveAll = async () => {
    setError(null);

    if (!validateExam()) return;
    if (!validateQuestions()) return;

    setSaving(true);

    try {
      // 1) Crear examen
      const examPayload = {
        ...exam,
        titulo: exam.titulo.trim(),
        descripcion: (exam.descripcion || "").trim(),
        instrucciones: (exam.instrucciones || "").trim(),
        fecha_inicio: normalizeLocalDateTime(exam.fecha_inicio),
        fecha_fin: normalizeLocalDateTime(exam.fecha_fin),
        duracion: Number(exam.duracion),
        intentos_permitidos: Number(exam.intentos_permitidos),
        aleatorizar_preguntas: !!exam.aleatorizar_preguntas,
        requiere_camara: !!exam.requiere_camara,
        mostrar_respuestas: !!exam.mostrar_respuestas,
      };

      const createdExam = await examService.createExam(examPayload);

      // ✅ TU BACKEND DEVUELVE: id_examen
      const examIdRaw =
        createdExam?.id_examen ??
        createdExam?.id ??
        createdExam?.pk ??
        createdExam?.examen_id ??
        createdExam?.examen?.id ??
        createdExam?.data?.id ??
        createdExam?.data?.pk;

      const examId = Number.parseInt(examIdRaw, 10);

      if (!Number.isInteger(examId) || examId <= 0) {
        console.log("Respuesta createExam (debug):", createdExam);
        throw new Error("El backend no devolvió un id de examen válido.");
      }

      // 2) Crear preguntas
      for (let idx = 0; idx < questions.length; idx++) {
        const q = questions[idx];

        const qPayload = {
          enunciado: q.enunciado.trim(),
          tipo: "OPCION_MULTIPLE",
          ponderacion: Number(q.ponderacion),
          orden: idx + 1,
          explicacion: (q.explicacion || "").trim(),
          opciones: q.opciones
            .map((o, i) => ({
              texto: (o.texto || "").trim(),
              es_correcta: !!o.es_correcta,
              orden: i + 1,
            }))
            .filter((o) => o.texto.length > 0),
        };

        try {
          await examService.createQuestion(examId, qPayload);
        } catch (err) {
          throw new Error(`Falló al crear la pregunta #${idx + 1}. Detalle: ${backendErrorToString(err)}`);
        }
      }

      setSuccess(true);

      setTimeout(() => {
        handleClose();
        if (onSuccess) onSuccess(createdExam);
      }, 800);
    } catch (e) {
      console.error("ExamWizard save error:", e);
      setError(e.message || "Error al guardar examen y preguntas");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} size="xl" centered backdrop={saving ? "static" : true}>
      <Modal.Header closeButton={!saving}>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <Alert variant="danger" dismissible={!saving} onClose={() => setError(null)}>
            <XCircle className="me-2" />
            <pre className="mb-0" style={{ whiteSpace: "pre-wrap" }}>{error}</pre>
          </Alert>
        )}

        {success && <Alert variant="success">Examen y preguntas creados exitosamente</Alert>}

        {step === 1 && (
          <>
            <h5 className="mb-3">Paso 1: Datos del examen</h5>

            <Form.Group className="mb-3">
              <Form.Label>Título *</Form.Label>
              <Form.Control type="text" name="titulo" value={exam.titulo} onChange={setExamField} disabled={saving || success} />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Descripción</Form.Label>
              <Form.Control as="textarea" rows={2} name="descripcion" value={exam.descripcion} onChange={setExamField} disabled={saving || success} />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Fecha de Inicio *</Form.Label>
                  <Form.Control type="datetime-local" name="fecha_inicio" value={exam.fecha_inicio} onChange={setExamField} disabled={saving || success} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Fecha de Fin *</Form.Label>
                  <Form.Control type="datetime-local" name="fecha_fin" value={exam.fecha_fin} onChange={setExamField} disabled={saving || success} />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Duración (min) *</Form.Label>
                  <Form.Control type="number" min={5} max={300} name="duracion" value={exam.duracion} onChange={setExamField} disabled={saving || success} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Intentos Permitidos</Form.Label>
                  <Form.Select name="intentos_permitidos" value={exam.intentos_permitidos} onChange={setExamField} disabled={saving || success}>
                    <option value={1}>1 intento</option>
                    <option value={2}>2 intentos</option>
                    <option value={3}>3 intentos</option>
                    <option value={5}>5 intentos</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Instrucciones</Form.Label>
              <Form.Control as="textarea" rows={2} name="instrucciones" value={exam.instrucciones} onChange={setExamField} disabled={saving || success} />
            </Form.Group>

            <div className="border rounded p-3">
              <h6 className="mb-3">Configuraciones</h6>
              <Form.Check
                type="switch"
                id="requiere_camara"
                name="requiere_camara"
                label="Requiere cámara"
                checked={exam.requiere_camara}
                onChange={setExamField}
                disabled={saving || success}
                className="mb-2"
              />
              <Form.Check
                type="switch"
                id="aleatorizar_preguntas"
                name="aleatorizar_preguntas"
                label="Aleatorizar preguntas"
                checked={exam.aleatorizar_preguntas}
                onChange={setExamField}
                disabled={saving || success}
                className="mb-2"
              />
              <Form.Check
                type="switch"
                id="mostrar_respuestas"
                name="mostrar_respuestas"
                label="Mostrar respuestas al finalizar"
                checked={exam.mostrar_respuestas}
                onChange={setExamField}
                disabled={saving || success}
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">Paso 2: Preguntas</h5>
              <Button type="button" variant="outline-primary" onClick={addQuestion} disabled={saving || success}>
                <PlusCircle className="me-1" />
                Agregar pregunta
              </Button>
            </div>

            {questions.map((q, qIndex) => (
              <Card key={qIndex} className="mb-3 shadow-sm">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="mb-3">Pregunta #{qIndex + 1}</h6>
                    <Button
                      type="button"
                      variant="outline-danger"
                      size="sm"
                      onClick={() => removeQuestion(qIndex)}
                      disabled={saving || success || questions.length <= 1}
                    >
                      <Trash className="me-1" />
                      Eliminar
                    </Button>
                  </div>

                  <Form.Group className="mb-3">
                    <Form.Label>Enunciado *</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={q.enunciado}
                      onChange={(e) => updateQuestionField(qIndex, "enunciado", e.target.value)}
                      disabled={saving || success}
                    />
                  </Form.Group>

                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Ponderación</Form.Label>
                        <Form.Control
                          type="number"
                          min={1}
                          value={q.ponderacion}
                          onChange={(e) => updateQuestionField(qIndex, "ponderacion", e.target.value)}
                          disabled={saving || success}
                        />
                      </Form.Group>
                    </Col>

                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Orden</Form.Label>
                        <Form.Control type="number" value={qIndex + 1} disabled />
                      </Form.Group>
                    </Col>

                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Tipo</Form.Label>
                        <Form.Select value="OPCION_MULTIPLE" disabled>
                          <option value="OPCION_MULTIPLE">Opción múltiple</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Form.Group className="mb-3">
                    <Form.Label>Explicación (opcional)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={q.explicacion}
                      onChange={(e) => updateQuestionField(qIndex, "explicacion", e.target.value)}
                      disabled={saving || success}
                    />
                  </Form.Group>

                  <div className="border rounded p-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="mb-0">Opciones</h6>
                      <Button type="button" variant="outline-primary" size="sm" onClick={() => addOption(qIndex)} disabled={saving || success}>
                        <PlusCircle className="me-1" />
                        Agregar opción
                      </Button>
                    </div>

                    {q.opciones.map((op, oIndex) => (
                      <Row key={oIndex} className="align-items-center mb-2">
                        <Col xs={1} className="text-muted">{oIndex + 1}</Col>

                        <Col md={7}>
                          <Form.Control
                            type="text"
                            value={op.texto}
                            onChange={(e) => updateOption(qIndex, oIndex, { texto: e.target.value })}
                            placeholder={`Opción ${oIndex + 1}`}
                            disabled={saving || success}
                          />
                        </Col>

                        <Col md={3}>
                          <Form.Check
                            type="radio"
                            name={`correcta_${qIndex}`}
                            label="Correcta"
                            checked={!!op.es_correcta}
                            onChange={() => markCorrect(qIndex, oIndex)}
                            disabled={saving || success}
                          />
                        </Col>

                        <Col md={1} className="text-end">
                          <Button
                            type="button"
                            variant="outline-danger"
                            size="sm"
                            onClick={() => removeOption(qIndex, oIndex)}
                            disabled={saving || success || q.opciones.length <= 2}
                            title="Eliminar opción"
                          >
                            <Trash />
                          </Button>
                        </Col>
                      </Row>
                    ))}

                    <small className="text-muted">Mínimo 2 opciones y exactamente 1 correcta.</small>
                  </div>
                </Card.Body>
              </Card>
            ))}
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={saving}>
          Cancelar
        </Button>

        {step === 2 && (
          <Button variant="outline-secondary" onClick={goBack} disabled={saving}>
            Volver
          </Button>
        )}

        {step === 1 && (
          <Button variant="primary" onClick={goNext} disabled={saving || success}>
            Siguiente
          </Button>
        )}

        {step === 2 && (
          <Button variant="success" onClick={handleSaveAll} disabled={saving || success}>
            {saving ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" className="me-2" />
                Guardando...
              </>
            ) : (
              "Guardar examen y preguntas"
            )}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default ExamWizardModal;
