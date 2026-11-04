import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getAsignaciones,
  getExamen,
  getExamenes,
  saveExamen,
  deleteExamen,
  submitExamenResult,
} from '../../api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/UI/Modal';
import './Examenes.css';

const emptyQuestion = () => ({
  id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(36).slice(2),
  texto: '',
  opciones: ['', '', '', ''],
  respuestaCorrecta: 0,
});

export default function ExamenTake() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { user, isAdmin } = useAuth();
  
  // Active tab: 'crear' (Paso 1: Gestionar Evaluaciones) or 'rendir' (Rendir Examen)
  const initialTab = searchParams.get('mode') === 'rendir' || !isAdmin ? 'rendir' : 'crear';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Tab 1: Exámenes creados
  const [examenesList, setExamenesList] = useState([]);
  const [loadingExamenes, setLoadingExamenes] = useState(true);

  // Modal / Editor Examen
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExamId, setEditingExamId] = useState(null);
  const [examTitulo, setExamTitulo] = useState('');
  const [tiempoLimite, setTiempoLimite] = useState(30);
  const [aprobacionMinima, setAprobacionMinima] = useState(70);
  const [preguntas, setPreguntas] = useState([emptyQuestion()]);
  const [saving, setSaving] = useState(false);

  // Tab 2: Rendir examen
  const [asignaciones, setAsignaciones] = useState([]);
  const [loadingAsig, setLoadingAsig] = useState(true);

  // Taking phase
  const [currentAsignacion, setCurrentAsignacion] = useState(null);
  const [examen, setExamen] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState(null);
  const timerRef = useRef(null);
  const answersRef = useRef(answers);
  const currentAsignacionRef = useRef(currentAsignacion);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    currentAsignacionRef.current = currentAsignacion;
  }, [currentAsignacion]);

  const loadExamenesList = useCallback(async (signal) => {
    setLoadingExamenes(true);
    try {
      const res = await getExamenes({ signal });
      setExamenesList(res.data || []);
      return res;
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('Error al cargar la lista de evaluaciones');
      }
      return { data: [] };
    } finally {
      setLoadingExamenes(false);
    }
  }, [toast]);

  const loadAsignacionesList = useCallback(async (signal) => {
    setLoadingAsig(true);
    try {
      const fetchOptions = { signal };
      if (!isAdmin && user) {
        fetchOptions.empleadoId = user.id;
      }
      const res = await getAsignaciones(fetchOptions);
      return res;
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('Error al cargar las asignaciones');
      }
      return { data: [] };
    } finally {
      setLoadingAsig(false);
    }
  }, [isAdmin, user, toast]);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function loadData() {
      setLoadingExamenes(true);
      setLoadingAsig(true);

      try {
        const [examListRes, asigListRes] = await Promise.all([
          isAdmin ? loadExamenesList(controller.signal) : Promise.resolve({ data: [] }),
          loadAsignacionesList(controller.signal),
        ]);

        if (!isMounted) return;

        setExamenesList(examListRes.data || []);
        const pending = (asigListRes.data || []).filter((a) => a.estado === 'pendiente' || a.estado === 'reprobada');
        setAsignaciones(pending);

        const urlAsigId = searchParams.get('asignacionId');
        if (urlAsigId) {
          const targetAsig = (asigListRes.data || []).find((a) => a.id === urlAsigId);
          if (targetAsig) {
            startExam(targetAsig, controller.signal, isMounted);
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError' && isMounted) {
          toast.error('Error al cargar evaluaciones');
        }
      } finally {
        if (isMounted) {
          setLoadingExamenes(false);
          setLoadingAsig(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isAdmin, loadAsignacionesList, loadExamenesList, searchParams, toast]);

  // ---- CREACIÓN Y EDICIÓN DE EXAMEN ----

  function openNewExamModal() {
    setEditingExamId(null);
    setExamTitulo('');
    setTiempoLimite(30);
    setAprobacionMinima(70);
    setPreguntas([emptyQuestion()]);
    setShowExamModal(true);
  }

  function openEditExamModal(ex) {
    setEditingExamId(ex.id);
    setExamTitulo(ex.titulo);
    setTiempoLimite(ex.tiempoLimite || 30);
    setAprobacionMinima(ex.aprobacionMinima || 70);
    setPreguntas(ex.preguntas && ex.preguntas.length > 0 ? ex.preguntas : [emptyQuestion()]);
    setShowExamModal(true);
  }

  function addQuestion() {
    const newQ = emptyQuestion();
    setPreguntas((prev) => [...prev, newQ]);
    setTimeout(() => {
      const el = document.getElementById(`modal-q-input-${newQ.id}`);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 50);
  }

  function removeQuestion(index) {
    if (preguntas.length <= 1) {
      toast.warning('Debe haber al menos una pregunta');
      return;
    }
    setPreguntas((prev) => prev.filter((_, i) => i !== index));
  }

  function updateQuestion(index, field, value) {
    const updated = [...preguntas];
    updated[index] = { ...updated[index], [field]: value };
    setPreguntas(updated);
  }

  function updateOption(qIndex, oIndex, value) {
    const updated = [...preguntas];
    const opciones = [...updated[qIndex].opciones];
    opciones[oIndex] = value;
    updated[qIndex] = { ...updated[qIndex], opciones };
    setPreguntas(updated);
  }

  async function handleSaveExam(proceedToCapacitacion = false) {
    if (!examTitulo.trim()) {
      toast.warning('El título de la evaluación es obligatorio');
      return;
    }

    const cleanedPreguntas = [];

    for (let i = 0; i < preguntas.length; i++) {
      const p = preguntas[i];
      if (!p.texto || !p.texto.trim()) {
        toast.warning(`La pregunta #${i + 1} no tiene enunciado. Por favor complétalo.`);
        const el = document.getElementById(`modal-q-input-${p.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // Filter out empty options
      const validOptions = (p.opciones || []).map((o) => (o ? o.trim() : '')).filter(Boolean);
      if (validOptions.length < 2) {
        toast.warning(`La pregunta #${i + 1} debe tener al menos 2 opciones completadas.`);
        const el = document.getElementById(`modal-q-input-${p.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // Ensure valid respuestaCorrecta index maps to a non-empty option
      let targetCorrectIndex = p.respuestaCorrecta || 0;
      const selectedOptionText = (p.opciones || [])[targetCorrectIndex]?.trim();
      let newCorrectIndex = validOptions.indexOf(selectedOptionText);
      if (newCorrectIndex === -1) {
        newCorrectIndex = 0;
      }

      cleanedPreguntas.push({
        id: p.id,
        texto: p.texto.trim(),
        opciones: validOptions,
        respuestaCorrecta: newCorrectIndex,
      });
    }

    setSaving(true);
    try {
      const res = await saveExamen({
        ...(editingExamId && { id: editingExamId }),
        titulo: examTitulo,
        tiempoLimite,
        aprobacionMinima,
        preguntas: cleanedPreguntas,
      });

      const savedExam = res.data;
      toast.success('¡Evaluación guardada exitosamente!');
      setShowExamModal(false);
      loadExamenesList();

      if (proceedToCapacitacion) {
        navigate(`/capacitaciones?examenId=${savedExam.id}`);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExam(id) {
    if (!window.confirm('¿Estás seguro de eliminar esta evaluación?')) return;
    try {
      await deleteExamen(id);
      toast.success('Evaluación eliminada');
      loadExamenesList();
    } catch (err) {
      toast.error(err.message);
    }
  }

  // ---- RENDIR EXAMEN ----

  async function startExam(asig, signal, isMounted = true) {
    try {
      const res = await getExamen(asig.capacitacionId, signal ? { signal } : {});
      if (!isMounted) return;
      if (!res.data || !res.data.preguntas || res.data.preguntas.length === 0) {
        toast.warning('Esta capacitación aún no tiene un examen configurado');
        return;
      }
      setExamen(res.data);
      setCurrentAsignacion(asig);
      setAnswers(new Array(res.data.preguntas.length).fill(-1));
      setCurrentQuestion(0);
      setTimeLeft(res.data.tiempoLimite * 60);
      setResult(null);
    } catch (err) {
      if (err.name !== 'AbortError' && isMounted) {
        toast.error('Error al cargar el examen');
      }
    }
  }

  const handleTimeUp = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    toast.warning('¡Se acabó el tiempo!');
    if (currentAsignacionRef.current) {
      try {
        const res = await submitExamenResult(
          currentAsignacionRef.current.id,
          answersRef.current
        );
        setResult(res.data);
      } catch (err) {
        toast.error('Error al enviar resultados');
      }
    }
  }, [toast]);

  useEffect(() => {
    if (examen && timeLeft > 0 && !result) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [examen, result, handleTimeUp]);

  function selectAnswer(optionIndex) {
    const updated = [...answers];
    updated[currentQuestion] = optionIndex;
    setAnswers(updated);
  }

  async function finishExam() {
    clearInterval(timerRef.current);
    try {
      const res = await submitExamenResult(currentAsignacion.id, answers);
      setResult(res.data);
    } catch (err) {
      toast.error('Error al enviar resultados');
    }
  }

  function backToList() {
    setExamen(null);
    setCurrentAsignacion(null);
    setResult(null);
    setAnswers([]);
    if (searchParams.get('asignacionId')) {
      navigate('/asignaciones');
    } else {
      loadPendingAsignaciones();
    }
  }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ---- RESULTS VIEW ----
  if (result) {
    const puntaje = result.resultado.puntaje;
    const aprobado = result.estado === 'aprobada';
    const circumference = 2 * Math.PI * 70;
    const offset = circumference - (puntaje / 100) * circumference;

    return (
      <div className="animate-fade-in">
        <div className="results-container">
          <div className="results-score-ring">
            <svg width="180" height="180" viewBox="0 0 180 180">
              <circle className="ring-bg" cx="90" cy="90" r="70" />
              <circle
                className="ring-fill"
                cx="90"
                cy="90"
                r="70"
                stroke={aprobado ? 'var(--success)' : 'var(--error)'}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="results-score-value">
              <span className="results-score-number" style={{ color: aprobado ? 'var(--success)' : 'var(--error)' }}>
                {result.resultado.totalPreguntas <= 3 ? result.resultado.correctas : `${puntaje}%`}
              </span>
              <span className="results-score-label">{result.resultado.totalPreguntas <= 3 ? 'Aciertos' : 'Puntaje'}</span>
            </div>
          </div>

          <h2 className="results-status" style={{ color: aprobado ? 'var(--success)' : 'var(--error)' }}>
            {aprobado ? '🎉 ¡Aprobado!' : '😔 No Aprobado'}
          </h2>
          <p className="results-summary">
            Respondiste correctamente {result.resultado.correctas} de {result.resultado.totalPreguntas} preguntas
          </p>

          <div style={{ marginBottom: 'var(--space-xl)' }}>
            {result.resultado.detalle.map((d, i) => {
              const pregunta = examen.preguntas[i];
              return (
                <div key={i} className={`results-detail-item ${d.esCorrecta ? 'correct' : 'incorrect'}`}>
                  <div className="results-detail-icon">{d.esCorrecta ? '✓' : '✕'}</div>
                  <div className="results-detail-text">
                    <div className="results-detail-question">{pregunta?.texto || `Pregunta ${i+1}`}</div>
                    <div className="results-detail-answer">
                      {d.esCorrecta
                        ? `Correcto: ${pregunta?.opciones[d.respuestaCorrecta]}`
                        : `Tu respuesta: ${d.respuestaUsuario >= 0 ? pregunta?.opciones[d.respuestaUsuario] : 'Sin respuesta'} · Correcta: ${pregunta?.opciones[d.respuestaCorrecta]}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-md justify-center mt-4">
            {!aprobado && (
              <button 
                className="btn btn-secondary btn-lg" 
                onClick={() => startExam(currentAsignacion)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M2.13 15.57a10 10 0 1 0 3.44-8.86L2.5 10"/>
                </svg>
                Volver a intentar
              </button>
            )}
            <button className="btn btn-primary btn-lg" onClick={backToList}>
              Volver a Exámenes Pendientes
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- TAKING EXAM VIEW ----
  if (examen) {
    const pregunta = examen.preguntas[currentQuestion];
    const isLast = currentQuestion === examen.preguntas.length - 1;
    const progress = ((currentQuestion + 1) / examen.preguntas.length) * 100;

    return (
      <div className="animate-fade-in exam-taking">
        <div className="page-header">
          <div>
            <h1>{examen.titulo}</h1>
            <p>Capacitación: {currentAsignacion.capacitacionTitulo}</p>
          </div>
          <div className="exam-timer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {formatTime(timeLeft)}
          </div>
        </div>

        <div className="exam-progress">
          <span className="exam-progress-text">
            {currentQuestion + 1} / {examen.preguntas.length}
          </span>
          <div className="progress-bar-container" style={{ flex: 1 }}>
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="exam-question-card">
          <div className="exam-question-number">Pregunta {currentQuestion + 1}</div>
          <div className="exam-question-text">{pregunta.texto}</div>

          {pregunta.opciones.map((opcion, i) => (
            <div
              key={i}
              className={`exam-option ${answers[currentQuestion] === i ? 'selected' : ''}`}
              onClick={() => selectAnswer(i)}
            >
              <span className="exam-option-marker">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{opcion}</span>
            </div>
          ))}
        </div>

        <div className="exam-nav">
          <button
            className="btn btn-secondary"
            disabled={currentQuestion === 0}
            onClick={() => setCurrentQuestion(currentQuestion - 1)}
          >
            ← Anterior
          </button>

          {isLast ? (
            <button
              className="btn btn-primary btn-lg"
              onClick={finishExam}
              disabled={answers.some((a) => a === -1)}
            >
              Finalizar Examen
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => setCurrentQuestion(currentQuestion + 1)}
            >
              Siguiente →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---- MAIN EVALUACIÓN PAGE (TABS) ----
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Evaluación</h1>
          <p>Diseña y gestiona las evaluaciones con preguntas, o rinde los exámenes pendientes</p>
        </div>
        {isAdmin && activeTab === 'crear' && (
          <button className="btn btn-primary" onClick={openNewExamModal}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Crear Nueva Evaluación
          </button>
        )}
      </div>

      {/* TABS HEADER */}
      {isAdmin && (
        <div className="asig-filters" style={{ marginBottom: 'var(--space-lg)' }}>
          <button
            className={`asig-filter-btn ${activeTab === 'crear' ? 'active' : ''}`}
            onClick={() => setActiveTab('crear')}
          >
            📝 Crear y Gestionar Evaluaciones ({examenesList.length})
          </button>
          <button
            className={`asig-filter-btn ${activeTab === 'rendir' ? 'active' : ''}`}
            onClick={() => setActiveTab('rendir')}
          >
            ✍️ Rendir Exámenes Pendientes ({asignaciones.length})
          </button>
        </div>
      )}

      {/* TAB 1: CREAR Y GESTIONAR EVALUACIONES */}
      {isAdmin && activeTab === 'crear' && (
        <>
          {loadingExamenes ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : examenesList.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <h3>No hay evaluaciones creadas</h3>
              <p>Comienza creando una evaluación con sus preguntas e instrucciones.</p>
              <button className="btn btn-primary" onClick={openNewExamModal}>
                Crear Evaluación
              </button>
            </div>
          ) : (
            <div className="grid-cards stagger-children">
              {examenesList.map((ex) => (
                <div key={ex.id} className="card">
                  <div className="card-header">
                    <div className="cap-card-icon seguridad">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                    </div>
                    <div className="cap-card-actions">
                      <button
                        className="btn btn-ghost btn-icon"
                        onClick={() => openEditExamModal(ex)}
                        title="Editar evaluación"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className="btn btn-ghost btn-icon"
                        onClick={() => handleDeleteExam(ex.id)}
                        title="Eliminar evaluación"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <h3 className="card-title">{ex.titulo}</h3>
                  <div className="exam-info-pills" style={{ marginBottom: 'var(--space-sm)' }}>
                    <span className="exam-pill">⏱️ {ex.tiempoLimite} min</span>
                    <span className="exam-pill">❓ {ex.preguntas ? ex.preguntas.length : 0} Preguntas</span>
                    <span className="exam-pill">🎯 {ex.aprobacionMinima}% Mínimo</span>
                  </div>
                  <div className="card-footer" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 'var(--space-xs)' }}>
                    {ex.vinculado ? (
                      <span className="badge badge-success" style={{ alignSelf: 'flex-start' }}>
                        ✓ Vinculado a: {ex.capacitacionTitulo}
                      </span>
                    ) : (
                      <span className="badge badge-neutral" style={{ alignSelf: 'flex-start' }}>
                        Evaluación Creada
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 2: RENDIR EXÁMENES PENDIENTES */}
      {activeTab === 'rendir' && (
        <>
          {loadingAsig ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : asignaciones.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </div>
              <h3>No hay exámenes pendientes</h3>
              <p>Todas las capacitaciones asignadas han sido completadas o no hay asignaciones activas.</p>
            </div>
          ) : (
            <div className="asig-composite-list stagger-children">
              {asignaciones.map((asig) => (
                <div key={asig.id} className="asig-composite-card animate-fade-in-up">
                  {/* Top Section: Capacitación */}
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
                        <span className="badge badge-warning">Pendiente</span>
                        <span className="composite-emp-badge">👤 {asig.empleadoNombre}</span>
                      </div>
                    </div>
                  </div>

                  {/* Connector */}
                  <div className="asig-exam-connector">
                    <div className="connector-line" />
                    <span className="connector-badge">📝 Examen Asociado y Listo para Realizar</span>
                    <div className="connector-line" />
                  </div>

                  {/* Bottom Section: Examen */}
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
                        <span className="exam-pill">🎯 {asig.examen?.aprobacionMinima || 70}% para Aprobar</span>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-lg start-exam-btn"
                      onClick={() => startExam(asig)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      {asig.estado === 'reprobada' ? 'Volver a intentar' : 'Realizar Examen Ahora'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* MODAL CREAR/EDITAR EXAMEN */}
      <Modal
        isOpen={showExamModal}
        onClose={() => setShowExamModal(false)}
        title={editingExamId ? 'Editar Evaluación' : 'Crear Nueva Evaluación'}
        large
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowExamModal(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleSaveExam(false)}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar Evaluación'}
            </button>
          </>
        }
      >

        <div className="form-group">
          <label className="form-label">Título de la Evaluación *</label>
          <input
            className="form-input"
            type="text"
            placeholder="Ej: Evaluación de Prevención de Riesgos"
            value={examTitulo}
            onChange={(e) => setExamTitulo(e.target.value)}
          />
        </div>

        <div className="exam-settings" style={{ marginBottom: 'var(--space-md)' }}>
          <div className="form-group">
            <label className="form-label">Tiempo límite (minutos)</label>
            <input
              className="form-input"
              type="number"
              min="5"
              max="180"
              value={tiempoLimite}
              onChange={(e) => setTiempoLimite(parseInt(e.target.value) || 30)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Porcentaje mínimo para aprobar (%)</label>
            <input
              className="form-input"
              type="number"
              min="1"
              max="100"
              value={aprobacionMinima}
              onChange={(e) => setAprobacionMinima(parseInt(e.target.value) || 70)}
            />
          </div>
        </div>

        <h4 style={{ marginBottom: 'var(--space-sm)', color: 'var(--primary-light)' }}>
          Preguntas de la Evaluación ({preguntas.length})
        </h4>

        <div className="stagger-children">
          {preguntas.map((pregunta, qIndex) => (
            <div key={pregunta.id} className="question-card" style={{ marginBottom: 'var(--space-md)' }}>
              <div className="question-card-header">
                <span className="question-number">📝 Pregunta #{qIndex + 1}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => removeQuestion(qIndex)}
                  style={{ color: 'var(--error)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Eliminar
                </button>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Enunciado de la Pregunta *
                </label>
                <input
                  id={`modal-q-input-${pregunta.id}`}
                  className="form-input"
                  type="text"
                  placeholder="Ej: ¿Qué se debe hacer en caso de incendio?"
                  value={pregunta.texto}
                  onChange={(e) => updateQuestion(qIndex, 'texto', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Opciones
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    (marca el botón circular de la respuesta correcta)
                  </span>
                </label>
                {pregunta.opciones.map((opcion, oIndex) => (
                  <div key={oIndex} className="option-row">
                    <input
                      type="radio"
                      className="option-radio"
                      name={`modal-q-${pregunta.id}`}
                      checked={pregunta.respuestaCorrecta === oIndex}
                      onChange={() => updateQuestion(qIndex, 'respuestaCorrecta', oIndex)}
                      title="Marcar respuesta correcta"
                    />
                    <input
                      className="form-input option-input"
                      type="text"
                      placeholder={`Opción ${String.fromCharCode(65 + oIndex)}`}
                      value={opcion}
                      onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button type="button" className="btn btn-secondary" onClick={addQuestion} style={{ width: '100%', marginTop: 'var(--space-sm)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          + Agregar Pregunta a la Evaluación
        </button>
      </Modal>
    </div>
  );
}
