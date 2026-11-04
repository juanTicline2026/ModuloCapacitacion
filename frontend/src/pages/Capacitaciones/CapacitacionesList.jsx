import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getCapacitaciones,
  createCapacitacion,
  updateCapacitacion,
  deleteCapacitacion,
  getExamenes,
  getExamenById,
} from '../../api';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/UI/Modal';
import './Capacitaciones.css';

const CATEGORIAS = ['Seguridad', 'Tecnología', 'Liderazgo', 'Calidad', 'Recursos Humanos', 'Operaciones', 'Otro'];

const emptyForm = {
  titulo: '',
  descripcion: '',
  categoria: 'General',
  duracionEstimada: 60,
  examenId: '',
};

export default function CapacitacionesList() {
  const [capacitaciones, setCapacitaciones] = useState([]);
  const [examenes, setExamenes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedExamObj, setSelectedExamObj] = useState(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const urlExamenId = searchParams.get('examenId');
  const hasPreselectedRef = useRef(false);

  async function loadData(signal) {
    try {
      const [capsRes, examsRes] = await Promise.all([
        getCapacitaciones(signal ? { signal } : {}),
        getExamenes(signal ? { signal } : {}),
      ]);
      setCapacitaciones(capsRes.data || []);
      setExamenes(examsRes.data || []);

      if (urlExamenId && !hasPreselectedRef.current) {
        hasPreselectedRef.current = true;
        handlePreselectExamen(urlExamenId, signal);
      }
    } catch (err) {
      if (!signal?.aborted) {
        toast.error('Error al cargar datos');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [urlExamenId]);

  async function handlePreselectExamen(exId, signal) {
    try {
      const res = await getExamenById(exId, signal ? { signal } : {});
      if (res.data) {
        setSelectedExamObj(res.data);
        setForm({
          titulo: `Capacitación: ${res.data.titulo}`,
          descripcion: `Capacitación correspondiente a la evaluación ${res.data.titulo}`,
          categoria: 'Seguridad',
          duracionEstimada: 60,
          examenId: exId,
        });
        setEditingId(null);
        setShowModal(true);
      }
    } catch (err) {
      if (!signal?.aborted) {
        console.error(err);
      }
    }
  }

  function openCreate() {
    setForm(emptyForm);
    setSelectedExamObj(null);
    setEditingId(null);
    setShowModal(true);
  }

  function openEdit(cap) {
    setForm({
      titulo: cap.titulo,
      descripcion: cap.descripcion,
      categoria: cap.categoria,
      duracionEstimada: cap.duracionEstimada,
      examenId: cap.examen?.id || '',
    });
    setSelectedExamObj(cap.examen || null);
    setEditingId(cap.id);
    setShowModal(true);
  }

  function handleExamChange(exId) {
    const ex = examenes.find((e) => e.id === exId);
    setSelectedExamObj(ex || null);
    setForm((prev) => ({
      ...prev,
      examenId: exId,
      ...(ex && !prev.titulo ? { titulo: `Capacitación: ${ex.titulo}` } : {}),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.titulo || !form.descripcion) {
      toast.warning('Completa todos los campos obligatorios');
      return;
    }
    try {
      if (editingId) {
        await updateCapacitacion(editingId, form);
        toast.success('Capacitación actualizada');
        setShowModal(false);
        loadData();
      } else {
        const res = await createCapacitacion(form);
        toast.success('¡Capacitación creada exitosamente!');
        setShowModal(false);
        loadData();
      }
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Estás seguro de eliminar esta capacitación? Se eliminarán también su examen y asignaciones.')) return;
    try {
      await deleteCapacitacion(id);
      toast.success('Capacitación eliminada');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  }

  function getCategoryIcon(cat) {
    const catLower = (cat || '').toLowerCase();
    let iconClass = 'default';
    if (catLower.includes('seguridad')) iconClass = 'seguridad';
    else if (catLower.includes('tecnolog')) iconClass = 'tecnologia';
    else if (catLower.includes('liderazgo')) iconClass = 'liderazgo';

    return (
      <div className={`cap-card-icon ${iconClass}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </div>
    );
  }

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Capacitación</h1>
          <p>Gestiona las capacitaciones de tu organización y asócialas con evaluaciones</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva Capacitación
        </button>
      </div>

      {capacitaciones.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <h3>No hay capacitaciones creadas</h3>
          <p>Crea una capacitación para asociarla a una evaluación y asignarla a tus trabajadores.</p>
          <button className="btn btn-primary" onClick={openCreate}>
            Crear Capacitación
          </button>
        </div>
      ) : (
        <div className="grid-cards stagger-children">
          {capacitaciones.map((cap) => (
            <div key={cap.id} className="card card-clickable" onClick={() => navigate(`/capacitaciones/${cap.id}`)}>
              <div className="card-header">
                {getCategoryIcon(cap.categoria)}
                <div className="cap-card-actions">
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/capacitaciones/${cap.id}?step=3`);
                    }}
                    title="Asignar Capacitación a Trabajadores"
                    style={{ color: 'var(--primary-light)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <polyline points="17 11 19 13 23 9" />
                    </svg>
                  </button>
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={(e) => { e.stopPropagation(); openEdit(cap); }}
                    title="Editar"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={(e) => { e.stopPropagation(); handleDelete(cap.id); }}
                    title="Eliminar"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
              <h3 className="card-title">{cap.titulo}</h3>
              <p className="card-description">{cap.descripcion}</p>
              <div className="card-footer">

                <div className="flex gap-sm items-center">
                  <span className="card-meta">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {cap.duracionEstimada} min
                  </span>
                  {cap.tieneExamen ? (
                    <span className="badge badge-success">Examen Listo ✓</span>
                  ) : (
                    <span className="badge badge-warning">Sin Examen</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CREAR / EDITAR CAPACITACIÓN */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Editar Capacitación' : 'Crear Nueva Capacitación'}
        large
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {editingId ? 'Guardar Cambios' : 'Crear Capacitación'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600, color: 'var(--primary-light)' }}>
              Selecciona la Evaluación Creada
            </label>
            <select
              className="form-select"
              value={form.examenId}
              onChange={(e) => handleExamChange(e.target.value)}
            >
              <option value="">-- Sin examen o vincular después --</option>
              {examenes.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  📝 {ex.titulo} ({ex.preguntas ? ex.preguntas.length : 0} preguntas)
                </option>
              ))}
            </select>
            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              Si no has creado la evaluación aún, puedes ir al módulo de <strong>Evaluación</strong> primero.
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">Título de la Capacitación *</label>
            <input
              className="form-input"
              type="text"
              placeholder="Ej: Capacitación en Seguridad Industrial Básica"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Descripción *</label>
            <textarea
              className="form-textarea"
              placeholder="Describe los objetivos y contenido de la capacitación..."
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </div>

          <div className="form-group" style={{ display: 'none' }}>
            <input type="hidden" value={form.categoria} />
            <input type="hidden" value={form.duracionEstimada} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
