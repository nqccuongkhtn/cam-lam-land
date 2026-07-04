import { API_BASE } from './config';
import { getToken } from './token';

function authHeaders(): Record<string,string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Tự thử lại khi máy chủ (gói free) đang "thức dậy": lỗi mạng hoặc 5xx -> gọi lại sau 1–3s.
export async function api<T = any>(path: string, opts: RequestInit = {}, _retry = 0): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(opts.headers || {}) },
    });
  } catch {
    if (_retry < 2) { await wait(1200 * (_retry + 1)); return api(path, opts, _retry + 1); }
    throw new Error('Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.');
  }
  if (res.status >= 500 && _retry < 2) { await wait(1200 * (_retry + 1)); return api(path, opts, _retry + 1); }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Máy chủ đang bận, vui lòng thử lại (mã ${res.status}).`);
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
export async function ocrImage(blob: Blob): Promise<{ text: string; engine: string }> {
  const fd = new FormData();
  fd.append('file', blob, 'coords.png');
  const res = await fetch(`${API_BASE}/ocr`, { method: 'POST', headers: { ...authHeaders() }, body: fd });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `OCR lỗi (${res.status})`);
  const j = await res.json();
  return { text: j.text || '', engine: j.engine || 'máy chủ' };
}
export async function ocrCertInfo(blob: Blob): Promise<{ text: string; engine: string }> {
  const fd = new FormData();
  fd.append('file', blob, 'so-do.jpg');
  const res = await fetch(`${API_BASE}/ocr/info`, { method: 'POST', headers: { ...authHeaders() }, body: fd });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Đọc sổ lỗi (${res.status})`);
  const j = await res.json();
  return { text: j.text || '', engine: j.engine || 'AI' };
}
export const apiBase = API_BASE;
