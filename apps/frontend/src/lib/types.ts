export type PropertyType = 'land' | 'house' | 'apartment' | 'villa' | 'commercial' | 'farm';
export interface Listing {
  id: number; title: string; description: string | null; price: number; area: number | null;
  propertyType: PropertyType; address: string | null; ward: string | null; bedrooms: number | null;
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
  land:'Đất nền', house:'Nhà phố', apartment:'Căn hộ', villa:'Biệt thự', commercial:'Thương mại', farm:'Đất nông nghiệp',
};
export function formatVnd(v: number): string {
  if (v >= 1e9) return `${(v/1e9).toFixed(v%1e9===0?0:2)} tỷ`;
  if (v >= 1e6) return `${(v/1e6).toFixed(0)} triệu`;
  return new Intl.NumberFormat('vi-VN').format(v) + ' đ';
}
