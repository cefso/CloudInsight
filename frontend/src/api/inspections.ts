import api from './index';

export async function getInspectionTasks(page = 1, pageSize = 20) {
  const res = await api.get('/inspections/tasks', { params: { page, page_size: pageSize } });
  return res.data;
}

export async function getInspectionResults(params: any) {
  const res = await api.get('/inspections/results', { params });
  return res.data;
}

export async function exportResults(taskId?: number, format = 'excel') {
  const res = await api.get('/inspections/results/export', { params: { task_id: taskId, format }, responseType: 'blob' });
  return res.data;
}

export async function getThresholds() {
  const res = await api.get('/thresholds');
  return res.data;
}

export async function updateThreshold(id: number, params: any) {
  await api.put(`/thresholds/${id}`, params);
}

export async function getCronConfigs() {
  const res = await api.get('/cron');
  return res.data;
}

export async function createCronConfig(params: any) {
  const res = await api.post('/cron', params);
  return res.data;
}

export async function updateCronConfig(id: number, params: any) {
  await api.put(`/cron/${id}`, params);
}

export async function deleteCronConfig(id: number) {
  await api.delete(`/cron/${id}`);
}
