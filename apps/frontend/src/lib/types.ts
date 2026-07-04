export type PropertyType = 'land' | 'house' | 'apartment' | 'villa' | 'commercial' | 'farm' | 'room' | 'office' | 'warehouse';
export type DealType = 'sale' | 'rent';
export interface Listing {
  id: number; title: string; description: string | null; price: number; area: number | null;
  propertyType: PropertyType; deal?: DealType; address: string | null; ward: string | null; bedrooms: number | null;
  bathrooms?: number | null; direction?: string | null; legal?: string | null; frontage?: number | null;
  contactName?: string | null; contactPhone?: string | null; boosted?: boolean; tier?: string; bumpedAt?: string | null; createdBy?: number | null;
  leadCount?: number; leadViews?: number; views?: number; posterAvatar?: string | null;
  status: string; images: string[]; lng: number; lat: number; createdAt: string;
}
export interface GisLayer {
  id: number; name: string; slug: string; layerType: 'parcel'|'zoning'|'admin'|'road'|'custom';
  geometryType: string | null; featureCount: number; status: string; visible: boolean;
  style: Record<string, any>;
}
export interface ImportJob {
  id: number; originalFilename: string|null; sourceFormat: string|null; layerName: string|null;
  layerType: string; status: string; log: string; featureCount: number|null; createdAt: string; updatedAt: string;
}
export const PROPERTY_LABELS: Record<PropertyType,string> = {
  land:'Đất nền', house:'Nhà phố', apartment:'Căn hộ', villa:'Biệt thự', commercial:'Mặt bằng KD', farm:'Đất nông nghiệp',
  room:'Phòng trọ', office:'Văn phòng', warehouse:'Kho / Xưởng',
};
// Loại BĐS theo nhu cầu — form đăng tin đổi danh sách theo Bán / Cho thuê.
export const SALE_PROPERTY_TYPES: PropertyType[] = ['land', 'house', 'apartment', 'villa', 'commercial', 'farm'];
export const RENT_PROPERTY_TYPES: PropertyType[] = ['house', 'apartment', 'room', 'commercial', 'office', 'warehouse'];
export const DEAL_LABELS: Record<DealType, string> = { sale: 'Bán', rent: 'Cho thuê' };
export function formatVnd(v: number): string {
  if (v >= 1e9) return `${(v/1e9).toFixed(v%1e9===0?0:2)} tỷ`;
  if (v >= 1e6) return `${(v/1e6).toFixed(0)} triệu`;
  return new Intl.NumberFormat('vi-VN').format(v) + ' đ';
}
/** Giá kèm hậu tố /tháng khi là tin cho thuê. */
export function priceLabel(price: number, deal?: string): string {
  return formatVnd(price) + (deal === 'rent' ? '/tháng' : '');
}

export const WARDS = ['Cam Đức','Cam Hải Đông','Cam Hải Tây','Cam Thành Bắc','Cam Hòa','Cam Tân','Cam Hiệp Bắc','Cam Hiệp Nam','Cam An Bắc','Cam An Nam','Cam Phước Tây','Sơn Tân','Suối Cát','Suối Tân'];
export const DIRECTIONS = ['Đông','Tây','Nam','Bắc','Đông Bắc','Đông Nam','Tây Bắc','Tây Nam'];
export const LEGAL_OPTIONS = ['Sổ đỏ / Sổ hồng','Sổ hồng riêng','Sổ chung','Hợp đồng mua bán','Đang chờ sổ','Khác'];

export const TIERS = ['normal', 'silver', 'gold', 'diamond'] as const;
export const TIER_LABEL: Record<string, string> = { normal: 'Tin thường', silver: 'VIP Bạc', gold: 'VIP Vàng', diamond: 'VIP Kim Cương' };
export const TIER_BADGE: Record<string, string> = {
  diamond: 'bg-gradient-to-r from-rose-600 to-red-500',
  gold: 'bg-gradient-to-r from-amber-500 to-yellow-500',
  silver: 'bg-gradient-to-r from-slate-400 to-slate-600',
};

export function postedLabel(iso?: string): string {
  if (!iso) return 'Đăng hôm nay';
  const d = new Date(iso); if (isNaN(d.getTime())) return 'Đăng hôm nay';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'Đăng hôm nay';
  if (days === 1) return 'Đăng hôm qua';
  if (days < 7) return `Đăng ${days} ngày trước`;
  if (days < 30) return `Đăng ${Math.floor(days / 7)} tuần trước`;
  if (days < 365) return `Đăng ${Math.floor(days / 30)} tháng trước`;
  return 'Đăng ' + d.toLocaleDateString('vi-VN');
}
