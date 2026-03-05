import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
});

// Attach JWT to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ld_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
};

// Events
export const eventsAPI = {
  list: () => api.get('/events'),
  get: (id) => api.get(`/events/${id}`),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
  end: (id) => api.post(`/events/${id}/end`),
  reopen: (id) => api.post(`/events/${id}/reopen`),
  qrUrl: (id) => `/api/events/${id}/qr`,
  participants: (id) => api.get(`/events/${id}/participants`),
  winners: (id) => api.get(`/events/${id}/winners`),
  deleteWinner: (eventId, winnerId) => api.delete(`/events/${eventId}/winners/${winnerId}`),
  draw: (id) => api.post(`/events/${id}/draw`),
};

// Sponsors
export const sponsorsAPI = {
  list: (eventId) => api.get(`/events/${eventId}/sponsors`),
  add: (eventId, data) => api.post(`/events/${eventId}/sponsors`, data),
  delete: (eventId, sponsorId) => api.delete(`/events/${eventId}/sponsor/${sponsorId}`),
};

// Prizes
export const prizesAPI = {
  list: (eventId) => api.get(`/events/${eventId}/prizes`),
  add: (eventId, data) => api.post(`/events/${eventId}/prizes`, data),
  delete: (eventId, prizeId) => api.delete(`/events/${eventId}/prize/${prizeId}`),
};

// Participants (public)
export const participantsAPI = {
  register: (data) => api.post('/participants', data),
};

export default api;
