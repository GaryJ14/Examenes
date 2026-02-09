// ============================================
// src/components/reports/GenerateReportModal.jsx
// ✅ Materias -> Exámenes por materia
// ✅ Callback onCreated
// ============================================
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Button, Form, Row, Col, Alert, Spinner, Table, Badge } from "react-bootstrap";
import { Download, PlayFill, ArrowRepeat, FileEarmarkPdf } from "react-bootstrap-icons";
import reportService from "../../services/reportService";
import examService from "../../services/examService";

const API_HOST = "http://127.0.0.1:8000";

const estadoBadge = (estado) => {
  const v = String(estado || "").toUpperCase();
  if (v === "COMPLETADO") return <Badge bg="success">COMPLETADO</Badge>;
  if (v === "GENERANDO") return <Badge bg="warning" text="dark">GENERANDO</Badge>;
  if (v === "ERROR") return <Badge bg="danger">ERROR</Badge>;
  return <Badge bg="secondary">{v || "N/A"}</Badge>;
};

const tipoBadge = (tipo) => {
  const v = String(tipo || "").toUpperCase();
  if (v === "INDIVIDUAL") return <Badge bg="primary">INDIVIDUAL</Badge>;
  if (v === "EXAMEN") return <Badge bg="info" text="dark">EXAMEN</Badge>;
  if (v === "ESTADISTICO") return <Badge bg="dark">ESTADISTICO</Badge>;
  if (v === "ANOMALIAS") return <Badge bg="warning" text="dark">ANOMALIAS</Badge>;
  if (v === "GENERAL") return <Badge bg="secondary">GENERAL</Badge>;
  return <Badge bg="secondary">{v || "N/A"}</Badge>;
};

const fullUrl = (maybeRelative) => {
  if (!maybeRelative) return "";
  if (String(maybeRelative).startsWith("http")) return maybeRelative;
  return `${API_HOST}${maybeRelative}`;
};

const downloadBlob = (content, filename, mime = "application/json") => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const CardBlock = ({ title, right, children }) => (
  <div className="mb-3">
    <div className="d-flex justify-content-between align-items-center mb-2">
      <div className="fw-bold">{title}</div>
      <div>{right}</div>
    </div>
    <div className="border rounded p-3" style={{ background: "#fff" }}>
      {children}
    </div>
  </div>
);

const GenerateReportModal = ({ show, onHide, onCreated }) => {
  // Form create
  const [form, setForm] = useState({
    tipo: "EXAMEN",
    formato: "PDF",
    materia_id: "",
    examen_id: "",
    intento_id: "",
    estudiante_id: "",
    observaciones: "",
  });

  // Materias / Exámenes (filtrados)
  const [materias, setMaterias] = useState([]);
  const [exams, setExams] = useState([]);

  // Listado reportes
  const [reportes, setReportes] = useState([]);
  const [total, setTotal] = useState(0);

  // UI
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMaterias, setLoadingMaterias] = useState(false);
  const [loadingExams, setLoadingExams] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [selected, setSelected] = useState(null);

  const reset = () => {
    setError(null);
    setInfo(null);
    setSelected(null);
    setForm({
      tipo: "EXAMEN",
      formato: "PDF",
      materia_id: "",
      examen_id: "",
      intento_id: "",
      estudiante_id: "",
      observaciones: "",
    });
    setExams([]);
  };

  const loadMaterias = async () => {
    setLoadingMaterias(true);
    try {
      const list = await examService.getMaterias();
      setMaterias(Array.isArray(list) ? list : []);
    } catch {
      setMaterias([]);
    } finally {
      setLoadingMaterias(false);
    }
  };

  const loadExamsByMateria = async (materiaId) => {
    if (!materiaId) {
      setExams([]);
      return;
    }
    setLoadingExams(true);
    try {
      const data = await examService.getExamsByMateriaPath(materiaId);
      const list = Array.isArray(data?.examenes) ? data.examenes : [];
      setExams(list);
    } catch {
      setExams([]);
    } finally {
      setLoadingExams(false);
    }
  };

  const loadAllReports = async () => {
    setLoadingList(true);
    setError(null);
    try {
      const data = await reportService.listReports();
      const list = data?.reportes || data?.results || data || [];
      setReportes(Array.isArray(list) ? list : []);
      setTotal(data?.total ?? (Array.isArray(list) ? list.length : 0));
    } catch (err) {
      setError(err?.response?.data ? JSON.stringify(err.response.data, null, 2) : "No se pudieron cargar reportes");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (show) {
      reset();
      loadMaterias();
      loadAllReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // cuando cambia materia, traer exámenes y resetear examen_id
  useEffect(() => {
    if (!show) return;
    const mid = form.materia_id ? Number(form.materia_id) : "";
    setForm((p) => ({ ...p, examen_id: "" }));
    if (mid) loadExamsByMateria(mid);
    else setExams([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.materia_id, show]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setError(null);
    setInfo(null);
  };

  const validate = () => {
    if (form.tipo === "EXAMEN") {
      if (!form.materia_id) return "Selecciona una materia";
      if (!form.examen_id) return "Selecciona un examen";
    }
    if (form.tipo === "INDIVIDUAL") {
      if (!form.intento_id) return "Para INDIVIDUAL debes colocar intento_id";
    }
    return null;
  };

  const onCreate = async () => {
    const msg = validate();
    if (msg) return setError(msg);

    setSubmitting(true);
    setError(null);
    setInfo(null);

    try {
      const payload = {
        tipo: form.tipo,
        formato: form.formato,
        examen_id: form.tipo === "EXAMEN" ? Number(form.examen_id) : null,
        intento_id: form.tipo === "INDIVIDUAL" ? Number(form.intento_id) : null,
        estudiante_id: form.tipo === "INDIVIDUAL" && form.estudiante_id ? Number(form.estudiante_id) : null,
        observaciones: form.observaciones || "",
      };

      const created = await reportService.createReport(payload);
      setSelected(created);
      setInfo(`Reporte creado (#${created.id_reporte}). Ahora puedes GENERARLO.`);
      await loadAllReports();

      if (typeof onCreated === "function") onCreated(created);
    } catch (err) {
      setError(err?.response?.data ? JSON.stringify(err.response.data, null, 2) : "Error creando reporte");
    } finally {
      setSubmitting(false);
    }
  };

  const onGenerate = async (id_reporte) => {
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      const updated = await reportService.generateReport(id_reporte);
      setSelected(updated);
      setInfo(`Reporte generado (#${updated.id_reporte}). Estado: ${updated.estado}`);
      await loadAllReports();

      if (typeof onCreated === "function") onCreated(updated);
    } catch (err) {
      setError(err?.response?.data ? JSON.stringify(err.response.data, null, 2) : "Error generando reporte");
    } finally {
      setSubmitting(false);
    }
  };

  const onDownloadPDF = (rep) => {
    const url = fullUrl(rep?.archivo_url);
    if (!url) {
      setError("Este reporte no tiene archivo_url. Si estás en dummy, activa generación PDF o usa REPORTS_MODE='internal'.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const onDownloadJSON = (rep) => {
    const filename = `reporte_${rep.id_reporte}_${rep.tipo}_${rep.formato || "JSON"}.json`;
    downloadBlob(JSON.stringify(rep, null, 2), filename, "application/json");
  };

  const close = () => {
    if (submitting) return;
    onHide();
  };

  const materiaNombre = useMemo(() => {
    const m = materias.find((x) => String(x.id_materia) === String(form.materia_id));
    return m?.nombre || "";
  }, [materias, form.materia_id]);

  return (
    <Modal show={show} onHide={close} size="xl" centered>
      <Modal.Header closeButton={!submitting}>
        <Modal.Title>Reportes: Crear / Generar / Descargar</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <Alert variant="danger" onClose={() => setError(null)} dismissible>
            <pre className="mb-0" style={{ whiteSpace: "pre-wrap" }}>{error}</pre>
          </Alert>
        )}

        {info && (
          <Alert variant="success" onClose={() => setInfo(null)} dismissible>
            {info}
          </Alert>
        )}

        <CardBlock title="Crear nuevo reporte">
          <Row className="g-3">
            <Col md={3}>
              <Form.Label>Tipo</Form.Label>
              <Form.Select name="tipo" value={form.tipo} onChange={onChange} disabled={submitting}>
                <option value="EXAMEN">EXAMEN (Grupal)</option>
                <option value="INDIVIDUAL">INDIVIDUAL</option>
              </Form.Select>
            </Col>

            <Col md={3}>
              <Form.Label>Formato</Form.Label>
              <Form.Select name="formato" value={form.formato} onChange={onChange} disabled={submitting}>
                <option value="PDF">PDF</option>
                <option value="JSON">JSON</option>
                <option value="EXCEL">EXCEL</option>
                <option value="CSV">CSV</option>
              </Form.Select>
            </Col>

            <Col md={6}>
              <Form.Label>Observaciones</Form.Label>
              <Form.Control
                name="observaciones"
                value={form.observaciones}
                onChange={onChange}
                disabled={submitting}
                placeholder="Ej: Reporte grupal del examen..."
              />
            </Col>

            {form.tipo === "EXAMEN" && (
              <>
                <Col md={6}>
                  <Form.Label>Materia</Form.Label>
                  <Form.Select
                    name="materia_id"
                    value={form.materia_id}
                    onChange={onChange}
                    disabled={submitting || loadingMaterias}
                  >
                    <option value="">Seleccione una materia...</option>
                    {materias.map((m) => (
                      <option key={m.id_materia} value={m.id_materia}>
                        {m.nombre}
                      </option>
                    ))}
                  </Form.Select>
                  {materiaNombre ? (
                    <Form.Text className="text-muted">Seleccionada: {materiaNombre}</Form.Text>
                  ) : null}
                </Col>

                <Col md={6}>
                  <Form.Label>Examen</Form.Label>
                  <Form.Select
                    name="examen_id"
                    value={form.examen_id}
                    onChange={onChange}
                    disabled={submitting || loadingExams || !form.materia_id}
                  >
                    <option value="">
                      {form.materia_id ? "Seleccione un examen..." : "Primero seleccione una materia"}
                    </option>
                    {exams.map((ex) => (
                      <option key={ex.id_examen} value={ex.id_examen}>
                        {ex.titulo} (ID {ex.id_examen})
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </>
            )}

            {form.tipo === "INDIVIDUAL" && (
              <>
                <Col md={3}>
                  <Form.Label>Intento ID *</Form.Label>
                  <Form.Control
                    type="number"
                    name="intento_id"
                    value={form.intento_id}
                    onChange={onChange}
                    disabled={submitting}
                    placeholder="Ej: 100"
                  />
                </Col>
                <Col md={3}>
                  <Form.Label>Estudiante ID (opcional)</Form.Label>
                  <Form.Control
                    type="number"
                    name="estudiante_id"
                    value={form.estudiante_id}
                    onChange={onChange}
                    disabled={submitting}
                    placeholder="Ej: 12"
                  />
                </Col>
              </>
            )}

            <Col md={12} className="d-flex gap-2">
              <Button variant="primary" onClick={onCreate} disabled={submitting}>
                {submitting ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-2" />
                    Procesando...
                  </>
                ) : (
                  "Crear reporte"
                )}
              </Button>

              <Button variant="outline-secondary" onClick={loadAllReports} disabled={loadingList || submitting}>
                <ArrowRepeat className="me-2" />
                Refrescar lista
              </Button>
            </Col>
          </Row>
        </CardBlock>

        <CardBlock
          title={`Todos los reportes (${total})`}
          right={
            loadingList ? (
              <span className="text-muted">
                <Spinner size="sm" animation="border" className="me-2" />
                Cargando...
              </span>
            ) : null
          }
        >
          {reportes.length === 0 ? (
            <div className="text-muted">No hay reportes registrados.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <Table hover responsive className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>ID</th>
                    <th style={{ width: 130 }}>Tipo</th>
                    <th style={{ width: 140 }}>Estado</th>
                    <th style={{ width: 100 }}>Formato</th>
                    <th>Examen</th>
                    <th>Estudiante</th>
                    <th style={{ width: 90 }}>Intento</th>
                    <th style={{ width: 320 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {reportes.map((r) => (
                    <tr key={r.id_reporte}>
                      <td>#{r.id_reporte}</td>
                      <td>{tipoBadge(r.tipo)}</td>
                      <td>{estadoBadge(r.estado)}</td>
                      <td>{r.formato || "—"}</td>
                      <td>{r.examen_titulo || "—"} <span className="text-muted">({r.examen_id ?? "—"})</span></td>
                      <td>{r.estudiante_nombre || "—"} <span className="text-muted">({r.estudiante_id ?? "—"})</span></td>
                      <td>{r.intento_id ?? "—"}</td>
                      <td>
                        <div className="d-flex flex-wrap gap-2">
                          <Button size="sm" variant="outline-primary" onClick={() => setSelected(r)}>
                            Ver JSON
                          </Button>

                          <Button
                            size="sm"
                            variant="outline-info"
                            onClick={() => onGenerate(r.id_reporte)}
                            disabled={submitting}
                          >
                            <PlayFill className="me-1" />
                            Generar
                          </Button>

                          <Button
                            size="sm"
                            variant={r.archivo_url ? "success" : "outline-secondary"}
                            onClick={() => onDownloadPDF(r)}
                            disabled={!r.archivo_url}
                            title={r.archivo_url ? "Abrir/descargar PDF" : "No hay archivo_url"}
                          >
                            <FileEarmarkPdf className="me-1" />
                            Descargar
                          </Button>

                          <Button size="sm" variant="outline-secondary" onClick={() => onDownloadJSON(r)}>
                            <Download className="me-1" />
                            JSON
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </CardBlock>

        {selected && (
          <CardBlock title={`Vista rápida JSON (Reporte #${selected.id_reporte})`}>
            <pre
              className="mb-0"
              style={{
                whiteSpace: "pre-wrap",
                background: "#0b1020",
                color: "#d7e1ff",
                padding: 12,
                borderRadius: 8,
                fontSize: 13,
                maxHeight: 360,
                overflow: "auto",
              }}
            >
              {JSON.stringify(selected, null, 2)}
            </pre>
          </CardBlock>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={close} disabled={submitting}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default GenerateReportModal;
