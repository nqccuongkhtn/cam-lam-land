// Xuất "PHIẾU KIỂM TRA THÔNG TIN QUY HOẠCH THỬA ĐẤT" — bản in (trình duyệt → lưu PDF).
// Cá nhân hóa cho Cam Lâm Land: logo + hotline, người yêu cầu = tài khoản, mã tra cứu + QR, dòng miễn trừ.
// Bảng kê tọa độ dùng VN-2000 Khánh Hòa (kinh tuyến trục 108°15', múi 3°) từ @/lib/vn2000.
import { wgs84ToVn2000 } from './vn2000';

const SITE = {
  ten: 'CAM LÂM LAND',
  mota: 'Nền tảng bất động sản & bản đồ quy hoạch Cam Lâm, Khánh Hòa',
  hotline: '0988 888 888',
  email: 'lienhe@camlamland.vn',
  diaChi: 'Cam Lâm, Khánh Hòa',
  domain: 'batdongsancamlam.vn',
};

type Overlap = { type: string; areaM2: number; hz?: string | null };
type Parcel = { soTo?: string | null; soThua?: string | null; xa?: string | null; areaM2?: number | null; properties?: Record<string, any> };
export type PhieuOpts = {
  parcel: Parcel;
  geometry: any;
  overlaps?: Overlap[];
  // Các bản quy hoạch KHÁC cùng phủ lên thửa (QĐ893, các bản phân khu 1/2000).
  // Một thửa ở Cam Lâm thường dính nhiều bản chồng nhau — phiếu phải in ĐỦ, ghi rõ từng bản,
  // chứ in mỗi QĐ205 là người cầm phiếu tưởng thửa chỉ chịu một quy hoạch.
  qhCacBan?: { ma: string; ten: string; phuTramPhanTram?: number; areas: { type: string; areaM2: number }[] }[];
  qhPieces?: { lo: string; hz?: string; c?: string; ring: number[][] }[];   // ô QH cắt qua thửa (ring WGS84) + màu thật → TÔ MÀU lên thửa
  neighbors?: { so: string; lng: number; lat: number }[];       // thửa liền kề (số hiệu + điểm đại diện WGS84)
  scenario?: string;                                             // kịch bản QH đang áp trên web: 'HT' | '2030' | '2045'
  roadHz?: string;                                               // mã lớp của CON ĐƯỜNG vẽ trên sơ đồ (HT = đường hiện trạng)
  roadFeats?: { t: string; c: any }[];                           // feature LỚP ĐƯỜNG THẬT (nét mảnh) gần thửa (WGS84) → vẽ đúng đường
  point?: { lng: number; lat: number } | null;
  user?: { name?: string | null; phone?: string | null } | null;
  logo?: string | null;   // ảnh logo/con dấu (data URL) do người dùng tải lên
  sign?: string | null;   // ảnh chữ ký (data URL)
};

// Màu theo loại đất quy hoạch (để tô nét QH trên thửa + chú giải).
function qhColor(lo: string): string {
  const s = (lo || '').toLowerCase();
  if (/giao th|đường|hạ tầng/.test(s)) return '#9ca3af';                 // xám — giao thông
  if (/cây xanh|công viên|c\.xanh|xanh|tdtt|thể dục/.test(s)) return '#22c55e'; // xanh lá
  if (/mặt nước|sông|hồ|kênh|thủy/.test(s)) return '#38bdf8';            // xanh nước
  if (/thương mại|dịch vụ|hỗn hợp|du lịch/.test(s)) return '#ef4444';    // đỏ
  if (/công cộng|giáo dục|y tế|hành chính|trường|trụ sở/.test(s)) return '#3b82f6'; // xanh dương
  if (/nông nghiệp|lúa|trồng|vườn/.test(s)) return '#84cc16';           // vàng chanh
  if (/ở|odt|otc|làng xóm|dân cư|đô thị/.test(s)) return '#f59e0b';      // cam — đất ở
  return '#a78bfa';                                                        // tím — khác
}

// ⚠️ LOGO LẤY TỪ ĐÚNG TỆP LOGO CỦA WEB, không vẽ lại bằng hình khối.
//    Trước đây chỗ này vẽ tay một ngôi nhà bằng SVG — đổi logo của web là
//    phiếu trích lục vẫn in ra logo cũ mà không ai để ý (đã đúng lỗi đó một
//    lần: web đã đổi sang logo chữ lồng mà phiếu vẫn in ngôi nhà).
//    Vẫn giữ một bản DỰ PHÒNG phía sau: phiếu hay được in ở nơi mạng chập
//    chờn, tệp ảnh không tải kịp thì đầu phiếu trống hoác, nhìn như phiếu giả.
//    Bản dự phòng nay là CHÍNH TẤM LOGO nhúng thẳng vào mã (base64) nên không
//    bao giờ lệch với logo thật nữa.
// LOGO-DUPHONG-BAT-DAU — dòng dưới do scripts/dong-bo-logo.py tự ghi lại,
//                        ĐỪNG SỬA TAY (sửa xong chạy lại script là mất).
const LOGO_DUPHONG = 'data:image/webp;base64,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';
// LOGO-DUPHONG-KET-THUC
function navLogo(origin: string): string {
  return `<span class="lgbox"><img src="${origin}/logo-cam-lam.webp" alt=""`
    + ` onerror="this.style.display='none';this.nextElementSibling.style.display='block'">`
    + `<img class="fb" style="display:none" alt="" src="${LOGO_DUPHONG}"></span>`;
}

function star(cx: number, cy: number, r: number): string {
  let p = '';
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; p += `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)} `; }
  return `<polygon points="${p.trim()}"/>`;
}
// Con dấu tròn đỏ mô phỏng logo Cam Lâm Land (vòng chữ + sao + biểu tượng cao ốc/nhà/dừa/sóng).
function stampSvg(): string {
  const R = '#c1121f';
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <defs><path id="cllTop" d="M100,100 m -78,0 a 78,78 0 1,1 156,0" fill="none"/><path id="cllBot" d="M100,100 m -82,0 a 82,82 0 0,0 164,0" fill="none"/></defs>
    <g fill="none" stroke="${R}"><circle cx="100" cy="100" r="96" stroke-width="3"/><circle cx="100" cy="100" r="88" stroke-width="1.4"/><circle cx="100" cy="100" r="57" stroke-width="1.1"/></g>
    <text font-family="Arial,sans-serif" font-weight="800" fill="${R}" font-size="19.5" letter-spacing="2"><textPath href="#cllTop" startOffset="50%" text-anchor="middle">CAM LÂM LAND</textPath></text>
    <text font-family="Arial,sans-serif" font-weight="700" fill="${R}" font-size="12" letter-spacing="1.2"><textPath href="#cllBot" startOffset="50%" text-anchor="middle">KẾT NỐI GIÁ TRỊ - KIẾN TẠO TƯƠNG LAI</textPath></text>
    <g fill="${R}">${star(18, 100, 7)}${star(182, 100, 7)}</g>
    <g fill="${R}" stroke="none"><rect x="85" y="66" width="11" height="34"/><rect x="97" y="57" width="10" height="43"/><rect x="108" y="72" width="9" height="28"/></g>
    <g fill="none" stroke="${R}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M73 100 L85 89 L97 100"/><path d="M76 100 V112 H94 V100"/>
      <path d="M100 100 L112 89 L124 100"/><path d="M103 100 V112 H121 V100"/>
      <path d="M133 100 C131 92 130 84 132 76"/><path d="M132 76 C127 72 121 72 117 75"/><path d="M132 76 C137 72 143 72 147 75"/><path d="M132 76 C128 71 125 66 125 61"/><path d="M132 76 C136 71 140 68 144 66"/>
      <path d="M71 118 q 8 -5 16 0 t 16 0 t 16 0 t 16 0"/>
    </g>
    <text x="100" y="133" text-anchor="middle" font-family="Arial" font-weight="800" font-size="13" fill="${R}">CAM LÂM</text>
    <text x="100" y="144" text-anchor="middle" font-family="Arial" font-weight="700" font-size="8" letter-spacing="2" fill="${R}">— LAND —</text>
  </svg>`;
}
// Chữ ký mẫu (nét bút bay bướm, mực đậm — hiện rõ cả khi in trắng đen).
function signSvg(): string {
  return `<svg viewBox="0 0 160 60" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#0b1e3a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 42 C 16 12, 26 10, 24 34 C 23 47, 32 46, 35 29 C 38 15, 45 17, 42 37 C 54 20, 63 24, 58 35 C 70 22, 81 26, 74 39 C 89 20, 98 24, 93 37 C 106 24, 118 28, 109 41 C 123 31, 135 31, 129 43"/><path d="M18 48 C 62 55, 112 52, 144 40" stroke-width="1.3"/></svg>`;
}

const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'));
const num = (n: number, d = 2) => (isFinite(n) ? n : 0).toFixed(d);
const numVi = (n: number, d = 2) => num(n, d).replace('.', ','); // số kiểu Việt (dấu phẩy) — CHỈ cho hiển thị, không dùng cho toạ độ SVG
const pick = (p: Record<string, any> = {}, keys: string[]) => { for (const k of keys) { const v = p?.[k]; if (v != null && String(v).trim() !== '') return String(v).trim(); } return ''; };

function shoelace(r: number[][]): number { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
function extractRing(geom: any): number[][] {
  if (!geom) return [];
  let ring: number[][] = [];
  if (geom.type === 'Polygon') ring = geom.coordinates?.[0] || [];
  else if (geom.type === 'MultiPolygon') { let bA = -1; for (const poly of geom.coordinates || []) { const r = poly?.[0] || []; const a = Math.abs(shoelace(r)); if (a > bA) { bA = a; ring = r; } } }
  if (ring.length > 1) { const f = ring[0], l = ring[ring.length - 1]; if (f[0] === l[0] && f[1] === l[1]) ring = ring.slice(0, -1); }
  return ring;
}

// Sơ đồ thửa đất (SVG): dùng tọa độ VN-2000 (mét) → không méo; đánh số đỉnh + ghi chiều dài cạnh + diện tích + hướng Bắc.
const PIDS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
// 6 kiểu hoa văn (hatch) đen trắng — TỰ CHỨA để mỗi SVG (sơ đồ + ô ký hiệu) hiện đúng, không phụ thuộc defs ngoài.
function hatchPattern(id: string, i: number): string {
  const P = [
    `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#333" stroke-width="0.8"/></pattern>`,
    `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#333" stroke-width="0.8"/></pattern>`,
    `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.6" cy="1.6" r="1" fill="#333"/></pattern>`,
    `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 0H6M0 0V6" stroke="#333" stroke-width="0.7"/></pattern>`,
    `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse"><line x1="0" y1="3" x2="6" y2="3" stroke="#333" stroke-width="0.8"/></pattern>`,
    `<pattern id="${id}" width="4.5" height="4.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4.5" stroke="#333" stroke-width="0.6"/></pattern>`,
  ];
  return P[((i % 6) + 6) % 6];
}
const patSwatch = (i: number) => `<svg width="18" height="12" style="vertical-align:-2px"><defs>${hatchPattern('sw' + i, i)}</defs><rect width="18" height="12" fill="url(#sw${i})" stroke="#111" stroke-width="0.7"/></svg>`;
// Quy tắc: Đất giao thông để Ô TRẮNG (không hoa văn).
const isRoad = (t: string) => /giao thông|đường/i.test(t || '');
const whiteSwatch = () => `<svg width="18" height="12" style="vertical-align:-2px"><rect width="18" height="12" fill="#fff" stroke="#111" stroke-width="0.7"/></svg>`;

// Kịch bản QH trên web (hz) → quyết định phê duyệt tương ứng, để ghi ĐÚNG "đang áp quy hoạch nào".
const QH_META: Record<string, { ten: string; qd: string }> = {
  '2045': { ten: 'Quy hoạch chung đô thị mới Cam Lâm, tỉnh Khánh Hòa đến năm 2045', qd: 'Quyết định số 205/QĐ-TTg ngày 28/02/2024 của Thủ tướng Chính phủ' },
  '2030': { ten: 'Quy hoạch sử dụng đất đến năm 2030 và Kế hoạch sử dụng đất năm đầu, huyện Cam Lâm', qd: 'Quyết định số 893/QĐ-UBND ngày 04/04/2025 của UBND tỉnh Khánh Hòa' },
  'HT': { ten: 'Hiện trạng sử dụng đất', qd: 'bản đồ hiện trạng sử dụng đất được cơ quan có thẩm quyền xác lập' },
};

// ---- SƠ ĐỒ THEO ẢNH QH GỐC (raster QĐ205, giống Guland/Meey) ----
const QD205_TILE = '/tiles/qd205v11/{z}/{x}/{y}.png?v=5';   // ảnh QH đã nắn toạ độ (cùng origin) · ?v=5 PHẢI khớp app/map/page.tsx
const lonToWX = (lng: number) => (lng + 180) / 360;
const latToWY = (lat: number) => { const s = Math.sin(lat * Math.PI / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
function buildSvgRaster(ll: [number, number][], areaM2: number, extra: { soThua?: string; neighbors?: { so: string; lng: number; lat: number }[]; origin?: string }): string {
  const W = 400, H = 300, nbs = extra.neighbors || [], origin = extra.origin || '';
  const ring = ll.length > 1 && ll[0][0] === ll[ll.length - 1][0] && ll[0][1] === ll[ll.length - 1][1] ? ll.slice(0, -1) : ll.slice();
  if (ring.length < 3) return '<div style="text-align:center;color:#888;padding:24px 0;font-size:11px">— Thửa chưa có ranh số hóa —</div>';
  const wx = ring.map((c) => lonToWX(c[0])), wy = ring.map((c) => latToWY(c[1]));
  const minX = Math.min(...wx), maxX = Math.max(...wx), minY = Math.min(...wy), maxY = Math.max(...wy);
  const cxW = (minX + maxX) / 2, cyW = (minY + maxY) / 2, spanX = Math.max(maxX - minX, 1e-12), spanY = Math.max(maxY - minY, 1e-12);
  const pad = 16, avail = Math.min(W, H) - 2 * pad;
  let z = Math.floor(Math.log2(avail / (Math.max(spanX, spanY) / 0.62 * 256))); z = Math.max(12, Math.min(18, isFinite(z) ? z : 16));
  const scale = 256 * Math.pow(2, z), cPx = cxW * scale, cPy = cyW * scale;
  const sX = (px: number) => W / 2 + (px - cPx), sY = (py: number) => H / 2 + (py - cPy);
  const sxL = (lng: number) => sX(lonToWX(lng) * scale), syL = (lat: number) => sY(latToWY(lat) * scale);
  const CX = sxL((Math.min(...ring.map((c) => c[0])) + Math.max(...ring.map((c) => c[0]))) / 2);
  const CY = syL((Math.min(...ring.map((c) => c[1])) + Math.max(...ring.map((c) => c[1]))) / 2);
  const pts = ring.map((c) => `${num(sxL(c[0]), 1)},${num(syL(c[1]), 1)}`).join(' ');
  // Tile QĐ205 phủ khung, cắt theo ranh thửa.
  const tx0 = Math.floor((cPx - W / 2) / 256), tx1 = Math.floor((cPx + W / 2) / 256), ty0 = Math.floor((cPy - H / 2) / 256), ty1 = Math.floor((cPy + H / 2) / 256), nT = Math.pow(2, z);
  let tiles = '';
  for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) {
    if (tx < 0 || ty < 0 || tx >= nT || ty >= nT) continue;
    tiles += `<image href="${origin}${QD205_TILE.replace('{z}', '' + z).replace('{x}', '' + tx).replace('{y}', '' + ty)}" x="${num(sX(tx * 256), 1)}" y="${num(sY(ty * 256), 1)}" width="256.4" height="256.4" preserveAspectRatio="none"/>`;
  }
  // Phủ ẢNH QH cả khung (bối cảnh xung quanh thửa, giống Guland) — KHÔNG cắt chỉ trong thửa.
  let els = `<rect x="0" y="0" width="${W}" height="${H}" fill="#eef0f2"/>${tiles}`;
  els += `<polygon points="${pts}" fill="none" stroke="#e11d48" stroke-width="2.6"/>`;   // ranh thửa (đỏ nổi bật) trên ảnh QH
  // Thửa liền kề.
  const parScr = ring.map((c) => [sxL(c[0]), syL(c[1])] as [number, number]);
  const reach = Math.max(...parScr.map((pt) => Math.hypot(pt[0] - CX, pt[1] - CY)));
  nbs.forEach((nb) => { let dx = sxL(nb.lng) - CX, dy = syL(nb.lat) - CY; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L; const px = Math.max(9, Math.min(W - 9, CX + dx * (reach + 12))), py = Math.max(9, Math.min(H - 9, CY + dy * (reach + 12))); els += `<text x="${num(px, 1)}" y="${num(py, 1)}" font-size="8.5" fill="#333" text-anchor="middle" dominant-baseline="central" style="paint-order:stroke;stroke:#fff;stroke-width:3">${esc(nb.so)}</text>`; });
  // Góc thửa: chấm + số.
  ring.forEach((c, i) => { const X = sxL(c[0]), Y = syL(c[1]), dx = X - CX, dy = Y - CY, L = Math.hypot(dx, dy) || 1; els += `<circle cx="${num(X, 1)}" cy="${num(Y, 1)}" r="2.2" fill="#e11d48"/><text x="${num(X + dx / L * 9, 1)}" y="${num(Y + dy / L * 9, 1)}" font-size="8.5" font-weight="700" fill="#111" text-anchor="middle" dominant-baseline="central" style="paint-order:stroke;stroke:#fff;stroke-width:3">${i + 1}</text>`; });
  // Tâm: số thửa / diện tích.
  const sth = esc(extra.soThua || '');
  if (sth) els += `<text x="${num(CX, 1)}" y="${num(CY - 4, 1)}" font-size="10" font-weight="800" fill="#111" text-anchor="middle" dominant-baseline="central" style="paint-order:stroke;stroke:#fff;stroke-width:3.5">${sth}</text>`;
  els += `<line x1="${num(CX - 16, 1)}" y1="${num(CY + 1, 1)}" x2="${num(CX + 16, 1)}" y2="${num(CY + 1, 1)}" stroke="#111" stroke-width="0.8"/>`;
  els += `<text x="${num(CX, 1)}" y="${num(CY + 8, 1)}" font-size="8.5" font-weight="700" fill="#111" text-anchor="middle" dominant-baseline="central" style="paint-order:stroke;stroke:#fff;stroke-width:3.5">${numVi(areaM2, 1)}</text>`;
  return `<svg id="qhsvg" viewBox="0 0 ${W} ${H}" width="100%" style="max-height:360px;touch-action:none;cursor:grab" xmlns="http://www.w3.org/2000/svg">${els}</svg>`;
}

function buildSvg(
  vn: { E: number; N: number }[], edges: number[], areaM2: number,
  qhVn: { lo: string; c?: string; pts: { E: number; N: number }[] }[] = [], qhTypes: string[] = [],
  extra: { soThua?: string; code?: string; neighbors?: { so: string; E: number; N: number }[]; roadAreaM2?: number; roadHz?: string; roadPaths?: { E: number; N: number }[][]; roadRings?: { E: number; N: number }[][] } = {}
): string {
  if (vn.length < 3) return '<div style="text-align:center;color:#888;padding:24px 0;font-size:11px">— Thửa chưa có ranh số hóa —</div>';
  const W = 400, H = 300;
  const nbs = extra.neighbors || [];
  // Point-in-polygon trong KHÔNG GIAN MÉT (E,N) — phân tích đường ĐỘC LẬP với tỷ lệ vẽ.
  const pipM = (E: number, N: number, ring: { E: number; N: number }[]) => {
    let ins = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i].E, yi = ring[i].N, xj = ring[j].E, yj = ring[j].N;
      if ((yi > N) !== (yj > N) && E < ((xj - xi) * (N - yi)) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  };
  const piecesM = qhVn.filter((pc) => pc.pts && pc.pts.length >= 3 && !isRoad(pc.lo)).map((pc) => pc.pts);
  const pspanE = Math.max(...vn.map((p) => p.E)) - Math.min(...vn.map((p) => p.E)), pspanN = Math.max(...vn.map((p) => p.N)) - Math.min(...vn.map((p) => p.N));
  // ---- Phân tích ĐƯỜNG QH (mét): tìm trục đường + BẮN TIA tới 2 lề THẬT (dùng ô đất đầy đủ) ----
  type PT = { E: number; N: number };
  type RInfo = { mx: number; my: number; ux: number; uy: number; full: boolean; wM: number; roadFrac: number; le1: PT; le2: PT; armL1: PT | null; armL2: PT | null; datM: number[][]; roadM: number[][]; stepM: number };
  let RI: RInfo | null = null;
  if (piecesM.length) {
    const e0 = Math.min(...vn.map((p) => p.E)), e1 = Math.max(...vn.map((p) => p.E)), n0 = Math.min(...vn.map((p) => p.N)), n1 = Math.max(...vn.map((p) => p.N));
    const stepM = Math.max(e1 - e0, n1 - n0) / 90 || 1;
    const roadM: number[][] = [], datM: number[][] = [];
    for (let E = e0 + stepM * 0.5; E < e1; E += stepM) for (let N = n0 + stepM * 0.5; N < n1; N += stepM) {
      if (!pipM(E, N, vn)) continue;
      if (piecesM.some((pc) => pipM(E, N, pc))) datM.push([E, N]); else roadM.push([E, N]);
    }
    if (roadM.length > 6) {
      const mx = roadM.reduce((a, b) => a + b[0], 0) / roadM.length, my = roadM.reduce((a, b) => a + b[1], 0) / roadM.length;
      let sxx = 0, syy = 0, sxy = 0; for (const [x, y] of roadM) { const dx = x - mx, dy = y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
      const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(th), uy = Math.sin(th), px = -uy, py = ux;
      // Kích thước vùng giao thông (mét): dài theo trục & rộng vuông góc → CHỈ coi là "đường" khi là DẢI HẸP THUÔN DÀI.
      let smin = Infinity, smax = -Infinity, tmin = Infinity, tmax = -Infinity;
      for (const [x, y] of roadM) { const s = (x - mx) * ux + (y - my) * uy, t = (x - mx) * px + (y - my) * py; if (s < smin) smin = s; if (s > smax) smax = s; if (t < tmin) tmin = t; if (t > tmax) tmax = t; }
      const roadFrac = roadM.length / Math.max(roadM.length + datM.length, 1);   // giao thông chiếm bao nhiêu % thửa
      // "Đường" = DẢI HẸP thuôn dài + là THIỂU SỐ thửa (≤60%). Nếu giao thông trùm thửa → thường do ô đất số hoá HỞ → KHÔNG coi là đường.
      const lenS = smax - smin, widS = tmax - tmin, strip = lenS >= 2.2 * Math.max(widS, 0.1) && widS <= 28 && roadFrac <= 0.6;
      const marchM = (dx: number, dy: number) => { for (let d = stepM; d <= 400; d += stepM) if (piecesM.some((pc) => pipM(mx + dx * d, my + dy * d, pc))) return d; return -1; };
      const dP = marchM(px, py), dM = marchM(-px, -py), rayW = (dP > 0 && dM > 0) ? dP + dM : -1;
      const rayOk = rayW > 0 && rayW >= 0.55 * widS && rayW <= 2.6 * widS && rayW <= 42;   // tia đo 2 lề HỢP LÝ?
      // VẼ đường cho MỌI dải hẹp thuôn dài; bề rộng lấy theo tia đo 2 lề (nếu hợp lý) hoặc đo trong thửa (nếu tia lỗi).
      // Vùng giao thông TO / nút giao (không phải dải) → full=false → chỉ tô, không đo (tránh số vô lý 115 m).
      const full = strip;
      // 2 lề: tia đo (kéo ra lề thật ngoài thửa) nếu hợp lý, ngược lại lấy mép đo trong thửa.
      const le1: PT = rayOk ? { E: mx - px * dM, N: my - py * dM } : { E: mx + px * tmin, N: my + py * tmin };
      const le2: PT = rayOk ? { E: mx + px * dP, N: my + py * dP } : { E: mx + px * tmax, N: my + py * tmax };
      const wM = full ? (rayOk ? rayW : widS) : 0;
      // "Tay đo" (arm): chỗ đặt MŨI TÊN 2 ĐẦU ở đoạn đường NGOÀI thửa (chạy dọc trục ra khỏi ranh).
      let armL1: PT | null = null, armL2: PT | null = null;
      if (full) {
        const rcE = (le1.E + le2.E) / 2, rcN = (le1.N + le2.N) / 2, half = wM / 2;
        const marchAx = (dir: number) => { for (let d = stepM; d <= 400; d += stepM) if (!pipM(rcE + ux * dir * d, rcN + uy * dir * d, vn)) return d; return -1; };
        const dpl = marchAx(1), dmi = marchAx(-1);
        let dir = 1, ex = dpl;
        if (dpl < 0 && dmi > 0) { dir = -1; ex = dmi; } else if (dmi > 0 && dmi < dpl) { dir = -1; ex = dmi; }
        if (ex > 0) {
          const off = ex + half * 1.1, aE = rcE + ux * dir * off, aN = rcN + uy * dir * off;
          if (!piecesM.some((pc) => pipM(aE, aN, pc))) { armL1 = { E: aE - px * half, N: aN - py * half }; armL2 = { E: aE + px * half, N: aN + py * half }; }
        }
      }
      RI = { mx, my, ux, uy, full, wM, roadFrac, le1, le2, armL1, armL2, datM, roadM, stepM };
    } else RI = { mx: 0, my: 0, ux: 1, uy: 0, full: false, wM: 0, roadFrac: 1, le1: { E: 0, N: 0 }, le2: { E: 0, N: 0 }, armL1: null, armL2: null, datM, roadM, stepM };
  }
  // ---- TỶ LỆ khung: bao THỬA + 2 LỀ đường + tay đo (nếu có) để LUÔN thấy đủ 2 cạnh đường & mũi tên đo ----
  const fit: [number, number][] = vn.map((p) => [p.E, p.N]);   // đường vẽ trong thửa → khung fit theo thửa
  const minE = Math.min(...fit.map((p) => p[0])), maxE = Math.max(...fit.map((p) => p[0])), minN = Math.min(...fit.map((p) => p[1])), maxN = Math.max(...fit.map((p) => p[1]));
  const spanE = Math.max(maxE - minE, 1e-6), spanN = Math.max(maxN - minN, 1e-6);
  const rPaths = extra.roadPaths || [], rRings = extra.roadRings || [], hasRoad = rPaths.length > 0 || rRings.length > 0;
  const mgn = Math.max(spanE, spanN) * (hasRoad ? 0.24 : (nbs.length ? 0.14 : 0.07));
  const vMinE = minE - mgn, vMaxE = maxE + mgn, vMinN = minN - mgn, vMaxN = maxN + mgn;
  const vSpanE = vMaxE - vMinE, vSpanN = vMaxN - vMinN, pad = 12;
  const sc = Math.min((W - 2 * pad) / vSpanE, (H - 2 * pad) / vSpanN);
  const ox = (W - vSpanE * sc) / 2, oy = (H - vSpanN * sc) / 2;
  const sx = (E: number) => ox + (E - vMinE) * sc;
  const sy = (N: number) => H - oy - (N - vMinN) * sc;
  const cE = vn.reduce((a, p) => a + p.E, 0) / vn.length, cN = vn.reduce((a, p) => a + p.N, 0) / vn.length;
  const CX = sx(cE), CY = sy(cN);
  const pts = vn.map((p) => `${num(sx(p.E), 1)},${num(sy(p.N), 1)}`).join(' ');
  const parScr = vn.map((p) => [sx(p.E), sy(p.N)] as [number, number]);
  void pspanE; void pspanN;
  let els = `<defs><clipPath id="pcl"><polygon points="${pts}"/></clipPath></defs><polygon points="${pts}" fill="#fff"/>`;
  // TÔ MÀU các ô đất QH theo MÀU THẬT (như bản đồ tra cứu QH), CẮT theo ranh thửa — đây là cách các app khác làm.
  const zones = qhVn.filter((pc) => pc.pts && pc.pts.length >= 3);
  if (zones.length) els += `<g clip-path="url(#pcl)">` + zones.map((pc) => `<polygon points="${pc.pts.map((p) => `${num(sx(p.E), 1)},${num(sy(p.N), 1)}`).join(' ')}" fill="${esc(pc.c || '#cbd5e1')}" fill-opacity="0.6"/>`).join('') + `</g>`;

  // Tâm ghi chú = VÙNG ĐẤT LỚN NHẤT (phân cụm trong không gian mét) → tránh đè đường.
  let LX = CX, LY = CY;
  if (RI && RI.datM.length > 4) {
    const st = RI.stepM, gk = (x: number, y: number) => Math.round(x / st) + ',' + Math.round(y / st);
    const map = new Map<string, number[]>(); for (const p of RI.datM) map.set(gk(p[0], p[1]), p);
    const seen = new Set<string>(); let best: number[][] = [];
    for (const p of RI.datM) {
      const k0 = gk(p[0], p[1]); if (seen.has(k0)) continue;
      const stk = [p], comp: number[][] = []; seen.add(k0);
      while (stk.length) {
        const q = stk.pop()!; comp.push(q); const ix = Math.round(q[0] / st), iy = Math.round(q[1] / st);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
          if (!a && !b) continue; const nk = (ix + a) + ',' + (iy + b); const np = map.get(nk);
          if (np && !seen.has(nk)) { seen.add(nk); stk.push(np); }
        }
      }
      if (comp.length > best.length) best = comp;
    }
    if (best.length) { LX = sx(best.reduce((a, b) => a + b[0], 0) / best.length); LY = sy(best.reduce((a, b) => a + b[1], 0) / best.length); }
  }
  const drawParcel = () => { els += `<polygon points="${pts}" fill="none" stroke="#111" stroke-width="2.3"/>`; };
  // GIAO THÔNG vẽ theo HÌNH THẬT (đi theo biên ô đất, cong đúng QH); chỉ vẽ khi là THIỂU SỐ thửa (≤60%).
  // Trùm thửa (thường do ô đất số hoá HỞ) → chỉ vẽ hình thửa (phía trong = loại đất chính).
  // ĐƯỜNG THẬT từ lớp 'road' (nét mảnh): vùng đường (polygon) tô nhạt + viền; tim/ranh đường (line) vẽ NÉT MẢNH ĐEN.
  // Không đoán đường từ khoảng hở ô đất nữa.
  if (rRings.length) {
    els += rRings.map((rg) => rg.length >= 3 ? `<polygon points="${rg.map((p) => `${num(sx(p.E), 1)},${num(sy(p.N), 1)}`).join(' ')}" fill="#d6dee7" stroke="#7a8794" stroke-width="0.7"/>` : '').join('');
  }
  drawParcel();
  if (rPaths.length) {
    els += `<g fill="none" stroke="#111" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">`
      + rPaths.map((pa) => pa.length >= 2 ? `<polyline points="${pa.map((p) => `${num(sx(p.E), 1)},${num(sy(p.N), 1)}`).join(' ')}"/>` : '').join('') + `</g>`;
  }
  if (hasRoad) {   // nhãn tên đường (nếu có), đặt ở đầu đường trong khung
    const anchor = rPaths[0]?.[Math.floor((rPaths[0]?.length || 1) / 2)] || rRings[0]?.[0];
    if (anchor) els += `<text x="${num(sx(anchor.E), 1)}" y="${num(sy(anchor.N) - 5, 1)}" font-size="8" font-weight="700" fill="#111" text-anchor="middle" dominant-baseline="central" style="paint-order:stroke;stroke:#fff;stroke-width:3.5">${extra.roadHz === 'HT' ? 'Đường hiện trạng' : 'Đường quy hoạch'}</text>`;
  }

  // Thửa liền kề: ghi số hiệu quanh ranh, về phía thửa đó.
  const reach = Math.max(...parScr.map((pt) => Math.hypot(pt[0] - CX, pt[1] - CY)));
  nbs.forEach((nb) => {
    let dx = sx(nb.E) - CX, dy = sy(nb.N) - CY; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const px = Math.max(9, Math.min(W - 9, CX + dx * (reach + 12))), py = Math.max(9, Math.min(H - 9, CY + dy * (reach + 12)));
    els += `<text x="${num(px, 1)}" y="${num(py, 1)}" font-size="8.5" fill="#555" text-anchor="middle" dominant-baseline="central" style="paint-order:stroke;stroke:#fff;stroke-width:3">${esc(nb.so)}</text>`;
  });

  // Góc thửa: chấm + số thứ tự (ra phía ngoài).
  vn.forEach((p, i) => {
    const X = sx(p.E), Y = sy(p.N), dx = X - CX, dy = Y - CY, L = Math.hypot(dx, dy) || 1;
    els += `<circle cx="${num(X, 1)}" cy="${num(Y, 1)}" r="2.2" fill="#111"/>`;
    els += `<text x="${num(X + dx / L * 9.5, 1)}" y="${num(Y + dy / L * 9.5, 1)}" font-size="9" font-weight="700" fill="#111" text-anchor="middle" dominant-baseline="central" style="paint-order:stroke;stroke:#fff;stroke-width:3">${i + 1}</text>`;
  });

  // Tâm thửa: mục đích SDĐ + số thửa / diện tích (kiểu phân số như mẫu), đặt trong vùng đất.
  const code = esc(extra.code || ''), sth = esc(extra.soThua || '');
  if (code) els += `<text x="${num(LX, 1)}" y="${num(LY - 12, 1)}" font-size="8.5" font-weight="700" fill="#0A2540" text-anchor="middle" dominant-baseline="central" style="paint-order:stroke;stroke:#fff;stroke-width:3.5">${code}</text>`;
  if (sth) els += `<text x="${num(LX, 1)}" y="${num(LY - 1, 1)}" font-size="10.5" font-weight="700" fill="#111" text-anchor="middle" dominant-baseline="central" style="paint-order:stroke;stroke:#fff;stroke-width:3.5">${sth}</text>`;
  els += `<line x1="${num(LX - 17, 1)}" y1="${num(LY + 4, 1)}" x2="${num(LX + 17, 1)}" y2="${num(LY + 4, 1)}" stroke="#111" stroke-width="0.8"/>`;
  els += `<text x="${num(LX, 1)}" y="${num(LY + 11, 1)}" font-size="9" fill="#111" text-anchor="middle" dominant-baseline="central" style="paint-order:stroke;stroke:#fff;stroke-width:3.5">${numVi(areaM2, 1)}</text>`;

  // (Mũi tên Bắc nằm ở overlay HTML ngoài SVG → GIỮ CỐ ĐỊNH khi zoom/di chuyển sơ đồ.)
  return `<svg id="qhsvg" viewBox="0 0 ${W} ${H}" width="100%" style="max-height:360px;touch-action:none;cursor:grab" xmlns="http://www.w3.org/2000/svg">${els}</svg>`;
}

function buildHtml(o: PhieuOpts): string {
  const p = o.parcel || {};
  const ring = extractRing(o.geometry);
  const vn = ring.map(([lng, lat]) => { const c = wgs84ToVn2000(lng, lat); return { E: c.x, N: c.y }; }); // x=Đông(E), y=Bắc(N)
  const edges = vn.map((pt, i) => { const q = vn[(i + 1) % vn.length]; return Math.hypot(q.E - pt.E, q.N - pt.N); });
  const dtRanh = vn.length >= 3 ? Math.abs(shoelace(vn.map((pt) => [pt.E, pt.N]))) : 0;
  const dt = p.areaM2 != null && p.areaM2 > 0 ? Number(p.areaM2) : dtRanh;
  const mdsd = pick(p.properties, ['KyHieu', 'MaLoaiDat', 'MDSD', 'MDSDD', 'LoaiDat', 'ky_hieu', 'ma_loai_dat', 'loai']) || '—';

  // Ô QH cắt qua thửa → đổi sang VN-2000 để vẽ nét QH lên thửa
  const qhVn = (o.qhPieces || []).map((pc) => ({ lo: pc.lo, c: pc.c, pts: (pc.ring || []).map(([lng, lat]) => { const cc = wgs84ToVn2000(lng, lat); return { E: cc.x, N: cc.y }; }) })).filter((pc) => pc.pts.length >= 3);
  const nbVn = (o.neighbors || []).map((n) => { const c = wgs84ToVn2000(n.lng, n.lat); return { so: String(n.so ?? '').trim(), E: c.x, N: c.y }; }).filter((n) => n.so);
  // LỚP ĐƯỜNG THẬT (nét mảnh) → VN-2000: đường dạng line và đường dạng vùng (polygon).
  const toVnRing = (ring: number[][]) => (ring || []).map(([lng, lat]) => { const c = wgs84ToVn2000(lng, lat); return { E: c.x, N: c.y }; });
  const roadPaths: { E: number; N: number }[][] = [], roadRings: { E: number; N: number }[][] = [];
  for (const f of o.roadFeats || []) {
    if (f.t === 'LineString') roadPaths.push(toVnRing(f.c));
    else if (f.t === 'MultiLineString') for (const ln of f.c) roadPaths.push(toVnRing(ln));
    else if (f.t === 'Polygon') { if (f.c[0]) roadRings.push(toVnRing(f.c[0])); }
    else if (f.t === 'MultiPolygon') for (const poly of f.c) { if (poly[0]) roadRings.push(toVnRing(poly[0])); }
  }
  // Chú giải màu ô đất QH (khớp màu tô trên sơ đồ).
  const legSeen = new Set<string>(); const legItems: { lo: string; c?: string }[] = [];
  for (const pc of qhVn) { const k = (pc.lo || '') + '|' + (pc.c || ''); if (pc.lo && !legSeen.has(k)) { legSeen.add(k); legItems.push({ lo: pc.lo, c: pc.c }); } }
  const legendHtml = legItems.length ? `<div class="legend">${legItems.slice(0, 8).map((z) => `<span><i style="background:${esc(z.c || '#cbd5e1')}"></i>${esc(z.lo)}</span>`).join('')}${(o.roadFeats || []).length ? '<span><i style="background:#111;height:2px;border:none"></i>Đường</span>' : ''}</div>` : '';

  // Thông tin quy hoạch — nhãn + CĂN CỨ theo lớp QH đang xem trên web (khớp popup, mặc định QH chung 2045).
  const ovAll = (o.overlaps || []).filter((x) => x && x.areaM2 > 0.5);
  const bdOf = (items: Overlap[]) => items.map((x) => `<b>${numVi(x.areaM2, 1)} m²</b> ${esc(x.type)}`).join('; ');
  const scen = o.scenario || '2045';
  const meta = QH_META[scen] || QH_META['2045'];
  // Nếu thửa có NHIỀU mã hz (nhiều kịch bản cùng phân loại) → lấy lớp diện tích lớn nhất, tránh CỘNG TRÙNG.
  const hzArea: Record<string, number> = {};
  for (const x of ovAll) if (x.hz && !isRoad(x.type)) hzArea[String(x.hz)] = (hzArea[String(x.hz)] || 0) + (Number(x.areaM2) || 0);
  const domHz = Object.keys(hzArea).sort((a, b) => hzArea[b] - hzArea[a])[0] || '';
  const items = ovAll.filter((x) => isRoad(x.type) || !x.hz || !domHz || String(x.hz) === domHz);
  const canCu = scen === 'HT' ? `Theo ${esc(meta.qd)}` : `Theo ${esc(meta.qd)} về việc phê duyệt ${esc(meta.ten)}`;
  const qhInfoHtml = items.length
    ? `<div class="qhb"><b>Căn cứ:</b> ${canCu}.<br><b>Nội dung:</b> Thửa đất có ${bdOf(items)}.</div>`
    : `<div class="cx">Chưa có dữ liệu quy hoạch số hóa tại thửa này.</div>`;
  // Mỗi bản quy hoạch khác một khối riêng, ghi rõ căn cứ + loại đất + diện tích.
  const banKhacHtml = (o.qhCacBan || [])
    .filter((b) => b && b.areas && b.areas.length)
    .map((b) => {
      const ds = b.areas.filter((x) => x && x.areaM2 > 0.5);
      if (!ds.length) return '';
      // Không in "chỉ phủ X% thửa" — chữ nghề, người cầm phiếu không hiểu.
      return `<div class="qhb"><b>Căn cứ:</b> ${esc(b.ten)}.<br><b>Nội dung:</b> Thửa đất có ${bdOf(ds)}.</div>`;
    })
    .join('');
  const qhTypes = ovAll.map((x) => x.type);

  const lng = o.point?.lng, lat = o.point?.lat;
  const now = new Date();
  const ma = `CLL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-T${esc(p.soTo || '-')}Th${esc(p.soThua || '-')}`;
  const mapUrl = `https://${SITE.domain}/map?` + (lng != null && lat != null ? `lng=${lng}&lat=${lat}&` : '') + `to=${encodeURIComponent(p.soTo || '')}&thua=${encodeURIComponent(p.soThua || '')}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=${encodeURIComponent(mapUrl)}`;
  const origin = (typeof window !== 'undefined' && window.location && window.location.origin) || ('https://' + SITE.domain);
  const logoSrc = o.logo || `${origin}/phieu/con-dau.png`;   // ưu tiên ảnh người dùng tải lên, sau đó file trong web
  const signSrc = o.sign || `${origin}/phieu/chu-ky.png`;
  const imgFb = "onerror=\"this.style.display='none';this.nextElementSibling.style.display='block'\"";
  const uName = esc(o.user?.name || '');
  const uPhone = esc(o.user?.phone || '');
  const diaChiThua = [p.xa, 'tỉnh Khánh Hòa'].filter(Boolean).map(esc).join(', ');

  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu quy hoạch — Thửa ${esc(p.soThua || '')} Tờ ${esc(p.soTo || '')}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { font-family: 'Times New Roman', serif; color: #111; font-size: 11px; line-height: 1.32; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .toolbar { background: #0A2540; color: #fff; padding: 7px 12px; display: flex; gap: 10px; align-items: center; justify-content: center; }
  .toolbar button { background: #C8A14B; color: #0A2540; font-weight: 700; border: none; border-radius: 8px; padding: 7px 18px; cursor: pointer; font-size: 13px; }
  .toolbar span { font-size: 11px; opacity: .85; }
  .wrap { max-width: 190mm; margin: 0 auto; padding: 8px; }
  .sheet { transform-origin: top center; }
  .hd { display: flex; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 1.5px solid #0A2540; padding-bottom: 5px; }
  .brand { display: flex; gap: 8px; align-items: center; }
  .logo { width: 42px; height: 42px; flex: none; } .logo img, .logo svg, .logo .fb { width: 42px; height: 42px; display: block; } .logo img { mix-blend-mode: multiply; }
  /* Ô logo đầu phiếu: nền navy bo góc, bên trong là ảnh logo nét sáng. */
  .lgbox { display: grid; place-items: center; width: 42px; height: 42px;
           border-radius: 11px; background: #0A2540; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .lgbox img, .lgbox svg { width: 33px !important; height: 22px !important; object-fit: contain; mix-blend-mode: normal !important; }
  .bname { font-weight: 800; color: #0A2540; font-size: 13px; }
  .bsub { font-size: 9px; color: #444; }
  .qrbox { text-align: center; font-size: 8px; color: #555; }
  .qrbox img { width: 52px; height: 52px; display: block; }
  h1 { text-align: center; font-size: 14px; margin: 7px 0 1px; text-transform: uppercase; color: #0A2540; font-weight: 800; }
  .sub { text-align: center; font-size: 9.5px; font-style: italic; color: #555; }
  .ma { text-align: center; font-size: 9px; color: #b45309; font-family: Consolas, monospace; margin-top: 1px; }
  ol.fld { margin: 6px 0 3px; padding-left: 18px; }
  ol.fld li { margin: 1.5px 0; }
  .warn { font-style: italic; font-size: 10px; color: #7a1010; margin: 2px 0 4px; }
  input.e { border: none; border-bottom: 1px dotted #888; font-family: inherit; font-size: inherit; padding: 0 2px; min-width: 70px; background: transparent; }
  input.e:focus { outline: none; border-bottom-color: #0A2540; }
  .sec { font-weight: 700; color: #0A2540; border-left: 3px solid #C8A14B; padding-left: 5px; margin: 7px 0 3px; font-size: 11px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 0.7px solid #444; padding: 2px 5px; font-size: 10px; vertical-align: top; }
  th { background: #0A2540; color: #fff; font-weight: 600; }
  td.c { text-align: center; } td.r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tcoord th, .tcoord td { font-size: 8.5px; padding: 1px 4px; line-height: 1.25; }
  .kh { display: inline-grid; place-items: center; width: 15px; height: 15px; border: 1px solid #111; border-radius: 50%; font-size: 9px; font-weight: 700; line-height: 1; }
  .grid2 { display: flex; gap: 12px; align-items: stretch; }
  .grid2 > div { flex: 1; min-width: 0; }
  .grid2 > div:first-child { flex: 6; }
  .grid2 > div:last-child { flex: 4; }
  .diagram { border: 0.8px solid #94a3b8; border-radius: 5px; padding: 3px; background: #fff; }
  .zoomctl { position: absolute; top: 5px; left: 5px; display: flex; flex-direction: column; gap: 3px; z-index: 6; }
  .zoomctl button { width: 23px; height: 23px; border: 1px solid #cbd5e1; background: rgba(255,255,255,.92); border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: 800; color: #0A2540; line-height: 1; padding: 0; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
  .zoomctl button:hover { border-color: #C8A14B; color: #C8A14B; }
  .northind { position: absolute; top: 3px; right: 7px; display: flex; flex-direction: column; align-items: center; z-index: 5; line-height: 1; }
  .northind b { font-size: 10px; font-weight: 800; color: #111; margin-top: 1px; }
  .legend { margin-top: 3px; display: flex; flex-wrap: wrap; gap: 3px 10px; font-size: 9px; }
  .lg { display: inline-flex; align-items: center; } .lg i { width: 10px; height: 10px; border-radius: 2px; margin-right: 3px; opacity: .55; border: 0.5px solid rgba(0,0,0,.25); }
  .note { font-size: 9px; color: #555; font-style: italic; margin-top: 3px; }
  .cx { border: 1px dotted #cbd5e1; border-radius: 4px; padding: 3px 6px; margin-top: 4px; font-size: 9.5px; color: #333; }
  .qhb { font-size: 9.5px; line-height: 1.32; color: #222; padding: 2px 6px; margin-top: 3px; border-left: 2px solid #C8A14B; background: #faf7ef; }
  .legend { display: flex; flex-wrap: wrap; gap: 2px 8px; margin: 3px 1px 0; font-size: 8.5px; color: #333; }
  .legend span { display: inline-flex; align-items: center; gap: 3px; }
  .legend i { width: 10px; height: 10px; border-radius: 2px; border: 0.5px solid #999; display: inline-block; flex: none; }
  .qhb b { color: #0A2540; }
  .disc { margin-top: 6px; font-size: 9px; color: #444; border: 1px dashed #b45309; background: #fffbeb; border-radius: 5px; padding: 4px 7px; }
  .ghichu { border: 0.8px solid #94a3b8; border-radius: 5px; min-height: 34px; padding: 4px 6px; margin-top: 4px; font-size: 10px; }
  .sign { display: flex; justify-content: space-around; gap: 6px; margin-top: 8px; text-align: center; }
  .sign > div { width: 44%; }
  .sign .day { font-size: 9.5px; font-style: italic; color: #555; }
  .sign .role { font-weight: 700; font-size: 10.5px; margin-top: 1px; } .sign .hint { font-size: 9px; font-style: italic; color: #666; } .sign .sp { height: 84px; }
  .signbox { position: relative; height: 94px; margin-top: 1px; }
  .signbox .kymau { position: absolute; left: 57%; top: 52%; width: 122px; transform: translate(-50%,-50%) rotate(-3deg); }
  .signbox .stamp { position: absolute; left: 45%; top: 50%; width: 82px; transform: translate(-50%,-50%) rotate(-2deg); }
  .signbox img, .signbox svg { width: 100%; height: auto; display: block; }
  .signbox img { mix-blend-mode: multiply; }
  .fb { display: none; }
  @media print { .toolbar { display: none; } input.e { border-bottom: none; } .wrap { padding: 0; } .noprint { display: none !important; } }
</style></head>
<body>
  <div class="toolbar"><button onclick="try{window.close()}catch(e){}setTimeout(function(){if(!window.closed){if(history.length>1){history.back()}else{location.href='/map'}}},200)" style="background:#fff;color:#0A2540">← Quay lại</button><button onclick="window.print()">🖨 In / Lưu PDF (1 trang A4)</button><span>Chỉ cần điền mục 1 (người yêu cầu) và mục 4 (mục đích SDĐ) trước khi in</span></div>
  <div class="wrap"><div class="sheet">
    <div class="hd">
      <div class="brand">${navLogo(origin)}<div><div class="bname">${SITE.ten}</div><div class="bsub">${SITE.mota} · ☎ ${SITE.hotline} · ${SITE.domain}</div></div></div>
      <div class="qrbox"><img id="qr" src="${qrSrc}" alt="QR" onerror="this.style.display='none'"><div>Quét mở thửa</div></div>
    </div>

    <h1>Phiếu cung cấp thông tin quy hoạch thửa đất</h1>
    <div class="sub">(Bản trích lục tham khảo — lập tự động từ dữ liệu bản đồ quy hoạch số hóa)</div>
    <div class="ma">Mã tra cứu: ${ma}</div>

    <ol class="fld">
      <li>Tên người yêu cầu: <input class="e" style="min-width:150px" value="${uName}"> · Số CC/CCCD: <input class="e" style="min-width:110px"> · Số ĐT: <input class="e" value="${uPhone}"><br>Địa chỉ liên hệ: <input class="e" style="min-width:70%"></li>
      <li>Số thửa/tờ thửa đất: Thửa <b>${esc(p.soThua || '—')}</b>, Tờ bản đồ số <b>${esc(p.soTo || '—')}</b>${p.xa ? ' — Thuộc bộ bản đồ địa chính ' + esc(p.xa) : ''}, tỉnh Khánh Hòa</li>
      <li>Diện tích: <b>${numVi(dt, 1)} m²</b></li>
      <li>Mục đích sử dụng đất: <input class="e" style="min-width:130px" value="${esc(mdsd)}"></li>
      <li>Mục đích sử dụng thông tin, dữ liệu: <b>Tham khảo</b></li>
    </ol>

    <div class="grid2">
      <div>
        <div class="sec" style="margin-top:0">Sơ đồ thửa đất & quy hoạch</div>
        <div class="diagram" style="position:relative">
          <div class="zoomctl noprint"><button id="zin" type="button" title="Phóng to">＋</button><button id="zout" type="button" title="Thu nhỏ">－</button><button id="zreset" type="button" title="Về mặc định">⟳</button></div>
          <div class="northind"><svg viewBox="0 0 24 34" width="13" height="19"><line x1="12" y1="31" x2="12" y2="8" stroke="#111" stroke-width="2"/><polygon points="12,2 7,12 17,12" fill="#111"/></svg><b>B</b></div>
          ${buildSvgRaster(ring as [number, number][], dt, { soThua: p.soThua || '', neighbors: o.neighbors || [], origin })}
        </div>
        ${legendHtml}
        <div class="sec" style="margin-top:5px">Thông tin quy hoạch</div>
        ${qhInfoHtml}
        ${banKhacHtml}
      </div>
      <div>
        <div class="sec" style="margin-top:0">Bảng kê toạ độ và khoảng cách (Hệ tọa độ VN-2000)</div>
        ${vn.length >= 3 ? `<table class="tcoord">
          <tr><th style="width:18%">Góc thửa</th><th>X (m)</th><th>Y (m)</th><th style="width:20%">S (m)</th></tr>
          ${vn.map((pt, i) => `<tr><td class="c">${i + 1}</td><td class="r">${numVi(pt.N)}</td><td class="r">${numVi(pt.E)}</td><td class="r">${numVi(edges[i])}</td></tr>`).join('')}
          <tr><td class="c">1</td><td class="r">${numVi(vn[0].N)}</td><td class="r">${numVi(vn[0].E)}</td><td class="r"></td></tr>
        </table>` : '<div class="note">Thửa chưa có ranh số hóa.</div>'}
      </div>
    </div>

    <div class="sec">Ghi chú</div>
    <div class="ghichu"><b>Miễn trừ trách nhiệm:</b> Bản trích lục do ${SITE.ten} lập tự động từ dữ liệu số hóa, chỉ mang tính tham khảo, không thay thế giấy tờ, trích lục hay văn bản do cơ quan Nhà nước có thẩm quyền cấp; diện tích, toạ độ và ranh quy hoạch có thể sai lệch so với hồ sơ địa chính gốc.</div>

    <div class="sign">
      <div><div class="day">Ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}</div><div class="role">NGƯỜI YÊU CẦU</div><div class="hint">(Ký, ghi rõ họ tên)</div><div class="sp"></div></div>
      <div><div class="day">Ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}</div><div class="role">${SITE.ten}</div><div class="hint">(Người lập phiếu)</div><div class="signbox"><div class="kymau"><img src="${signSrc}" alt="chữ ký" ${imgFb}><span class="fb">${signSvg()}</span></div><div class="stamp"><img src="${logoSrc}" alt="con dấu" ${imgFb}><span class="fb">${stampSvg()}</span></div></div></div>
    </div>
  </div></div>
  <script>
    try { window.focus(); } catch (e) {}
    (function(){ function fit(){ var s=document.querySelector('.sheet'); if(!s) return; s.style.zoom=''; var maxH=1040; var h=s.scrollHeight; if(h>maxH){ s.style.zoom=(maxH/h).toFixed(4); } }
      if(document.readyState!=='loading') setTimeout(fit,60); else window.addEventListener('load',function(){setTimeout(fit,60);}); })();
    // Zoom/di chuyển SƠ ĐỒ theo ý người dùng: con lăn chuột, kéo thả, chụm 2 ngón, nút +/-/reset.
    (function(){
      var svg=document.getElementById('qhsvg'); if(!svg) return;
      var vb={x:0,y:0,w:400,h:300};
      function apply(){ svg.setAttribute('viewBox', vb.x.toFixed(2)+' '+vb.y.toFixed(2)+' '+vb.w.toFixed(2)+' '+vb.h.toFixed(2)); }
      function toSvg(cx,cy){ var r=svg.getBoundingClientRect(); return {x:vb.x+(cx-r.left)/r.width*vb.w, y:vb.y+(cy-r.top)/r.height*vb.h}; }
      function zoomAt(f,sx,sy){ var nw=vb.w*f; if(nw>1600||nw<100) return; vb.x=sx-(sx-vb.x)*f; vb.y=sy-(sy-vb.y)*f; vb.w=nw; vb.h=vb.h*f; apply(); }
      svg.addEventListener('wheel',function(e){ e.preventDefault(); var p=toSvg(e.clientX,e.clientY); zoomAt(e.deltaY>0?1.12:0.892,p.x,p.y); },{passive:false});
      var drag=null;
      svg.addEventListener('mousedown',function(e){ drag={cx:e.clientX,cy:e.clientY,vx:vb.x,vy:vb.y}; svg.style.cursor='grabbing'; e.preventDefault(); });
      window.addEventListener('mousemove',function(e){ if(!drag)return; var r=svg.getBoundingClientRect(); vb.x=drag.vx-(e.clientX-drag.cx)/r.width*vb.w; vb.y=drag.vy-(e.clientY-drag.cy)/r.height*vb.h; apply(); });
      window.addEventListener('mouseup',function(){ if(drag){drag=null; svg.style.cursor='grab';} });
      var tp=null, dist=function(t){return Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);}, mid=function(t){return {x:(t[0].clientX+t[1].clientX)/2,y:(t[0].clientY+t[1].clientY)/2};};
      svg.addEventListener('touchstart',function(e){ if(e.touches.length===2){tp={d:dist(e.touches)};} else if(e.touches.length===1){drag={cx:e.touches[0].clientX,cy:e.touches[0].clientY,vx:vb.x,vy:vb.y};} },{passive:false});
      svg.addEventListener('touchmove',function(e){ e.preventDefault();
        if(e.touches.length===2&&tp){ var nd=dist(e.touches),m=mid(e.touches),p=toSvg(m.x,m.y); zoomAt(tp.d/nd,p.x,p.y); tp.d=nd; }
        else if(e.touches.length===1&&drag){ var r=svg.getBoundingClientRect(); vb.x=drag.vx-(e.touches[0].clientX-drag.cx)/r.width*vb.w; vb.y=drag.vy-(e.touches[0].clientY-drag.cy)/r.height*vb.h; apply(); } },{passive:false});
      svg.addEventListener('touchend',function(e){ if(e.touches.length<2)tp=null; if(e.touches.length===0)drag=null; });
      function b(id,f){ var el=document.getElementById(id); if(el) el.onclick=function(){ zoomAt(f,vb.x+vb.w/2,vb.y+vb.h/2); }; }
      b('zin',0.83); b('zout',1.2);
      var zr=document.getElementById('zreset'); if(zr) zr.onclick=function(){ vb={x:0,y:0,w:400,h:300}; apply(); };
    })();
  </script>
</body></html>`;
}

export function openPhieuQh(opts: PhieuOpts) {
  try {
    const w = window.open('', '_blank');
    if (!w) { alert('Trình duyệt đang chặn cửa sổ in. Hãy cho phép pop-up cho trang này rồi thử lại.'); return; }
    w.document.open(); w.document.write(buildHtml(opts)); w.document.close();
  } catch (e: any) { alert('Không tạo được phiếu: ' + (e?.message || e)); }
}

// Trả HTML phiếu để ghi vào cửa sổ đã mở sẵn (dùng khi cần tính toán BẤT ĐỒNG BỘ trước, tránh bị chặn pop-up).
export function phieuQhHtml(opts: PhieuOpts): string { return buildHtml(opts); }
