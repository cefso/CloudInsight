import api from './index';

export interface CloudAccount {
  id: number;
  name: string;
  access_key_id: string;
  regions: string[] | null;
  resource_types: string[] | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export async function getAccounts(): Promise<CloudAccount[]> {
  const res: any = await api.get('/accounts');
  return res.data;
}

export async function createAccount(params: any): Promise<{ id: number }> {
  const res: any = await api.post('/accounts', params);
  return res.data;
}

export async function updateAccount(id: number, params: any): Promise<void> {
  await api.put(`/accounts/${id}`, params);
}

export async function deleteAccount(id: number): Promise<void> {
  await api.delete(`/accounts/${id}`);
}

export async function testConnection(id: number): Promise<{ success: boolean; message: string }> {
  const res: any = await api.post(`/accounts/${id}/test`);
  return res.data;
}
