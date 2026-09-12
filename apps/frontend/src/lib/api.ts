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
// ĐÓNG DẤU MỜ "Cam Lâm Land" vào GIỮA ảnh — nung thẳng vào ảnh ngay khi upload nên bám theo ảnh ở
// mọi nơi (thẻ tin, xem ảnh lớn, mở URL gốc). Rất mờ để không phá ảnh, đủ để chống lấy ảnh.
function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const text = 'Cam Lâm Land';
  const fs = Math.max(13, Math.round(Math.min(w, h) * 0.075));
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.font = `800 ${fs}px Arial, "Segoe UI", sans-serif`;
  const textW = ctx.measureText(text).width;
  const k = fs / 22;                 // scale để BỀ NGANG ngôi nhà ≈ fs
  const houseW = fs, gap = fs * 0.3;
  const gx = -(houseW + gap + textW) / 2;   // mép trái cụm — LOGO + chữ trên CÙNG 1 HÀNG
  // ── LOGO ngôi nhà (bên trái, căn giữa dọc với chữ) ──
  ctx.save();
  ctx.translate(gx - 11 * k, -22 * k);
  ctx.scale(k, k);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const house = (col: string, lw: number) => {
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(11, 21.5); ctx.lineTo(22, 12); ctx.lineTo(33, 21.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14.2, 20); ctx.lineTo(14.2, 31.4); ctx.lineTo(29.8, 31.4); ctx.lineTo(29.8, 20); ctx.stroke();
    ctx.beginPath(); ctx.arc(22, 25.6, 2.5, 0, Math.PI * 2); ctx.fill();
  };
  house('rgba(0,0,0,0.12)', 4.6);          // viền tối nhạt (đọc được trên nền sáng)
  house('rgba(255,255,255,0.22)', 2.6);    // logo trắng mờ
  ctx.restore();
  // ── CHỮ "Cam Lâm Land" (bên PHẢI logo, cùng hàng) ──
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(1.5, fs * 0.06);
  ctx.strokeStyle = 'rgba(0,0,0,0.11)'; ctx.strokeText(text, gx + houseW + gap, 0);   // viền tối nhạt
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillText(text, gx + houseW + gap, 0);  // chữ trắng RẤT MỜ
  ctx.restore();
}
async function compressImage(file: File, maxDim = 1400, targetKB = 280, watermark = true): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const dataUrl: string = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(file); });
    const img = new Image(); img.src = dataUrl; await img.decode();
    const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
    const scale = Math.min(1, maxDim / Math.max(w0, h0));
    if (!watermark && scale === 1 && file.size < 180 * 1024) return file; // ảnh nhỏ sẵn — chỉ bỏ qua khi KHÔNG cần đóng dấu
    const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); if (!ctx) return file;
    (ctx as any).imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, w, h);
    if (watermark) drawWatermark(ctx, w, h); // nung dấu mờ vào giữa ảnh
    const enc = (type: string, q: number) => new Promise<Blob | null>((res) => cv.toBlob((b) => res(b), type, q));
    let type = 'image/webp', q = 0.82;
    let blob = await enc(type, q);
    if (!blob || blob.type !== 'image/webp') { type = 'image/jpeg'; blob = await enc(type, q); } // fallback trình duyệt cũ
    // Giảm chất lượng dần cho tới khi đạt dung lượng mục tiêu (không xuống dưới sàn 0.5 để giữ nét).
    while (blob && blob.size > targetKB * 1024 && q > 0.5) { q = Math.round((q - 0.08) * 100) / 100; blob = (await enc(type, q)) || blob; }
    if (!blob) return file;
    if (!watermark && blob.size >= file.size) return file; // khi đã đóng dấu thì LUÔN dùng ảnh mới (giữ dấu)
    const ext = type === 'image/webp' ? '.webp' : '.jpg';
    const name = file.name.replace(/\.[^.]+$/, '') + ext;
    return new File([blob], name, { type, lastModified: Date.now() });
  } catch { return file; }
}
export async function uploadImages(files: File[]): Promise<{ id: number; url: string }[]> {
  const fd = new FormData();
  const compressed = await Promise.all(files.map((f) => compressImage(f)));           // ảnh to (~280KB)
  const thumbs = await Promise.all(compressed.map((f) => compressImage(f, 400, 55, false)));  // ảnh THU NHỎ — KHÔNG đóng dấu lại (kế thừa dấu từ ảnh to, tránh trùng)
  compressed.forEach((f) => fd.append('files', f));
  thumbs.forEach((f) => fd.append('thumbs', f));
  const res = await fetch(`${API_BASE}/images`, { method: 'POST', headers: { ...authHeaders() }, body: fd });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return (await res.json()).images as { id: number; url: string }[];
}
// Tải LÊN 1 TỆP (ảnh HOẶC PDF) — dùng cho đính kèm công văn ở danh sách nóng.
// Ảnh: nén nhẹ, KHÔNG đóng dấu (giữ công văn rõ nét, không gắn thương hiệu). PDF: giữ nguyên.
// Trả URL TUYỆT ĐỐI để mở/nhúng được ở mọi nơi (trình xem công văn cần link bắt đầu bằng http).
export async function uploadFile(file: File): Promise<{ id: number; url: string }> {
  const fd = new FormData();
  const f = file.type.startsWith('image/') ? await compressImage(file, 1400, 280, false) : file; // ẢNH: nén như ảnh tin đăng (~280KB, tối đa 1400px) cho nhẹ kho lưu; PDF giữ nguyên
  fd.append('files', f);
  const res = await fetch(`${API_BASE}/images`, { method: 'POST', headers: { ...authHeaders() }, body: fd });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  const imgs = (await res.json()).images as { id: number; url: string }[];
  if (!imgs?.length) throw new Error('Tải tệp lên thất bại (chỉ nhận ảnh hoặc PDF).');
  const ext = f.type === 'application/pdf' ? '.pdf' : f.type === 'image/webp' ? '.webp' : f.type === 'image/png' ? '.png' : '.jpg';
  const rel = imgs[0].url + ext; // /api/images/:id.pdf | .webp… (đuôi để trình xem nhận diện loại + Cloudflare cache)
  const base = API_BASE.startsWith('http') ? API_BASE : (typeof window !== 'undefined' ? window.location.origin : '');
  const url = /^https?:\/\//.test(rel) ? rel : new URL(rel, base).href;
  return { id: imgs[0].id, url };
}
/** Đổi URL ảnh gốc → ảnh THU NHỎ (cho thẻ tin/danh sách). URL ngoài (không phải /api/images/) giữ nguyên.
 *  Thêm đuôi .webp để Cloudflare cache ảnh ở biên (điện thoại tải nhanh hơn). */
export function thumbUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return /\/api\/images\/\d+$/.test(url) ? url + '/thumb.webp' : url;
}
// Ảnh MẶC ĐỊNH khi tin CHƯA có ảnh — SVG xám in-brand (không tải mạng, KHÔNG ảnh ngẫu nhiên như picsum).
export const NO_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='500' viewBox='0 0 800 500'%3E%3Crect width='800' height='500' fill='%23eef2f7'/%3E%3Cg fill='none' stroke='%23aab6c7' stroke-width='16' stroke-linejoin='round' stroke-linecap='round'%3E%3Cpath d='M276 250l124-98 124 98'/%3E%3Cpath d='M308 232v98h184v-98'/%3E%3C/g%3E%3C/svg%3E";
/** Ảnh GỐC + đuôi .webp để Cloudflare cache ở biên (dùng cho trang chi tiết, thư viện ảnh). */
export function imgUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return /\/api\/images\/\d+$/.test(url) ? url + '.webp' : url;
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

// ── CHAT: gửi 1 tệp (ảnh hoặc PDF) vào một phòng chat ────────────────────────
// Khác uploadFile ở chỗ tệp KHÔNG vào kho ảnh tin rao mà vào bảng riêng có kiểm quyền,
// nên trả về id tệp chứ không phải link công khai — muốn xem phải gọi kèm thẻ đăng nhập.
// Ảnh: nén cho nhẹ nhưng để 1600px/400KB (đọc chữ trên sổ đỏ mới rõ) và CỐ Ý KHÔNG đóng dấu mờ
// — dấu nằm giữa ảnh sẽ che mất chữ trên giấy tờ. PDF: giữ nguyên, không đụng vào.
export const CHAT_TEP_TOI_DA = 10 * 1024 * 1024;
export async function uploadChatFile(room: string, file: File): Promise<any> {
  const f = file.type.startsWith('image/') ? await compressImage(file, 1600, 400, false) : file;
  if (f.size > CHAT_TEP_TOI_DA) throw new Error('Tệp quá lớn — tối đa 10MB.');
  const fd = new FormData();
  fd.append('room', room);
  fd.append('file', f, f.name || 'tep');
  const res = await fetch(`${API_BASE}/chat/file`, { method: 'POST', headers: { ...authHeaders() }, body: fd });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Gửi tệp lỗi (${res.status})`);
  return res.json();
}
// Tải nội dung tệp chat về dạng blob (phải kèm thẻ đăng nhập nên KHÔNG dùng <img src> thẳng được).
export async function chatFileBlob(fileId: number): Promise<string> {
  const res = await fetch(`${API_BASE}/chat/file/${fileId}`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(`Không tải được tệp (${res.status})`);
  return URL.createObjectURL(await res.blob());
}
