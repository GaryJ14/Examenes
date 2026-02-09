// src/pages/auth/LoginPage.jsx
import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Shield, Eye, EyeSlash } from 'react-bootstrap-icons';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    correo_electronico: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  
  const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');
  setLoading(true);

  try {
    const result = await login(
      formData.correo_electronico,
      formData.password
    );

    if (result?.access) {
      navigate('/dashboard');
    }
  } catch (err) {
    const errorMessage =
      err.response?.data?.error ||
      err.response?.data?.detail ||
      'Error al iniciar sesión';

    setError(errorMessage);
  } finally {
    setLoading(false);
  }
};

  

  return (
    <div className="min-vh-100 d-flex align-items-center bg-light">
      <Container>
        <Row className="justify-content-center">
          <Col md={6} lg={5}>
            <Card className="shadow-lg border-0">
              <Card.Body className="p-5">
                <div className="text-center mb-4">
                  <div className="bg-primary bg-opacity-10 rounded-circle d-inline-flex p-3 mb-3">
                    <Shield size={40} className="text-primary" />
                  </div>
                  <h2 className="fw-bold">Iniciar Sesión</h2>
                  <p className="text-muted">
                    Sistema de Monitoreo de Exámenes
                  </p>
                </div>

                {error && (
                  <Alert
                    variant="danger"
                    dismissible
                    onClose={() => setError('')}
                  >
                    {error}
                  </Alert>
                )}

                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>Correo Electrónico</Form.Label>
                    <Form.Control
                      type="email"
                      name="correo_electronico"
                      value={formData.correo_electronico}
                      onChange={handleChange}
                      placeholder="usuario@ejemplo.com"
                      required
                      autoFocus
                    />
                  </Form.Group>

                  <Form.Group className="mb-4">
                    <Form.Label>Contraseña</Form.Label>
                    <div className="position-relative">
                      <Form.Control
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        required
                      />
                      <Button
                        type="button"
                        variant="link"
                        className="position-absolute end-0 top-0 text-muted"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ textDecoration: 'none' }}
                      >
                        {showPassword ? <EyeSlash /> : <Eye />}
                      </Button>
                    </div>
                  </Form.Group>

                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <Form.Check type="checkbox" label="Recordarme" />
                    <Link
                      to="/forgot-password"
                      className="text-decoration-none"
                    >
                      ¿Olvidó su contraseña?
                    </Link>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-100 py-2"
                    disabled={loading}
                  >
                    {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                  </Button>
                </Form>

                <hr className="my-4" />

                <p className="text-center text-muted mb-0">
                  ¿No tiene una cuenta?{' '}
                  <Link to="/register" className="fw-bold text-decoration-none">
                    Registrarse
                  </Link>
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default LoginPage;
