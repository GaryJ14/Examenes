// src/pages/dashboard/DashboardPage.jsx
import { Container } from 'react-bootstrap';
import { useAuth } from '../../hooks/useAuth';
import AdminDashboard from './AdminDashboard';
import DocenteDashboard from './DocenteDashboard';
import EstudianteDashboard from './EstudianteDashboard';

const DashboardPage = () => {
  const { user } = useAuth();

  const renderDashboard = () => {
    switch (user?.rol) {
      case 'ADMIN':
        return <AdminDashboard />;
      case 'DOCENTE':
        return <DocenteDashboard />;
      case 'ESTUDIANTE':
        return <EstudianteDashboard />;
      default:
        return <div>Rol no reconocido</div>;
    }
  };

  return <Container fluid className="py-4">{renderDashboard()}</Container>;
};

export default DashboardPage;

