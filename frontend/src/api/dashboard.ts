import api from './index';
import type { DashboardStats } from '../types';

export interface AbnormalResource {
  id: number;
  resource_type: string;
  resource_id: string;
  resource_name: string;
  region: string;
  account_id: number;
  cpu_usage: number | null;
  memory_usage: number | null;
  disk_usage: number | null;
  abnormal_metrics: string[] | null;
}

export async function getDashboardStats(taskId?: number): Promise<DashboardStats> {
  const params: Record<string, number> = {};
  if (taskId) params.task_id = taskId;
  return await api.get('/dashboard/stats', { params });
}

export async function getAbnormalResources(limit = 10, accountId?: number, taskId?: number): Promise<AbnormalResource[]> {
  const params: Record<string, number> = { limit };
  if (accountId) params.account_id = accountId;
  if (taskId) params.task_id = taskId;
  return await api.get('/dashboard/abnormal-resources', { params });
}
