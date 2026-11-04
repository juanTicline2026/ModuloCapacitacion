const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { read, write } = require('../utils/jsonStore');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();
const FILE = 'examenes.json';

// GET /api/examenes - Listar todos los exámenes
router.get('/', (req, res) => {
  const examenes = read(FILE, []);
  const capacitaciones = read('capacitaciones.json', []);

  const enriched = examenes.map((ex) => {
    const linkedCaps = capacitaciones.filter((c) => c.examenId ? c.examenId === ex.id : ex.capacitacionId === c.id);
    const isVinculado = linkedCaps.length > 0;
    return {
      ...ex,
      capacitacionTitulo: isVinculado ? (linkedCaps.length > 1 ? `Múltiples Capacitaciones (${linkedCaps.length})` : linkedCaps[0].titulo) : null,
      vinculado: isVinculado,
    };
  });

  res.json({ success: true, data: enriched });
});

// GET /api/examenes/by-id/:id - Obtener un examen por ID de examen
router.get('/by-id/:id', (req, res) => {
  const examenes = read(FILE, []);
  const examen = examenes.find((ex) => ex.id === req.params.id);

  if (!examen) {
    return res.json({ success: true, data: null });
  }

  res.json({ success: true, data: examen });
});

// GET /api/examenes/:capacitacionId - Obtener examen por ID de capacitación
router.get('/:capacitacionId', (req, res) => {
  const examenes = read(FILE, []);
  const capacitaciones = read('capacitaciones.json', []);
  const cap = capacitaciones.find(c => c.id === req.params.capacitacionId);
  
  if (!cap) {
    return res.json({ success: true, data: null });
  }

  const examen = examenes.find((ex) => cap.examenId ? ex.id === cap.examenId : ex.capacitacionId === cap.id);

  if (!examen) {
    return res.json({ success: true, data: null });
  }

  res.json({ success: true, data: examen });
});

// POST /api/examenes - Crear un examen (puede ser antes o después de la capacitación)
router.post('/', (req, res, next) => {
  const { id: customId, capacitacionId, titulo, tiempoLimite, aprobacionMinima, preguntas } = req.body;

  if (!titulo || !titulo.trim()) {
    return next(new AppError('El título del examen es obligatorio'));
  }

  const capacitaciones = read('capacitaciones.json', []);
  const examenes = read(FILE, []);

  // Find existing exam by customId or capacitacionId
  let existingIndex = -1;
  if (customId) {
    existingIndex = examenes.findIndex((ex) => ex.id === customId);
  } else if (capacitacionId) {
    existingIndex = examenes.findIndex((ex) => ex.capacitacionId === capacitacionId);
  }

  const examen = {
    id: existingIndex >= 0 ? examenes[existingIndex].id : (customId || uuidv4()),
    capacitacionId: capacitacionId || (existingIndex >= 0 ? examenes[existingIndex].capacitacionId : null),
    titulo: titulo.trim(),
    tiempoLimite: parseInt(tiempoLimite) || 30,
    aprobacionMinima: parseInt(aprobacionMinima) || 70,
    preguntas: (preguntas || []).map((p) => ({
      id: p.id || uuidv4(),
      texto: p.texto ? p.texto.trim() : '',
      opciones: (p.opciones || []).map((o) => (o ? o.trim() : '')),
      respuestaCorrecta: parseInt(p.respuestaCorrecta) || 0,
    })),
    creadoEn: existingIndex >= 0 ? examenes[existingIndex].creadoEn : new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    examenes[existingIndex] = examen;
  } else {
    examenes.push(examen);
  }

  write(FILE, examenes);

  // Update tieneExamen flag in capacitaciones.json if linked
  if (examen.capacitacionId) {
    const capIndex = capacitaciones.findIndex((c) => c.id === examen.capacitacionId);
    if (capIndex >= 0) {
      capacitaciones[capIndex] = {
        ...capacitaciones[capIndex],
        tieneExamen: true,
        actualizadoEn: new Date().toISOString(),
      };
      write('capacitaciones.json', capacitaciones);
    }
  }

  res.status(existingIndex >= 0 ? 200 : 201).json({ success: true, data: examen });
});

// PUT /api/examenes/:id - Actualizar examen
router.put('/:id', (req, res, next) => {
  const examenes = read(FILE, []);
  const index = examenes.findIndex((ex) => ex.id === req.params.id);

  if (index === -1) {
    return next(new AppError('Examen no encontrado', 404));
  }

  const { titulo, tiempoLimite, aprobacionMinima, preguntas, capacitacionId } = req.body;

  examenes[index] = {
    ...examenes[index],
    ...(titulo && { titulo: titulo.trim() }),
    ...(tiempoLimite && { tiempoLimite: parseInt(tiempoLimite) }),
    ...(aprobacionMinima && { aprobacionMinima: parseInt(aprobacionMinima) }),
    ...(capacitacionId !== undefined && { capacitacionId }),
    ...(preguntas && {
      preguntas: preguntas.map((p) => ({
        id: p.id || uuidv4(),
        texto: p.texto.trim(),
        opciones: p.opciones.map((o) => o.trim()),
        respuestaCorrecta: parseInt(p.respuestaCorrecta),
      })),
    }),
    actualizadoEn: new Date().toISOString(),
  };

  write(FILE, examenes);
  res.json({ success: true, data: examenes[index] });
});

// DELETE /api/examenes/:id - Eliminar examen
router.delete('/:id', (req, res, next) => {
  const examenes = read(FILE, []);
  const index = examenes.findIndex((ex) => ex.id === req.params.id);

  if (index === -1) {
    return next(new AppError('Examen no encontrado', 404));
  }

  examenes.splice(index, 1);
  write(FILE, examenes);

  res.json({ success: true, message: 'Examen eliminado correctamente' });
});

module.exports = router;

