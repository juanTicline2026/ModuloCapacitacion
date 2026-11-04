const API_BASE = '/api';

/**
 * Generic fetch wrapper with error handling.
 */
async function request(endpoint, options = {}) {
  const { signal, body, headers, ...restOptions } = options;
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...headers },
    signal,
    ...restOptions,
  };

  if (body && typeof body === 'object') {
    config.body = JSON.stringify(body);
  }

  const res = await fetch(url, config);
  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || 'Error en la solicitud');
  }

  return data;
}

// ==================== AUTH ====================

export async function login(credentials, options) {
  return request('/auth/login', { method: 'POST', body: credentials, ...options });
}

// ==================== CAPACITACIONES ====================

export async function getCapacitaciones(options) {
  return request('/capacitaciones', options);
}

export async function getCapacitacion(id, options) {
  return request(`/capacitaciones/${id}`, options);
}

export async function createCapacitacion(data, options) {
  return request('/capacitaciones', { method: 'POST', body: data, ...options });
}

export async function updateCapacitacion(id, data, options) {
  return request(`/capacitaciones/${id}`, { method: 'PUT', body: data, ...options });
}

export async function deleteCapacitacion(id, options) {
  return request(`/capacitaciones/${id}`, { method: 'DELETE', ...options });
}

// ==================== EXAMENES ====================

export async function getExamenes(options) {
  return request('/examenes', options);
}

export async function getExamenById(id, options) {
  return request(`/examenes/by-id/${id}`, options);
}

export async function getExamen(capacitacionId, options) {
  return request(`/examenes/${capacitacionId}`, options);
}

export async function saveExamen(data, options) {
  return request('/examenes', { method: 'POST', body: data, ...options });
}

export async function updateExamen(id, data, options) {
  return request(`/examenes/${id}`, { method: 'PUT', body: data, ...options });
}

export async function deleteExamen(id, options) {
  return request(`/examenes/${id}`, { method: 'DELETE', ...options });
}

// ==================== EMPLEADOS ====================

export async function getEmpleados(options) {
  return request('/empleados', options);
}

// ==================== ASIGNACIONES ====================

export async function getAsignaciones(options = {}) {
  const { empleadoId, ...restOptions } = options;
  const query = empleadoId ? `?empleadoId=${empleadoId}` : '';
  return request(`/asignaciones${query}`, restOptions);
}

export async function createAsignacion(data, options) {
  return request('/asignaciones', { method: 'POST', body: data, ...options });
}

export async function submitExamenResult(asignacionId, respuestas, options) {
  return request(`/asignaciones/${asignacionId}/resultado`, {
    method: 'PUT',
    body: { respuestas },
    ...options,
  });
}

export async function deleteAsignacion(id, options) {
  return request(`/asignaciones/${id}`, { method: 'DELETE', ...options });
}

// ==================== DASHBOARD ====================

export async function getDashboardStats(options) {
  return request('/asignaciones/dashboard/stats', options);
}
