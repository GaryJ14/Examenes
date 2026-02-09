// ============================================
// src/pages/dashboard/AdminDashboard.jsx
// ✅ Totales correctos según tus endpoints
// ============================================
import React, { useEffect, useMemo, useState } from "react";
import { Row, Col, Card, Button, Modal, Form, Alert, Spinner } from "react-bootstrap";
import { PersonFill, FileEarmarkText, CameraVideo, GraphUp, XCircle } from "react-bootstrap-icons";

import userService from "../../services/userService";
import examService from "../../services/examService";
import attemptService from "../../services/attemptService";
import monitoringService from "../../services/monitoringService";

import ExamWizardModal from "../../components/exam/ExamWizardModal1";
import GenerateReportModal from "../../components/reports/GenerateReportModal";

// ----------------------------
// Helpers: normalizar respuesta
// ----------------------------
const asArray = (v) => (Array.isArray(v) ? v : []);

const extractTotal = (data, list) => {
  // prioriza total/count si existe
  if (data && typeof data === "object") {
    if (typeof data.total === "number") return data.total;
    if (typeof data.count === "number") return data.count;
  }
  return Array.isArray(list) ? list.length : 0;
};

const normalizeUsers = (data) => {
  // esperado: { total, usuarios } o lista
  if (Array.isArray(data)) return { total: data.length, list: data };
  const list = asArray(data?.usuarios ?? data?.results ?? data?.data);
  return { total: extractTotal(data, list), list };
};

const normalizeExams = (data) => {
  // esperado: { total, examenes } o lista
  if (Array.isArray(data)) return { total: data.length, list: data };
  const list = asArray(data?.examenes ?? data?.results ?? data?.data);
  return { total: extractTotal(data, list), list };
};

const normalizeAttempts = (data) => {
  // según tu backend: { total, intentos } o lista
  if (Array.isArray(data)) return { total: data.length, list: data };
  const list = asArray(data?.intentos ?? data?.results ?? data?.data);
  return { total: extractTotal(data, list), list };
};

const normalizeWarnings = (data) => {
  // depende de tu API monitoreo: { total, advertencias } o lista
  if (Array.isArray(data)) return { total: data.length, list: data };
  const list = asArray(data?.advertencias ?? data?.results ?? data?.data);
  return { total: extractTotal(data, list), list };
};

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsuarios: 0,
    totalExamenes: 0,
    totalIntentos: 0,
    totalAdvertencias: 0,
  });

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [showUserModal, setShowUserModal] = useState(false);
  const [showExamWizard, setShowExamWizard] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const [exams, setExams] = useState([]);

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const [usersData, examsData, attemptsData, warningsData] = await Promise.all([
        userService.getUsers(),
        examService.getExams(),
        attemptService.getAttempts?.() ?? Promise.resolve([]),
        monitoringService.getWarnings?.() ?? Promise.resolve([]),
      ]);

      const usersN = normalizeUsers(usersData);
      const examsN = normalizeExams(examsData);
      const attemptsN = normalizeAttempts(attemptsData);
      const warningsN = normalizeWarnings(warningsData);

      setExams(examsN.list);

      setStats({
        totalUsuarios: usersN.total,
        totalExamenes: examsN.total,
        totalIntentos: attemptsN.total,
        totalAdvertencias: warningsN.total,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
      setErrorMsg(
        error?.response?.data
          ? JSON.stringify(error.response.data, null, 2)
          : "No se pudieron cargar las estadísticas. Revisa token/endpoints."
      );
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, color }) => (
    <Card className="h-100 border-0 shadow-sm">
      <Card.Body>
        <div className="d-flex align-items-center">
          <div className={`bg-${color} bg-opacity-10 rounded p-3 me-3`}>
            <Icon size={32} className={`text-${color}`} />
          </div>
          <div className="flex-grow-1">
            <h6 className="text-muted mb-1">{title}</h6>
            <h3 className="mb-0">{loading ? "..." : value}</h3>
          </div>
        </div>
      </Card.Body>
    </Card>
  );

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-0">Panel de Administración</h2>
          <p className="text-muted">Resumen general del sistema</p>
        </div>

        <Button variant="outline-secondary" onClick={loadStats} disabled={loading}>
          {loading ? (
            <>
              <Spinner size="sm" animation="border" className="me-2" />
              Cargando...
            </>
          ) : (
            "Recargar"
          )}
        </Button>
      </div>

      {errorMsg && (
        <Alert variant="danger" className="mb-4" dismissible onClose={() => setErrorMsg("")}>
          <XCircle className="me-2" />
          <pre className="mb-0" style={{ whiteSpace: "pre-wrap" }}>{errorMsg}</pre>
        </Alert>
      )}

      <Row className="g-4 mb-4">
        <Col md={6} lg={3}>
          <StatCard icon={PersonFill} title="Total Usuarios" value={stats.totalUsuarios} color="primary" />
        </Col>
        <Col md={6} lg={3}>
          <StatCard icon={FileEarmarkText} title="Exámenes" value={stats.totalExamenes} color="success" />
        </Col>
        <Col md={6} lg={3}>
          <StatCard icon={GraphUp} title="Intentos Realizados" value={stats.totalIntentos} color="info" />
        </Col>
        <Col md={6} lg={3}>
          <StatCard icon={CameraVideo} title="Advertencias" value={stats.totalAdvertencias} color="warning" />
        </Col>
      </Row>

      <Row className="g-4">
        <Col lg={6}>
          <Card className="h-100 shadow-sm">
            <Card.Header>
              <h5 className="mb-0">Acciones Rápidas</h5>
            </Card.Header>
            <Card.Body>
              <div className="d-grid gap-2">
                <Button variant="primary" className="text-start" onClick={() => setShowUserModal(true)}>
                  <PersonFill className="me-2" />
                  Crear Nuevo Usuario
                </Button>

                

                <Button variant="info" className="text-start" onClick={() => setShowReportModal(true)}>
                  <GraphUp className="me-2" />
                  Generar Reporte (Grupal / Individual)
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="h-100 shadow-sm">
            <Card.Header>
              <h5 className="mb-0">Actividad Reciente</h5>
            </Card.Header>
            <Card.Body>
              <div className="text-muted text-center py-4">
                <p>No hay actividad reciente</p>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <CreateUserModal show={showUserModal} onHide={() => setShowUserModal(false)} onSuccess={loadStats} />

      <ExamWizardModal
        show={showExamWizard}
        onHide={() => setShowExamWizard(false)}
        onSuccess={() => loadStats()}
        title="Crear Examen (con preguntas)"
        defaultEstado="BORRADOR"
      />

      {/* Si tu GenerateReportModal NUEVO ya no necesita examsProp, déjalo así */}
      <GenerateReportModal
        show={showReportModal}
        onHide={() => setShowReportModal(false)}
      />

      {/* Si tu GenerateReportModal AÚN usa examsProp (versión anterior), usa esto:
      <GenerateReportModal
        show={showReportModal}
        onHide={() => setShowReportModal(false)}
        examsProp={exams}
      />
      */}
    </>
  );
};

// ===============================
// MODAL: CREAR USUARIO
// ===============================
const CreateUserModal = ({ show, onHide, onSuccess }) => {
  const [formData, setFormData] = useState({
    cedula: "",
    nombres: "",
    apellidos: "",
    correo_electronico: "",
    rol: "ESTUDIANTE",
    password: "",
    password_confirmacion: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const resetForm = () => {
    setFormData({
      cedula: "",
      nombres: "",
      apellidos: "",
      correo_electronico: "",
      rol: "ESTUDIANTE",
      password: "",
      password_confirmacion: "",
    });
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onHide();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const validateForm = () => {
    if (formData.cedula.length !== 10) return setError("La cédula debe tener 10 dígitos"), false;
    if (!/^[0-9]+$/.test(formData.cedula)) return setError("La cédula solo debe contener números"), false;
    if (!formData.nombres.trim() || !formData.apellidos.trim()) return setError("Nombres y apellidos son obligatorios"), false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.correo_electronico)) return setError("Correo electrónico inválido"), false;

    if (formData.password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres"), false;
    if (formData.password !== formData.password_confirmacion) return setError("Las contraseñas no coinciden"), false;

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      await userService.register(formData);
      setSuccess(true);

      setTimeout(() => {
        handleClose();
        if (onSuccess) onSuccess();
      }, 900);
    } catch (err) {
      setError(JSON.stringify(err.response?.data, null, 2) || "Error al crear usuario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton={!loading}>
        <Modal.Title>
          <PersonFill className="me-2" />
          Crear Nuevo Usuario
        </Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              <XCircle className="me-2" />
              <pre className="mb-0" style={{ whiteSpace: "pre-wrap" }}>{error}</pre>
            </Alert>
          )}

          {success && <Alert variant="success">Usuario creado exitosamente</Alert>}

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Cédula *</Form.Label>
                <Form.Control
                  type="text"
                  name="cedula"
                  value={formData.cedula}
                  onChange={handleChange}
                  maxLength={10}
                  required
                  disabled={loading || success}
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Rol *</Form.Label>
                <Form.Select
                  name="rol"
                  value={formData.rol}
                  onChange={handleChange}
                  required
                  disabled={loading || success}
                >
                  <option value="ESTUDIANTE">Estudiante</option>
                  <option value="DOCENTE">Docente</option>
                  <option value="ADMIN">Administrador</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Nombres *</Form.Label>
                <Form.Control
                  type="text"
                  name="nombres"
                  value={formData.nombres}
                  onChange={handleChange}
                  required
                  disabled={loading || success}
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Apellidos *</Form.Label>
                <Form.Control
                  type="text"
                  name="apellidos"
                  value={formData.apellidos}
                  onChange={handleChange}
                  required
                  disabled={loading || success}
                />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Correo Electrónico *</Form.Label>
            <Form.Control
              type="email"
              name="correo_electronico"
              value={formData.correo_electronico}
              onChange={handleChange}
              required
              disabled={loading || success}
            />
          </Form.Group>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Contraseña *</Form.Label>
                <Form.Control
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={loading || success}
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Confirmar Contraseña *</Form.Label>
                <Form.Control
                  type="password"
                  name="password_confirmacion"
                  value={formData.password_confirmacion}
                  onChange={handleChange}
                  required
                  disabled={loading || success}
                />
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={loading || success}>
            {loading ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" className="me-2" />
                Creando...
              </>
            ) : (
              "Crear Usuario"
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default AdminDashboard;
