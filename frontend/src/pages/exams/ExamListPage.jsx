// ============================================
// src/pages/exams/ExamListPage.jsx
// (COMPLETO: lista por materia o general; crear/generar IA SOLO ADMIN/DOCENTE; estudiante solo ve e inicia)
// ============================================
import React, { useEffect, useMemo, useState } from "react";
import {
  Row,
  Col,
  Card,
  Button,
  Badge,
  Alert,
  Modal,
  Form,
  Spinner,
} from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import examService from "../../services/examService";
import { useAuth } from "../../hooks/useAuth";

const ExamListPage = () => {
  const { materiaId } = useParams(); // /materias/:materiaId/examenes

  const { user } = useAuth();
  const rol = user?.rol;
  const canManage = rol === "ADMIN" || rol === "DOCENTE";
  const isStudent = rol === "ESTUDIANTE";

  const [exams, setExams] = useState([]);
  const [materia, setMateria] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Modal Generar Examen IA (solo admin/docente)
  const [showGen, setShowGen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [genError, setGenError] = useState("");

  // formulario examen base + params IA
  
  const [form, setForm] = useState({
    titulo: "",
    descripcion: "Examen generado con IA",
    duracion_minutos: 20,
    puntaje_total: 5,
    nivel: "BASICO",
    idioma: "ES",
    numero_preguntas: 3,
    enfoque_tematico: "variables",
    estilo: "simple",
    tags: "test",
    requiere_camara: false,
    aleatorizar_preguntas: true,
    aleatorizar_opciones: true,
    mostrar_respuestas: false,
    om: 2,
    vf: 1,
  });

  const hasMateriaContext = !!materiaId;

  const fetchExams = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      let data;

      if (materiaId) {
        data = await examService.getExamsByMateriaPath(materiaId);
        setMateria(data?.materia || null);
        setExams(Array.isArray(data?.examenes) ? data.examenes : []);
      } else {
        data = await examService.getExams();
        const list = Array.isArray(data) ? data : data?.examenes || [];
        setMateria(null);
        setExams(list);
      }
    } catch (error) {
      console.error("Error cargando exámenes:", error);
      setExams([]);
      setMateria(null);
      setErrorMsg(
        error?.response?.data?.detail ||
          "No se pudo cargar la lista de exámenes. Revisa el backend o el token."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materiaId]);

  // -----------------------------
  // Modal IA: abrir/cerrar
  // -----------------------------
  const openGenModal = () => {
    if (!canManage) return;
    setGenError("");
    const nombreMateria = materia?.nombre ? String(materia.nombre) : "";
    setForm((prev) => ({
      ...prev,
      titulo: nombreMateria ? `Examen - ${nombreMateria}` : prev.titulo,
    }));
    setShowGen(true);
  };

  const closeGenModal = () => {
    if (saving) return;
    setShowGen(false);
  };

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const parsedIaPayload = useMemo(() => {
    const tags = String(form.tags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const enfoque_tematico = String(form.enfoque_tematico || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const om = Number(form.om || 0);
    const vf = Number(form.vf || 0);

    return {
      nivel: form.nivel,
      idioma: form.idioma,
      numero_preguntas: Number(form.numero_preguntas || 0),
      distribucion_tipos: {
        OPCION_MULTIPLE: om,
        VERDADERO_FALSO: vf,
      },
      duracion_minutos: Number(form.duracion_minutos || 0),
      puntaje_total: Number(form.puntaje_total || 0),
      enfoque_tematico,
      estilo: form.estilo,
      tags,
    };
  }, [form]);

  const submitGenerate = async (e) => {
    e.preventDefault();
    if (!canManage) return;

    setGenError("");

    if (!materiaId) {
      setGenError("Debes entrar desde una materia para generar un examen con IA.");
      return;
    }

    const titulo = String(form.titulo || "").trim();
    if (!titulo) {
      setGenError("El título es obligatorio.");
      return;
    }

    const nPreg = Number(form.numero_preguntas || 0);
    if (!nPreg || nPreg < 1) {
      setGenError("numero_preguntas debe ser >= 1.");
      return;
    }

    const om = Number(form.om || 0);
    const vf = Number(form.vf || 0);
    if (om + vf !== nPreg) {
      setGenError("La suma de distribucion_tipos debe ser igual a numero_preguntas.");
      return;
    }

    try {
      setSaving(true);

      // 1) Crear examen base (materia fija por ruta)
      const created = await examService.createExam({
        materia: Number(materiaId),
        titulo,
        descripcion: String(form.descripcion || "").trim(),
        duracion: Number(form.duracion_minutos || 0),
        mostrar_respuestas: !!form.mostrar_respuestas,
        aleatorizar_preguntas: !!form.aleatorizar_preguntas,
        aleatorizar_opciones: !!form.aleatorizar_opciones,
        requiere_camara: !!form.requiere_camara,
        nivel: form.nivel,
        idioma: form.idioma,
        tags: String(form.tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        // estado por defecto: BORRADOR (según tu examService)
      });

      const examenId = created?.id_examen;
      if (!examenId) {
        throw new Error("No se obtuvo id_examen al crear el examen.");
      }

      // 2) Generar preguntas con IA
      await examService.generateExamIA(examenId, parsedIaPayload);

      await fetchExams();
      setShowGen(false);
    } catch (error) {
      console.error("Error generando examen IA:", error);

      const apiErr = error?.response?.data;
      if (apiErr && typeof apiErr === "object") {
        const k = Object.keys(apiErr)[0];
        const msg = Array.isArray(apiErr[k]) ? apiErr[k][0] : String(apiErr[k]);
        setGenError(msg || "No se pudo generar el examen con IA.");
      } else {
        setGenError(
          error?.response?.data?.detail || "No se pudo generar el examen con IA."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mb-4 d-flex justify-content-between align-items-start gap-2">
        <div>
          <h2 className="mb-0">
            {materia?.nombre ? `Exámenes - ${materia.nombre}` : "Exámenes"}
          </h2>
          <p className="text-muted mb-0">
            {materiaId
              ? "Lista de exámenes asociados a la materia seleccionada"
              : "Lista de exámenes disponibles"}
          </p>
        </div>

        {hasMateriaContext && canManage && (
          <Button variant="success" onClick={openGenModal}>
            + Generar con IA
          </Button>
        )}
      </div>

      {errorMsg && (
        <Alert variant="danger" className="mb-3">
          {errorMsg}
        </Alert>
      )}

      <Card className="shadow-sm">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Listado</h5>
          <Badge bg="secondary">{exams.length}</Badge>
        </Card.Header>

        <Card.Body>
          {loading ? (
            <p className="text-center text-muted mb-0">Cargando...</p>
          ) : exams.length === 0 ? (
            <p className="text-center text-muted mb-0">No hay exámenes disponibles</p>
          ) : (
            <Row className="g-3">
              {exams.map((exam) => {
                const examId = exam?.id_examen;
                const isActivo = exam?.estado === "ACTIVO";

                return (
                  <Col md={6} lg={4} key={examId}>
                    <Card className="h-100 border">
                      <Card.Body className="d-flex flex-column">
                        <div className="d-flex justify-content-between align-items-start">
                          <h6 className="mb-2">{exam.titulo}</h6>
                          <Badge bg={isActivo ? "success" : "secondary"}>
                            {exam.estado}
                          </Badge>
                        </div>

                        <p className="text-muted small mb-3">
                          {exam.descripcion || "Sin descripción"}
                        </p>

                        <div className="d-flex justify-content-between mb-2 small">
                          <span>Duración:</span>
                          <strong>{exam.duracion ?? 0} min</strong>
                        </div>

                        <div className="d-flex justify-content-between mb-3 small">
                          <span>Intentos:</span>
                          <strong>{exam.intentos_permitidos ?? 0}</strong>
                        </div>

                        {/* Botón detalle siempre visible */}
                        <Button
                          as={Link}
                          to={`/examenes/${examId}`}
                          variant="primary"
                          className={`mt-auto w-100 ${isStudent ? "mb-2" : ""}`}
                          disabled={!examId}
                        >
                          Ver detalle
                        </Button>

                        
                        
                      </Card.Body>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          )}
        </Card.Body>
      </Card>

      {/* =========================
          MODAL: GENERAR EXAMEN IA (solo ADMIN/DOCENTE)
         ========================= */}
      {canManage && (
        <Modal show={showGen} onHide={closeGenModal} centered size="lg">
          <Form onSubmit={submitGenerate}>
            <Modal.Header closeButton={!saving}>
              <Modal.Title>Generar examen con IA</Modal.Title>
            </Modal.Header>

            <Modal.Body>
              {genError && (
                <Alert variant="danger" className="mb-3">
                  {genError}
                </Alert>
              )}

              <Row className="g-3">
                <Col md={8}>
                  <Form.Group className="mb-3">
                    <Form.Label>Título *</Form.Label>
                    <Form.Control
                      name="titulo"
                      value={form.titulo}
                      onChange={onChange}
                      disabled={saving}
                      placeholder="Ej: Física I - Parcial 1"
                      autoFocus
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Idioma</Form.Label>
                    <Form.Select
                      name="idioma"
                      value={form.idioma}
                      onChange={onChange}
                      disabled={saving}
                    >
                      <option value="ES">ES</option>
                      <option value="EN">EN</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={12}>
                  <Form.Group className="mb-3">
                    <Form.Label>Descripción</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      name="descripcion"
                      value={form.descripcion}
                      onChange={onChange}
                      disabled={saving}
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Nivel</Form.Label>
                    <Form.Select
                      name="nivel"
                      value={form.nivel}
                      onChange={onChange}
                      disabled={saving}
                    >
                      <option value="BASICO">BASICO</option>
                      <option value="INTERMEDIO">INTERMEDIO</option>
                      <option value="AVANZADO">AVANZADO</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Número de preguntas</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      name="numero_preguntas"
                      value={form.numero_preguntas}
                      onChange={onChange}
                      disabled={saving}
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Duración (min)</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      name="duracion_minutos"
                      value={form.duracion_minutos}
                      onChange={onChange}
                      disabled={saving}
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Puntaje total</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      name="puntaje_total"
                      value={form.puntaje_total}
                      onChange={onChange}
                      disabled={saving}
                    />
                  </Form.Group>
                </Col>

                <Col md={8}>
                  <Form.Group className="mb-3">
                    <Form.Label>Enfoque temático (coma separada)</Form.Label>
                    <Form.Control
                      name="enfoque_tematico"
                      value={form.enfoque_tematico}
                      onChange={onChange}
                      disabled={saving}
                      placeholder="Ej: variables, operadores"
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Distribución: Opción múltiple</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      name="om"
                      value={form.om}
                      onChange={onChange}
                      disabled={saving}
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Distribución: Verdadero/Falso</Form.Label>
                    <Form.Control
                      type="number"
                      min={0}
                      name="vf"
                      value={form.vf}
                      onChange={onChange}
                      disabled={saving}
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Estilo</Form.Label>
                    <Form.Select
                      name="estilo"
                      value={form.estilo}
                      onChange={onChange}
                      disabled={saving}
                    >
                      <option value="simple">simple</option>
                      <option value="intermedio">intermedio</option>
                      <option value="detallado">detallado</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Tags (coma separada)</Form.Label>
                    <Form.Control
                      name="tags"
                      value={form.tags}
                      onChange={onChange}
                      disabled={saving}
                      placeholder="Ej: test, parcial1"
                    />
                  </Form.Group>
                </Col>

                <Col md={12}>
                  <div className="d-flex flex-wrap gap-3">
                    <Form.Check
                      type="checkbox"
                      name="requiere_camara"
                      label="Requiere cámara"
                      checked={form.requiere_camara}
                      onChange={onChange}
                      disabled={saving}
                    />
                    <Form.Check
                      type="checkbox"
                      name="aleatorizar_preguntas"
                      label="Aleatorizar preguntas"
                      checked={form.aleatorizar_preguntas}
                      onChange={onChange}
                      disabled={saving}
                    />
                    <Form.Check
                      type="checkbox"
                      name="aleatorizar_opciones"
                      label="Aleatorizar opciones"
                      checked={form.aleatorizar_opciones}
                      onChange={onChange}
                      disabled={saving}
                    />
                    <Form.Check
                      type="checkbox"
                      name="mostrar_respuestas"
                      label="Mostrar respuestas"
                      checked={form.mostrar_respuestas}
                      onChange={onChange}
                      disabled={saving}
                    />
                  </div>
                </Col>
              </Row>

              <div className="mt-3">
                <small className="text-muted">Payload IA (se envía a generar-ia):</small>
                <pre className="bg-light p-2 rounded small mb-0">
                  {JSON.stringify(parsedIaPayload, null, 2)}
                </pre>
              </div>
            </Modal.Body>

            <Modal.Footer>
              <Button variant="secondary" onClick={closeGenModal} disabled={saving}>
                Cancelar
              </Button>

              <Button variant="primary" type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-2" />
                    Generando...
                  </>
                ) : (
                  "Crear y generar"
                )}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>
      )}
    </>
  );
};

export default ExamListPage;
