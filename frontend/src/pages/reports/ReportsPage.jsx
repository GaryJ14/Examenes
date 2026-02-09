// ============================================
// src/pages/reports/ReportsPage.jsx
// ✅ COMPLETO (con onCreated funcionando)
// ============================================
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Row,
  Col,
  Button,
  Form,
  Table,
  Spinner,
  Alert,
  InputGroup,
  Dropdown,
  Pagination,
} from "react-bootstrap";
import {
  Eye,
  ArrowRepeat,
  Search,
  Funnel,
  FileEarmarkPdf,
  Download,
  LightningCharge,
  ThreeDotsVertical,
  CheckCircleFill,
  ExclamationTriangleFill,
  HourglassSplit,
  XCircleFill,
  PlusCircle,
} from "react-bootstrap-icons";

import reportService from "../../services/reportService";
import examService from "../../services/examService";
import GenerateReportModal from "../../components/reports/GenerateReportModal";

const API_HOST = "http://127.0.0.1:8000";
const PAGE_SIZE = 10;

const fullUrl = (maybeRelative) => {
  if (!maybeRelative) return "";
  const s = String(maybeRelative);
  if (s.startsWith("http")) return s;
  return `${API_HOST}${s}`;
};

const fmt = (x) => (x == null || x === "" ? "—" : String(x));
const fmtDate = (d) => (d ? String(d) : "—");

const EstadoPill = ({ estado }) => {
  const v = String(estado || "").toUpperCase();
  if (v === "COMPLETADO") {
    return (
      <span className="d-inline-flex align-items-center gap-2 px-2 py-1 rounded-pill bg-success bg-opacity-10 text-success fw-semibold">
        <CheckCircleFill size={14} /> COMPLETADO
      </span>
    );
  }
  if (v === "GENERANDO") {
    return (
      <span className="d-inline-flex align-items-center gap-2 px-2 py-1 rounded-pill bg-warning bg-opacity-10 text-warning fw-semibold">
        <HourglassSplit size={14} /> GENERANDO
      </span>
    );
  }
  if (v === "ERROR") {
    return (
      <span className="d-inline-flex align-items-center gap-2 px-2 py-1 rounded-pill bg-danger bg-opacity-10 text-danger fw-semibold">
        <XCircleFill size={14} /> ERROR
      </span>
    );
  }
  return (
    <span className="d-inline-flex align-items-center px-2 py-1 rounded-pill bg-secondary bg-opacity-10 text-secondary fw-semibold">
      {v || "N/A"}
    </span>
  );
};

const TipoPill = ({ tipo }) => {
  const v = String(tipo || "").toUpperCase();
  const map = {
    INDIVIDUAL: { bg: "primary", label: "INDIVIDUAL" },
    EXAMEN: { bg: "info", label: "EXAMEN" },
    ESTADISTICO: { bg: "dark", label: "ESTADÍSTICO" },
    ANOMALIAS: { bg: "warning", label: "ANOMALÍAS" },
    GENERAL: { bg: "secondary", label: "GENERAL" },
  };
  const t = map[v] || { bg: "secondary", label: v || "N/A" };
  return <span className={`badge bg-${t.bg} rounded-pill px-3 py-2 fw-semibold`}>{t.label}</span>;
};

const ReportsPage = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadingExams, setLoadingExams] = useState(true);
  const [error, setError] = useState(null);

  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);

  const [exams, setExams] = useState([]);

  const [showReportModal, setShowReportModal] = useState(false);

  const [filters, setFilters] = useState({
    q: "",
    tipo: "",
    estado: "",
    formato: "",
    examen_id: "",
    estudiante_id: "",
    intento_id: "",
  });

  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(true);

  const buildQuery = (f = filters) => {
    const params = new URLSearchParams();
    if (f.tipo) params.set("tipo", f.tipo);
    if (f.estado) params.set("estado", f.estado);
    if (f.formato) params.set("formato", f.formato);
    if (f.examen_id) params.set("examen_id", f.examen_id);
    if (f.estudiante_id) params.set("estudiante_id", f.estudiante_id);
    if (f.intento_id) params.set("intento_id", f.intento_id);
    return params.toString();
  };

  const loadExams = async () => {
    setLoadingExams(true);
    try {
      const data = await examService.getExams();
      const list = Array.isArray(data) ? data : data?.examenes || data?.results || [];
      setExams(Array.isArray(list) ? list : []);
    } catch {
      setExams([]);
    } finally {
      setLoadingExams(false);
    }
  };

  const loadReports = async (customFilters = null) => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQuery(customFilters ?? filters);
      const data = await reportService.listReports(qs);
      const list = data?.reportes || data?.results || data || [];
      const arr = Array.isArray(list) ? list : [];
      setReports(arr);
      setTotal(data?.total ?? arr.length);
      setPage(1);
    } catch (err) {
      setError(err?.response?.data ? JSON.stringify(err.response.data, null, 2) : "No se pudieron cargar reportes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const localFiltered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) => {
      const hay = `${r.id_reporte} ${r.estudiante_nombre || ""} ${r.examen_titulo || ""} ${r.tipo || ""} ${r.estado || ""} ${r.formato || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [reports, filters.q]);

  const totalPages = Math.max(1, Math.ceil(localFiltered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return localFiltered.slice(start, start + PAGE_SIZE);
  }, [localFiltered, pageSafe]);

  const stats = useMemo(() => {
    const s = { completado: 0, generando: 0, error: 0, pdf: 0 };
    for (const r of localFiltered) {
      const e = String(r.estado || "").toUpperCase();
      if (e === "COMPLETADO") s.completado++;
      else if (e === "GENERANDO") s.generando++;
      else if (e === "ERROR") s.error++;
      const f = String(r.formato || "").toUpperCase();
      if (f === "PDF") s.pdf++;
    }
    return s;
  }, [localFiltered]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((p) => ({ ...p, [name]: value }));
  };

  const applyFilters = async (e) => {
    e?.preventDefault?.();
    await loadReports();
  };

  const resetFilters = async () => {
    const clean = { q: "", tipo: "", estado: "", formato: "", examen_id: "", estudiante_id: "", intento_id: "" };
    setFilters(clean);
    await loadReports(clean);
  };

  const goDetail = (id) => navigate(`/reportes/${id}`);

  const openFile = (r) => {
    const url = fullUrl(r.archivo_url);
    if (!url) {
      setError("Este reporte no tiene archivo_url (aún no hay PDF guardado).");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const downloadJSON = (r) => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_${r.id_reporte}_${r.tipo}_${r.formato || "JSON"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const items = [];
    const windowSize = 5;
    const start = Math.max(1, pageSafe - Math.floor(windowSize / 2));
    const end = Math.min(totalPages, start + windowSize - 1);

    items.push(
      <Pagination.Prev key="prev" disabled={pageSafe === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} />
    );

    if (start > 1) items.push(<Pagination.Ellipsis key="e1" disabled />);
    for (let p = start; p <= end; p++) {
      items.push(
        <Pagination.Item key={p} active={p === pageSafe} onClick={() => setPage(p)}>
          {p}
        </Pagination.Item>
      );
    }
    if (end < totalPages) items.push(<Pagination.Ellipsis key="e2" disabled />);

    items.push(
      <Pagination.Next key="next" disabled={pageSafe === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} />
    );

    return <Pagination className="mb-0">{items}</Pagination>;
  };

  // ✅ este callback ahora SÍ será llamado por el modal
  const onReportCreated = async () => {
    await loadReports();
  };

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div>
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-4 shadow-sm"
              style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "rgba(13,110,253,.10)" }}
            >
              <LightningCharge className="text-primary" size={22} />
            </div>
            <div>
              <h3 className="mb-0">Reportes</h3>
              <div className="text-muted">Busca, filtra, revisa y descarga reportes</div>
            </div>
          </div>
        </div>

        <div className="d-flex gap-2">
          <Button variant="primary" onClick={() => setShowReportModal(true)}>
            <PlusCircle className="me-2" />
            Generar reporte
          </Button>

          <Button variant="outline-secondary" onClick={() => loadReports()} disabled={loading}>
            <ArrowRepeat className="me-2" />
            Recargar
          </Button>

          <Button variant={showFilters ? "outline-primary" : "primary"} onClick={() => setShowFilters((v) => !v)}>
            <Funnel className="me-2" />
            {showFilters ? "Ocultar filtros" : "Mostrar filtros"}
          </Button>
        </div>
      </div>

      <Row className="g-3 mb-3">
        <Col md={3}>
          <Card className="shadow-sm border-0">
            <Card.Body className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted" style={{ fontSize: 13 }}>Total</div>
                <div className="fs-4 fw-bold">{localFiltered.length}</div>
              </div>
              <div className="rounded-4" style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "rgba(13,110,253,.10)" }}>
                <Search className="text-primary" />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="shadow-sm border-0">
            <Card.Body className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted" style={{ fontSize: 13 }}>Completados</div>
                <div className="fs-4 fw-bold">{stats.completado}</div>
              </div>
              <div className="rounded-4" style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "rgba(25,135,84,.10)" }}>
                <CheckCircleFill className="text-success" />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="shadow-sm border-0">
            <Card.Body className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted" style={{ fontSize: 13 }}>Generando</div>
                <div className="fs-4 fw-bold">{stats.generando}</div>
              </div>
              <div className="rounded-4" style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "rgba(255,193,7,.10)" }}>
                <HourglassSplit className="text-warning" />
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="shadow-sm border-0">
            <Card.Body className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted" style={{ fontSize: 13 }}>Con PDF</div>
                <div className="fs-4 fw-bold">{stats.pdf}</div>
              </div>
              <div className="rounded-4" style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "rgba(13,202,240,.10)" }}>
                <FileEarmarkPdf className="text-info" />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible className="shadow-sm">
          <div className="d-flex align-items-start gap-2">
            <ExclamationTriangleFill className="mt-1" />
            <div style={{ width: "100%" }}>
              <div className="fw-semibold mb-1">Ocurrió un error</div>
              <pre className="mb-0" style={{ whiteSpace: "pre-wrap" }}>{error}</pre>
            </div>
          </div>
        </Alert>
      )}

      {showFilters && (
        <Card className="shadow-sm border-0 mb-3">
          <Card.Header className="bg-white border-0 d-flex align-items-center gap-2 fw-bold">
            <Funnel /> Filtros
          </Card.Header>
          <Card.Body>
            <Form onSubmit={applyFilters}>
              <Row className="g-3">
                <Col lg={4}>
                  <Form.Label className="fw-semibold">Búsqueda rápida</Form.Label>
                  <InputGroup>
                    <InputGroup.Text><Search /></InputGroup.Text>
                    <Form.Control name="q" value={filters.q} onChange={handleChange} placeholder="ID, estudiante, examen, tipo..." />
                  </InputGroup>
                </Col>

                <Col lg={2}>
                  <Form.Label className="fw-semibold">Tipo</Form.Label>
                  <Form.Select name="tipo" value={filters.tipo} onChange={handleChange}>
                    <option value="">(Todos)</option>
                    <option value="INDIVIDUAL">INDIVIDUAL</option>
                    <option value="EXAMEN">EXAMEN</option>
                    <option value="ESTADISTICO">ESTADISTICO</option>
                    <option value="ANOMALIAS">ANOMALIAS</option>
                    <option value="GENERAL">GENERAL</option>
                  </Form.Select>
                </Col>

                <Col lg={2}>
                  <Form.Label className="fw-semibold">Estado</Form.Label>
                  <Form.Select name="estado" value={filters.estado} onChange={handleChange}>
                    <option value="">(Todos)</option>
                    <option value="GENERANDO">GENERANDO</option>
                    <option value="COMPLETADO">COMPLETADO</option>
                    <option value="ERROR">ERROR</option>
                  </Form.Select>
                </Col>

                <Col lg={2}>
                  <Form.Label className="fw-semibold">Formato</Form.Label>
                  <Form.Select name="formato" value={filters.formato} onChange={handleChange}>
                    <option value="">(Todos)</option>
                    <option value="JSON">JSON</option>
                    <option value="PDF">PDF</option>
                    <option value="EXCEL">EXCEL</option>
                    <option value="CSV">CSV</option>
                  </Form.Select>
                </Col>

                <Col lg={2}>
                  <Form.Label className="fw-semibold">Examen</Form.Label>
                  <Form.Select name="examen_id" value={filters.examen_id} onChange={handleChange} disabled={loadingExams}>
                    <option value="">(Todos)</option>
                    {exams.map((ex) => {
                      const id = ex.id_examen ?? ex.id ?? ex.examen_id;
                      const titulo = ex.titulo ?? ex.examen_titulo ?? `Examen #${id}`;
                      return <option key={id} value={id}>{titulo}</option>;
                    })}
                  </Form.Select>
                </Col>

                <Col lg={2}>
                  <Form.Label className="fw-semibold">Estudiante ID</Form.Label>
                  <Form.Control type="number" name="estudiante_id" value={filters.estudiante_id} onChange={handleChange} />
                </Col>

                <Col lg={2}>
                  <Form.Label className="fw-semibold">Intento ID</Form.Label>
                  <Form.Control type="number" name="intento_id" value={filters.intento_id} onChange={handleChange} />
                </Col>

                <Col lg={8} className="d-flex align-items-end gap-2">
                  <Button type="submit" variant="primary" disabled={loading} className="px-4">Aplicar</Button>
                  <Button type="button" variant="outline-secondary" onClick={resetFilters} disabled={loading}>Limpiar</Button>
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    Total (backend): {total} &nbsp;|&nbsp; Mostrando: {localFiltered.length}
                  </div>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>
      )}

      <Card className="shadow-sm border-0">
        <Card.Header className="bg-white border-0 d-flex justify-content-between align-items-center">
          <div className="fw-bold">Listado</div>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Página {pageSafe} de {totalPages}
          </div>
        </Card.Header>

        <Card.Body className="p-0">
          {loading ? (
            <div className="d-flex justify-content-center py-5"><Spinner animation="border" role="status" /></div>
          ) : pageItems.length === 0 ? (
            <div className="text-center text-muted py-5">No hay reportes con los filtros actuales.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <Table hover responsive className="mb-0 align-middle">
                <thead style={{ background: "#f8fafc" }}>
                  <tr>
                    <th style={{ width: 90 }}>ID</th>
                    <th style={{ width: 140 }}>Tipo</th>
                    <th style={{ width: 150 }}>Estado</th>
                    <th style={{ width: 110 }}>Formato</th>
                    <th>Examen</th>
                    <th>Estudiante</th>
                    <th style={{ width: 90 }}>Intento</th>
                    <th style={{ width: 80 }} className="text-end"></th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((r) => (
                    <tr key={r.id_reporte}>
                      <td className="fw-semibold">#{r.id_reporte}</td>
                      <td><TipoPill tipo={r.tipo} /></td>
                      <td><EstadoPill estado={r.estado} /></td>
                      <td>{fmt(r.formato)}</td>
                      <td>{fmt(r.examen_titulo)} <span className="text-muted">(ID: {fmt(r.examen_id)})</span></td>
                      <td>{fmt(r.estudiante_nombre)} <span className="text-muted">(ID: {fmt(r.estudiante_id)})</span></td>
                      <td className="text-muted fw-semibold">{fmt(r.intento_id)}</td>
                      <td className="text-end">
                        <Dropdown align="end">
                          <Dropdown.Toggle variant="outline-secondary" size="sm" className="rounded-pill">
                            <ThreeDotsVertical />
                          </Dropdown.Toggle>

                          <Dropdown.Menu>
                            <Dropdown.Item onClick={() => goDetail(r.id_reporte)}>
                              <Eye className="me-2" /> Ver detalle
                            </Dropdown.Item>

                            <Dropdown.Item onClick={() => downloadJSON(r)}>
                              <Download className="me-2" /> Descargar JSON
                            </Dropdown.Item>

                            <Dropdown.Divider />

                            <Dropdown.Item onClick={() => openFile(r)} disabled={!r.archivo_url}>
                              <FileEarmarkPdf className="me-2" /> Abrir PDF
                            </Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>

        <Card.Footer className="bg-white border-0 d-flex justify-content-between align-items-center">
          <div className="text-muted" style={{ fontSize: 13 }}>
            Mostrando {pageItems.length} de {localFiltered.length}
          </div>
          {renderPagination()}
        </Card.Footer>
      </Card>

      <GenerateReportModal
        show={showReportModal}
        onHide={() => setShowReportModal(false)}
        examsProp={exams}
        onCreated={onReportCreated}   // ✅ ahora el modal lo usa
      />
    </div>
  );
};

export default ReportsPage;
