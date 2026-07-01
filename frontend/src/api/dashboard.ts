import api from './index';
import type { DashboardStats } from '../types';

export type { DashboardStats };

export interface AbnormalResource {
  id: number;
  resource_type: string;
  resource_id: string;
  resource_name: string;
  region: string;
  cpu_usage: number | null;
  memory_usage: number | null;
  disk_usage: number | null;
  abnormal_metrics: string[] | null;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return await api.get('/dashboard/stats');
}

export async function getAbnormalResources(limit = 10, accountId?: number): Promise<AbnormalResource[]> {
  const params: any = { limit };
  if (accountId) params.account_id = accountId;
  return await api.get('/dashboard/abnormal-resources', { params });
}
