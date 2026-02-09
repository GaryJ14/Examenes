import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PersonPlus } from 'react-bootstrap-icons';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    cedula: '',
    nombres: '',
    apellidos: '',
    correo_electronico: '',
    password: '',
    password_confirmacion: '',
    rol: 'ESTUDIANTE',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validaciones
    if (formData.password !== formData.password_confirmacion) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (!/^\d{10}$/.test(formData.cedula)) {
      setError('La cédula debe tener 10 dígitos');
      return;
    }

    setLoading(true);

    try {
      console.log('Datos enviados al registro:', formData); // Para depuración
      const response = await register(formData);
      console.log('Respuesta del backend:', response);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      console.error('Error del backend:', err.response?.data || err.message);
      const backendError = err.response?.data;

      // Mostrar el primer mensaje de error que venga del backend
      if (backendError) {
        const firstKey = Object.keys(backendError)[0];
        setError(`${firstKey}: ${backendError[firstKey]}`);
      } else {
        setError('Error al registrar usuario');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center bg-light py-5">
      <Container>
        <Row className="justify-content-center">
          <Col md={8} lg={7}>
            <Card className="shadow-lg border-0">
              <Card.Body className="p-5">
                <div className="text-center mb-4">
                  <div className="bg-success bg-opacity-10 rounded-circle d-inline-flex p-3 mb-3">
                    <PersonPlus size={40} className="text-success" />
                  </div>
                  <h2 className="fw-bold">Crear Cuenta</h2>
                  <p className="text-muted">Complete el formulario para registrarse</p>
                </div>

                {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
                {success && <Alert variant="success">✅ Usuario registrado exitosamente. Redirigiendo al login...</Alert>}

                <Form onSubmit={handleSubmit}>
                  {/* Cédula y rol */}
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Cédula *</Form.Label>
                        <Form.Control type="text" name="cedula" value={formData.cedula} onChange={handleChange} placeholder="1234567890" maxLength="10" required />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Rol *</Form.Label>
                        <Form.Select name="rol" value={formData.rol} onChange={handleChange}>
                          <option value="ESTUDIANTE">Estudiante</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Nombres y apellidos */}
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nombres *</Form.Label>
                        <Form.Control type="text" name="nombres" value={formData.nombres} onChange={handleChange} placeholder="Juan Carlos" required />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Apellidos *</Form.Label>
                        <Form.Control type="text" name="apellidos" value={formData.apellidos} onChange={handleChange} placeholder="Pérez García" required />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Correo */}
                  <Form.Group className="mb-3">
                    <Form.Label>Correo Electrónico *</Form.Label>
                    <Form.Control type="email" name="correo_electronico" value={formData.correo_electronico} onChange={handleChange} placeholder="usuario@ejemplo.com" required />
                  </Form.Group>

                  {/* Password */}
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Contraseña *</Form.Label>
                        <Form.Control type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Mínimo 8 caracteres" minLength="8" required />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Confirmar Contraseña *</Form.Label>
                        <Form.Control type="password" name="password_confirmacion" value={formData.password_confirmacion} onChange={handleChange} placeholder="Repita su contraseña" required />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Form.Group className="mb-4">
                    <Form.Check type="checkbox" label="Acepto los términos y condiciones" required />
                  </Form.Group>

                  <Button type="submit" variant="success" className="w-100 py-2" disabled={loading || success}>
                    {loading ? 'Registrando...' : 'Crear Cuenta'}
                  </Button>
                </Form>

                <hr className="my-4" />
                <p className="text-center text-muted mb-0">
                  ¿Ya tiene una cuenta?{' '}
                  <Link to="/login" className="text-decoration-none fw-bold">Iniciar Sesión</Link>
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default RegisterPage;
