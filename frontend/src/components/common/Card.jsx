
// ============================================
// src/components/common/Card.jsx
// ============================================
import React from 'react';
import { Card as BootstrapCard } from 'react-bootstrap';

const Card = ({ title, subtitle, children, footer, className = '' }) => {
  return (
    <BootstrapCard className={`shadow-sm ${className}`}>
      {(title || subtitle) && (
        <BootstrapCard.Header>
          {title && <h5 className="mb-0">{title}</h5>}
          {subtitle && <small className="text-muted">{subtitle}</small>}
        </BootstrapCard.Header>
      )}
      <BootstrapCard.Body>{children}</BootstrapCard.Body>
      {footer && <BootstrapCard.Footer>{footer}</BootstrapCard.Footer>}
    </BootstrapCard>
  );
};

export default Card;
