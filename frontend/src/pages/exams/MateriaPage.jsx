// ============================================
// src/pages/exams/MateriaPage.jsx
// (COMPLETO: listar + crear materia (solo ADMIN/DOCENTE) + habilitar/deshabilitar (solo ADMIN/DOCENTE))
// ============================================
import React, { useEffect, useState } from "react";
import {
  Card,
  Row,
  Col,
  Button,
  Badge,
  Alert,
  Modal,
  Form,
  Spinner,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import examService from "../../services/examService";
import { useAuth } from "../../hooks/useAuth"; // ✅ ya lo vienes usando en tu proyecto

const MateriaPage = () => {
  const { user } = useAuth();
  const rol = user?.rol;
  const canManage = rol === "ADMIN" || rol === "DOCENTE"; // ✅ estudiante NO crea ni edita

  const [materias, setMaterias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Modal crear materia
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nombre: "", descripcion: "", activo: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Toggle activo/inactivo
  const [togglingId, setTogglingId] = useState(null);

  const navigate = useNavigate();

  const fetchMaterias = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const data = await examService.getMaterias();
      setMaterias(data || []);
    } catch (error) {
      console.error("Error cargando materias:", error);
      setMaterias([]);
      setErrorMsg(
        error?.response?.data?.detail || "No se pudo cargar la lista de materias."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterias();
  }, []);

  const goToExams = (materiaId) => {
    if (!materiaId) return;
    navigate(`/materias/${materiaId}/examenes`);
  };

  // =========================
  // Modal crear materia
  // =========================
  const openCreateModal = () => {
    if (!canManage) return;
    setForm({ nombre: "", descripcion: "", activo: true });
    setFormError("");
    setShowCreate(true);
  };

  const closeCreateModal = () => {
    if (saving) return;
    setShowCreate(false);
  };

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const submitCreateMateria = async (e) => {
    e.preventDefault();
    if (!canManage) return;

    setFormError("");
    const nombre = (form.nombre || "").trim();
    if (!nombre) {
      setFormError("El nombre es obligatorio.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        nombre,
        descripcion: (form.descripcion || "").trim(),
        activo: !!form.activo,
      };

      await examService.createMateria(payload);
      await fetchMaterias();
      setShowCreate(false);
    } catch (error) {
      console.error("Error creando materia:", error);

      const apiErr = error?.response?.data;
      if (apiErr && typeof apiErr === "object") {
        const firstKey = Object.keys(apiErr)[0];
        const firstMsg = Array.isArray(apiErr[firstKey])
          ? apiErr[firstKey][0]
          : String(apiErr[firstKey]);
        setFormError(firstMsg || "No se pudo crear la materia.");
      } else {
        setFormError(error?.response?.data?.detail || "No se pudo crear la materia.");
      }
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // Habilitar/Deshabilitar
  // =========================
  const toggleMateria = async (materia) => {
    if (!canManage) return;
    if (!materia?.id_materia) return;

    try {
      setTogglingId(materia.id_materia);

      // Requiere examService.updateMateria(materiaId, {activo})
      await examService.updateMateria(materia.id_materia, {
        activo: !materia.activo,
      });

      await fetchMaterias();
    } catch (error) {
      console.error("Error actualizando materia:", error);
      alert(
        error?.response?.data?.detail ||
          "No se pudo actualizar el estado de la materia."
      );
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <>
      <div className="mb-4 d-flex justify-content-between align-items-start gap-2">
        <div>
          <h2 className="mb-0">Materias</h2>
          <p className="text-muted mb-0">
            Selecciona una materia para ver sus exámenes
          </p>
        </div>

        {canManage && (
          <Button variant="success" onClick={openCreateModal}>
            + Nueva materia
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
          <h5 className="mb-0">Listado de materias</h5>
          <Badge bg="secondary">{materias.length}</Badge>
        </Card.Header>

        <Card.Body>
          {loading ? (
            <p className="text-center text-muted mb-0">Cargando...</p>
          ) : materias.length === 0 ? (
            <p className="text-center text-muted mb-0">No hay materias disponibles</p>
          ) : (
            <Row className="g-3">
              {materias.map((m) => (
                <Col md={6} lg={4} key={m.id_materia}>
                  <Card className="h-100 border">
                    <Card.Body className="d-flex flex-column">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <h6 className="mb-0">{m.nombre}</h6>
                        <Badge bg={m.activo ? "success" : "secondary"}>
                          {m.activo ? "Activa" : "Inactiva"}
                        </Badge>
                      </div>

                      <p className="text-muted small mb-3">
                        {m.descripcion || "Sin descripción"}
                      </p>

                      <Button
                        variant="primary"
                        className={`mt-auto w-100 ${canManage ? "mb-2" : ""}`}
                        onClick={() => goToExams(m.id_materia)}
                        disabled={!m.id_materia}
                      >
                        Ver exámenes
                      </Button>

                      {canManage && (
                        <Button
                          variant={m.activo ? "outline-danger" : "outline-success"}
                          className="w-100"
                          onClick={() => toggleMateria(m)}
                          disabled={!m.id_materia || togglingId === m.id_materia}
                        >
                          {togglingId === m.id_materia
                            ? "Procesando..."
                            : m.activo
                            ? "Deshabilitar"
                            : "Habilitar"}
                        </Button>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card.Body>
      </Card>

      {/* =========================
          MODAL: CREAR MATERIA
         ========================= */}
      {canManage && (
        <Modal show={showCreate} onHide={closeCreateModal} centered>
          <Form onSubmit={submitCreateMateria}>
            <Modal.Header closeButton={!saving}>
              <Modal.Title>Nueva materia</Modal.Title>
            </Modal.Header>

            <Modal.Body>
              {formError && (
                <Alert variant="danger" className="mb-3">
                  {formError}
                </Alert>
              )}

              <Form.Group className="mb-3">
                <Form.Label>Nombre *</Form.Label>
                <Form.Control
                  name="nombre"
                  value={form.nombre}
                  onChange={onChange}
                  placeholder="Ej: Física I"
                  disabled={saving}
                  autoFocus
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Descripción</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="descripcion"
                  value={form.descripcion}
                  onChange={onChange}
                  placeholder="Ej: Fundamentos de Física"
                  disabled={saving}
                />
              </Form.Group>

              <Form.Group className="mb-1">
                <Form.Check
                  type="checkbox"
                  name="activo"
                  label="Materia activa"
                  checked={form.activo}
                  onChange={onChange}
                  disabled={saving}
                />
              </Form.Group>
            </Modal.Body>

            <Modal.Footer>
              <Button variant="secondary" onClick={closeCreateModal} disabled={saving}>
                Cancelar
              </Button>

              <Button variant="primary" type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-2" />
                    Guardando...
                  </>
                ) : (
                  "Crear"
                )}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>
      )}
    </>
  );
};

export default MateriaPage;
