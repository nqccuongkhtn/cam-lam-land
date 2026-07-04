'use client';
export interface SavedPlace { id: string; lng: number; lat: number; x: number; y: number; note: string; at: number; }

const KEY = 'camlam_places_v1';

export function getPlaces(): SavedPlace[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function save(list: SavedPlace[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
  window.dispatchEvent(new Event('places-change'));
}
export function addPlace(p: Omit<SavedPlace, 'id' | 'at'>): void {
  save([{ ...p, id: Date.now().toString(36), at: Date.now() }, ...getPlaces()].slice(0, 100));
}
export function updatePlaceNote(id: string, note: string): void {
  save(getPlaces().map((x) => (x.id === id ? { ...x, note } : x)));
}
export function removePlace(id: string): void { save(getPlaces().filter((x) => x.id !== id)); }
