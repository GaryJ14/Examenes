
// ============================================
// src/components/common/LoadingSpinner.jsx
// ============================================
import React from 'react';
import { Spinner } from 'react-bootstrap';

const LoadingSpinner = ({ size = 'md', message = 'Cargando...' }) => {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center p-5">
      <Spinner animation="border" variant="primary" size={size} />
      {message && <p className="mt-3 text-muted">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;

