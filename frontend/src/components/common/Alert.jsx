// src/components/common/Alert.jsx
import React from 'react';
import { Alert as BootstrapAlert } from 'react-bootstrap';

const Alert = ({ variant = 'info', message, onClose, show = true }) => {
  if (!show || !message) return null;

  return (
    <BootstrapAlert variant={variant} dismissible={!!onClose} onClose={onClose}>
      {message}
    </BootstrapAlert>
  );
};

export default Alert;

