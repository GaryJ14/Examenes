
// ============================================
// src/components/common/RoleBadge.jsx
// ============================================
import React from 'react';
import { Badge } from 'react-bootstrap';

const RoleBadge = ({ rol }) => {
  const getVariant = () => {
    switch (rol) {
      case 'ADMIN':
        return 'danger';
      case 'DOCENTE':
        return 'primary';
      case 'ESTUDIANTE':
        return 'success';
      default:
        return 'secondary';
    }
  };

  const getLabel = () => {
    switch (rol) {
      case 'ADMIN':
        return 'Administrador';
      case 'DOCENTE':
        return 'Docente';
      case 'ESTUDIANTE':
        return 'Estudiante';
      default:
        return rol;
    }
  };

  return <Badge bg={getVariant()}>{getLabel()}</Badge>;
};

export default RoleBadge;   