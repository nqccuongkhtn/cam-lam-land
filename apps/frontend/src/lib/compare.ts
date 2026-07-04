'use client';
import type { Listing } from './types';

const KEY = 'camlam_compare_v1';
export const COMPARE_MAX = 3;

export function getCompare(): Listing[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function save(list: Listing[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
  window.dispatchEvent(new Event('compare-change'));
}
export function inCompare(id: number): boolean { return getCompare().some((x) => x.id === id); }
export function toggleCompare(l: Listing): void {
  const cur = getCompare();
  const i = cur.findIndex((x) => x.id === l.id);
  if (i >= 0) { cur.splice(i, 1); save(cur); return; }
  if (cur.length >= COMPARE_MAX) { alert(`Chỉ so sánh tối đa ${COMPARE_MAX} bất động sản. Hãy bỏ bớt 1 tin trước.`); return; }
  save([...cur, l]);
}
export function removeCompare(id: number): void { save(getCompare().filter((x) => x.id !== id)); }
export function clearCompare(): void { save([]); }
