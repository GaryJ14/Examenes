// src/pages/users/UserListPage.jsx
import React, { useEffect, useState } from 'react';
import { 
  Container, Card, Button, Badge, Form, Row, Col, 
  Modal, Alert, Spinner 
} from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import userService from '../../services/userService';
import SearchBar from '../../components/common/SearchBar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import RoleBadge from '../../components/common/RoleBadge';
import { 
  PersonPlus, Pencil, XCircle, 
  CheckCircle, ExclamationTriangle 
} from 'react-bootstrap-icons';
import { toast } from 'react-toastify';

const UserListPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRol, setFilterRol] = useState('');
  
  // Estados para modales
  const [showEditModal, setShowEditModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await userService.getUsers();
      setUsers(data.usuarios || data.results || []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (user) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleToggleClick = (user) => {
    setSelectedUser(user);
    setShowToggleModal(true);
  };

  const handleEditSuccess = () => {
    loadUsers();
    toast.success('Usuario actualizado correctamente');
  };

  const handleToggleSuccess = () => {
    loadUsers();
    const action = selectedUser.is_active ? 'desactivado' : 'activado';
    toast.success(`Usuario ${action} correctamente`);
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.nombre_completo?.toLowerCase().includes(search.toLowerCase()) ||
      user.correo_electronico?.toLowerCase().includes(search.toLowerCase()) ||
      user.cedula?.includes(search);
    const matchesRol = !filterRol || user.rol === filterRol;
    return matchesSearch && matchesRol;
  });

  if (loading) {
    return <LoadingSpinner message="Cargando usuarios..." />;
  }

  return (
    <Container fluid className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-0">Gestión de Usuarios</h2>
          <p className="text-muted">Administre todos los usuarios del sistema</p>
        </div>
        {currentUser?.rol === 'ADMIN' && (
          <Button as={Link} to="/register" variant="primary">
            <PersonPlus className="me-2" />
            Nuevo Usuario
          </Button>
        )}
      </div>

      <Card className="shadow-sm mb-4">
        <Card.Body>
          <Row className="g-3">
            <Col md={6}>
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Buscar por nombre, cédula o correo..."
              />
            </Col>
            <Col md={3}>
              <Form.Select
                value={filterRol}
                onChange={(e) => setFilterRol(e.target.value)}
              >
                <option value="">Todos los roles</option>
                <option value="ADMIN">Administrador</option>
                <option value="DOCENTE">Docente</option>
                <option value="ESTUDIANTE">Estudiante</option>
              </Form.Select>
            </Col>
            <Col md={3}>
              <div className="text-muted">Total: {filteredUsers.length} usuarios</div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="shadow-sm">
        <Card.Body>
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Usuario</th>
                  <th>Cédula</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id_usuario || user.id}>
                    <td>
                      <strong>{user.nombre_completo}</strong>
                      <div className="small text-muted">{user.correo_electronico}</div>
                    </td>
                    <td>{user.cedula}</td>
                    <td>
                      <RoleBadge rol={user.rol} />
                    </td>
                    <td>
                      <Badge bg={user.is_active ? 'success' : 'danger'}>
                        {user.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td>
                      <div className="d-flex gap-2 justify-content-end">
                        {currentUser?.rol === 'ADMIN' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => handleEditClick(user)}
                              title="Editar usuario"
                            >
                              <Pencil size={16} />
                            </Button>
                            <Button
                              size="sm"
                              variant={user.is_active ? 'outline-danger' : 'outline-success'}
                              onClick={() => handleToggleClick(user)}
                              title={user.is_active ? 'Desactivar' : 'Activar'}
                            >
                              {user.is_active ? (
                                <XCircle size={16} />
                              ) : (
                                <CheckCircle size={16} />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-4 text-muted">
                No se encontraron usuarios
              </div>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* Modal de Edición */}
      {selectedUser && (
        <EditUserModal
          show={showEditModal}
          onHide={() => setShowEditModal(false)}
          user={selectedUser}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Modal de Activar/Desactivar */}
      {selectedUser && (
        <ToggleUserModal
          show={showToggleModal}
          onHide={() => setShowToggleModal(false)}
          user={selectedUser}
          onSuccess={handleToggleSuccess}
        />
      )}
    </Container>
  );
};

// ============================================
// Modal para editar usuario
// ============================================
const EditUserModal = ({ show, onHide, user, onSuccess }) => {
  const [formData, setFormData] = useState({
    nombres: '',
    apellidos: '',
    correo_electronico: '',
    rol: 'ESTUDIANTE',
    password: '',
    password_confirmacion: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        nombres: user.nombres || '',
        apellidos: user.apellidos || '',
        correo_electronico: user.correo_electronico || '',
        rol: user.rol || 'ESTUDIANTE',
        password: '',
        password_confirmacion: ''
      });
      setError(null);
      setSuccess(false);
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.nombres.trim() || !formData.apellidos.trim()) {
      setError('Nombres y apellidos son obligatorios');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.correo_electronico)) {
      setError('Correo electrónico inválido');
      return false;
    }

    if (formData.password || formData.password_confirmacion) {
      if (formData.password !== formData.password_confirmacion) {
        setError('Las contraseñas no coinciden');
        return false;
      }
      if (formData.password.length < 8) {
        setError('La contraseña debe tener al menos 8 caracteres');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    
    
    try {
      
      const userId = user.id_usuario ?? user.id;
      // Solo enviamos password si fue modificada
      const payload = { ...formData };
      if (!formData.password) {
        delete payload.password;
        delete payload.password_confirmacion;
      }
      

      await userService.updateUser(userId, payload);
      setSuccess(true);

      setTimeout(() => {
        if (onSuccess) onSuccess();
        onHide();
      }, 1000);

    } catch (err) {
      
      if (err.response?.data) {
        const messages = Object.entries(err.response.data)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
          .join('\n');
        setError(messages);
      
      } else {
        setError('La contraseña debe tener al menos 8 caracteres y una combinación de letras y números');
       
      }
     
    } finally {
      setLoading(false);
    }

  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <Pencil className="me-2" />
          Editar Usuario
        </Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">Usuario actualizado exitosamente</Alert>}

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Nombres</Form.Label>
                <Form.Control
                  name="nombres"
                  value={formData.nombres}
                  onChange={handleChange}
                  disabled={loading || success}
                  required
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Apellidos</Form.Label>
                <Form.Control
                  name="apellidos"
                  value={formData.apellidos}
                  onChange={handleChange}
                  disabled={loading || success}
                  required
                />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Correo Electrónico</Form.Label>
            <Form.Control
              type="email"
              name="correo_electronico"
              value={formData.correo_electronico}
              onChange={handleChange}
              disabled={loading || success}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Rol</Form.Label>
            <Form.Select
              name="rol"
              value={formData.rol}
              onChange={handleChange}
              disabled={loading || success}
              required
            >
              <option value="ESTUDIANTE">Estudiante</option>
              <option value="DOCENTE">Docente</option>
              <option value="ADMIN">Administrador</option>
            </Form.Select>
          </Form.Group>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Contraseña</Form.Label>
                <Form.Control
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={loading || success}
                  placeholder="Dejar vacío para no cambiar"
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Confirmar Contraseña</Form.Label>
                <Form.Control
                  type="password"
                  name="password_confirmacion"
                  value={formData.password_confirmacion}
                  onChange={handleChange}
                  disabled={loading || success}
                  placeholder="Dejar vacío para no cambiar"
                />
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={loading}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={loading || success}>
            {loading ? 'Actualizando...' : 'Guardar Cambios'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};
// ============================================
// Modal para activar/desactivar usuario
// ============================================

const ToggleUserModal = ({ show, onHide, user, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Determina si estamos activando o desactivando
  const isActivating = !user.is_active;

  // Cierra el modal y resetea errores
  const handleClose = () => {
    setError(null);
    onHide();
  };

  // Confirma la acción (activar/desactivar)
  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      if (isActivating) {
        // Llama al endpoint para activar
        await userService.activateUser(user.id_usuario || user.id);
      } else {
        // Llama al endpoint para desactivar
        await userService.deleteUser(user.id_usuario || user.id);
      }

      // Cierra modal y refresca datos
      handleClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al actualizar estado del usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <ExclamationTriangle className="me-2 text-warning" />
          {isActivating ? 'Activar Usuario' : 'Desactivar Usuario'}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            <XCircle className="me-2" />
            {error}
          </Alert>
        )}

        <div className="mb-3">
          <p className="mb-2">
            {isActivating ? (
              <>¿Está seguro que desea <strong className="text-success">activar</strong> al usuario:</>
            ) : (
              <>¿Está seguro que desea <strong className="text-danger">desactivar</strong> al usuario:</>
            )}
          </p>

          <div className="bg-light rounded p-3">
            <div><strong>{user.nombre_completo}</strong></div>
            <div className="small text-muted">{user.correo_electronico}</div>
            <div className="small text-muted">Cédula: {user.cedula}</div>
          </div>
        </div>

        {isActivating ? (
          <Alert variant="info" className="mb-0">
            <small><strong>Nota:</strong> El usuario podrá acceder nuevamente al sistema.</small>
          </Alert>
        ) : (
          <Alert variant="warning" className="mb-0">
            <small><strong>Advertencia:</strong> El usuario no podrá acceder al sistema hasta que sea reactivado.</small>
          </Alert>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button 
          variant={isActivating ? 'success' : 'danger'}
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <>
              <Spinner as="span" animation="border" size="sm" role="status" className="me-2" />
              Procesando...
            </>
          ) : (
            <>
              {isActivating ? (
                <>
                  <CheckCircle className="me-2" size={16} />
                  Activar Usuario
                </>
              ) : (
                <>
                  <XCircle className="me-2" size={16} />
                  Desactivar Usuario
                </>
              )}
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};


export default UserListPage;