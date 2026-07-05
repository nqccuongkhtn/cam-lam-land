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
// Nén ảnh phía client trước khi upload — cách các web lớn hay dùng để GIẢM LƯU LƯỢNG/DUNG LƯỢNG:
//   1) resize về tối đa 1400px  2) chuyển WebP (nhẹ hơn JPEG ~25-35%)  3) hạ chất lượng DẦN tới khi <= ~280KB.
// => DB nhẹ, upload nhanh, tải trang nhẹ. Trình duyệt cũ không hỗ trợ WebP thì tự dùng JPEG. Ảnh nhỏ sẵn giữ nguyên.
async function compressImage(file: File, maxDim = 1400, targetKB = 280): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const dataUrl: string = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(file); });
    const img = new Image(); img.src = dataUrl; await img.decode();
    const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
    const scale = Math.min(1, maxDim / Math.max(w0, h0));
    if (scale === 1 && file.size < 180 * 1024) return file; // đã nhỏ sẵn, nén nữa không lợi
    const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); if (!ctx) return file;
    (ctx as any).imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, w, h);
    const enc = (type: string, q: number) => new Promise<Blob | null>((res) => cv.toBlob((b) => res(b), type, q));
    let type = 'image/webp', q = 0.82;
    let blob = await enc(type, q);
    if (!blob || blob.type !== 'image/webp') { type = 'image/jpeg'; blob = await enc(type, q); } // fallback trình duyệt cũ
    // Giảm chất lượng dần cho tới khi đạt dung lượng mục tiêu (không xuống dưới sàn 0.5 để giữ nét).
    while (blob && blob.size > targetKB * 1024 && q > 0.5) { q = Math.round((q - 0.08) * 100) / 100; blob = (await enc(type, q)) || blob; }
    if (!blob || blob.size >= file.size) return file;
    const ext = type === 'image/webp' ? '.webp' : '.jpg';
    const name = file.name.replace(/\.[^.]+$/, '') + ext;
    return new File([blob], name, { type, lastModified: Date.now() });
  } catch { return file; }
}
export async function uploadImages(files: File[]): Promise<{ id: number; url: string }[]> {
  const fd = new FormData();
  const compressed = await Promise.all(files.map((f) => compressImage(f)));           // ảnh to (~280KB)
  const thumbs = await Promise.all(compressed.map((f) => compressImage(f, 400, 55)));  // ảnh THU NHỎ (~40KB) cho thẻ tin
  compressed.forEach((f) => fd.append('files', f));
  thumbs.forEach((f) => fd.append('thumbs', f));
  const res = await fetch(`${API_BASE}/images`, { method: 'POST', headers: { ...authHeaders() }, body: fd });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return (await res.json()).images as { id: number; url: string }[];
}
/** Đổi URL ảnh gốc → ảnh THU NHỎ (cho thẻ tin/danh sách). URL ngoài (không phải /api/images/) giữ nguyên. */
export function thumbUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return /\/api\/images\/\d+$/.test(url) ? url + '/thumb' : url;
}
export async function ocrImage(blob: Blob): Promise<{ text: string; engine: string }> {
  const fd = new FormData();
  fd.append('file', blob, 'coords.png');
  const res = await fetch(`${API_BASE}/ocr`, { method: 'POST', headers: { ...authHeaders() }, body: fd });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `OCR lỗi (${res.status})`);
  const j = await res.json();
  return { text: j.text || '', engine: j.engine || 'máy chủ' };
}
export const apiBase = API_BASE;
