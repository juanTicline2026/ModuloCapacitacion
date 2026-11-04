const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { read, write } = require('../utils/jsonStore');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();
const FILE = 'capacitaciones.json';

// GET /api/capacitaciones - Listar todas las capacitaciones
router.get('/', (req, res) => {
  const capacitaciones = read(FILE, []);
  const examenes = read('examenes.json', []);

  // Enrich with exam status and details
  const enriched = capacitaciones.map((cap) => {
    const examen = examenes.find((ex) => cap.examenId ? ex.id === cap.examenId : ex.capacitacionId === cap.id);
    return {
      ...cap,
      tieneExamen: !!examen,
      totalPreguntas: examen && examen.preguntas ? examen.preguntas.length : 0,
      examen: examen || null,
    };
  });

  res.json({ success: true, data: enriched });
});

// GET /api/capacitaciones/:id - Obtener una capacitación por ID
router.get('/:id', (req, res, next) => {
  const capacitaciones = read(FILE, []);
  const cap = capacitaciones.find((c) => c.id === req.params.id);

  if (!cap) {
    return next(new AppError('Capacitación no encontrada', 404));
  }

  const examenes = read('examenes.json', []);
  const examen = examenes.find((ex) => cap.examenId ? ex.id === cap.examenId : ex.capacitacionId === cap.id);

  res.json({
    success: true,
    data: { ...cap, tieneExamen: !!examen, examen: examen || null },
  });
});

// POST /api/capacitaciones - Crear una nueva capacitación
router.post('/', (req, res, next) => {
  const { titulo, descripcion, categoria, duracionEstimada, examenId } = req.body;

  if (!titulo || !descripcion || !categoria) {
    return next(new AppError('Título, descripción y categoría son obligatorios'));
  }

  const capacitaciones = read(FILE, []);
  const nueva = {
    id: uuidv4(),
    titulo: titulo.trim(),
    descripcion: descripcion.trim(),
    categoria: categoria.trim(),
    duracionEstimada: parseInt(duracionEstimada) || 60,
    estado: 'activa',
    tieneExamen: !!examenId,
    examenId: examenId || null,
    creadoEn: new Date().toISOString(),
  };

  capacitaciones.push(nueva);
  write(FILE, capacitaciones);

  // No sobrescribimos el capacitacionId en el examen para permitir múltiples vinculaciones
  if (examenId) {
    const examenes = read('examenes.json', []);
    const exIndex = examenes.findIndex((ex) => ex.id === examenId);
    if (exIndex >= 0) {
      nueva.examen = examenes[exIndex];
    }
  }

  res.status(201).json({ success: true, data: nueva });
});

// PUT /api/capacitaciones/:id - Actualizar una capacitación
router.put('/:id', (req, res, next) => {
  const capacitaciones = read(FILE, []);
  const index = capacitaciones.findIndex((c) => c.id === req.params.id);

  if (index === -1) {
    return next(new AppError('Capacitación no encontrada', 404));
  }

  const { titulo, descripcion, categoria, duracionEstimada, estado, examenId } = req.body;

  capacitaciones[index] = {
    ...capacitaciones[index],
    ...(titulo && { titulo: titulo.trim() }),
    ...(descripcion && { descripcion: descripcion.trim() }),
    ...(categoria && { categoria: categoria.trim() }),
    ...(duracionEstimada && { duracionEstimada: parseInt(duracionEstimada) }),
    ...(estado && { estado }),
    actualizadoEn: new Date().toISOString(),
  };

  if (examenId !== undefined) {
    capacitaciones[index].examenId = examenId || null;
    capacitaciones[index].tieneExamen = !!examenId;
  }

  write(FILE, capacitaciones);
  res.json({ success: true, data: capacitaciones[index] });
});

// DELETE /api/capacitaciones/:id - Eliminar una capacitación
router.delete('/:id', (req, res, next) => {
  const capacitaciones = read(FILE, []);
  const index = capacitaciones.findIndex((c) => c.id === req.params.id);

  if (index === -1) {
    return next(new AppError('Capacitación no encontrada', 404));
  }

  // Also remove associated exam and assignments
  const examenes = read('examenes.json', []);
  const asignaciones = read('asignaciones.json', []);

  write('examenes.json', examenes.filter((ex) => ex.capacitacionId !== req.params.id));
  write('asignaciones.json', asignaciones.filter((a) => a.capacitacionId !== req.params.id));

  capacitaciones.splice(index, 1);
  write(FILE, capacitaciones);

  res.json({ success: true, message: 'Capacitación eliminada correctamente' });
});

module.exports = router;
