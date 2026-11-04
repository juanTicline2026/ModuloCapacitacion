const express = require('express');
const { read } = require('../utils/jsonStore');

const router = express.Router();
const FILE = 'empleados.json';

// GET /api/empleados - Listar todos los empleados
router.get('/', (req, res) => {
  const empleados = read(FILE, []);
  res.json({ success: true, data: empleados });
});

// GET /api/empleados/:id - Obtener un empleado por ID
router.get('/:id', (req, res) => {
  const empleados = read(FILE, []);
  const empleado = empleados.find((e) => e.id === req.params.id);

  if (!empleado) {
    return res.status(404).json({ success: false, error: 'Empleado no encontrado' });
  }

  res.json({ success: true, data: empleado });
});

module.exports = router;
