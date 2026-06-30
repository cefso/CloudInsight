import api from './index';

export interface DashboardStats {
  total_resources: number;
  normal_count: number;
  abnormal_count: number;
  account_count: number;
  last_inspection_time: string | null;
  next_inspection_time: string | null;
}

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
  const res = await api.get('/dashboard/stats');
  return res.data;
}

export async function getAbnormalResources(limit = 10): Promise<AbnormalResource[]> {
  const res = await api.get('/dashboard/abnormal-resources', { params: { limit } });
  return res.data;
}

export async function triggerInspection(): Promise<{ task_id: number }> {
  const res = await api.post('/inspections/trigger', {});
  return res.data;
}
