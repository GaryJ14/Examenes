// ============================================
// src/pages/dashboard/EstudianteDashboard.jsx
// ✅ Materias colapsables + botón va a ExamDetailPage (/examenes/:id)
// ============================================
import React, { useEffect, useMemo, useState } from "react";
import {
  Row,
  Col,
  Card,
  Button,
  Badge,
  Form,
  InputGroup,
  Spinner,
  Alert,
  Accordion,
} from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  FileEarmarkText,
  Search,
  ArrowRepeat,
  EyeFill,
  ExclamationTriangleFill,
  Tags,
  Translate,
  BarChart,
  Folder2Open,
} from "react-bootstrap-icons";
import examService from "../../services/examService";

const safeArr = (x) => (Array.isArray(x) ? x : []);

const EstudianteDashboard = () => {
  const [materias, setMaterias] = useState([]);
  const [loadingMaterias, setLoadingMaterias] = useState(true);
  const [loadingExams, setLoadingExams] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // examsByMateria: { [id_materia]: { materia, examenes, error? } }
  const [examsByMateria, setExamsByMateria] = useState({});

  // UI
  const [q, setQ] = useState("");
  const [activeKey, setActiveKey] = useState(null); // ✅ 1 materia abierta a la vez (colapsable)

  useEffect(() => {
    loadMateriasAndExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMateriasAndExams = async () => {
    setErrorMsg("");
    setLoadingMaterias(true);
    setLoadingExams(true);

    try {
      const mats = await examService.getMaterias(); // lista
      const matsActive = safeArr(mats).filter((m) => !!m?.activo);
      setMaterias(matsActive);

      const results = await Promise.all(
        matsActive.map(async (m) => {
          try {
            // ⚠️ Ajusta si tu método tiene otro nombre.
            // Debe llamar a /api/examenes/materia/<id>/
            const data = await examService.getExamsByMateriaPath(m.id_materia, { estado: "ACTIVO" });

            const examenes = Array.isArray(data?.examenes)
              ? data.examenes
              : Array.isArray(data)
              ? data
              : [];

            const materiaInfo = data?.materia || m;

            return [String(m.id_materia), { materia: materiaInfo, examenes }];
          } catch (err) {
            return [String(m.id_materia), { materia: m, examenes: [], error: true }];
          }
        })
      );

      const map = {};
      for (const [id, payload] of results) map[id] = payload;
      setExamsByMateria(map);

      // abrir la primera materia que tenga examenes
      const firstWithContent = results.find(([, v]) => (v?.examenes || []).length > 0);
      setActiveKey(firstWithContent ? firstWithContent[0] : (matsActive[0] ? String(matsActive[0].id_materia) : null));
    } catch (error) {
      console.error("Error loading materias/exams:", error);
      setMaterias([]);
      setExamsByMateria({});
      setActiveKey(null);
      setErrorMsg(
        error?.response?.data?.detail ||
          "No se pudieron cargar materias y exámenes. Revisa backend o token."
      );
    } finally {
      setLoadingMaterias(false);
      setLoadingExams(false);
    }
  };

  const totalExams = useMemo(() => {
    return Object.values(examsByMateria).reduce((acc, v) => acc + (v?.examenes?.length || 0), 0);
  }, [examsByMateria]);

  const filteredByMateria = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return examsByMateria;

    const out = {};
    for (const [mid, payload] of Object.entries(examsByMateria)) {
      const list = safeArr(payload?.examenes).filter((e) => {
        const hay = `${e?.titulo || ""} ${e?.descripcion || ""} ${(e?.tags || []).join(" ")} ${e?.nivel || ""} ${e?.idioma || ""}`.toLowerCase();
        return hay.includes(s);
      });
      out[mid] = { ...payload, examenes: list };
    }
    return out;
  }, [examsByMateria, q]);

  const BadgeNivel = (nivel) => {
    const v = String(nivel || "").toUpperCase();
    const bg =
      v === "BASICO" ? "success" :
      v === "INTERMEDIO" ? "warning" :
      v === "AVANZADO" ? "danger" : "secondary";
    return v ? (
      <Badge bg={bg} className="rounded-pill px-3 py-2 fw-semibold">
        <BarChart className="me-1" /> {v}
      </Badge>
    ) : null;
  };

  const BadgeIdioma = (idioma) => {
    const v = String(idioma || "").toUpperCase();
    return v ? (
      <Badge bg="secondary" className="rounded-pill px-3 py-2 fw-semibold">
        <Translate className="me-1" /> {v}
      </Badge>
    ) : null;
  };

  const ExamCard = ({ exam }) => {
    const examId = exam?.id_examen ?? exam?.id;
    const tags = safeArr(exam?.tags).slice(0, 4);

    return (
      <Card className="h-100 border-0 shadow-sm">
        <Card.Body className="d-flex flex-column">
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div className="fw-bold" style={{ fontSize: 16, lineHeight: 1.2 }}>
              {exam?.titulo || "Examen"}
            </div>
            <Badge bg="success" className="rounded-pill px-3 py-2 fw-semibold">
              ACTIVO
            </Badge>
          </div>

          <div className="text-muted mt-2" style={{ fontSize: 13, minHeight: 38 }}>
            {exam?.descripcion || "Sin descripción"}
          </div>

          <div className="d-flex flex-wrap gap-2 mt-3">
            {BadgeNivel(exam?.nivel)}
            {BadgeIdioma(exam?.idioma)}
            {exam?.requiere_camara ? (
              <Badge bg="dark" className="rounded-pill px-3 py-2 fw-semibold">
                Cámara requerida
              </Badge>
            ) : (
              <Badge bg="light" text="dark" className="rounded-pill px-3 py-2 fw-semibold">
                Sin cámara
              </Badge>
            )}
          </div>

          <div className="mt-3">
            <div className="text-muted d-flex align-items-center gap-2" style={{ fontSize: 13 }}>
              <Tags /> Tags
            </div>
            <div className="d-flex flex-wrap gap-2 mt-2">
              {tags.length === 0 ? (
                <Badge bg="light" text="dark" className="rounded-pill px-3 py-2">
                  —
                </Badge>
              ) : (
                tags.map((t, idx) => (
                  <Badge key={`${t}-${idx}`} bg="light" text="dark" className="rounded-pill px-3 py-2">
                    {String(t).trim()}
                  </Badge>
                ))
              )}
            </div>
          </div>

          <div className="border-top mt-3 pt-3">
            <div className="d-flex justify-content-between small">
              <span className="text-muted">Duración</span>
              <span className="fw-semibold">{exam?.duracion ?? 0} min</span>
            </div>
            <div className="d-flex justify-content-between small mt-1">
              <span className="text-muted">Intentos permitidos</span>
              <span className="fw-semibold">{exam?.intentos_permitidos ?? 0}</span>
            </div>
          </div>

          {/* ✅ CAMBIO: ir a ExamDetailPage */}
          <Button
            as={Link}
            to={`/examenes/${examId}`}
            variant="primary"
            className="mt-auto w-100 rounded-3"
            disabled={!examId}
          >
            <EyeFill className="me-2" />
            Ver detalle
          </Button>
        </Card.Body>
      </Card>
    );
  };

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-4 shadow-sm"
              style={{
                width: 44,
                height: 44,
                display: "grid",
                placeItems: "center",
                background: "rgba(13,110,253,.10)",
              }}
            >
              <Folder2Open className="text-primary" size={22} />
            </div>
            <div>
              <h3 className="mb-0">Exámenes por materias</h3>
              <div className="text-muted">Abre una materia y revisa los exámenes habilitados</div>
            </div>
          </div>
        </div>

        <div className="d-flex gap-2">
          <Button
            variant="outline-secondary"
            onClick={loadMateriasAndExams}
            disabled={loadingMaterias || loadingExams}
          >
            <ArrowRepeat className="me-2" />
            {(loadingMaterias || loadingExams) ? "Cargando..." : "Recargar"}
          </Button>
        </div>
      </div>

      {errorMsg && (
        <Alert variant="danger" className="shadow-sm" dismissible onClose={() => setErrorMsg("")}>
          <div className="d-flex align-items-start gap-2">
            <ExclamationTriangleFill className="mt-1" />
            <div style={{ width: "100%" }}>{errorMsg}</div>
          </div>
        </Alert>
      )}

      {/* KPI / resumen */}
      <Row className="g-3 mb-3">
        <Col md={6} lg={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted" style={{ fontSize: 13 }}>Materias activas</div>
                <div className="fs-3 fw-bold">{(loadingMaterias || loadingExams) ? "…" : materias.length}</div>
              </div>
              <div
                className="rounded-4"
                style={{ width: 48, height: 48, display: "grid", placeItems: "center", background: "rgba(13,110,253,.10)" }}
              >
                <Folder2Open className="text-primary" size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6} lg={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted" style={{ fontSize: 13 }}>Exámenes activos</div>
                <div className="fs-3 fw-bold">{(loadingMaterias || loadingExams) ? "…" : totalExams}</div>
              </div>
              <div
                className="rounded-4"
                style={{ width: 48, height: 48, display: "grid", placeItems: "center", background: "rgba(25,135,84,.10)" }}
              >
                <FileEarmarkText className="text-success" size={22} />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="fw-bold mb-2">Buscar examen</div>
              <InputGroup>
                <InputGroup.Text><Search /></InputGroup.Text>
                <Form.Control
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Título, descripción, tags…"
                />
              </InputGroup>
              <div className="text-muted mt-2" style={{ fontSize: 13 }}>
                Filtrado local (por materia)
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Materias colapsables */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white border-0 d-flex justify-content-between align-items-center">
          <div className="fw-bold">Materias</div>
          <Badge bg="secondary" className="rounded-pill px-3 py-2">
            {(loadingMaterias || loadingExams) ? "…" : materias.length}
          </Badge>
        </Card.Header>

        <Card.Body>
          {(loadingMaterias || loadingExams) ? (
            <div className="d-flex justify-content-center py-5">
              <Spinner animation="border" role="status" />
            </div>
          ) : materias.length === 0 ? (
            <div className="text-center py-5 text-muted">
              No hay materias activas disponibles.
            </div>
          ) : (
            <Accordion activeKey={activeKey} onSelect={(k) => setActiveKey(k)}>
              {materias.map((m) => {
                const mid = String(m.id_materia);
                const payload = filteredByMateria[mid] || { materia: m, examenes: [] };
                const list = safeArr(payload?.examenes);
                const hadError = !!payload?.error;

                return (
                  <Accordion.Item eventKey={mid} key={mid}>
                    <Accordion.Header>
                      <div className="d-flex flex-wrap align-items-center gap-2 w-100">
                        <span className="fw-semibold">{m.nombre}</span>
                        <Badge bg="secondary" className="rounded-pill px-3 py-2">
                          {list.length} examen{list.length === 1 ? "" : "es"}
                        </Badge>
                        {hadError ? (
                          <Badge bg="danger" className="rounded-pill px-3 py-2">
                            Error cargando
                          </Badge>
                        ) : null}
                        <span className="text-muted ms-auto" style={{ fontSize: 13 }}>
                          {m.descripcion || ""}
                        </span>
                      </div>
                    </Accordion.Header>

                    <Accordion.Body>
                      {list.length === 0 ? (
                        <div className="text-muted">
                          No hay exámenes activos para esta materia {q.trim() ? "(con el filtro actual)." : "."}
                        </div>
                      ) : (
                        <Row className="g-3">
                          {list.map((ex) => (
                            <Col md={6} lg={4} key={ex?.id_examen ?? ex?.id}>
                              <ExamCard exam={ex} />
                            </Col>
                          ))}
                        </Row>
                      )}
                    </Accordion.Body>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default EstudianteDashboard;
