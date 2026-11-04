import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCapacitacion, getEmpleados, createAsignacion } from '../../api';
import { useToast } from '../../context/ToastContext';
import './Capacitaciones.css';

export default function CapacitacionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [cap, setCap] = useState(null);
  const [loading, setLoading] = useState(true);

  // Assignment section state
  const [empleados, setEmpleados] = useState([]);
  const [selectedEmps, setSelectedEmps] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('todas');

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function loadData() {
      try {
        const [capRes, empsRes] = await Promise.all([
          getCapacitacion(id, { signal: controller.signal }),
          getEmpleados({ signal: controller.signal }),
        ]);
        if (!isMounted) return;
        setCap(capRes.data);
        setEmpleados(empsRes.data || []);
      } catch (err) {
        if (err.name !== 'AbortError' && isMounted) {
          toast.error('Error al cargar la capacitación');
          navigate('/capacitaciones');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [id]);

  function toggleEmployee(empId) {
    setSelectedEmps((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  }

  function toggleAllEmployees() {
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

  async function handleAssignSubmit() {
    if (selectedEmps.length === 0) {
      toast.warning('Selecciona al menos un trabajador');
      return;
    }
    setAssigning(true);
    try {
      const res = await createAsignacion({
        empleadoIds: selectedEmps,
        capacitacionId: id,
      });
      toast.success(res.message || 'Capacitación y evaluación asignadas exitosamente');
      navigate('/asignaciones');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAssigning(false);
    }
  }

  const areasDisponibles = Array.from(
    new Set(empleados.map((e) => e.departamento).filter(Boolean))
  );

  const filteredEmployees = empleados.filter((emp) => {
    // Area filter
    if (selectedArea !== 'todas' && emp.departamento !== selectedArea) {
      return false;
    }
    // Search term filter
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

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  if (!cap) return null;

  return (
    <div className="animate-fade-in">
      {/* Back button */}
      <button className="cap-detail-back" onClick={() => navigate('/capacitaciones')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Volver a Capacitaciones
      </button>

      {/* Header Info */}
      <div className="page-header" style={{ marginTop: 'var(--space-sm)' }}>
        <div>
          <h1>{cap.titulo}</h1>
          <p>{cap.descripcion}</p>
        </div>
        <div className="flex gap-sm items-center">
          <span className="badge badge-primary">{cap.categoria}</span>
          <span className="badge badge-neutral">{cap.duracionEstimada} min</span>
          {cap.tieneExamen && (
            <span className="badge badge-success">✓ Evaluación Asociada</span>
          )}
        </div>
      </div>

      {/* Recuadro de Asignación a Trabajadores (Por Área / Por Área para Ciertas Personas) */}
      <div id="recuadro-asignacion-trabajadores" className="assignment-section-box animate-fade-in">
        <div className="assignment-section-header">
          <div className="flex gap-md items-center">
            <div className="stat-icon stat-icon-primary" style={{ width: 44, height: 44 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <polyline points="17 11 19 13 23 9" />
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', margin: 0 }}>👥 Recuadro de Asignación por Área y Personas</h3>
              <p className="text-muted" style={{ fontSize: '0.875rem', margin: 0 }}>
                Asigna la capacitación "{cap.titulo}" a un área completa o filtra un área para seleccionar personas específicas.
              </p>
            </div>
          </div>
          <span className="badge badge-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.875rem' }}>
            {selectedEmps.length} de {empleados.length} seleccionados
          </span>
        </div>

        {/* Selector de Áreas / Departamentos */}
        <div className="asig-area-selector">
          <div className="asig-area-label">
            <span>🏢 Selecciona o Filtra por Área / Departamento:</span>
          </div>
          <div className="asig-area-chips">
            <button
              type="button"
              className={`asig-chip ${selectedArea === 'todas' ? 'active' : ''}`}
              onClick={() => setSelectedArea('todas')}
            >
              🌐 Todas las Áreas ({empleados.length})
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
              Acción para el Área <strong>{selectedArea}</strong>:
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

        {/* Toolbar de búsqueda y selección general */}
        <div className="asig-select-all" style={{ marginTop: 'var(--space-sm)', borderRadius: 'var(--radius-md)' }}>
          <label className="checkbox-item" style={{ padding: 0 }}>
            <input
              type="checkbox"
              checked={selectedEmps.length === empleados.length && empleados.length > 0}
              onChange={toggleAllEmployees}
            />
            <span className="asig-select-all-label">Seleccionar todos los trabajadores de la empresa</span>
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Buscar trabajador o puesto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ maxWidth: '280px', padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }}
          />
        </div>

        {/* Lista Scrollable de Trabajadores */}
        <div className="asig-employee-list-scrollable">
          {filteredEmployees.length === 0 ? (
            <div style={{ padding: 'var(--space-md)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No se encontraron trabajadores para esta área o búsqueda.
            </div>
          ) : (
            filteredEmployees.map((emp) => (
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
            ))
          )}
        </div>

        {/* Action Footer */}
        <div className="flex justify-between items-center" style={{ marginTop: 'var(--space-lg)' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/capacitaciones')}>
            Cancelar
          </button>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleAssignSubmit}
            disabled={assigning || selectedEmps.length === 0}
            style={{ boxShadow: '0 4px 20px var(--primary-glow)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            {assigning ? 'Asignando...' : `Confirmar y Asignar a (${selectedEmps.length}) Trabajadores`}
          </button>
        </div>
      </div>
    </div>
  );
}
