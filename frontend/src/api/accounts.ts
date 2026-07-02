import api from './index';
import type { CloudAccount } from '../types';

export async function getAccounts(): Promise<CloudAccount[]> {
  return await api.get('/accounts');
}

export async function createAccount(params: {
  name: string;
  access_key_id: string;
  access_key_secret: string;
  regions?: string[];
  resource_types?: string[];
}): Promise<{ id: number }> {
  return await api.post('/accounts', params);
}

export async function updateAccount(id: number, params: Partial<{
  name: string;
  access_key_id: string;
  access_key_secret: string;
  regions: string[];
  resource_types: string[];
  is_enabled: boolean;
}>): Promise<void> {
  await api.put(`/accounts/${id}`, params);
}

export async function deleteAccount(id: number): Promise<void> {
  await api.delete(`/accounts/${id}`);
}

export async function testConnection(id: number): Promise<{ success: boolean; message: string }> {
  return await api.post(`/accounts/${id}/test`);
}
