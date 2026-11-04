import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

const routeNames = {
  '/': 'Dashboard',
  '/examenes': 'Evaluación',
  '/capacitaciones': 'Capacitación',
  '/asignaciones': 'Empleado',
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const getPageName = () => {
    // Check exact match first
    if (routeNames[location.pathname]) return routeNames[location.pathname];
    // Check partial matches
    for (const [path, name] of Object.entries(routeNames)) {
      if (path !== '/' && location.pathname.startsWith(path)) return name;
    }
    return 'Inicio';
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-breadcrumb">
          <Link to="/" className="header-breadcrumb-link">Inicio</Link>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="header-breadcrumb-current">{getPageName()}</span>
        </div>
      </div>
      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div className="header-date">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span style={{ textTransform: 'capitalize' }}>{dateStr}</span>
        </div>
        
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{user.nombre}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.role === 'admin' ? 'Administrador' : 'Empleado'}</span>
            </div>
            <button 
              className="btn btn-ghost btn-sm btn-icon" 
              onClick={() => {
                logout();
                navigate('/login');
              }}
              title="Cerrar sesión"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
