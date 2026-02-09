// ============================================
// src/pages/reports/ReportDetail.jsx
// ============================================
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, Badge, Button, Alert, Spinner, Row, Col, Table } from "react-bootstrap";
import { ArrowLeft, Download, FileEarmarkCode, ExclamationTriangle } from "react-bootstrap-icons";

import reportService from "../../services/reportService";
const API_HOST = "http://127.0.0.1:8000";
const estadoBadge = (estado) => {
  const v = String(estado || "").toUpperCase();
  if (v === "COMPLETADO") return <Badge bg="success">COMPLETADO</Badge>;
  if (v === "GENERANDO") return <Badge bg="warning" text="dark">GENERANDO</Badge>;
  if (v === "ERROR") return <Badge bg="danger">ERROR</Badge>;
  return <Badge bg="secondary">{v || "N/A"}</Badge>;
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

const safeNum = (x) => (x == null ? 0 : Number(x));

const ReportDetail = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [reporte, setReporte] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reportService.getReportById(id);
      setReporte(data);
    } catch (err) {
      setError(
        err?.response?.data
          ? JSON.stringify(err.response.data, null, 2)
          : "No se pudo cargar el reporte"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const advertenciasDetalle = useMemo(() => {
    const d = reporte?.advertencias_detalle;
    return Array.isArray(d) ? d : [];
  }, [reporte]);

  const eventosMonitoreo = useMemo(() => {
    const e = reporte?.eventos_monitoreo;
    return e && typeof e === "object" ? e : {};
  }, [reporte]);

  const onDownloadJSON = () => {
    if (!reporte) return;
    const filename = `reporte_${reporte.id_reporte}_${reporte.tipo}_${reporte.formato || "JSON"}.json`;
    downloadBlob(JSON.stringify(reporte, null, 2), filename, "application/json");
  };

  

    const onOpenArchivo = () => {
    if (!reporte?.archivo_url) return;

    const url = reporte.archivo_url.startsWith("http")
        ? reporte.archivo_url
        : `${API_HOST}${reporte.archivo_url}`;

    window.open(url, "_blank", "noopener,noreferrer");
    };


  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" role="status" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-4">
        <Alert variant="danger">
          <pre className="mb-0" style={{ whiteSpace: "pre-wrap" }}>{error}</pre>
        </Alert>
        <Button variant="secondary" onClick={load}>Reintentar</Button>
      </div>
    );
  }

  if (!reporte) return null;

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center gap-2">
          <Link to="/admin-dashboard" className="btn btn-outline-secondary btn-sm">
            <ArrowLeft className="me-2" />
            Volver
          </Link>
          <h4 className="mb-0">Detalle del Reporte #{reporte.id_reporte}</h4>
          <span className="ms-2">{estadoBadge(reporte.estado)}</span>
        </div>

        <div className="d-flex gap-2">
          {/* ✅ 1) Si existe archivo_url, descarga/abre el archivo */}
          <Button
            variant={reporte.archivo_url ? "success" : "outline-secondary"}
            size="sm"
            onClick={onOpenArchivo}
            disabled={!reporte.archivo_url}
          >
            <Download className="me-2" />
            Descargar archivo
          </Button>

          {/* ✅ 2) Siempre disponible: descargar JSON */}
          <Button variant="outline-primary" size="sm" onClick={onDownloadJSON}>
            <Download className="me-2" />
            Descargar JSON
          </Button>

          <Button variant="outline-secondary" size="sm" onClick={load}>
            Recargar
          </Button>
        </div>
      </div>

      <Row className="g-3">
        <Col lg={4}>
          <Card className="shadow-sm">
            <Card.Header className="fw-bold">Resumen</Card.Header>
            <Card.Body>
              <div className="mb-2"><b>Tipo:</b> {reporte.tipo}</div>
              <div className="mb-2"><b>Formato:</b> {reporte.formato}</div>
              <div className="mb-2"><b>Examen ID:</b> {reporte.examen_id ?? "—"}</div>
              <div className="mb-2"><b>Examen:</b> {reporte.examen_titulo || "—"}</div>
              <div className="mb-2"><b>Estudiante:</b> {reporte.estudiante_nombre || "—"}</div>
              <div className="mb-2"><b>Intento ID:</b> {reporte.intento_id ?? "—"}</div>

              <hr />

              <div className="mb-2"><b>Total advertencias:</b> {safeNum(reporte.total_advertencias)}</div>
              <div className="mb-2"><b>Expulsión:</b> {reporte.hubo_expulsion ? "Sí" : "No"}</div>
              {reporte.hubo_expulsion ? (
                <div className="mb-2"><b>Motivo:</b> {reporte.motivo_expulsion || "—"}</div>
              ) : null}

              <hr />

              <div className="mb-2"><b>Solicitado por:</b> {reporte.solicitado_por_nombre} ({reporte.solicitado_por_rol})</div>
              <div className="mb-2"><b>Observaciones:</b> {reporte.observaciones || "—"}</div>

              <hr />

              <div className="mb-2"><b>Generación:</b> {reporte.fecha_generacion}</div>
              <div className="mb-2"><b>Actualización:</b> {reporte.fecha_actualizacion}</div>

              {!reporte.archivo_url && (
                <Alert variant="warning" className="mt-3 mb-0">
                  <ExclamationTriangle className="me-2" />
                  No hay <b>archivo_url</b>. El backend aún no está generando PDF/Excel/CSV.
                  Puedes descargar el JSON con el botón.
                </Alert>
              )}

              {reporte.error_mensaje ? (
                <Alert variant="danger" className="mt-3 mb-0">
                  <b>Error:</b> {reporte.error_mensaje}
                </Alert>
              ) : null}
            </Card.Body>
          </Card>

          {/* ✅ Advertencias detalle */}
          <Card className="shadow-sm mt-3">
            <Card.Header className="fw-bold">Advertencias (detalle)</Card.Header>
            <Card.Body>
              {advertenciasDetalle.length === 0 ? (
                <div className="text-muted">No hay advertencias registradas.</div>
              ) : (
                <Table bordered size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th style={{ width: 110 }}>Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advertenciasDetalle.map((a, idx) => (
                      <tr key={idx}>
                        <td>{a.tipo}</td>
                        <td>{a.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>

          {/* ✅ Eventos monitoreo */}
          <Card className="shadow-sm mt-3">
            <Card.Header className="fw-bold">Eventos de monitoreo</Card.Header>
            <Card.Body>
              {Object.keys(eventosMonitoreo).length === 0 ? (
                <div className="text-muted">No hay eventos de monitoreo.</div>
              ) : (
                <Table bordered size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>Evento</th>
                      <th style={{ width: 110 }}>Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(eventosMonitoreo).map(([k, v]) => (
                      <tr key={k}>
                        <td>{k}</td>
                        <td>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={8}>
          <Card className="shadow-sm">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span className="fw-bold">
                <FileEarmarkCode className="me-2" />
                JSON completo del Reporte
              </span>
            </Card.Header>

            <Card.Body>
              <pre
                className="mb-0"
                style={{
                  whiteSpace: "pre-wrap",
                  background: "#0b1020",
                  color: "#d7e1ff",
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 13,
                  maxHeight: 620,
                  overflow: "auto",
                }}
              >
                {JSON.stringify(reporte, null, 2)}
              </pre>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ReportDetail;
