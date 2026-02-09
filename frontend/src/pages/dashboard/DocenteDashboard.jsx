// ============================================
// src/pages/dashboard/DocenteDashboard.jsx
// ============================================
import React, { useEffect, useState } from "react";
import { Row, Col, Card, Button, Badge } from "react-bootstrap";
import { Link } from "react-router-dom";
import { FileEarmarkText, PeopleFill, GraphUp } from "react-bootstrap-icons";

import examService from "../../services/examService";
import ExamWizardModal from "../../components/exam/ExamWizardModal1"; 

const DocenteDashboard = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showExamWizard, setShowExamWizard] = useState(false);

  useEffect(() => {
    loadExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadExams = async () => {
    setLoading(true);
    try {
      const data = await examService.getExams();

      // tu backend devuelve: {total, examenes}
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.examenes)
          ? data.examenes
          : Array.isArray(data?.results)
            ? data.results
            : [];

      setExams(list);
    } catch (error) {
      console.error("Error loading exams:", error);
      setExams([]);
    } finally {
      setLoading(false);
    }
  };

  const getEstadoBadge = (estado) => {
    const variants = {
      BORRADOR: "secondary",
      ACTIVO: "success",
      FINALIZADO: "dark",
      ARCHIVADO: "warning",
      PUBLICADO: "info", // si lo usas luego
    };
    return <Badge bg={variants[estado] || "secondary"}>{estado || "BORRADOR"}</Badge>;
  };

  const parseDate = (value) => {
    if (!value) return null;

    // backend: "YYYY-MM-DD HH:mm:ss"
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
      return new Date(value.replace(" ", "T"));
    }

    return new Date(value);
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-0">Panel del Docente</h2>
          <p className="text-muted">Gestione sus exámenes y estudiantes</p>
        </div>

        <Button variant="primary" onClick={() => setShowExamWizard(true)}>
          <FileEarmarkText className="me-2" />
          Nuevo Examen
        </Button>
      </div>

      <Row className="g-4 mb-4">
        <Col md={4}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="text-center">
              <FileEarmarkText size={40} className="text-primary mb-3" />
              <h3>{exams.length}</h3>
              <p className="text-muted mb-0">Exámenes Creados</p>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="text-center">
              <PeopleFill size={40} className="text-success mb-3" />
              <h3>0</h3>
              <p className="text-muted mb-0">Estudiantes Activos</p>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body className="text-center">
              <GraphUp size={40} className="text-info mb-3" />
              <h3>0</h3>
              <p className="text-muted mb-0">Intentos Completados</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="shadow-sm">
        <Card.Header>
          <h5 className="mb-0">Mis Exámenes</h5>
        </Card.Header>

        <Card.Body>
          {loading ? (
            <p className="text-center text-muted">Cargando...</p>
          ) : exams.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted">No tiene exámenes creados</p>

              <Button variant="primary" onClick={() => setShowExamWizard(true)}>
                Crear Primer Examen
              </Button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Estado</th>
                    <th>Fecha Inicio</th>
                    <th>Duración</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {exams.map((exam) => {
                    const examId = exam.id_examen;
                    const fecha = parseDate(exam.fecha_inicio);

                    return (
                      <tr key={examId}>
                        <td>{exam.titulo}</td>
                        <td>{getEstadoBadge(exam.estado)}</td>
                        <td>{fecha ? fecha.toLocaleString() : "—"}</td>
                        <td>{exam.duracion} min</td>

                        <td>
                          <Button
                            as={Link}
                            to={`/examenes/${examId}`}
                            size="sm"
                            variant="outline-primary"
                          >
                            Ver
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card.Body>
      </Card>

      <ExamWizardModal
        show={showExamWizard}
        onHide={() => setShowExamWizard(false)}
        onCreated={() => {
          setShowExamWizard(false);
          loadExams();
        }}
      />
    </>
  );
};

export default DocenteDashboard;
