'use client';
import { api } from './api';

export interface SavedPlace {
  id: number; lng: number; lat: number; x?: number; y?: number;
  note?: string | null; price?: string | null; area?: string | null; images?: string[]; createdAt?: string;
  phone?: string | null;       // SĐT chủ đất
  owner?: string | null;       // tên chủ đất
  commission?: string | null;  // hoa hồng
  custNote?: string | null;    // ghi chú quan tâm của khách
  parcel?: string | null;      // số thửa
  sheet?: string | null;       // số tờ bản đồ
  ward?: string | null;        // xã
  features?: string | null;    // đặc điểm & lưu ý đặc biệt
  custName?: string | null;    // tên khách quan tâm
  custPhone?: string | null;   // SĐT khách quan tâm
  interest?: string | null;    // mức độ quan tâm (Cao/Vừa/Thấp)
  dealStatus?: string | null;  // trạng thái chốt deal
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
export type PlaceInput = {
  lng: number; lat: number; x?: number; y?: number;
  note?: string; price?: string; area?: string; phone?: string; owner?: string; commission?: string;
  custNote?: string; parcel?: string; sheet?: string; ward?: string; features?: string;
  custName?: string; custPhone?: string; interest?: string; dealStatus?: string; images?: string[];
};
export async function addPlace(p: PlaceInput): Promise<SavedPlace> {
  return (await api<{ place: SavedPlace }>('/saved-places', { method: 'POST', body: JSON.stringify(p) })).place;
}
export async function updatePlace(id: number, patch: Partial<PlaceInput>): Promise<void> {
  await api(`/saved-places/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}
export async function removePlace(id: number): Promise<void> {
  await api(`/saved-places/${id}`, { method: 'DELETE' });
}
