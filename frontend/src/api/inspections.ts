import api from './index';
import type {
  InspectionTask,
  InspectionResult,
  PaginatedResponse,
  AlertThreshold,
  CronConfig,
} from '../types';

// ========== 巡检任务 ==========

export async function getInspectionTasks(page = 1, pageSize = 20): Promise<PaginatedResponse<InspectionTask>> {
  return await api.get('/inspections/tasks', { params: { page, page_size: pageSize } });
}

export async function getInspectionResults(params: {
  task_id?: number;
  account_id?: number;
  resource_type?: string;
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<PaginatedResponse<InspectionResult>> {
  return await api.get('/inspections/results', { params });
}

export async function exportResults(taskId?: number, format = 'excel'): Promise<Blob> {
  const response = await api.get('/inspections/results/export', {
    params: { task_id: taskId, format },
    responseType: 'blob',
  });
  return response as unknown as Blob;
}

export async function triggerInspection(accountIds?: number[]): Promise<{ task_id: number }> {
  return await api.post('/inspections/trigger', { account_ids: accountIds });
}

// ========== 告警阈值 ==========

export async function getThresholds(): Promise<AlertThreshold[]> {
  return await api.get('/thresholds');
}

export async function updateThreshold(id: number, params: {
  cpu_threshold?: number;
  memory_threshold?: number;
  disk_threshold?: number;
}): Promise<void> {
  await api.put(`/thresholds/${id}`, params);
}

// ========== 定时任务 ==========

export async function getCronConfigs(): Promise<CronConfig[]> {
  return await api.get('/cron');
}

export async function createCronConfig(params: {
  name: string;
  cron_expression: string;
}): Promise<{ id: number }> {
  return await api.post('/cron', params);
}

export async function updateCronConfig(id: number, params: {
  name?: string;
  cron_expression?: string;
  is_enabled?: boolean;
}): Promise<void> {
  await api.put(`/cron/${id}`, params);
}

export async function deleteCronConfig(id: number): Promise<void> {
  await api.delete(`/cron/${id}`);
}
