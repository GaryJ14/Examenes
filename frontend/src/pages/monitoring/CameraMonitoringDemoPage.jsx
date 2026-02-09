// ============================================
// src/pages/monitoring/CameraMonitoringDemoPage.jsx
// ============================================
import React, { useRef, useState } from "react";
import { Alert, Badge, Button, Card } from "react-bootstrap";
import CameraMonitor from "../../components/exam/CameraMonitor";

const CameraMonitoringDemoPage = () => {
  const [events, setEvents] = useState([]);
  const [enabled, setEnabled] = useState(true);
  const seqRef = useRef(0);

  const handleViolation = (payload) => {
    const msg = payload?.msg || "Evento detectado";
    const tipo = payload?.tipo_evento || "DESCONOCIDO";

    seqRef.current += 1;
    const id =
      (crypto?.randomUUID?.() || `${Date.now()}_${Math.random()}`) + `_${seqRef.current}`;

    const item = {
      id,
      ts: new Date().toLocaleString(),
      tipo_evento: tipo,
      msg,
    };

    setEvents((prev) => [item, ...prev].slice(0, 20));
  };

  return (
    <div className="p-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h4 className="mb-1">Camara de monitoreo </h4>
          <div className="text-muted">
            Validación de la cámara + análisis en backend.
          </div>
        </div>

        <div className="d-flex gap-2">
          <Button
            variant={enabled ? "outline-danger" : "outline-success"}
            onClick={() => setEnabled((v) => !v)}
          >
            {enabled ? "Desactivar" : "Activar"}
          </Button>

          <Button variant="outline-secondary" onClick={() => setEvents([])}>
            Limpiar logs
          </Button>
        </div>
      </div>

      {!enabled && (
        <Alert variant="warning">
          Monitoreo desactivado. Actívalo para iniciar la cámara.
        </Alert>
      )}

      {enabled ? (
        <Card className="shadow-sm mb-3">
          <Card.Header className="d-flex align-items-center justify-content-between">
            <div className="fw-bold">Vista previa de cámara</div>
            <Badge bg={events.length ? "warning" : "success"}>
              Eventos: {events.length}
            </Badge>
          </Card.Header>

          <Card.Body>
            <CameraMonitor
              enabled={enabled}
              intentoId={null}              // ✅ demo: NO registra eventos en BD
              examenTitulo="DEMO"
              onViolation={handleViolation} // ✅ muestra eventos detectados
            />

            <div className="text-muted mt-2" style={{ fontSize: 13 }}>
              Si el navegador pide permisos, acepta. En HTTP puede bloquearse la cámara (usa HTTPS o localhost).
            </div>
          </Card.Body>
        </Card>
      ) : null}

      <Card className="shadow-sm">
        <Card.Header className="fw-bold">Logs / eventos</Card.Header>
        <Card.Body>
          {events.length === 0 ? (
            <div className="text-muted">Sin eventos todavía.</div>
          ) : (
            <div style={{ maxHeight: 260, overflow: "auto" }}>
              {events.map((e) => (
                <div key={e.id} className="border rounded p-2 mb-2">
                  <div className="d-flex justify-content-between">
                    <div className="fw-semibold">{e.tipo_evento}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>
                      {e.ts}
                    </div>
                  </div>
                  <div>{e.msg}</div>
                </div>
              ))}
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default CameraMonitoringDemoPage;
