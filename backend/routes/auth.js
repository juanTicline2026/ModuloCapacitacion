const express = require('express');
const { read } = require('../utils/jsonStore');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Falta correo o contraseña', 400));
  }

  // Admin hardcoded
  if (email === 'admin@empresa.com' && password === '123456') {
    return res.json({
      success: true,
      data: {
        id: 'admin',
        nombre: 'Administrador Principal',
        email: 'admin@empresa.com',
        role: 'admin'
      }
    });
  }

  // Empleado login
  const empleados = read('empleados.json', []);
  const empleado = empleados.find(e => e.email === email);

  if (!empleado) {
    return next(new AppError('Usuario no encontrado', 401));
  }

  // For demonstration, we just require 123456 for any employee
  if (password !== '123456') {
    return next(new AppError('Contraseña incorrecta', 401));
  }

  res.json({
    success: true,
    data: {
      id: empleado.id,
      nombre: empleado.nombre,
      email: empleado.email,
      departamento: empleado.departamento,
      role: 'empleado'
    }
  });
});

module.exports = router;
