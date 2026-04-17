import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const getSummary = () => api.get('/dashboard/summary').then(r => r.data);

export const getReviews = (params = {}) =>
  api.get('/dashboard/reviews', { params }).then(r => r.data);

export const getAlerts = () => api.get('/dashboard/alerts').then(r => r.data);

export const getAspects = (productId) =>
  api.get(`/dashboard/aspects/${productId}`).then(r => r.data);

export const getAnomalyReport = (productId) =>
  api.get(`/dashboard/anomaly-report/${productId}`).then(r => r.data);

export const ingestCSV = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/ingest/csv', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const ingestJSON = (data) =>
  api.post('/ingest/json', data).then(r => r.data);

export const ingestManual = (review) =>
  api.post('/ingest/manual', review).then(r => r.data);
