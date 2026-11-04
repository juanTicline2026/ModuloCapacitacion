import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { login as loginApi } from '../../api';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const res = await loginApi({ email, password });
      login(res.data);
      // Admin goes to dashboard, employee goes to asignaciones
      if (res.data.role === 'admin') {
        navigate('/');
      } else {
        navigate('/asignaciones');
      }
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h2>Iniciar Sesión</h2>
          <p>Módulo de Capacitación y Evaluación</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Correo Electrónico</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ej: carlos.mendoza@empresa.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña por defecto: 123456"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Verificando...' : 'Entrar'}
          </button>
        </form>

        <div className="login-footer">
          <p style={{ margin: 0, marginBottom: '8px', fontWeight: 'bold', fontSize: '0.85rem', color: '#666' }}>Credenciales de prueba:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <small style={{ margin: 0 }}><strong>Admin:</strong> admin@empresa.com / 123456</small>
            <small style={{ margin: 0 }}><strong>Empleado:</strong> carlos.mendoza@empresa.com / 123456</small>
          </div>
        </div>
      </div>
    </div>
  );
}
