import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, Row, Col, Form, Button, Alert, Spinner, Badge } from "react-bootstrap";
import { PersonCircle, PencilSquare, ShieldLock, Camera, CheckCircleFill, XCircleFill } from "react-bootstrap-icons";
import userService from "../../services/userService";

const API_HOST = "http://127.0.0.1:8000";

const fullUrl = (maybeRelative) => {
  if (!maybeRelative) return "";
  const s = String(maybeRelative);
  if (s.startsWith("http")) return s;
  return `${API_HOST}${s}`;
};

const roleBadge = (rol) => {
  const v = String(rol || "").toUpperCase();
  if (v === "ADMIN") return <Badge bg="danger" className="rounded-pill px-3 py-2">ADMIN</Badge>;
  if (v === "DOCENTE") return <Badge bg="primary" className="rounded-pill px-3 py-2">DOCENTE</Badge>;
  return <Badge bg="success" className="rounded-pill px-3 py-2">ESTUDIANTE</Badge>;
};

const Pill = ({ ok }) =>
  ok ? (
    <span className="d-inline-flex align-items-center gap-2 px-2 py-1 rounded-pill bg-success bg-opacity-10 text-success fw-semibold">
      <CheckCircleFill size={14} /> Validada
    </span>
  ) : (
    <span className="d-inline-flex align-items-center gap-2 px-2 py-1 rounded-pill bg-warning bg-opacity-10 text-warning fw-semibold">
      <XCircleFill size={14} /> No validada
    </span>
  );

const MyProfile = () => {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [uploadingValidation, setUploadingValidation] = useState(false);

  const [me, setMe] = useState(null);

  const [profileForm, setProfileForm] = useState({
    cedula: "",
    nombres: "",
    apellidos: "",
    correo_electronico: "",
  });

  const [passForm, setPassForm] = useState({
    password: "",
    password_confirmacion: "",
  });

  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);

  const validationInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      const data = await userService.getPerfil();
      setMe(data);

      setProfileForm({
        cedula: data?.cedula || "",
        nombres: data?.nombres || "",
        apellidos: data?.apellidos || "",
        correo_electronico: data?.correo_electronico || "",
      });
    } catch (err) {
      setError(err?.response?.data ? JSON.stringify(err.response.data, null, 2) : "No se pudo cargar tu perfil");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const fotoPerfil = useMemo(() => {
    const raw = me?.foto_perfil?.foto || "";
    return fullUrl(raw);
  }, [me]);

  const fotoValidacion = useMemo(() => {
    const raw = me?.foto_perfil?.foto_validacion || "";
    return fullUrl(raw);
  }, [me]);

  const validada = Boolean(me?.foto_perfil?.validada);

  const onChangeProfile = (e) => {
    const { name, value } = e.target;
    setProfileForm((p) => ({ ...p, [name]: value }));
    setError(null);
    setOk(null);
  };

  const validateProfile = () => {
    if (!/^\d{10}$/.test(profileForm.cedula)) return "La cédula debe tener 10 dígitos.";
    if (!profileForm.nombres.trim()) return "Nombres es obligatorio.";
    if (!profileForm.apellidos.trim()) return "Apellidos es obligatorio.";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profileForm.correo_electronico)) return "Correo electrónico inválido.";
    return null;
  };

  const saveProfile = async () => {
    const msg = validateProfile();
    if (msg) return setError(msg);

    if (!me?.id_usuario) return setError("No se encontró id_usuario en el perfil.");

    setSavingProfile(true);
    setError(null);
    setOk(null);

    try {
      // ✅ usa tu endpoint existente: usuarios/<id>/actualizar/
      const updated = await userService.updateUser(me.id_usuario, {
        nombres: profileForm.nombres,
        apellidos: profileForm.apellidos,
        correo_electronico: profileForm.correo_electronico,
        // cedula NO está en ActualizarUsuarioSerializer (si quieres permitirlo, agrégalo)
      });

      // tu backend responde { mensaje, usuario }
      const user = updated?.usuario || updated;
      setOk("Perfil actualizado correctamente ✅");
      // recargar para mantener foto_perfil etc
      await load();
      return user;
    } catch (err) {
      setError(err?.response?.data ? JSON.stringify(err.response.data, null, 2) : "No se pudo actualizar el perfil");
    } finally {
      setSavingProfile(false);
    }
  };

  const validatePass = () => {
    if (!passForm.password || passForm.password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
    if (passForm.password !== passForm.password_confirmacion) return "Las contraseñas no coinciden.";
    return null;
  };

  const savePassword = async () => {
    const msg = validatePass();
    if (msg) return setError(msg);

    if (!me?.id_usuario) return setError("No se encontró id_usuario en el perfil.");

    setSavingPass(true);
    setError(null);
    setOk(null);

    try {
      await userService.updateUser(me.id_usuario, {
        password: passForm.password,
        password_confirmacion: passForm.password_confirmacion,
      });

      setOk("Contraseña actualizada correctamente ✅");
      setPassForm({ password: "", password_confirmacion: "" });
    } catch (err) {
      setError(err?.response?.data ? JSON.stringify(err.response.data, null, 2) : "No se pudo cambiar la contraseña");
    } finally {
      setSavingPass(false);
    }
  };

  const validateImage = (file) => {
    if (!file) return "No se seleccionó archivo.";
    if (!file.type.startsWith("image/")) return "El archivo debe ser una imagen.";
    if (file.size > 3 * 1024 * 1024) return "La imagen no debe superar 3MB.";
    return null;
  };

  const onPickValidationPhoto = () => validationInputRef.current?.click();

  const onUploadValidationPhoto = async (e) => {
    const file = e.target.files?.[0];
    const msg = validateImage(file);
    if (msg) return setError(msg);

    setUploadingValidation(true);
    setError(null);
    setOk(null);

    try {
      await userService.uploadFotoValidacion(file);
      setOk("Foto de validación subida ✅ (validada=true)");
      await load();
    } catch (err) {
      setError(err?.response?.data ? JSON.stringify(err.response.data, null, 2) : "No se pudo subir la foto de validación");
    } finally {
      setUploadingValidation(false);
      e.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" role="status" />
      </div>
    );
  }

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-4 shadow-sm"
            style={{ width: 52, height: 52, display: "grid", placeItems: "center", background: "rgba(13,110,253,.10)" }}
          >
            <PersonCircle size={26} className="text-primary" />
          </div>
          <div>
            <h3 className="mb-0">Mi Perfil</h3>
            <div className="text-muted">Edita tu información, validación y seguridad</div>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">{roleBadge(me?.rol)}</div>
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible className="shadow-sm">
          <pre className="mb-0" style={{ whiteSpace: "pre-wrap" }}>{error}</pre>
        </Alert>
      )}
      {ok && (
        <Alert variant="success" onClose={() => setOk(null)} dismissible className="shadow-sm">
          {ok}
        </Alert>
      )}

      <Row className="g-3">
        {/* Left - fotos */}
        <Col lg={4}>
          <Card className="shadow-sm border-0">
            <Card.Body>
              <div className="fw-bold mb-2">Foto de perfil (base)</div>

              <div className="rounded-4 overflow-hidden shadow-sm mb-3" style={{ width: "100%", height: 220, background: "#f1f5f9", display: "grid", placeItems: "center" }}>
                {fotoPerfil ? (
                  <img src={fotoPerfil} alt="foto-perfil" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div className="text-center text-muted">
                    <PersonCircle size={60} />
                    <div className="mt-2">Sin foto</div>
                  </div>
                )}
              </div>

              <div className="d-flex align-items-center justify-content-between">
                <Pill ok={validada} />
                <span className="text-muted" style={{ fontSize: 12 }}>
                  (No editable con tus endpoints actuales)
                </span>
              </div>
            </Card.Body>
          </Card>

          <Card className="shadow-sm border-0 mt-3">
            <Card.Body>
              <div className="fw-bold mb-2">Foto de validación (monitoreo)</div>

              <div className="rounded-4 overflow-hidden shadow-sm mb-3" style={{ width: "100%", height: 220, background: "#f1f5f9", display: "grid", placeItems: "center" }}>
                {fotoValidacion ? (
                  <img src={fotoValidacion} alt="foto-validacion" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div className="text-center text-muted">
                    <PersonCircle size={60} />
                    <div className="mt-2">Sin captura</div>
                  </div>
                )}
              </div>

              <input
                ref={validationInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onUploadValidationPhoto}
              />

              <Button
                variant="outline-dark"
                className="w-100 d-flex justify-content-center align-items-center gap-2"
                onClick={onPickValidationPhoto}
                disabled={uploadingValidation}
              >
                {uploadingValidation ? (
                  <>
                    <Spinner animation="border" size="sm" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Camera />
                    Subir foto validación
                  </>
                )}
              </Button>

              <div className="text-muted mt-2" style={{ fontSize: 12 }}>
                Esta foto se usa para confirmar identidad en monitoreo.
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Right - forms */}
        <Col lg={8}>
          <Card className="shadow-sm border-0 mb-3">
            <Card.Header className="bg-white border-0 d-flex align-items-center gap-2 fw-bold">
              <PencilSquare /> Editar datos
            </Card.Header>
            <Card.Body>
              <Row className="g-3">
                <Col md={4}>
                  <Form.Label className="fw-semibold">Cédula</Form.Label>
                  <Form.Control value={profileForm.cedula} disabled />
                  <Form.Text className="text-muted">No editable desde este módulo.</Form.Text>
                </Col>

                <Col md={4}>
                  <Form.Label className="fw-semibold">Nombres</Form.Label>
                  <Form.Control name="nombres" value={profileForm.nombres} onChange={onChangeProfile} disabled={savingProfile} />
                </Col>

                <Col md={4}>
                  <Form.Label className="fw-semibold">Apellidos</Form.Label>
                  <Form.Control name="apellidos" value={profileForm.apellidos} onChange={onChangeProfile} disabled={savingProfile} />
                </Col>

                <Col md={12}>
                  <Form.Label className="fw-semibold">Correo</Form.Label>
                  <Form.Control type="email" name="correo_electronico" value={profileForm.correo_electronico} onChange={onChangeProfile} disabled={savingProfile} />
                </Col>

                <Col md={12} className="d-flex gap-2">
                  <Button variant="primary" onClick={saveProfile} disabled={savingProfile} className="px-4">
                    {savingProfile ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Guardando...
                      </>
                    ) : (
                      "Guardar cambios"
                    )}
                  </Button>

                  <Button variant="outline-secondary" onClick={load} disabled={savingProfile}>
                    Recargar
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Card className="shadow-sm border-0">
            <Card.Header className="bg-white border-0 d-flex align-items-center gap-2 fw-bold">
              <ShieldLock /> Cambiar contraseña
            </Card.Header>
            <Card.Body>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Label className="fw-semibold">Nueva contraseña</Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    value={passForm.password}
                    onChange={(e) => setPassForm((p) => ({ ...p, password: e.target.value }))}
                    disabled={savingPass}
                  />
                </Col>

                <Col md={6}>
                  <Form.Label className="fw-semibold">Confirmación</Form.Label>
                  <Form.Control
                    type="password"
                    name="password_confirmacion"
                    value={passForm.password_confirmacion}
                    onChange={(e) => setPassForm((p) => ({ ...p, password_confirmacion: e.target.value }))}
                    disabled={savingPass}
                  />
                </Col>

                <Col md={12} className="d-flex gap-2">
                  <Button variant="dark" onClick={savePassword} disabled={savingPass} className="px-4">
                    {savingPass ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Guardando...
                      </>
                    ) : (
                      "Actualizar contraseña"
                    )}
                  </Button>

                  <Button
                    variant="outline-secondary"
                    onClick={() => setPassForm({ password: "", password_confirmacion: "" })}
                    disabled={savingPass}
                  >
                    Limpiar
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MyProfile;
