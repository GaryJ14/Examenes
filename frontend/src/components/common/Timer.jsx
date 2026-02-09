
// ============================================
// src/components/common/Timer.jsx
// ============================================
import React from 'react';
import { Badge } from 'react-bootstrap';
import { useTimer } from '../../hooks/useTimer';

const Timer = ({ initialSeconds, onTimeUp, variant = 'primary' }) => {
  const { formatTime, seconds } = useTimer(initialSeconds, onTimeUp);

  // Cambiar color cuando quede poco tiempo
  const getVariant = () => {
    if (seconds < 300) return 'danger'; // Menos de 5 minutos
    if (seconds < 600) return 'warning'; // Menos de 10 minutos
    return variant;
  };

  return (
    <Badge bg={getVariant()} className="fs-5 p-2">
      ⏱️ {formatTime()}
    </Badge>
  );
};

export default Timer;

