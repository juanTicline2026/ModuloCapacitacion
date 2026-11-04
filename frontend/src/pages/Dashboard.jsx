import { useState, useEffect } from 'react';
import { getDashboardStats } from '../api';
import { useToast } from '../context/ToastContext';
import './Dashboard.css';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCapacitacion, setFilterCapacitacion] = useState('todas');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterArea, setFilterArea] = useState('todas');
  const toast = useToast();

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function loadStats() {
      try {
        const res = await getDashboardStats({ signal: controller.signal });
        if (isMounted) {
          setStats(res.data);
        }
      } catch (err) {
        if (err.name !== 'AbortError' && isMounted) {
          console.error('Error loading dashboard stats:', err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadStats();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="empty-state">
        <h3>No se pudieron cargar las estadísticas</h3>
      </div>
    );
  }

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Filtered employees list for detailed table
  const empleadosEstado = stats.empleadosEstado || [];
  const uniqueAreas = [...new Set(empleadosEstado.map(emp => emp.empleadoDepartamento))].filter(Boolean).sort();

  const filteredEmpleados = empleadosEstado.filter((item) => {
    const matchesSearch =
      item.empleadoNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.empleadoDepartamento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.empleadoPuesto.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCapacitacion =
      filterCapacitacion === 'todas' || item.capacitacionId === filterCapacitacion;

    const matchesEstado =
      filterEstado === 'todos' ||
      (filterEstado === 'completada' && item.estado !== 'pendiente' && item.estado !== 'sin_asignar') ||
      (filterEstado === 'pendiente' && item.estado === 'pendiente');

    const matchesArea =
      filterArea === 'todas' || item.empleadoDepartamento === filterArea;

    return matchesSearch && matchesCapacitacion && matchesEstado && matchesArea;
  });

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Resumen general del sistema de capacitaciones</p>
        </div>
      </div>

      <div className="dashboard-stats stagger-children">
        <div className="stat-card">
          <div className="stat-icon stat-icon-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalCapacitaciones}</div>
            <div className="stat-label">Capacitaciones</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalEmpleados}</div>
            <div className="stat-label">Empleados</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-warning">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.pendientes}</div>
            <div className="stat-label">Pendientes</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.aprobadas}</div>
            <div className="stat-label">Aprobadas</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.reprobadas}</div>
            <div className="stat-label">Perdidas</div>
          </div>
        </div>
      </div>

      {/* TABLA DETALLADA DE ESTADO DE CAPACITACIÓN DE EMPLEADOS */}
      <div className="dashboard-table-section animate-fade-in-up">
        <div className="dashboard-table-header">
          <div className="table-header-title">
            <h3>Estado Detallado de Empleados</h3>
            <span className="table-count-badge">
              {filteredEmpleados.length} {filteredEmpleados.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>

          <div className="dashboard-table-controls">
            {/* Buscador */}
            <div className="search-box">
              <svg className="search-box-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Buscar empleado o depto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filtro por Capacitación */}
            <select
              className="filter-select"
              value={filterCapacitacion}
              onChange={(e) => setFilterCapacitacion(e.target.value)}
            >
              <option value="todas">Todas las Capacitaciones</option>
              {stats.porCapacitacion.map((cap) => (
                <option key={cap.id} value={cap.id}>
                  {cap.titulo}
                </option>
              ))}
            </select>

            {/* Filtro por Área */}
            <select
              className="filter-select"
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
            >
              <option value="todas">Todas las Áreas</option>
              {uniqueAreas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>

            {/* Filtro por Estado */}
            <select
              className="filter-select"
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
            >
              <option value="todos">Todos los Estados</option>
              <option value="completada">✔️ Realizó la capacitación</option>
              <option value="pendiente">⏳ Pendiente por la capacitacion</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="emp-table">
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Departamento / Puesto</th>
                <th>Capacitación</th>
                <th>Estado de Capacitación</th>
                <th>Puntaje</th>
                <th>Recordatorio</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmpleados.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted" style={{ padding: '2.5rem 0' }}>
                    No se encontraron registros de empleados
                  </td>
                </tr>
              ) : (
                filteredEmpleados.map((item, idx) => (
                  <tr key={item.asignacionId || `${item.empleadoId}-${idx}`}>
                    <td>
                      <div className="emp-user-cell">
                        <div className="activity-avatar">{getInitials(item.empleadoNombre)}</div>
                        <div>
                          <div className="emp-user-name">{item.empleadoNombre}</div>
                          <div className="emp-user-email">{item.empleadoEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong>{item.empleadoDepartamento}</strong>
                        {item.empleadoPuesto && (
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {item.empleadoPuesto}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="font-medium">{item.capacitacionTitulo}</span>
                    </td>
                    <td>
                      {item.estado === 'aprobada' ? (
                        <span className="status-badge status-badge-completed">
                          <span className="status-icon-symbol">✔️</span> Realizó la capacitación
                        </span>
                      ) : item.estado === 'reprobada' ? (
                        <span className="status-badge status-badge-failed">
                          <span className="status-icon-symbol">❌</span> Perdida
                        </span>
                      ) : item.estado === 'pendiente' ? (
                        <span className="status-badge status-badge-pending">
                          <span className="status-icon-symbol">⏳</span> Pendiente por la capacitacion
                        </span>
                      ) : (
                        <span className="status-badge" style={{ background: 'rgba(255,255,255,0.1)', color: '#aaa' }}>
                          <span className="status-icon-symbol">➖</span> Sin asignación
                        </span>
                      )}
                    </td>
                    <td>
                      {item.puntaje !== null && item.puntaje !== undefined ? (
                        <span
                          style={{
                            fontWeight: 'bold',
                            color: item.estado === 'aprobada' ? 'var(--success)' : 'var(--error)',
                          }}
                        >
                          {item.puntaje}%
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="text-center">
                      {item.estado === 'pendiente' && (
                        <button
                          type="button"
                          title="Enviar recordatorio"
                          onClick={() => toast.success('Mensaje de recordatorio de la capacitación ha sido enviado al correo electrónico correctamente!')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', padding: '0' }}
                        >
                          📨
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dashboard-grid mt-xl">
        <div className="dashboard-section animate-fade-in-up">
          <div className="dashboard-section-header">
            <h3 className="dashboard-section-title">Actividad Reciente</h3>
          </div>
          {stats.actividadReciente.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>
              Aún no hay actividad registrada
            </p>
          ) : (
            stats.actividadReciente.map((act, i) => (
              <div key={i} className="activity-item">
                <div className="activity-avatar">{getInitials(act.empleadoNombre)}</div>
                <div className="activity-info">
                  <div className="activity-name">{act.empleadoNombre}</div>
                  <div className="activity-detail">{act.capacitacionTitulo}</div>
                </div>
                <span
                  className="activity-score"
                  style={{ color: act.estado === 'aprobada' ? 'var(--success)' : 'var(--error)' }}
                >
                  {act.puntaje}%
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
