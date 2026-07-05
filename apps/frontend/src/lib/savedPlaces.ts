'use client';
import { api } from './api';

export interface SavedPlace {
  id: number; lng: number; lat: number; x?: number; y?: number;
  note?: string | null; price?: string | null; area?: string | null; images?: string[]; createdAt?: string;
  // chỉ có khi admin xem tất cả:
  userId?: number; ownerName?: string; ownerPhone?: string | null; ownerRole?: string;
}

/** Điểm/sản phẩm đã lưu của CHÍNH mình (cần đăng nhập). */
export async function listMyPlaces(): Promise<SavedPlace[]> {
  return (await api<{ places: SavedPlace[] }>('/saved-places')).places || [];
}
/** ADMIN: tất cả điểm đã lưu của mọi người + tên/SĐT (kho sales + lead khách). */
export async function listAllPlaces(): Promise<SavedPlace[]> {
  return (await api<{ places: SavedPlace[] }>('/saved-places/all')).places || [];
}
export async function addPlace(p: { lng: number; lat: number; x?: number; y?: number; note?: string; price?: string; area?: string; images?: string[] }): Promise<SavedPlace> {
  return (await api<{ place: SavedPlace }>('/saved-places', { method: 'POST', body: JSON.stringify(p) })).place;
}
export async function updatePlace(id: number, patch: { note?: string; price?: string; area?: string }): Promise<void> {
  await api(`/saved-places/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}
export async function removePlace(id: number): Promise<void> {
  await api(`/saved-places/${id}`, { method: 'DELETE' });
}
