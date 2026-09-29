import api from './index';
import type { Customer } from '../types';

export async function getCustomers(): Promise<Customer[]> {
  return await api.get('/customers');
}

export async function getCustomer(id: number): Promise<Customer> {
  return await api.get(`/customers/${id}`);
}

export async function createCustomer(params: {
  name: string;
  contact?: string;
  phone?: string;
  remark?: string;
}): Promise<{ id: number }> {
  return await api.post('/customers', params);
}

export async function updateCustomer(id: number, params: Partial<{
  name: string;
  contact: string;
  phone: string;
  remark: string;
}>): Promise<void> {
  await api.put(`/customers/${id}`, params);
}

export async function deleteCustomer(id: number): Promise<void> {
  await api.delete(`/customers/${id}`);
}
