// ── MÃ THIẾT BỊ (10/10/2026) — xem apps/backend/src/lib/thietBi.ts ──
// Mỗi trình duyệt tự sinh MỘT mã ngẫu nhiên, cất ở localStorage (+ cookie dự phòng), gửi kèm mọi yêu cầu qua header
// X-Thiet-Bi. Máy chủ dựa vào đó để ghi sổ thiết bị và (khi bật) giới hạn số thiết bị mỗi tài khoản.
// Không thu thập gì riêng tư: chỉ mã ngẫu nhiên + vài thông số máy (màn hình, múi giờ, ngôn ngữ) gửi lúc đăng nhập.
const KHOA = 'camlam_tb';

function sinhMa(): string {
  try { if (crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, ''); } catch { /* bỏ qua */ }
  let s = ''; for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16); return s;
}

let maNho: string | null = null;
export function maThietBi(): string | null {
  if (maNho) return maNho;
  if (typeof window === 'undefined') return null;
  let m: string | null = null;
  try { m = localStorage.getItem(KHOA); } catch { /* chế độ ẩn danh / chặn lưu trữ */ }
  if (!m) { const c = document.cookie.match(/(?:^|; )camlam_tb=([A-Za-z0-9_-]{16,64})/); if (c) m = c[1]; }
  if (!m) m = sinhMa();
  try { localStorage.setItem(KHOA, m); } catch { /* bỏ qua */ }
  try { document.cookie = `camlam_tb=${m}; path=/; max-age=${5 * 365 * 86400}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`; } catch { /* bỏ qua */ }
  maNho = m;
  return m;
}

/** Header gửi kèm mọi yêu cầu tới máy chủ. */
export function dauThietBi(): Record<string, string> {
  const m = maThietBi(); return m ? { 'X-Thiet-Bi': m } : {};
}

/** Thông số máy gửi kèm lúc ĐĂNG NHẬP (để admin đối chiếu khi khách chối). Tên máy Android lấy được trên Chrome. */
let infoNho: string | null = null;
/* ── BỘ PHÔNG CHỮ ĐÃ CÀI (13/10/2026) — dấu hiệu "cùng máy" cho MÁY TÍNH (backend lib/thietBi.ts bacCungMay, bậc 2) ──
 * Mỗi máy tính cài phần mềm khác nhau (Office, Adobe, bộ gõ VNI / TCVN3, phông thiết kế…) nên bộ phông khác nhau; mọi cửa sổ /
 * trình duyệt nhân Chromium (Chrome, Edge, Cốc Cốc…) trên CÙNG máy thấy cùng một bộ. Dò bằng đo bề rộng chữ: phông có cài thì
 * chữ rộng khác phông dự phòng. CHỈ GỬI SỐ PHÔNG + MÃ BĂM của danh sách, không gửi tên phông. Safari / Firefox giấu bớt phông
 * nên cho kết quả khác — khi đó máy chủ lùi về luật "cùng mạng". */
const DS_PHONG = ['Arial Narrow', 'Bahnschrift', 'Calibri', 'Cambria', 'Candara', 'Consolas', 'Constantia', 'Corbel',
  'Franklin Gothic Medium', 'Gabriola', 'Segoe Print', 'Segoe Script', 'Sitka Text', 'Aptos', 'Book Antiqua', 'Bookman Old Style',
  'Century Gothic', 'Century Schoolbook', 'Garamond', 'Gill Sans MT', 'Lucida Bright', 'Lucida Calligraphy', 'Lucida Handwriting',
  'Monotype Corsiva', 'Rockwell', 'Tw Cen MT', 'MS Reference Sans Serif', 'Agency FB', 'Algerian', 'Bauhaus 93', 'Bodoni MT',
  'Broadway', 'Brush Script MT', 'Castellar', 'Chiller', 'Cooper Black', 'Curlz MT', 'Elephant', 'Forte', 'Freestyle Script',
  'Harrington', 'Jokerman', 'Kristen ITC', 'Magneto', 'Mistral', 'Old English Text MT', 'Onyx', 'Papyrus', 'Playbill', 'Ravie',
  'Showcard Gothic', 'Snap ITC', 'Stencil', 'Vladimir Script', 'Wide Latin', 'Myriad Pro', 'Minion Pro', 'Adobe Garamond Pro',
  'Source Sans Pro', 'Roboto', 'Open Sans', 'Noto Sans', 'Lato', 'Montserrat', 'Inter', 'VNI-Times', 'VNI-Helve', 'VNI-Avo',
  '.VnTime', '.VnArial', '.VnTimeH', 'UTM Avo', 'UTM Bebas', 'Tahoma', 'Verdana', 'Trebuchet MS', 'Georgia', 'Palatino Linotype',
  'Segoe UI', 'Comic Sans MS', 'Courier New', 'Impact', 'Helvetica Neue', 'Menlo', 'Avenir', 'Futura', 'Optima', 'Didot',
  'Baskerville', 'American Typewriter', 'Ubuntu', 'DejaVu Sans', 'Liberation Sans'];
function maBoPhongChu(): string | null {
  try {
    const c = document.createElement('canvas').getContext('2d');
    if (!c) return null;
    const mau = 'mmmmmmmmmmlli1WQ@#Ẫẫđ 0123456789';
    const duPhong = ['monospace', 'serif', 'sans-serif'];
    const rong = (f: string) => { c.font = `72px ${f}`; return c.measureText(mau).width; };
    const goc = duPhong.map(rong);
    const co = DS_PHONG.filter((p) => duPhong.some((d, i) => rong(`'${p}', ${d}`) !== goc[i]));
    let h = 0x811c9dc5;                                               // băm FNV-1a 32 bit
    for (const ch of co.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return `${co.length}:${h.toString(16)}`;
  } catch { return null; }
}

export async function thongTinThietBi(): Promise<string> {
  if (infoNho) return infoNho;
  const o: Record<string, unknown> = {};
  try {
    o.manHinh = `${screen.width}×${screen.height}`; o.tiLe = Math.round((window.devicePixelRatio || 1) * 100) / 100;
    o.muiGio = Intl.DateTimeFormat().resolvedOptions().timeZone; o.ngonNgu = navigator.language;
    o.nhanCpu = (navigator as any).hardwareConcurrency; o.ram = (navigator as any).deviceMemory; o.cham = navigator.maxTouchPoints;
    // Tên CARD ĐỒ HOẠ (13/10/2026): mọi cửa sổ / trình duyệt nhân Chromium trên cùng máy đọc ra cùng một tên → máy chủ dùng
    // làm thêm một dấu hiệu "cùng máy" khi gộp thiết bị (backend lib/thietBi.ts laCungMay). Web KHÔNG đọc được số máy thật
    // (sê-ri, MAC, IMEI) — trình duyệt chặn; đây là thông số phần cứng gần nhất đọc được. Safari / Firefox trả tên chung chung.
    try {
      const gl = document.createElement('canvas').getContext('webgl') as WebGLRenderingContext | null;
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      const gpu = gl && (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      if (gpu) o.gpu = String(gpu).slice(0, 110);
      gl?.getExtension('WEBGL_lose_context')?.loseContext();        // trả lại bộ nhớ card đồ hoạ ngay
    } catch { /* máy tắt WebGL: bỏ qua */ }
    const pc = maBoPhongChu();
    if (pc) o.phongChu = pc;
    const uad = (navigator as any).userAgentData;
    if (uad?.getHighEntropyValues) {
      const h = await Promise.race([uad.getHighEntropyValues(['model', 'platformVersion']), new Promise((r) => setTimeout(() => r(null), 800))]) as any;
      if (h) { if (h.model) o.model = h.model; o.nenTang = uad.platform; if (h.platformVersion) o.banNenTang = h.platformVersion; }
    }
  } catch { /* bỏ qua */ }
  infoNho = encodeURIComponent(JSON.stringify(o));
  return infoNho;
}
