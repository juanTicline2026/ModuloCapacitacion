const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { read, write } = require('../utils/jsonStore');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();
const FILE = 'asignaciones.json';

// GET /api/asignaciones - Listar todas las asignaciones (enriched with names & exam)
router.get('/', (req, res) => {
  let asignaciones = read(FILE, []);
  if (req.query.empleadoId) {
    asignaciones = asignaciones.filter(a => a.empleadoId === req.query.empleadoId);
  }
  const empleados = read('empleados.json', []);
  const capacitaciones = read('capacitaciones.json', []);
  const examenes = read('examenes.json', []);

  const enriched = asignaciones.map((asig) => {
    const empleado = empleados.find((e) => e.id === asig.empleadoId);
    const capacitacion = capacitaciones.find((c) => c.id === asig.capacitacionId);
    const examen = examenes.find((ex) => capacitacion && capacitacion.examenId ? ex.id === capacitacion.examenId : ex.capacitacionId === asig.capacitacionId);

    return {
      ...asig,
      empleadoNombre: empleado ? empleado.nombre : 'Desconocido',
      empleadoEmail: empleado ? empleado.email : '',
      empleadoDepartamento: empleado ? empleado.departamento : '',
      capacitacionTitulo: capacitacion ? capacitacion.titulo : 'Eliminada',
      capacitacionDescripcion: capacitacion ? capacitacion.descripcion : '',
      capacitacionCategoria: capacitacion ? capacitacion.categoria : '',
      capacitacionDuracion: capacitacion ? capacitacion.duracionEstimada : 60,
      tieneExamen: !!examen,
      examen: examen
        ? {
            id: examen.id,
            titulo: examen.titulo,
            tiempoLimite: examen.tiempoLimite,
            aprobacionMinima: examen.aprobacionMinima,
            totalPreguntas: examen.preguntas ? examen.preguntas.length : 0,
          }
        : null,
    };
  });

  res.json({ success: true, data: enriched });
});

// POST /api/asignaciones - Crear asignación(es)
router.post('/', (req, res, next) => {
  const { empleadoIds, capacitacionId } = req.body;

  if (!empleadoIds || !Array.isArray(empleadoIds) || empleadoIds.length === 0) {
    return next(new AppError('Debe seleccionar al menos un empleado'));
  }
  if (!capacitacionId) {
    return next(new AppError('Debe seleccionar una capacitación'));
  }

  // Verify capacitación exists
  const capacitaciones = read('capacitaciones.json', []);
  if (!capacitaciones.find((c) => c.id === capacitacionId)) {
    return next(new AppError('La capacitación no existe', 404));
  }

  // Verify all empleados exist
  const empleados = read('empleados.json', []);
  const invalidIds = empleadoIds.filter((id) => !empleados.find((e) => e.id === id));
  if (invalidIds.length > 0) {
    return next(new AppError(`Empleados no encontrados: ${invalidIds.join(', ')}`, 404));
  }

  const asignaciones = read(FILE, []);
  const nuevas = [];

  for (const empleadoId of empleadoIds) {
    // Skip if already assigned
    const existing = asignaciones.find(
      (a) => a.empleadoId === empleadoId && a.capacitacionId === capacitacionId
    );
    if (existing) continue;

    const nueva = {
      id: uuidv4(),
      empleadoId,
      capacitacionId,
      estado: 'pendiente',
      fechaAsignacion: new Date().toISOString(),
      resultado: null,
    };
    asignaciones.push(nueva);
    nuevas.push(nueva);
  }

  write(FILE, asignaciones);

  res.status(201).json({
    success: true,
    data: nuevas,
    message: `${nuevas.length} asignación(es) creada(s)`,
  });
});

// PUT /api/asignaciones/:id/resultado - Registrar resultado de examen
router.put('/:id/resultado', (req, res, next) => {
  const { respuestas } = req.body;

  if (!respuestas || !Array.isArray(respuestas)) {
    return next(new AppError('Las respuestas son obligatorias'));
  }

  const asignaciones = read(FILE, []);
  const index = asignaciones.findIndex((a) => a.id === req.params.id);

  if (index === -1) {
    return next(new AppError('Asignación no encontrada', 404));
  }

  const asignacion = asignaciones[index];

  // Get the exam for this capacitación
  const examenes = read('examenes.json', []);
  const examen = examenes.find((ex) => ex.capacitacionId === asignacion.capacitacionId);

  if (!examen) {
    return next(new AppError('No hay examen asociado a esta capacitación', 404));
  }

  // Calculate score
  let correctas = 0;
  const detalle = examen.preguntas.map((pregunta, i) => {
    const respuestaUsuario = respuestas[i] !== undefined ? respuestas[i] : -1;
    const esCorrecta = respuestaUsuario === pregunta.respuestaCorrecta;
    if (esCorrecta) correctas++;
    return {
      preguntaId: pregunta.id,
      respuestaUsuario,
      respuestaCorrecta: pregunta.respuestaCorrecta,
      esCorrecta,
    };
  });

  const puntaje = examen.preguntas.length > 0
    ? Math.round((correctas / examen.preguntas.length) * 100)
    : 0;

  const aprobado = puntaje >= examen.aprobacionMinima;

  asignaciones[index] = {
    ...asignacion,
    estado: aprobado ? 'aprobada' : 'reprobada',
    resultado: {
      puntaje,
      correctas,
      totalPreguntas: examen.preguntas.length,
      detalle,
      fechaCompletado: new Date().toISOString(),
    },
  };

  write(FILE, asignaciones);

  res.json({ success: true, data: asignaciones[index] });
});

// DELETE /api/asignaciones/:id - Eliminar asignación
router.delete('/:id', (req, res, next) => {
  const asignaciones = read(FILE, []);
  const index = asignaciones.findIndex((a) => a.id === req.params.id);

  if (index === -1) {
    return next(new AppError('Asignación no encontrada', 404));
  }

  asignaciones.splice(index, 1);
  write(FILE, asignaciones);

  res.json({ success: true, message: 'Asignación eliminada correctamente' });
});

// GET /api/dashboard/stats - Estadísticas del dashboard
router.get('/dashboard/stats', (req, res) => {
  const capacitaciones = read('capacitaciones.json', []);
  const examenes = read('examenes.json', []);
  const empleados = read('empleados.json', []);
  const asignaciones = read(FILE, []);

  const completadas = asignaciones.filter((a) => a.estado !== 'pendiente');
  const aprobadas = asignaciones.filter((a) => a.estado === 'aprobada');
  const reprobadas = asignaciones.filter((a) => a.estado === 'reprobada');
  const pendientes = asignaciones.filter((a) => a.estado === 'pendiente');

  const promedioGeneral = completadas.length > 0
    ? Math.round(
        completadas.reduce((sum, a) => sum + (a.resultado?.puntaje || 0), 0) /
          completadas.length
      )
    : 0;

  // Stats by capacitación
  const porCapacitacion = capacitaciones.map((cap) => {
    const asigs = asignaciones.filter((a) => a.capacitacionId === cap.id);
    const comps = asigs.filter((a) => a.estado !== 'pendiente');
    const aprs = asigs.filter((a) => a.estado === 'aprobada');
    return {
      id: cap.id,
      titulo: cap.titulo,
      totalAsignadas: asigs.length,
      completadas: comps.length,
      aprobadas: aprs.length,
      tasaAprobacion: comps.length > 0 ? Math.round((aprs.length / comps.length) * 100) : 0,
    };
  });

  // Recent activity
  const actividadReciente = asignaciones
    .filter((a) => a.resultado)
    .sort((a, b) => new Date(b.resultado.fechaCompletado) - new Date(a.resultado.fechaCompletado))
    .slice(0, 10)
    .map((a) => {
      const empleado = empleados.find((e) => e.id === a.empleadoId);
      const cap = capacitaciones.find((c) => c.id === a.capacitacionId);
      return {
        empleadoNombre: empleado?.nombre || 'Desconocido',
        capacitacionTitulo: cap?.titulo || 'Eliminada',
        puntaje: a.resultado.puntaje,
        estado: a.estado,
        fecha: a.resultado.fechaCompletado,
      };
    });

  // Estado detallado de capacitaciones por empleado
  const empleadosEstado = [];
  empleados.forEach((emp) => {
    const empAsignaciones = asignaciones.filter((a) => a.empleadoId === emp.id);
    if (empAsignaciones.length === 0) {
      empleadosEstado.push({
        empleadoId: emp.id,
        empleadoNombre: emp.nombre,
        empleadoEmail: emp.email,
        empleadoDepartamento: emp.departamento,
        empleadoPuesto: emp.puesto,
        capacitacionId: null,
        capacitacionTitulo: 'Sin asignación',
        estado: 'sin_asignar',
        completada: false,
        puntaje: null,
        fechaCompletado: null,
      });
    } else {
      empAsignaciones.forEach((asig) => {
        const cap = capacitaciones.find((c) => c.id === asig.capacitacionId);
        empleadosEstado.push({
          asignacionId: asig.id,
          empleadoId: emp.id,
          empleadoNombre: emp.nombre,
          empleadoEmail: emp.email,
          empleadoDepartamento: emp.departamento,
          empleadoPuesto: emp.puesto,
          capacitacionId: asig.capacitacionId,
          capacitacionTitulo: cap ? cap.titulo : 'Eliminada',
          estado: asig.estado,
          completada: asig.estado === 'aprobada',
          puntaje: asig.resultado ? asig.resultado.puntaje : null,
          fechaCompletado: asig.resultado ? asig.resultado.fechaCompletado : null,
        });
      });
    }
  });

  res.json({
    success: true,
    data: {
      totalCapacitaciones: capacitaciones.length,
      totalExamenes: examenes.length,
      totalEmpleados: empleados.length,
      totalAsignaciones: asignaciones.length,
      pendientes: pendientes.length,
      completadas: completadas.length,
      aprobadas: aprobadas.length,
      reprobadas: reprobadas.length,
      promedioGeneral,
      porCapacitacion,
      actividadReciente,
      empleadosEstado,
    },
  });
});

module.exports = router;
