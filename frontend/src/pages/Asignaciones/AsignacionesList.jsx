import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAsignaciones,
  getCapacitaciones,
  getEmpleados,
  createAsignacion,
  deleteAsignacion,
} from '../../api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/UI/Modal';
import './Asignaciones.css';

const ESTADOS = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'aprobada', label: 'Aprobadas' },
  { key: 'reprobada', label: 'Sigue intentando' },
];

const estadoBadge = {
  pendiente: 'badge-warning',
  aprobada: 'badge-success',
  reprobada: 'badge-error',
};

export default function AsignacionesList() {
  const [asignaciones, setAsignaciones] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuth();

  // Modal data
  const [showModal, setShowModal] = useState(false);
  const [capacitaciones, setCapacitaciones] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [selectedCap, setSelectedCap] = useState('');
  const [selectedEmps, setSelectedEmps] = useState([]);
  const [selectedArea, setSelectedArea] = useState('todas');
  const [searchTerm, setSearchTerm] = useState('');

  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function loadData() {
      try {
        const fetchOptions = { signal: controller.signal };
        if (!isAdmin && user) {
          fetchOptions.empleadoId = user.id; // Send employee ID via query string
        }
        // Construimos el query string manualmente ya que nuestra función request solo toma `options`
        // o si adaptamos `getAsignaciones` podríamos hacerlo más limpio.
        // Asumiendo que `getAsignaciones` no soporta pasar params en `options`, lo más seguro es:
        const queryParams = !isAdmin && user ? `?empleadoId=${user.id}` : '';
        // Pero no podemos cambiar la URL de getAsignaciones fácilmente.
        // Vamos a modificar getAsignaciones en src/api/index.js para que use query parameters.
        // Por ahora, pasamos params en options:
        const res = await getAsignaciones(fetchOptions);
        if (isMounted) {
          setAsignaciones(res.data);
        }
      } catch (err) {
        if (err.name !== 'AbortError' && isMounted) {
          toast.error('Error al cargar asignaciones');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    const params = new URLSearchParams(window.location.search);
    const capIdParam = params.get('capacitacionId');
    if (capIdParam) {
      openModalWithCap(capIdParam, controller.signal, isMounted);
    }

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  async function openModalWithCap(capId, signal, isMounted = true) {
    try {
      const [capsRes, empsRes] = await Promise.all([
        getCapacitaciones(signal ? { signal } : {}),
        getEmpleados(signal ? { signal } : {}),
      ]);
      if (!isMounted) return;
      setCapacitaciones(capsRes.data);
      setEmpleados(empsRes.data);
      setSelectedCap(capId);
      setSelectedEmps([]);
      setSelectedArea('todas');
      setSearchTerm('');
      setShowModal(true);
    } catch (err) {
      if (err.name !== 'AbortError' && isMounted) {
        toast.error('Error al cargar datos');
      }
    }
  }

  async function openModal() {
    try {
      const [capsRes, empsRes] = await Promise.all([getCapacitaciones(), getEmpleados()]);
      setCapacitaciones(capsRes.data);
      setEmpleados(empsRes.data);
      setSelectedCap('');
      setSelectedEmps([]);
      setSelectedArea('todas');
      setSearchTerm('');
      setShowModal(true);
    } catch (err) {
      toast.error('Error al cargar datos');
    }
  }

  function toggleEmployee(id) {
    setSelectedEmps((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    if (selectedEmps.length === empleados.length) {
      setSelectedEmps([]);
    } else {
      setSelectedEmps(empleados.map((e) => e.id));
    }
  }

  function selectEntireArea(areaName) {
    const areaEmpIds = empleados
      .filter((e) => e.departamento === areaName)
      .map((e) => e.id);
    setSelectedEmps((prev) => Array.from(new Set([...prev, ...areaEmpIds])));
    toast.success(`Todos los trabajadores de ${areaName} seleccionados`);
  }

  function deselectEntireArea(areaName) {
    const areaEmpSet = new Set(
      empleados.filter((e) => e.departamento === areaName).map((e) => e.id)
    );
    setSelectedEmps((prev) => prev.filter((id) => !areaEmpSet.has(id)));
    toast.info(`Trabajadores de ${areaName} desmarcados`);
  }

  async function handleAssign() {
    if (!selectedCap) {
      toast.warning('Selecciona una capacitación');
      return;
    }
    if (selectedEmps.length === 0) {
      toast.warning('Selecciona al menos un empleado');
      return;
    }
    try {
      const res = await createAsignacion({
        empleadoIds: selectedEmps,
        capacitacionId: selectedCap,
      });
      toast.success(res.message || 'Asignaciones creadas');
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar esta asignación?')) return;
    try {
      await deleteAsignacion(id);
      toast.success('Asignación eliminada');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const areasDisponibles = Array.from(
    new Set(empleados.map((e) => e.departamento).filter(Boolean))
  );

  const filteredEmployeesModal = empleados.filter((emp) => {
    if (selectedArea !== 'todas' && emp.departamento !== selectedArea) {
      return false;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return (
        emp.nombre.toLowerCase().includes(term) ||
        emp.departamento.toLowerCase().includes(term) ||
        emp.puesto.toLowerCase().includes(term) ||
        emp.email.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const filtered =
    filtro === 'todos'
      ? asignaciones
      : asignaciones.filter((a) => a.estado === filtro);

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Empleado</h1>
          <p>Vista de las capacitaciones y evaluaciones asignadas al empleado</p>
        </div>
        <div className="flex gap-sm items-center">
          <div className="view-mode-toggle">
            <button
              className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('cards')}
              title="Vista de Tarjetas con Examen"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
              Tarjetas
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('table')}
              title="Vista de Tabla"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              Tabla
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="asig-filters">
        {ESTADOS.map((e) => (
          <button
            key={e.key}
            className={`asig-filter-btn ${filtro === e.key ? 'active' : ''}`}
            onClick={() => setFiltro(e.key)}
          >
            {e.label}
            {e.key !== 'todos' && (
              <span style={{ marginLeft: '0.35rem', opacity: 0.7 }}>
                ({asignaciones.filter((a) => a.estado === e.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3>No hay capacitaciones asignadas</h3>
          <p>No tienes capacitaciones o evaluaciones asignadas por el momento.</p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Composite Card View (Capacitación arriba + Examen debajo) */
        <div className="asig-composite-list stagger-children">
          {filtered.map((asig) => (
            <div key={asig.id} className="asig-composite-card animate-fade-in-up">
              {/* Upper Part: Capacitación */}
              <div className="asig-cap-header">
                <div className="flex justify-between items-start gap-md">
                  <div className="flex gap-md items-start" style={{ flex: 1 }}>
                    <div className="cap-card-icon default" style={{ marginTop: '2px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="flex gap-xs items-center" style={{ marginBottom: '4px' }}>
                        <span className="badge badge-primary">{asig.capacitacionCategoria || 'Capacitación'}</span>
                        <span className="badge badge-neutral">{asig.capacitacionDuracion || 60} min</span>
                      </div>
                      <h3 className="composite-cap-title">{asig.capacitacionTitulo}</h3>
                      {asig.capacitacionDescripcion && (
                        <p className="composite-cap-desc">{asig.capacitacionDescripcion}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-xs" style={{ flexShrink: 0 }}>
                    <div className="flex gap-xs items-center">
                      <span className={`badge ${estadoBadge[asig.estado] || 'badge-neutral'}`}>
                        {asig.estado === 'reprobada' ? 'Perdida' : asig.estado}
                      </span>
                      {isAdmin && (
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => handleDelete(asig.id)}
                          title="Eliminar asignación"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <span className="composite-emp-badge">
                      👤 {asig.empleadoNombre} ({asig.empleadoDepartamento})
                    </span>
                  </div>
                </div>
              </div>

              {/* Connection Bar */}
              <div className="asig-exam-connector">
                <div className="connector-line" />
                <span className="connector-badge">📝 Examen Creado y Listo para Realizar</span>
                <div className="connector-line" />
              </div>

              {/* Lower Part: Examen */}
              <div className="asig-exam-body">
                <div className="exam-info-meta">
                  <div>
                    <span className="exam-info-label">Evaluación de Conocimientos</span>
                    <span className="exam-info-val">
                      {asig.examen?.titulo || `Evaluación: ${asig.capacitacionTitulo}`}
                    </span>
                  </div>
                  <div className="exam-info-pills">
                    <span className="exam-pill">⏱️ {asig.examen?.tiempoLimite || 30} min</span>
                    <span className="exam-pill">❓ {asig.examen?.totalPreguntas ?? 0} Preguntas</span>
                    <span className="exam-pill">🎯 {asig.examen?.aprobacionMinima || 70}% Mínimo</span>
                  </div>
                </div>

                {asig.estado === 'pendiente' || asig.estado === 'reprobada' ? (
                  <div className="flex flex-col gap-sm">
                    {asig.estado === 'reprobada' && (
                      <div className="flex gap-md items-center" style={{ marginBottom: '0.5rem' }}>
                        <div className="asig-score-pill">
                          <span className="score-number" style={{ color: 'var(--error)' }}>
                            {asig.examen?.totalPreguntas <= 3 ? asig.resultado?.correctas : `${asig.resultado?.puntaje}%`}
                          </span>
                          <span className="score-label">{asig.examen?.totalPreguntas <= 3 ? 'Aciertos' : 'Último Puntaje'}</span>
                        </div>
                        <span className={`badge ${estadoBadge[asig.estado]}`} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                          ✕ Sigue intentando
                        </span>
                      </div>
                    )}
                    <button
                      className="btn btn-primary btn-lg start-exam-btn"
                      onClick={() => navigate(`/examenes?mode=rendir&asignacionId=${asig.id}`)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      {asig.estado === 'reprobada' ? 'Volver a intentar' : 'Realizar Examen'}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-md items-center">
                    <div className="asig-score-pill">
                      <span className="score-number" style={{ color: 'var(--success)' }}>
                        {asig.examen?.totalPreguntas <= 3 ? asig.resultado?.correctas : `${asig.resultado?.puntaje}%`}
                      </span>
                      <span className="score-label">{asig.examen?.totalPreguntas <= 3 ? 'Aciertos' : 'Puntaje'}</span>
                    </div>
                    <span className={`badge ${estadoBadge[asig.estado]}`} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                      ✓ Aprobado
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="table-container animate-fade-in-up">
          <table className="table">
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Departamento</th>
                <th>Capacitación</th>
                <th>Examen Listo</th>
                <th>Estado</th>
                <th>Puntaje</th>
                <th>Fecha</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((asig) => (
                <tr key={asig.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{asig.empleadoNombre}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {asig.empleadoEmail}
                    </div>
                  </td>
                  <td>{asig.empleadoDepartamento}</td>
                  <td>
                    <span style={{ fontWeight: 500 }}>{asig.capacitacionTitulo}</span>
                  </td>
                  <td>
                    {asig.tieneExamen ? (
                      <span className="badge badge-success">✓ Listo</span>
                    ) : (
                      <span className="badge badge-neutral">Pendiente</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${estadoBadge[asig.estado] || 'badge-neutral'}`}>
                      {asig.estado === 'reprobada' ? 'Sigue intentando' : asig.estado}
                    </span>
                  </td>
                  <td>
                    {asig.resultado ? (
                      <span
                        style={{
                          fontWeight: 700,
                          color: asig.estado === 'aprobada' ? 'var(--success)' : 'var(--error)',
                        }}
                      >
                        {asig.examen?.totalPreguntas <= 3 ? asig.resultado.correctas : `${asig.resultado.puntaje}%`}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {new Date(asig.fechaAsignacion).toLocaleDateString('es-MX')}
                  </td>
                  {isAdmin && (
                    <td>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => handleDelete(asig.id)}
                        title="Eliminar"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal - Nueva Asignación */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nueva Asignación por Área y Personas"
        large
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleAssign}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              Asignar ({selectedEmps.length})
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Selecciona una Capacitación</label>
          <select
            className="form-select"
            value={selectedCap}
            onChange={(e) => setSelectedCap(e.target.value)}
          >
            <option value="">Seleccionar capacitación...</option>
            {capacitaciones.map((cap) => (
              <option key={cap.id} value={cap.id}>
                {cap.titulo} ({cap.categoria}) {cap.tieneExamen ? '✓ Examen Incluido' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Selector de Áreas / Departamentos en Modal */}
        <div className="asig-area-selector">
          <div className="asig-area-label">
            <span>🏢 Asignar por Área / Departamento Completo:</span>
          </div>
          <div className="asig-area-chips">
            <button
              type="button"
              className={`asig-chip ${selectedArea === 'todas' ? 'active' : ''}`}
              onClick={() => setSelectedArea('todas')}
            >
              🌐 Todas ({empleados.length})
            </button>
            {areasDisponibles.map((area) => {
              const empsInArea = empleados.filter((e) => e.departamento === area);
              const selectedInArea = empsInArea.filter((e) => selectedEmps.includes(e.id));
              const isAllSelected = selectedInArea.length === empsInArea.length && empsInArea.length > 0;

              return (
                <button
                  key={area}
                  type="button"
                  className={`asig-chip ${selectedArea === area ? 'active' : ''} ${isAllSelected ? 'area-all-selected' : ''}`}
                  onClick={() => setSelectedArea(area)}
                >
                  🏢 {area} ({selectedInArea.length}/{empsInArea.length})
                </button>
              );
            })}
          </div>
        </div>

        {/* Acciones Rápidas del Área Seleccionada */}
        {selectedArea !== 'todas' && (
          <div className="asig-area-quick-actions flex justify-between items-center gap-md">
            <span className="text-muted" style={{ fontSize: '0.8125rem' }}>
              Acción para <strong>{selectedArea}</strong>:
            </span>
            <div className="flex gap-xs">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => selectEntireArea(selectedArea)}
              >
                ✓ Seleccionar Todo {selectedArea}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => deselectEntireArea(selectedArea)}
                style={{ color: 'var(--error)' }}
              >
                ✕ Desmarcar {selectedArea}
              </button>
            </div>
          </div>
        )}

        <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
          <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-xs)' }}>
            <label className="form-label" style={{ margin: 0 }}>Trabajadores ({selectedEmps.length} seleccionados)</label>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 Buscar trabajador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ maxWidth: '240px', padding: '0.25rem 0.65rem', fontSize: '0.8125rem' }}
            />
          </div>
          <div className="asig-employee-list-scrollable">
            <div className="asig-select-all">
              <label className="checkbox-item" style={{ padding: 0 }}>
                <input
                  type="checkbox"
                  checked={selectedEmps.length === empleados.length && empleados.length > 0}
                  onChange={toggleAll}
                />
                <span className="asig-select-all-label">Seleccionar todos los trabajadores</span>
              </label>
            </div>
            {filteredEmployeesModal.map((emp) => (
              <label key={emp.id} className="checkbox-item employee-row-item">
                <div className="flex gap-sm items-center">
                  <input
                    type="checkbox"
                    checked={selectedEmps.includes(emp.id)}
                    onChange={() => toggleEmployee(emp.id)}
                  />
                  <div className="checkbox-label">
                    <span className="checkbox-label-name">{emp.nombre}</span>
                    <span className="checkbox-label-detail">
                      {emp.email} · {emp.puesto}
                    </span>
                  </div>
                </div>
                <span className="badge badge-neutral">🏢 {emp.departamento}</span>
              </label>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
