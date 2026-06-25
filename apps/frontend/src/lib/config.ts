export const MAP = {
  center: [
    Number(process.env.NEXT_PUBLIC_MAP_CENTER_LNG ?? 109.0917),
    Number(process.env.NEXT_PUBLIC_MAP_CENTER_LAT ?? 12.0771),
  ] as [number, number],
  zoom: Number(process.env.NEXT_PUBLIC_MAP_ZOOM ?? 12),
  region: 'Cam Lâm, Khánh Hòa',
};
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
