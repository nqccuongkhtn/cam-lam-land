// ── Shared types & constants for the Cam Lâm GIS platform ───────────────────

/** Default geographic anchor: Cam Lâm district, Khánh Hòa (WGS84 / EPSG:4326). */
export const CAM_LAM = {
  name: 'Cam Lâm, Khánh Hòa',
  center: { lng: 109.0917, lat: 12.0771 },
  zoom: 12,
  /** [west, south, east, north] */
  bbox: [108.95, 11.95, 109.27, 12.25] as [number, number, number, number],
  srid: 4326,
} as const;

export type Role = 'user' | 'admin' | 'sales';
export type UserTier = 'free' | 'paid';
export type PropertyType = 'land' | 'house' | 'apartment' | 'villa' | 'commercial' | 'farm';
export type ListingStatus = 'active' | 'pending' | 'sold' | 'hidden';
export type LayerType = 'parcel' | 'zoning' | 'admin' | 'road' | 'custom';
export type ImportStatus = 'pending' | 'processing' | 'done' | 'error';
export type SupportedFormat = 'dgn' | 'shp' | 'geojson';

export interface User { id: number; email: string; role: Role; fullName?: string | null; phone?: string | null; tier?: UserTier; status?: string; emailVerified?: boolean; createdAt?: string; }

export interface Listing {
  id: number;
  title: string;
  description: string | null;
  price: number;            // VND
  area: number | null;      // m²
  propertyType: PropertyType;
  address: string | null;
  ward: string | null;
  bedrooms: number | null;
  status: ListingStatus;
  images: string[];
  lng: number;
  lat: number;
  createdAt: string;
}

export interface GisLayer {
  id: number;
  name: string;
  slug: string;
  layerType: LayerType;
  geometryType: string | null;
  sourceFormat: string | null;
  featureCount: number;
  status: 'ready' | 'processing' | 'error';
  visible: boolean;
  style: Record<string, unknown>;
  createdAt: string;
}

export interface ImportJob {
  id: number;
  layerId: number | null;
  originalFilename: string | null;
  sourceFormat: string | null;
  layerName: string | null;
  layerType: string;
  status: ImportStatus;
  log: string;
  featureCount: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Format VND price into a compact Vietnamese label (tỷ / triệu). */
export function formatVnd(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(v % 1e9 === 0 ? 0 : 2)} tỷ`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)} triệu`;
  return new Intl.NumberFormat('vi-VN').format(v) + ' đ';
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  land: 'Đất nền', house: 'Nhà phố', apartment: 'Căn hộ',
  villa: 'Biệt thự', commercial: 'Thương mại', farm: 'Đất nông nghiệp',
};
