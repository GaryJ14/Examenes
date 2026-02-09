
// ============================================
// src/components/layout/Sidebar.jsx
// ============================================
import React from 'react';
import { Nav } from 'react-bootstrap';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  HouseFill,
  FileEarmarkText,
  PeopleFill,
  CameraVideo,
  GraphUp,
  PersonCircle,
  GearFill,
} from 'react-bootstrap-icons';

const Sidebar = () => {
  const { user } = useAuth();

  const menuItems = [
    {
      to: '/dashboard',
      icon: HouseFill,
      label: 'Dashboard',
      roles: ['ADMIN', 'DOCENTE', 'ESTUDIANTE'],
    },
    {
      to: '/materias',
      icon: FileEarmarkText,
      label: 'Materias',
      roles: ['ADMIN', 'DOCENTE', 'ESTUDIANTE'],
    },
    {
      to: '/usuarios',
      icon: PeopleFill,
      label: 'Usuarios',
      roles: ['ADMIN', 'DOCENTE'],
    },
    {
      to: '/monitoreo/demo',
      icon: CameraVideo,
      label: 'Monitoreo',
      roles: ['ADMIN', 'DOCENTE'],
    },
    {
      to: '/reportes',
      icon: GraphUp,
      label: 'Reportes',
      roles: ['ADMIN', 'DOCENTE'],
    },
    {
      to: '/mi-perfil',
      icon: PersonCircle,
      label: 'Mi Perfil',
      roles: ['ADMIN', 'DOCENTE', 'ESTUDIANTE'],
    },
  ];

  const filteredItems = menuItems.filter((item) =>
    item.roles.includes(user?.rol)
  );

  return (
    <div
      className="bg-dark text-white d-flex flex-column"
      style={{ width: '250px', minHeight: '100vh' }}
    >
      <div className="p-3 border-bottom border-secondary">
        <h5 className="mb-0">Menú</h5>
      </div>

      <Nav className="flex-column flex-grow-1 p-2">
        {filteredItems.map((item) => (
          <Nav.Link
            key={item.to}
            as={NavLink}
            to={item.to}
            className={({ isActive }) =>
              `text-white rounded mb-1 d-flex align-items-center ${
                isActive ? 'bg-primary' : ''
              }`
            }
          >
            <item.icon className="me-3" size={20} />
            {item.label}
          </Nav.Link>
        ))}
      </Nav>

      {user?.rol === 'ADMIN' && (
        <div className="p-3 border-top border-secondary">
          <Nav.Link
            as={NavLink}
            to="/configuracion"
            className="text-white rounded d-flex align-items-center"
          >
            <GearFill className="me-3" size={20} />
            Configuración
          </Nav.Link>
        </div>
      )}
    </div>
  );
};

export default Sidebar;

