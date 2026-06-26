import { API_BASE } from './config';

function authHeaders(): Record<string,string> {
  if (typeof window === 'undefined') return {};
  const t = window.localStorage.getItem('camlam_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}

export async function uploadGis(form: FormData): Promise<any> {
  const res = await fetch(`${API_BASE}/imports/upload`, { method: 'POST', headers: { ...authHeaders() }, body: form });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}
export async function uploadImages(files: File[]): Promise<{ id: number; url: string }[]> {
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  const res = await fetch(`${API_BASE}/images`, { method: 'POST', headers: { ...authHeaders() }, body: fd });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return (await res.json()).images as { id: number; url: string }[];
}
export const apiBase = API_BASE;
