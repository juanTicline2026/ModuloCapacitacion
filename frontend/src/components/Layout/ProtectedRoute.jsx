import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children, requireAdmin }) {
  const { user, isAdmin } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    // If route requires admin and user is not admin, redirect to asignaciones (empleado dashboard)
    return <Navigate to="/asignaciones" replace />;
  }

  return children;
}
