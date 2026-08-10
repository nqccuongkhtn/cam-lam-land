'use client';
import { api } from './api';

export interface Customer {
  id: number; name?: string | null; phone?: string | null; source?: string | null; note?: string | null;
  createdAt?: string; needCount?: number; interestCount?: number; salesName?: string | null; dealStage?: string | null;
}
export interface Activity { id: number; kind?: string | null; note?: string | null; createdAt?: string; }
export interface Appointment {
  id: number; appointAt?: string; location?: string | null; note?: string | null; status?: string | null;
  smsReminder?: boolean; smsSentAt?: string | null;
  customerId?: number; custName?: string | null; custPhone?: string | null;
  placeId?: number; features?: string | null; parcel?: string | null; sheet?: string | null; salesName?: string | null;
}
export interface CustomerNeed {
  id: number; dealType?: string | null; propType?: string | null; budget?: string | null;
  areaNeed?: string | null; location?: string | null; status?: string | null; note?: string | null; createdAt?: string;
}
export interface Interest {
  id: number; interest?: string | null; dealStatus?: string | null; note?: string | null; followUpAt?: string | null; createdAt?: string;
  customerId?: number; custName?: string | null; custPhone?: string | null;
  placeId?: number; features?: string | null; parcel?: string | null; sheet?: string | null; ward?: string | null;
  price?: string | null; area?: string | null; commission?: string | null; lng?: number; lat?: number; salesName?: string | null;
}
export interface CrmStats {
  byStatus: { status: string; n: number }[];
  customers: number; needs: number; interests: number; closed: number; dueFollow: number;
}
export interface MatchGroup { need: CustomerNeed; places: Interest[]; }

// ---- Khách hàng ----
export async function listCustomers(all = false): Promise<Customer[]> {
  return (await api<{ customers: Customer[] }>(`/crm/customers${all ? '?all=1' : ''}`)).customers || [];
}
export async function getCustomer(id: number): Promise<{ customer: Customer; needs: CustomerNeed[]; interests: Interest[]; activities: Activity[]; appointments: Appointment[] }> {
  return await api(`/crm/customers/${id}`);
}
export async function addActivity(customerId: number, p: { kind?: string; note?: string }): Promise<Activity> {
  return (await api<{ activity: Activity }>(`/crm/customers/${customerId}/activities`, { method: 'POST', body: JSON.stringify(p) })).activity;
}
export async function removeActivity(id: number): Promise<void> {
  await api(`/crm/activities/${id}`, { method: 'DELETE' });
}
export async function updateActivity(id: number, p: { note?: string; kind?: string }): Promise<Activity> {
  return (await api<{ activity: Activity }>(`/crm/activities/${id}`, { method: 'PATCH', body: JSON.stringify(p) })).activity;
}
export async function clearActivities(customerId: number): Promise<void> {
  await api(`/crm/customers/${customerId}/activities`, { method: 'DELETE' });
}
export async function addCustomer(p: { name?: string; phone?: string; source?: string; note?: string }): Promise<Customer> {
  return (await api<{ customer: Customer }>('/crm/customers', { method: 'POST', body: JSON.stringify(p) })).customer;
}
export async function updateCustomer(id: number, p: { name?: string; phone?: string; source?: string; note?: string }): Promise<void> {
  await api(`/crm/customers/${id}`, { method: 'PATCH', body: JSON.stringify(p) });
}
export async function removeCustomer(id: number): Promise<void> {
  await api(`/crm/customers/${id}`, { method: 'DELETE' });
}

// ---- Nhu cầu ----
export async function addNeed(customerId: number, p: Partial<CustomerNeed>): Promise<CustomerNeed> {
  return (await api<{ need: CustomerNeed }>(`/crm/customers/${customerId}/needs`, { method: 'POST', body: JSON.stringify(p) })).need;
}
export async function updateNeed(id: number, p: Partial<CustomerNeed>): Promise<void> {
  await api(`/crm/needs/${id}`, { method: 'PATCH', body: JSON.stringify(p) });
}
export async function removeNeed(id: number): Promise<void> {
  await api(`/crm/needs/${id}`, { method: 'DELETE' });
}

// ---- Quan tâm (tin ↔ khách) ----
export async function listInterests(placeId: number): Promise<Interest[]> {
  return (await api<{ interests: Interest[] }>(`/crm/interests?placeId=${placeId}`)).interests || [];
}
export async function addInterest(p: { placeId: number; customerId?: number; name?: string; phone?: string; interest?: string; dealStatus?: string; note?: string }): Promise<Interest> {
  return (await api<{ interest: Interest }>('/crm/interests', { method: 'POST', body: JSON.stringify(p) })).interest;
}
export async function updateInterest(id: number, p: { interest?: string; dealStatus?: string; note?: string; followUpAt?: string | null }): Promise<void> {
  await api(`/crm/interests/${id}`, { method: 'PATCH', body: JSON.stringify(p) });
}
export async function removeInterest(id: number): Promise<void> {
  await api(`/crm/interests/${id}`, { method: 'DELETE' });
}

// ---- Dashboard / pipeline ----
export async function getStats(all = false): Promise<CrmStats> {
  return await api(`/crm/stats${all ? '?all=1' : ''}`);
}
export async function getBoard(all = false): Promise<Interest[]> {
  return (await api<{ items: Interest[] }>(`/crm/board${all ? '?all=1' : ''}`)).items || [];
}
export async function getMatch(customerId: number): Promise<MatchGroup[]> {
  return (await api<{ matches: MatchGroup[] }>(`/crm/match?customerId=${customerId}`)).matches || [];
}

// ---- Lịch công chứng ----
export async function listAppointments(all = false): Promise<Appointment[]> {
  return (await api<{ appointments: Appointment[] }>(`/crm/appointments${all ? '?all=1' : ''}`)).appointments || [];
}
export async function addAppointment(p: { customerId?: number; placeId?: number; appointAt: string; location?: string; note?: string; status?: string; smsReminder?: boolean }): Promise<Appointment> {
  return (await api<{ appointment: Appointment }>('/crm/appointments', { method: 'POST', body: JSON.stringify(p) })).appointment;
}
export async function updateAppointment(id: number, p: { appointAt?: string; location?: string; note?: string; status?: string; smsReminder?: boolean }): Promise<void> {
  await api(`/crm/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(p) });
}
export async function removeAppointment(id: number): Promise<void> {
  await api(`/crm/appointments/${id}`, { method: 'DELETE' });
}
