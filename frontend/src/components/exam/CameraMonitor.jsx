// ============================================================
// src/components/exam/CameraMonitor.jsx
// ============================================================
// - Abre cámara
// - Health check al backend (con token por interceptor axios)
// - Captura frames y llama /analizar-frame/
// - Registra eventos REALES en /eventos/ SOLO si backend lo indica
// - Si backend expulsa (intento_expulsado o expulsion_creada), notifica al padre una sola vez
// ============================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, Badge, Alert } from "react-bootstrap";
import monitoringService from "../../services/monitoringService";
import { useAuth } from "../../hooks/useAuth";

const CAPTURE_INTERVAL_MS = 800;

// Enviar el MISMO tipo_evento máximo 1 vez cada X ms
// (si tu backend crea advertencias por evento, esto evita spam)
const EVENT_COOLDOWN_MS = 2500;

const CameraMonitor = ({
  intentoId,
  examenId = null,
  examenTitulo = "",
  enabled = true,
  onViolation, // ({msg,tipo_evento,expulsado,backend}) => void
}) => {
  const { user } = useAuth();
  const estudianteId = Number(user?.id_usuario ?? user?.id ?? 0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const activeRef = useRef(false);

  // cooldown por tipo_evento
  const lastSentRef = useRef({});
  // evita notificar expulsión repetidamente
  const expelledNotifiedRef = useRef(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [backendOk, setBackendOk] = useState(null); // null | true | false
  const [statusText, setStatusText] = useState("Inicializando…");
  const [localWarnings, setLocalWarnings] = useState([]);
  const [latencyMs, setLatencyMs] = useState(null);

  const getStudentName = useCallback(() => {
    const full =
      user?.nombre_completo ||
      `${user?.nombres ?? ""} ${user?.apellidos ?? ""}`.trim();
    return full || "Estudiante";
  }, [user]);

  const addWarning = useCallback((msg) => {
    setLocalWarnings((prev) => [...prev, { msg, ts: Date.now() }].slice(-10));
  }, []);

  const canSend = useCallback((tipo_evento) => {
    const now = Date.now();
    const last = lastSentRef.current[tipo_evento] ?? 0;
    if (now - last < EVENT_COOLDOWN_MS) return false;
    lastSentRef.current[tipo_evento] = now;
    return true;
  }, []);

  // ----------------------------------------------------------
  // ✅ Enviar evento al backend y detectar expulsión REAL
  // ----------------------------------------------------------
  const sendEvent = useCallback(
    async (tipo_evento, msg, confianza = 80, extra = {}) => {
      if (!enabled || !intentoId || !estudianteId || !tipo_evento) return null;

      // Evita spam por tipo
      if (!canSend(tipo_evento)) return null;

      const payload = {
        intento_id: Number(intentoId),
        estudiante_id: Number(estudianteId),
        tipo_evento,
        confianza_algoritmo: Number(confianza),
        detalles: {
          msg: msg || "",
          estudiante_nombre: getStudentName(),
          ...(examenId != null ? { examen_id: Number(examenId) } : {}),
          ...(examenTitulo ? { examen_titulo: examenTitulo } : {}),
          ...extra,
        },
      };

      try {
        const res = await monitoringService.createEvent(payload);

        // Backend real:
        // - intento_expulsado: bool
        // - expulsion_creada: objeto o null
        const backendExpelled =
          Boolean(res?.intento_expulsado) || Boolean(res?.expulsion_creada);

        if (backendExpelled && !expelledNotifiedRef.current) {
          expelledNotifiedRef.current = true;

          onViolation?.({
            msg: "Examen expulsado por alcanzar el máximo de advertencias.",
            tipo_evento: "EXPULSION",
            expulsado: true,
            backend: res,
          });
        }

        return res;
      } catch (e) {
        console.warn("[CameraMonitor] sendEvent:", e?.response?.data || e?.message);
        return null;
      }
    },
    [
      enabled,
      intentoId,
      estudianteId,
      examenId,
      examenTitulo,
      getStudentName,
      onViolation,
      canSend,
    ]
  );

  // ----------------------------------------------------------
  // Health check (usa axios para que el token viaje por interceptor)
  // ----------------------------------------------------------
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      try {
        setBackendOk(null);
        setStatusText("Conectando con backend…");
        const data = await monitoringService.detectionHealth();
        if (cancelled) return;

        if (data?.status === "ok") {
          setBackendOk(true);
          setStatusText(`Backend listo (${data.modelo || "modelo"})`);
        } else {
          setBackendOk(false);
          setStatusText("⚠ Modelo no cargado en backend");
        }
      } catch (e) {
        if (cancelled) return;
        setBackendOk(false);
        setStatusText("❌ No se conectó al backend / auth");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // ----------------------------------------------------------
  // Abrir / cerrar cámara
  // ----------------------------------------------------------
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    activeRef.current = true;
    expelledNotifiedRef.current = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.muted = true;
          video.playsInline = true;
          try {
            await video.play();
          } catch {}
        }

        streamRef.current = stream;
        setCameraActive(true);

        // Eventos informativos (opcional; no generan advertencias si tu mapping no lo hace)
        await sendEvent("INICIO_SESION", "Monitoreo iniciado", 100);
      } catch (err) {
        setCameraActive(false);
        setStatusText("❌ Sin acceso a cámara");

        await sendEvent("CONEXION_PERDIDA", "No se pudo acceder a la cámara", 50, {
          error: err?.message,
        });

        alert("No se pudo acceder a la cámara.\nRevisa permisos del navegador.");
      }
    })();

    return () => {
      cancelled = true;
      activeRef.current = false;

      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      if (videoRef.current) videoRef.current.srcObject = null;
      setCameraActive(false);

      sendEvent("FIN_SESION", "Monitoreo detenido", 100);
    };
  }, [enabled, sendEvent]);

  // ----------------------------------------------------------
  // Loop: capturar frame -> analizar -> registrar eventos REALES
  // ----------------------------------------------------------
  useEffect(() => {
    if (!enabled || !cameraActive || backendOk !== true) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");

    const syncCanvas = () => {
      if (video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    };
    syncCanvas();

    const tick = async () => {
      if (!activeRef.current) return;

      // Si ya notificaste expulsión, deja de analizar/enviar
      if (expelledNotifiedRef.current) return;

      if (video.readyState < video.HAVE_ENOUGH_DATA || !video.videoWidth) return;

      syncCanvas();
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      let blob;
      try {
        blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("toBlob null"))),
            "image/jpeg",
            0.75
          );
        });
      } catch {
        return;
      }

      const t0 = performance.now();

      let data;
      try {
        data = await monitoringService.analyzeFrame(blob);
        setLatencyMs(Math.round(performance.now() - t0));
      } catch {
        setStatusText("❌ Error analizar-frame");
        return;
      }

      if (!activeRef.current) return;

      const {
        num_faces,
        events = [],
        primary,
        status_text,
        severity,  // esperado: OK, OK_INFO, WARN, VIOLATION (según tu backend)
        yaw_pct,   // opcional si lo envías
      } = data || {};

      setStatusText(status_text || "…");

      // ✅ Regla: si backend manda “OK_INFO” (80–85%), NO registrar nada.
      if (severity === "OK_INFO") return;

      // ✅ Si backend no manda eventos, no inventamos.
      if (!Array.isArray(events) || events.length === 0) return;

      const confidence = Math.round((data?.confidence || 1.0) * 100);

      // Importante:
      // - SOLO llamamos onViolation cuando el backend lo determinó.
      // - onViolation se llama DESPUÉS de sendEvent solo para mostrar alerta local,
      //   pero si el backend expulsa, sendEvent ya va a notificar EXPULSION.

      if (events.includes("MULTIPLES_ROSTROS")) {
        const msg = `⚠ Se detectaron ${num_faces} personas en el encuadre`;
        addWarning(msg);
        await sendEvent("MULTIPLES_ROSTROS", msg, confidence, {
          cantidad_rostros: num_faces,
        });

        // Si sendEvent expulsó, ya no sigas.
        if (expelledNotifiedRef.current) return;

        onViolation?.({ msg, tipo_evento: "MULTIPLES_ROSTROS" });
      }

      if (events.includes("FUERA_DE_ENCUADRE")) {
        const msg =
          num_faces === 0
            ? "⚠ El estudiante no está en el encuadre"
            : "⚠ El estudiante está lejos";
        addWarning(msg);
        await sendEvent("FUERA_DE_ENCUADRE", msg, confidence, {
          num_faces,
          face_width: primary?.face_width_norm,
        });

        if (expelledNotifiedRef.current) return;

        onViolation?.({ msg, tipo_evento: "FUERA_DE_ENCUADRE" });
      }

      if (events.includes("MIRADA_DESVIADA")) {
        const msg = status_text || "⚠ Mirada desviada";
        addWarning(msg);
        await sendEvent("MIRADA_DESVIADA", msg, confidence, {
          yaw: primary?.yaw,
          yaw_pct,
          gaze_x: primary?.gaze_x,
          severity,
        });

        if (expelledNotifiedRef.current) return;

        onViolation?.({ msg, tipo_evento: "MIRADA_DESVIADA" });
      }

      if (events.includes("OJOS_CERRADOS")) {
        const msg = "⚠ Ojos cerrados";
        addWarning(msg);
        await sendEvent("OJOS_CERRADOS", msg, confidence, {
          ear: primary?.ear,
        });

        if (expelledNotifiedRef.current) return;

        onViolation?.({ msg, tipo_evento: "OJOS_CERRADOS" });
      }
    };

    const intervalId = setInterval(tick, CAPTURE_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [enabled, cameraActive, backendOk, addWarning, sendEvent, onViolation]);

  const badgeBg =
    cameraActive && backendOk ? "success" : backendOk === null ? "secondary" : "danger";

  return (
    <Card className="shadow-sm mb-4" style={{ borderRadius: 10, overflow: "hidden" }}>
      <Card.Header
        className="d-flex justify-content-between align-items-center"
        style={{ background: "#1a1a2e", color: "#eee", borderBottom: "2px solid #e94560" }}
      >
        <span style={{ fontWeight: 600, letterSpacing: 0.5 }}>📹 Monitoreo por Cámara</span>
        <div className="d-flex gap-2 align-items-center">
          {latencyMs !== null && (
            <Badge bg={latencyMs < 600 ? "info" : "warning"} style={{ fontSize: 10 }}>
              {latencyMs} ms
            </Badge>
          )}
          <Badge bg={badgeBg} style={{ fontSize: 11 }}>
            {cameraActive
              ? backendOk
                ? "Activo"
                : backendOk === null
                ? "Conectando…"
                : "Sin backend"
              : "Sin cámara"}
          </Badge>
        </div>
      </Card.Header>

      <Card.Body className="text-center" style={{ background: "#0f0f1a", padding: "1rem" }}>
        <div style={{ position: "relative", display: "inline-block", width: "100%", maxWidth: 420 }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="border rounded"
            style={{ width: "100%", background: "#111", borderColor: "#333" }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 6,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.7)",
              color: "#eee",
              fontSize: 12,
              padding: "3px 12px",
              borderRadius: 12,
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {statusText}
          </div>
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />

        {localWarnings.length > 0 && (
          <div className="mt-3 text-start">
            {localWarnings.slice(-3).map((w, i) => (
              <Alert key={w.ts + i} variant="warning" className="py-1 mb-1" style={{ fontSize: 13 }}>
                {w.msg}
              </Alert>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default CameraMonitor;
