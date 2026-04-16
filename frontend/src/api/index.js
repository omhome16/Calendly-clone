// frontend/src/api/index.js
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

// ── Event Types ───────────────────────────────────────────────
export const eventTypesApi = {
  list: () => api.get('/api/event-types/').then(r => r.data),
  get: (id) => api.get(`/api/event-types/${id}`).then(r => r.data),
  create: (data) => api.post('/api/event-types/', data).then(r => r.data),
  update: (id, data) => api.patch(`/api/event-types/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/api/event-types/${id}`),
}

// ── Availability ──────────────────────────────────────────────
export const availabilityApi = {
  get: () => api.get('/api/availability/').then(r => r.data),
  getById: (id) => api.get(`/api/availability/all`).then(r => r.data.find(s => s.id === id)),
  getAll: () => api.get('/api/availability/all').then(r => r.data),
  list: () => api.get('/api/availability/all').then(r => r.data),
  create: (data) => api.post('/api/availability/', data).then(r => r.data),
  update: (scheduleId, data) => api.patch(`/api/availability/${scheduleId}`, data).then(r => r.data),
  delete: (scheduleId) => api.delete(`/api/availability/${scheduleId}`),
  createOverride: (scheduleId, data) => api.post(`/api/availability/${scheduleId}/overrides`, data).then(r => r.data),
  listOverrides: (scheduleId) => api.get(`/api/availability/${scheduleId}/overrides`).then(r => r.data),
  deleteOverride: (overrideId) => api.delete(`/api/availability/overrides/${overrideId}`),
  checkConflicts: (scheduleId) => api.get(`/api/availability/${scheduleId}/conflicts`).then(r => r.data),
  checkDateConflicts: (date) => api.post('/api/availability/check-date-conflicts', { date }).then(r => r.data),
}

// ── Bookings ──────────────────────────────────────────────────
export const bookingsApi = {
  list: (filter) => api.get('/api/bookings/', { params: filter ? { filter } : {} }).then(r => r.data),
  get: (id) => api.get(`/api/bookings/${id}`).then(r => r.data),
  create: (slug, data) => api.post(`/api/bookings/${slug}`, data).then(r => r.data),
  cancel: (id, reason) => api.patch(`/api/bookings/${id}/cancel`, { cancel_reason: reason }).then(r => r.data),
  reschedule: (id, newStartTime) => api.patch(`/api/bookings/${id}/reschedule`, { new_start_time: newStartTime }).then(r => r.data),
  getPublicEventType: (slug) => api.get(`/api/bookings/public/${slug}`).then(r => r.data),
  validateToken: (token) => api.get(`/api/bookings/validate-token/${token}`).then(r => r.data),
}

// ── Slots ─────────────────────────────────────────────────────
export const slotsApi = {
  getSlots: (slug, date, tz) => api.get(`/api/slots/${slug}/${date}`, { params: tz ? { tz } : {} }).then(r => r.data),
  getAvailableDays: (slug, year, month, tz) => api.get(`/api/slots/${slug}/available-days/${year}/${month}`, { params: tz ? { tz } : {} }).then(r => r.data),
}

// ── Single Use Links ──────────────────────────────────────────
export const singleUseLinksApi = {
  list: () => api.get('/api/single-use-links/').then(r => r.data),
  create: (eventTypeId) => api.post('/api/single-use-links/', { event_type_id: eventTypeId }).then(r => r.data),
  delete: (id) => api.delete(`/api/single-use-links/${id}`),
}

// ── Holidays ──────────────────────────────────────────────────
export const holidaysApi = {
  get: (countryCode, year) => api.get(`/api/holidays/${countryCode}/${year}`).then(r => r.data),
  getCountries: () => api.get('/api/holidays/countries').then(r => r.data),
}

// ── Notifications ─────────────────────────────────────────────
export const notificationsApi = {
  send: (bookingId, notificationType) => api.post('/api/notifications/send', { booking_id: bookingId, notification_type: notificationType }).then(r => r.data),
}

export default api
