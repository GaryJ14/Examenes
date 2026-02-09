// ============================================
// src/pages/exams/StartExamPage.jsx
// ============================================
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Badge, Button, Card, Spinner } from "react-bootstrap";
import Swal from "sweetalert2";

import { useAuth } from "../../hooks/useAuth";
import examService from "../../services/examService";
import attemptService from "../../services/attemptService";
import userPhotoService from "../../services/userPhotoService";
import { captureVideoFrameAsFile } from "../../utils/cameraCapture";

const StartExamPage = () => {
  const { id } = useParams(); // examenId
  const navigate = useNavigate();
  const { user } = useAuth();

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);

  const [requestingCam, setRequestingCam] = useState(false);
  const [camReady, setCamReady] = useState(false);

  const [validated, setValidated] = useState(false);
  const [validating, setValidating] = useState(false);

  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  const stopCamera = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    } catch {}
  };

  useEffect(() => {
    const loadExam = async () => {
      try {
        setLoading(true);
        setErr("");
        const data = await examService.getExamById(id);
        setExam(data);
      } catch (e) {
        setErr(e?.response?.data?.detail || "No se pudo cargar el examen.");
      } finally {
        setLoading(false);
      }
    };

    loadExam();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const requestCamera = async () => {
    setRequestingCam(true);
    setErr("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCamReady(true);
    } catch (e) {
      stopCamera();
      setCamReady(false);
      setErr(e?.message || "No se pudo acceder a la cámara. Revisa permisos.");
    } finally {
      setRequestingCam(false);
    }
  };

  const validateIdentity = async () => {
    if (!camReady) {
      await Swal.fire({
        icon: "warning",
        title: "Cámara requerida",
        text: "Primero habilita la cámara.",
      });
      return;
    }

    setValidating(true);
    setErr("");

    try {
      const cedula = String(user?.cedula || "").trim();
      const filename = `validacion_${cedula || "usuario"}.jpg`;
      const file = await captureVideoFrameAsFile(videoRef.current, filename);

      const resp = await userPhotoService.uploadValidationPhoto(file);
      const ok = resp?.validada ?? true;
      if (!ok) throw new Error("El servidor no aceptó la validación.");

      setValidated(true);

      await Swal.fire({
        icon: "success",
        title: "Identidad validada",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (e) {
      const backend = e?.response?.data;
      setValidated(false);
      setErr(
        backend?.detail ||
          (backend ? JSON.stringify(backend, null, 2) : e?.message) ||
          "No se pudo validar identidad."
      );
    } finally {
      setValidating(false);
    }
  };

  
  const getNextAttemptNumber = async (estudiante_id, examen_id) => {
    const resp = await attemptService.listAttempts({ estudiante_id, examen_id });
    const intentos = resp?.intentos || [];

    const maxNum = intentos.reduce((max, it) => {
      const n = Number(it?.numero_intento ?? 0);
      return n > max ? n : max;
    }, 0);

    return maxNum + 1; // siguiente intento
  };

  const createAttempt = async () => {
    if (!validated) {
      await Swal.fire({
        icon: "warning",
        title: "Validación requerida",
        text: "Debes validar tu identidad antes de iniciar.",
      });
      return;
    }

    if (!exam) return;

    setCreating(true);
    setErr("");

    try {
      // Usuario
      const estudiante_id = Number(user?.id_usuario);
      const estudiante_nombre =
        user?.nombre_completo ||
        `${user?.nombres || ""} ${user?.apellidos || ""}`.trim() ||
        "Estudiante";
      const estudiante_cedula = String(user?.cedula || "").trim();

      if (!estudiante_id) throw new Error("estudiante_id inválido (revisa AuthContext).");
      if (!/^\d{10}$/.test(estudiante_cedula)) {
        throw new Error("Cédula inválida (debe tener 10 dígitos).");
      }

      // Examen
      const examen_id = Number(exam?.id_examen ?? id);
      if (!examen_id) throw new Error("examen_id inválido");

      const examen_titulo = exam?.titulo || "Examen";
      const puntaje_total = Number(exam?.puntaje_total ?? 10);
      const preguntas_totales = Number(exam?.preguntas_totales ?? 10);

      // Fecha límite ISO
      const duracionMin = Number(exam?.duracion ?? 60);
      const limitDate = new Date(Date.now() + duracionMin * 60 * 1000);
      const fecha_limite = limitDate.toISOString().slice(0, 19); // YYYY-MM-DDTHH:mm:ss

    
      const numero_intento = await getNextAttemptNumber(estudiante_id, examen_id);

      const payload = {
        estudiante_id,
        estudiante_nombre,
        estudiante_cedula,
        examen_id,
        examen_titulo,
        numero_intento, 
        puntaje_total,
        preguntas_totales,
        fecha_limite,
        camara_activada: true,
        validacion_facial_completada: true,
      };

      console.log("PAYLOAD INTENTO =>", payload);

      const intento = await attemptService.createAttempt(payload);

      const attemptId = intento?.id_intento ?? intento?.id;
      if (!attemptId) throw new Error("El backend no devolvió id_intento.");

      stopCamera();
      navigate(`/intentos/${attemptId}/take`);
    } catch (e) {
      const backend = e?.response?.data;
      setErr(
        backend?.detail ||
          (backend ? JSON.stringify(backend, null, 2) : e?.message) ||
          "No se pudo crear el intento."
      );
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <p className="text-muted">Cargando...</p>;
  if (err && !exam) return <Alert variant="danger">{err}</Alert>;

  return (
    <Card className="shadow-sm">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Iniciar examen</h5>
        {validated ? <Badge bg="success">Validado</Badge> : <Badge bg="secondary">Sin validar</Badge>}
      </Card.Header>

      <Card.Body>
        {err && (
          <Alert variant="danger" dismissible onClose={() => setErr("")}>
            <pre className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
              {err}
            </pre>
          </Alert>
        )}

        <div className="mb-2 text-muted">
          Examen: <strong>{exam?.titulo}</strong>
        </div>

        <div className="d-flex gap-2 flex-wrap mb-3">
          <Button
            variant="outline-secondary"
            onClick={() => navigate(-1)}
            disabled={creating || requestingCam || validating}
          >
            Volver
          </Button>

          <Button variant="primary" onClick={requestCamera} disabled={creating || requestingCam || validating}>
            {requestingCam ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Solicitando cámara...
              </>
            ) : (
              "Habilitar cámara"
            )}
          </Button>

          <Button variant="warning" onClick={validateIdentity} disabled={!camReady || validating || creating}>
            {validating ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Validando...
              </>
            ) : (
              "Validar identidad (foto)"
            )}
          </Button>

          <Button variant="success" onClick={createAttempt} disabled={!validated || creating}>
            {creating ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Creando intento...
              </>
            ) : (
              "Iniciar intento"
            )}
          </Button>
        </div>

        <div className="border rounded p-2">
          <div className="small text-muted mb-2">Vista previa:</div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", maxHeight: 320, background: "#111" }}
          />
        </div>

        {!camReady && (
          <Alert variant="info" className="mt-3 mb-0">
            Habilita la cámara para poder validar.
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
};

export default StartExamPage;
