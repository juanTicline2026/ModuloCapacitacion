import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import ProtectedRoute from './components/Layout/ProtectedRoute';

import Dashboard from './pages/Dashboard';
import CapacitacionesList from './pages/Capacitaciones/CapacitacionesList';
import CapacitacionDetail from './pages/Capacitaciones/CapacitacionDetail';
import AsignacionesList from './pages/Asignaciones/AsignacionesList';
import ExamenTake from './pages/Examenes/ExamenTake';
import Login from './pages/Login/Login';

function AppLayout() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="app-content">
          <Routes>
            {/* Rutas de Administrador */}
            <Route path="/" element={
              <ProtectedRoute requireAdmin={true}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/capacitaciones" element={
              <ProtectedRoute requireAdmin={true}>
                <CapacitacionesList />
              </ProtectedRoute>
            } />
            <Route path="/capacitaciones/:id" element={
              <ProtectedRoute requireAdmin={true}>
                <CapacitacionDetail />
              </ProtectedRoute>
            } />

            {/* Rutas compartidas (Empleado y Admin) */}
            <Route path="/asignaciones" element={
              <ProtectedRoute>
                <AsignacionesList />
              </ProtectedRoute>
            } />
            <Route path="/examenes" element={
              <ProtectedRoute>
                <ExamenTake />
              </ProtectedRoute>
            } />

            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
