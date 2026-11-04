const express = require('express');
const cors = require('cors');
const path = require('path');
const { errorHandler } = require('./middleware/errorHandler');

// Route imports
const capacitacionesRouter = require('./routes/capacitaciones');
const examenesRouter = require('./routes/examenes');
const empleadosRouter = require('./routes/empleados');
const asignacionesRouter = require('./routes/asignaciones');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging (development)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/capacitaciones', capacitacionesRouter);
app.use('/api/examenes', examenesRouter);
app.use('/api/empleados', empleadosRouter);
app.use('/api/asignaciones', asignacionesRouter);
app.use('/api/auth', authRouter);

// Dashboard stats route (handled inside asignaciones for data access convenience)
// Re-export the dashboard endpoint at /api/dashboard/stats
app.get('/api/dashboard/stats', (req, res, next) => {
  // Forward to asignaciones router's dashboard handler
  req.url = '/dashboard/stats';
  asignacionesRouter.handle(req, res, next);
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🚀 Servidor de Capacitaciones corriendo en http://localhost:${PORT}`);
  console.log(`📋 API disponible en http://localhost:${PORT}/api\n`);
});
