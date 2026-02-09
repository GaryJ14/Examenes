import React, { useEffect, useState } from "react";
import { Modal, Button, Alert, Spinner, Form, Row, Col } from "react-bootstrap";
import examService from "../../services/examService";

const toDatetimeLocal = (value) => {
  if (!value) return "";
  if (typeof value !== "string") return "";
  if (value.includes("T")) return value.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return value.replace(" ", "T").slice(0, 16);
  }
  return value;
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

const EditExamModal = ({ show, onHide, exam, onSaved }) => {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!exam) return;

    setForm({
      titulo: exam.titulo || "",
      descripcion: exam.descripcion || "",
      fecha_inicio: toDatetimeLocal(exam.fecha_inicio),
      fecha_fin: toDatetimeLocal(exam.fecha_fin),
      duracion: exam.duracion ?? 60,
      instrucciones: exam.instrucciones || "",
      intentos_permitidos: exam.intentos_permitidos ?? 1,
      aleatorizar_preguntas: !!exam.aleatorizar_preguntas,
      requiere_camara: !!exam.requiere_camara,
      mostrar_respuestas: !!exam.mostrar_respuestas,
    });

    setErr("");
    setSaving(false);
  }, [exam]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => {
      if (!prev) return prev;
      if (type === "checkbox") return { ...prev, [name]: checked };
      if (name === "duracion" || name === "intentos_permitidos") return { ...prev, [name]: Number(value) };
      return { ...prev, [name]: value };
    });

    setErr("");
  };

  const validate = () => {
    if (!form?.titulo?.trim()) return setErr("El título es obligatorio."), false;
    if (!form.fecha_inicio || !form.fecha_fin) return setErr("Fecha inicio y fin son obligatorias."), false;

    const inicio = new Date(form.fecha_inicio);
    const fin = new Date(form.fecha_fin);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return setErr("Fechas inválidas."), false;
    if (inicio >= fin) return setErr("La fecha inicio debe ser menor a la fecha fin."), false;

    const d = Number(form.duracion);
    if (!Number.isFinite(d) || d < 5) return setErr("Duración mínima 5 min."), false;

    const i = Number(form.intentos_permitidos);
    if (!Number.isFinite(i) || i < 1) return setErr("Intentos inválidos."), false;

    return true;
  };

  const handleSave = async () => {
    if (!exam || !form) return;
    if (!validate()) return;

    setSaving(true);
    setErr("");

    try {
      const examId = exam.id_examen ?? exam.id ?? exam.pk;

      const updated = await examService.updateExam(examId, {
        ...form,
        titulo: form.titulo.trim(),
        descripcion: (form.descripcion || "").trim(),
        instrucciones: (form.instrucciones || "").trim(),
      });

      onSaved(updated);
      onHide();
    } catch (e) {
      setErr(backendErrorToString(e, "No se pudo guardar el examen"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={() => (!saving ? onHide() : null)} size="lg" centered backdrop={saving ? "static" : true}>
      <Modal.Header closeButton={!saving}>
        <Modal.Title>Editar examen</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {err && (
          <Alert variant="danger" dismissible={!saving} onClose={() => setErr("")}>
            <pre className="mb-0" style={{ whiteSpace: "pre-wrap" }}>{err}</pre>
          </Alert>
        )}

        {!form ? (
          <div className="text-muted">Cargando formulario...</div>
        ) : (
          <>
            <Form.Group className="mb-3">
              <Form.Label>Título *</Form.Label>
              <Form.Control name="titulo" value={form.titulo} onChange={handleChange} disabled={saving} />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Descripción</Form.Label>
              <Form.Control as="textarea" rows={2} name="descripcion" value={form.descripcion} onChange={handleChange} disabled={saving} />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Fecha de inicio *</Form.Label>
                  <Form.Control type="datetime-local" name="fecha_inicio" value={form.fecha_inicio} onChange={handleChange} disabled={saving} />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Fecha de fin *</Form.Label>
                  <Form.Control type="datetime-local" name="fecha_fin" value={form.fecha_fin} onChange={handleChange} disabled={saving} />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Duración (min) *</Form.Label>
                  <Form.Control type="number" min={5} max={300} name="duracion" value={form.duracion} onChange={handleChange} disabled={saving} />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Intentos permitidos *</Form.Label>
                  <Form.Select name="intentos_permitidos" value={form.intentos_permitidos} onChange={handleChange} disabled={saving}>
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
              <Form.Control as="textarea" rows={2} name="instrucciones" value={form.instrucciones} onChange={handleChange} disabled={saving} />
            </Form.Group>

            <div className="border rounded p-3">
              <h6 className="mb-3">Configuraciones</h6>

              <Form.Check type="switch" id="requiere_camara" name="requiere_camara" label="Requiere cámara" checked={form.requiere_camara} onChange={handleChange} disabled={saving} className="mb-2" />
              <Form.Check type="switch" id="aleatorizar_preguntas" name="aleatorizar_preguntas" label="Aleatorizar preguntas" checked={form.aleatorizar_preguntas} onChange={handleChange} disabled={saving} className="mb-2" />
              <Form.Check type="switch" id="mostrar_respuestas" name="mostrar_respuestas" label="Mostrar respuestas al finalizar" checked={form.mostrar_respuestas} onChange={handleChange} disabled={saving} />
            </div>
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving || !form}>
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

export default EditExamModal;
