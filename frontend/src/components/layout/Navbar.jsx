
// ============================================
// src/components/layout/Navbar.jsx
// ============================================
import React from 'react';
import { Navbar as BootstrapNavbar, Container, Dropdown } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { PersonCircle, BoxArrowRight, GearFill } from 'react-bootstrap-icons';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <BootstrapNavbar bg="white" className="border-bottom shadow-sm">
      <Container fluid>
        <BootstrapNavbar.Brand className="fw-bold">
          Sistema de Monitoreo de Exámenes
        </BootstrapNavbar.Brand>
        
        <div className="d-flex align-items-center">
          <Dropdown align="end">
            <Dropdown.Toggle
              variant="link"
              className="text-decoration-none text-dark d-flex align-items-center"
            >
              <PersonCircle size={24} className="me-2" />
              <div className="text-start">
                <div className="small fw-semibold">{user?.nombre_completo}</div>
                <div className="small text-muted">{user?.rol}</div>
              </div>
            </Dropdown.Toggle>

            <Dropdown.Menu>
              <Dropdown.Item onClick={() => navigate('/perfil')}>
                <PersonCircle className="me-2" />
                Mi Perfil
              </Dropdown.Item>
              <Dropdown.Item onClick={() => navigate('/configuracion')}>
                <GearFill className="me-2" />
                Configuración
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={handleLogout} className="text-danger">
                <BoxArrowRight className="me-2" />
                Cerrar Sesión
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </Container>
    </BootstrapNavbar>
  );
};

export default Navbar;

