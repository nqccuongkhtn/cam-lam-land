// Tính diện tích QH theo THỬA — chạy TƯƠI mỗi lần tra (đổi/nạp địa chính vẫn đúng, không cần precompute).
// CÁCH C (khớp qhviet ±3%): ranh ĐƯỜNG lấy từ MẶT NẠ raster dựng bằng flood-fill trên mép đường DXF
//   (GIỮ CUNG cong thật) → mỗi điểm trong thửa: nằm trong lòng đường ⇒ Đất giao thông;
//   ngoài đường ⇒ LOẠI ĐẤT = ô QH chứa điểm (hoặc ô QH gần nhất nếu qh_vector vẽ thiếu vài mét).
// Nhờ vậy thửa kiểu 326 (qh_vector vẽ thiếu ~10%) vẫn ra đủ 72% hỗn hợp thay vì bị tính nhầm thành giao thông.
// Dữ liệu: qh_zones.json (loại đất) + road_mask.bin/json (đường). Ngoài phạm vi mask ⇒ tự lùi về cách "không-thuộc-ô = giao thông".
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.QH_DATA_DIR ?? path.resolve(process.cwd(), 'data');
const CELL = 0.0005; // ô lưới chỉ mục vùng (~55m)

type Zone = [number, number, number, number, number[][], string, number, number]; // minx,miny,maxx,maxy, ring, loại, diện, bậc(2=QH/1=HT)

let ZONE: Zone[] = [];
const zoneIdx = new Map<string, number[]>();
let ready = false;
// Khung bao của TOÀN BỘ dữ liệu quy hoạch (hiện chỉ có QĐ205 — huyện Cam Lâm cũ).
// Ra ngoài khung này là KHÔNG CÓ dữ liệu quy hoạch, phải nói thẳng "chưa có" chứ tuyệt đối
// không được đoán. Trước đây thiếu khung này nên một thửa ở Nha Trang bị trả về
// "Đất giao thông" phủ kín cả thửa — nhìn như kết quả thật, rất dễ tin nhầm.
let zX0 = Infinity, zY0 = Infinity, zX1 = -Infinity, zY1 = -Infinity;

try {
  ZONE = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'qh_zones.json'), 'utf-8'));
  for (let k = 0; k < ZONE.length; k++) {
    const z = ZONE[k];
    if (z[0] < zX0) zX0 = z[0]; if (z[1] < zY0) zY0 = z[1];
    if (z[2] > zX1) zX1 = z[2]; if (z[3] > zY1) zY1 = z[3];
    const gx0 = Math.floor(z[0] / CELL), gx1 = Math.floor(z[2] / CELL);
    const gy0 = Math.floor(z[1] / CELL), gy1 = Math.floor(z[3] / CELL);
    for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
      const key = `${gx},${gy}`; let a = zoneIdx.get(key); if (!a) { a = []; zoneIdx.set(key, a); } a.push(k);
    }
  }
  ready = ZONE.length > 0;
  console.log(`[qhCompute] nạp ${ZONE.length} ô đất QH · phạm vi ${zX0.toFixed(4)},${zY0.toFixed(4)} → ${zX1.toFixed(4)},${zY1.toFixed(4)}`);
} catch (e: any) {
  console.log('[qhCompute] thiếu qh_zones.json → dùng cách cũ:', e?.message || e);
}

// ── MẶT NẠ ĐƯỜNG (raster bit-packed, giữ cung từ DXF) ──────────────────────────
let MASK: Buffer | null = null;
let mX0 = 0, mY0 = 0, mX1 = 0, mY1 = 0, mW = 0, mH = 0, mRB = 0;
try {
  const meta = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'road_mask.json'), 'utf-8'));
  mX0 = meta.x0; mY0 = meta.y0; mX1 = meta.x1; mY1 = meta.y1; mW = meta.W; mH = meta.H; mRB = meta.rowbytes;
  MASK = fs.readFileSync(path.join(DATA_DIR, 'road_mask.bin'));
  console.log(`[qhCompute] nạp mặt nạ đường ${mW}x${mH} (${Math.round(MASK.length / 1024)} KB) — cách C: mask đường + ô đất gần nhất`);
} catch (e: any) {
  console.log('[qhCompute] thiếu road_mask → cách B (không-thuộc-ô = giao thông):', e?.message || e);
}

export function qhReady() { return ready; }

// Thửa này có nằm trong vùng ĐÃ CÓ dữ liệu quy hoạch không?
// Chưa nạp dữ liệu QH thì coi như KHÔNG có vùng nào → mọi nơi đều "ngoài vùng".
//
// ⚠️ CHỈ so KHUNG BAO là KHÔNG ĐỦ: khung bao của QĐ205 là hình chữ nhật, trùm cả một phần
// Cam Ranh và nam Nha Trang — mấy chỗ đó không hề có ô đất quy hoạch nào nhưng vẫn lọt.
// Nên sau bước loại nhanh bằng khung bao, phải hỏi tiếp: quanh thửa có ô đất QH nào không.
const NOI = 0.001; // ~110m, nới quanh khung bao để thửa sát mép vẫn tính là trong vùng
export function ngoaiVungQh(ring: number[][] | null | undefined): boolean {
  if (!ready) return true;
  if (!ring || ring.length < 3) return false;   // không biết hình thửa thì đừng kết luận
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const c of ring) { if (c[0] < minx) minx = c[0]; if (c[0] > maxx) maxx = c[0]; if (c[1] < miny) miny = c[1]; if (c[1] > maxy) maxy = c[1]; }
  if (maxx < zX0 - NOI || minx > zX1 + NOI || maxy < zY0 - NOI || miny > zY1 + NOI) return true;
  // Quanh thửa (bán kính ~550m) có ô đất quy hoạch nào không? Chỉ cần có một ô là coi như
  // khu vực này ĐÃ có dữ liệu, phần trống bên trong vẫn tính theo cách cũ (lòng đường).
  // Vì sao lấy tận 550m mà không phải 50m: trong huyện Cam Lâm có những khoảng trống rộng
  // hơn trăm mét (hành lang đường lớn, mặt nước…), lấy ngưỡng hẹp là mấy thửa đó bị hiểu
  // nhầm thành "chưa có dữ liệu". Còn Nha Trang, Cam Ranh thì cách ô gần nhất hàng cây số
  // nên hai bên vẫn tách bạch rõ ràng.
  const PHU = 0.005;
  const gx0 = Math.floor((minx - PHU) / CELL), gx1 = Math.floor((maxx + PHU) / CELL);
  const gy0 = Math.floor((miny - PHU) / CELL), gy1 = Math.floor((maxy + PHU) / CELL);
  for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
    if (zoneIdx.has(`${gx},${gy}`)) return false;
  }
  return true;
}

// Đường tại điểm: 1=đường, 0=đất, null=ngoài phạm vi mask.
function roadAt(x: number, y: number): 0 | 1 | null {
  if (!MASK) return null;
  if (x < mX0 || x > mX1 || y < mY0 || y > mY1) return null;
  const gx = Math.floor((x - mX0) / (mX1 - mX0) * mW);
  const gy = Math.floor((1 - (y - mY0) / (mY1 - mY0)) * mH);
  if (gx < 0 || gx >= mW || gy < 0 || gy >= mH) return null;
  const byte = MASK[gy * mRB + (gx >> 3)];
  return (((byte >> (7 - (gx & 7))) & 1) ? 1 : 0);
}

function pip(x: number, y: number, r: number[][]): boolean {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

// Ô đất CHỨA điểm: ưu tiên bậc cao (QH>HT); cùng bậc lấy ô NHỎ nhất (cụ thể nhất).
function landAt(x: number, y: number): string | null {
  const key = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
  const cand = zoneIdx.get(key); if (!cand) return null;
  let bt = -1, bar = Infinity, blo: string | null = null;
  for (const k of cand) {
    const z = ZONE[k];
    if (z[7] < bt) continue;
    if (x < z[0] || x > z[2] || y < z[1] || y > z[3]) continue;
    if (!pip(x, y, z[4])) continue;
    if (z[7] > bt || z[6] < bar) { bt = z[7]; bar = z[6]; blo = z[5]; }
  }
  return blo;
}

// Khoảng cách điểm→đoạn (độ, chỉ để so sánh).
function d2seg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay; const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + t * dx, cy = ay + t * dy; const ex = px - cx, ey = py - cy;
  return ex * ex + ey * ey;
}

// Ô đất GẦN NHẤT trong bán kính ~50m (dùng cho điểm-đất mà qh_vector vẽ thiếu → không rơi vào ô nào).
const NEAR = 0.00045; // ~50m
function nearestLand(x: number, y: number): string | null {
  const gx0 = Math.floor((x - NEAR) / CELL), gx1 = Math.floor((x + NEAR) / CELL);
  const gy0 = Math.floor((y - NEAR) / CELL), gy1 = Math.floor((y + NEAR) / CELL);
  const seen = new Set<number>(); let bd = NEAR * NEAR, bt = -1; let blo: string | null = null;
  for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
    const cand = zoneIdx.get(`${gx},${gy}`); if (!cand) continue;
    for (const k of cand) {
      if (seen.has(k)) continue; seen.add(k);
      const z = ZONE[k]; const r = z[4]; let dmin = Infinity;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const d = d2seg(x, y, r[j][0], r[j][1], r[i][0], r[i][1]); if (d < dmin) dmin = d;
      }
      // ưu tiên bậc cao hơn; cùng phạm vi thì gần hơn
      if (z[7] > bt || (z[7] === bt && dmin < bd)) { if (dmin <= NEAR * NEAR) { bd = dmin; bt = z[7]; blo = z[5]; } }
    }
  }
  return blo;
}

// ring: [[lng,lat],…] WGS84 (ranh ngoài thửa); dienTich: diện tích thửa (m²) từ DB.
export function computeQhAreas(ring: number[][], dienTich: number): { type: string; hz: string; areaM2: number }[] | null {
  if (!ready || !ring || ring.length < 3 || !(dienTich > 0)) return null;
  // Ngoài phạm vi dữ liệu QH (vd Nha Trang, Ninh Hoà…) thì KHÔNG tính gì cả.
  // Bỏ bước này là mọi điểm đều rơi vào nhánh "ngoài mặt nạ ⇒ Đất giao thông" bên dưới,
  // thửa nào cũng ra "Đất giao thông" phủ kín — sai mà nhìn như thật.
  if (ngoaiVungQh(ring)) return null;
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const c of ring) { if (c[0] < minx) minx = c[0]; if (c[0] > maxx) maxx = c[0]; if (c[1] < miny) miny = c[1]; if (c[1] > maxy) maxy = c[1]; }
  const N = 44; const cnt: Record<string, number> = {}; let ins = 0;
  for (let iy = 0; iy < N; iy++) for (let ix = 0; ix < N; ix++) {
    const x = minx + (maxx - minx) * (ix + 0.5) / N, y = miny + (maxy - miny) * (iy + 0.5) / N;
    if (!pip(x, y, ring)) continue; ins++;
    const r = roadAt(x, y);          // 1=lòng đường, 0=đất, null=ngoài phạm vi mask
    const z = landAt(x, y);          // ô đất CHỨA điểm
    let lo: string;
    if (z) lo = z;                                            // rơi vào 1 ô QH ⇒ loại đó
    else {
      const near = nearestLand(x, y);                        // ô QH gần nhất ≤50m (null nếu xa)
      if (near) lo = (r === 1) ? 'Đất giao thông' : near;    // trong vùng QH: lòng đường=gt, khe hở vẽ thiếu=ô gần nhất
      // Điểm xa mọi ô đất: TRONG vùng quy hoạch thì đó là lòng đường (cách B) — giữ nguyên,
      // vì đây là chỗ làm cho kết quả khớp app tham chiếu ±3%. Còn thửa nằm HẲN ngoài vùng
      // quy hoạch thì đã bị chặn từ đầu hàm rồi, không xuống tới đây.
      else lo = (r === null) ? 'Đất giao thông' : 'Đất khác'; // ngoài mask→cách B; trong mask mà xa mọi ô⇒ngoài QĐ205
    }
    cnt[lo] = (cnt[lo] || 0) + 1;
  }
  if (ins < 4) return null;
  const out = Object.entries(cnt).map(([lo, n]) => ({ type: lo, hz: '2045', areaM2: Math.round((dienTich * n / ins) * 10) / 10 }));
  out.sort((a, b) => b.areaM2 - a.areaM2);
  return out.filter((o) => o.areaM2 > 0.4);
}

// Lấy ranh ngoài (lớn nhất) từ 1 GeoJSON geometry.
export function outerRing(geom: any): number[][] | null {
  if (!geom) return null;
  if (geom.type === 'Polygon') return (geom.coordinates?.[0] as number[][]) || null;
  if (geom.type === 'MultiPolygon') {
    let best: number[][] | null = null, bn = 0;
    for (const poly of geom.coordinates || []) { const r = poly?.[0]; if (r && r.length > bn) { bn = r.length; best = r; } }
    return best;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// CÁC BẢN QUY HOẠCH KHÁC (ngoài QĐ205)
// ═══════════════════════════════════════════════════════════════════════════
// Một thửa ở Cam Lâm thường bị NHIỀU bản quy hoạch phủ chồng lên nhau: QĐ205 trùm cả huyện,
// bên trong còn QĐ893 (sử dụng đất) và ba bản phân khu 1/2000. Không bản nào "thắng" bản nào —
// nên web LIỆT KÊ RIÊNG từng bản, mỗi bản ghi rõ dính loại đất gì, bao nhiêu m².
//
// ⚠️ CỐ Ý KHÔNG đụng gì tới computeQhAreas() ở trên. Kết quả QĐ205 đã chỉnh cho khớp app tham
// chiếu ±3%, thêm bản mới mà làm lệch con số cũ là hỏng thứ đang đúng.
//
// Cách tính ở đây ĐƠN GIẢN HƠN QĐ205: chỉ đếm điểm rơi vào ô đất. KHÔNG có nhánh "điểm xa mọi
// ô ⇒ đất giao thông" — nhánh đó là cách bù riêng cho QĐ205 (mặt nạ đường dựng từ DXF của nó).
// Điểm không rơi vào ô nào của bản nào thì bản đó đơn giản là KHÔNG phủ chỗ đó.

// `na` = MẶT NẠ ĐƯỜNG riêng của bản đó (ảnh bit, 1 = lòng đường), dựng bằng
// scripts/qh-pipeline/6-tao-mat-na-duong.py. Dùng để trả lời phần thửa rơi vào chỗ TRẮNG của
// bản vẽ (bản vẽ chỉ tô ô đất, phần đường để trắng). Đo thật trên 43 thửa QĐ2101: có mặt nạ thì
// tỉ lệ phủ trung bình lên 91,8% → 99,7%, số thửa phủ đủ 100% lên 28 → 39.
interface MatNa { buf: Buffer; x0: number; y0: number; x1: number; y1: number; W: number; H: number; rb: number; }
interface BanQh { ma: string; ten: string; zone: Zone[]; idx: Map<string, number[]>; na: MatNa | null; }
const BAN_KHAC: BanQh[] = [];

for (const b of [
  { ma: '893',  ten: 'QĐ893 — Quy hoạch sử dụng đất đến 2030', tep: 'qh_zones_893.json' },
  { ma: '2076', ten: 'QĐ2076 — Quy hoạch phân khu phía Bắc 1/2000',     tep: 'qh_zones_2076.json' },
  { ma: '2101', ten: 'QĐ2101 — Quy hoạch phân khu trung tâm 1/2000',     tep: 'qh_zones_2101.json' },
  { ma: '2222', ten: 'QĐ2222 — Quy hoạch 1/2000',              tep: 'qh_zones_2222.json' },
  { ma: '918',  ten: 'QĐ918 — Quy hoạch phân khu phức hợp phía Tây 1/2000', tep: 'qh_zones_918.json' },
  // Bản vẽ gốc: quyhoach2025/phân khu cù hin 1.2000.dxf (nạp 14/9/2026). Chưa có số quyết định.
  { ma: 'cuhin', ten: 'Quy hoạch phân khu Cù Hin 1/2000', tep: 'qh_zones_cuhin.json' },
  // Bản vẽ gốc: quyhoach2025/Tay Nam da sua - ban cuoi.dxf (chủ dự án sửa 2 chỗ, nạp 14/9/2026).
  { ma: 'taynam', ten: 'Quy hoạch phân khu Tây Nam 1/2000', tep: 'qh_zones_taynam.json' },
]) {
  try {
    const zone: Zone[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, b.tep), 'utf-8'));
    if (!zone.length) continue;
    const idx = new Map<string, number[]>();
    for (let k = 0; k < zone.length; k++) {
      const z = zone[k];
      const gx0 = Math.floor(z[0] / CELL), gx1 = Math.floor(z[2] / CELL);
      const gy0 = Math.floor(z[1] / CELL), gy1 = Math.floor(z[3] / CELL);
      for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
        const key = `${gx},${gy}`; let a = idx.get(key); if (!a) { a = []; idx.set(key, a); } a.push(k);
      }
    }
    let na: MatNa | null = null;
    try {
      const m = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `road_mask_${b.ma}.json`), 'utf-8'));
      na = { buf: fs.readFileSync(path.join(DATA_DIR, `road_mask_${b.ma}.bin`)),
             x0: m.x0, y0: m.y0, x1: m.x1, y1: m.y1, W: m.W, H: m.H, rb: m.rowbytes };
    } catch { na = null; }   // chưa có mặt nạ thì thôi, chỉ là phần trăm phủ thấp hơn
    BAN_KHAC.push({ ma: b.ma, ten: b.ten, zone, idx, na });
    console.log(`[qhCompute] nạp bản ${b.ma}: ${zone.length} ô đất${na ? ` + mặt nạ đường ${na.W}x${na.H}` : ' (chưa có mặt nạ đường)'}`);
  } catch {
    console.log(`[qhCompute] chưa có ${b.tep} — bỏ qua bản ${b.ma}`);
  }
}

// Ô đất chứa điểm, trong MỘT bản. Cùng kiểu chọn với landAt: bậc cao thắng, cùng bậc thì ô NHỎ
// hơn thắng (ô nhỏ = vẽ cụ thể hơn, vd lô nhà ở nằm trong khối đơn vị ở).
function landAtBan(b: BanQh, x: number, y: number): string | null {
  const cand = b.idx.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`);
  if (!cand) return null;
  let bt = -1, bar = Infinity, blo: string | null = null;
  for (const k of cand) {
    const z = b.zone[k];
    if (z[7] < bt) continue;
    if (x < z[0] || x > z[2] || y < z[1] || y > z[3]) continue;
    if (!pip(x, y, z[4])) continue;
    if (z[7] > bt || z[6] < bar) { bt = z[7]; bar = z[6]; blo = z[5]; }
  }
  return blo;
}

// Điểm này có nằm trong lòng đường của bản đó không (đọc 1 bit trong ảnh mặt nạ).
function duongBan(b: BanQh, x: number, y: number): boolean {
  const m = b.na;
  if (!m) return false;
  if (x < m.x0 || x > m.x1 || y < m.y0 || y > m.y1) return false;
  const gx = Math.floor((x - m.x0) / (m.x1 - m.x0) * m.W);
  const gy = Math.floor((1 - (y - m.y0) / (m.y1 - m.y0)) * m.H);
  if (gx < 0 || gx >= m.W || gy < 0 || gy >= m.H) return false;
  return !!((m.buf[gy * m.rb + (gx >> 3)] >> (7 - (gx & 7))) & 1);
}

// Nhãn do scripts/qh-pipeline/5-tao-qh-zones.py gắn cho ô mà BẢN VẼ KHÔNG GHI loại đất.
// Trước đây mấy ô này bị vứt hẳn khỏi dữ liệu, để lại LỖ TRỐNG giữa bản đồ — riêng QĐ893 thủng
// 4.846 ô (~8.861 ha). Hậu quả: thửa nào rơi phần lớn vào lỗ thì tỉ lệ phủ tụt xuống dưới ngưỡng
// 20% và CẢ BẢN QUY HOẠCH biến mất khỏi phiếu (đo ở Cam Đức: cứ 5 thửa thì 1 thửa mất dòng QĐ893).
// Giữ ô lại, ghi thẳng là chưa rõ, và để bậc 0 nên không bao giờ che mất ô có tên thật.
const CHUA_RO = 'Chưa ghi loại đất trong bản vẽ';
// Phần thửa nằm NGOÀI phạm vi bản quy hoạch đó (bản chỉ trùm một phần thửa).
const NGOAI_BAN = 'Nằm ngoài phạm vi bản quy hoạch này';

export interface KetQuaBan { ma: string; ten: string; areas: { type: string; areaM2: number }[]; phuTramPhanTram: number; }

/** Thửa này dính những bản quy hoạch nào — mỗi bản liệt kê loại đất + diện tích. */
export function computeQhTheoBan(ring: number[][], dienTich: number): KetQuaBan[] {
  if (!ring || ring.length < 3 || !(dienTich > 0) || !BAN_KHAC.length) return [];
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const c of ring) { if (c[0] < minx) minx = c[0]; if (c[0] > maxx) maxx = c[0]; if (c[1] < miny) miny = c[1]; if (c[1] > maxy) maxy = c[1]; }
  const N = 44;
  const dem: Record<string, Record<string, number>> = {};
  const demO: Record<string, number> = {};   // số điểm rơi vào Ô ĐẤT THẬT của từng bản
  let ins = 0;
  for (let iy = 0; iy < N; iy++) for (let ix = 0; ix < N; ix++) {
    const x = minx + (maxx - minx) * (ix + 0.5) / N, y = miny + (maxy - miny) * (iy + 0.5) / N;
    if (!pip(x, y, ring)) continue;
    ins++;
    for (const b of BAN_KHAC) {
      // Ô đất trước; không thuộc ô nào thì hỏi mặt nạ đường của CHÍNH bản đó (không mượn bản khác).
      const o = landAtBan(b, x, y);
      if (o) demO[b.ma] = (demO[b.ma] || 0) + 1;
      const lo = o || (duongBan(b, x, y) ? 'Đất giao thông' : null);
      if (!lo) continue;
      (dem[b.ma] ||= {})[lo] = ((dem[b.ma] || {})[lo] || 0) + 1;
    }
  }
  if (ins < 4) return [];
  const ra: KetQuaBan[] = [];
  for (const b of BAN_KHAC) {
    const d = dem[b.ma];
    // ⚠️ BẮT BUỘC phải có ít nhất một điểm rơi vào Ô ĐẤT THẬT mới được báo bản này.
    // Mặt nạ đường có vùng đệm ~220m quanh bản vẽ; thửa nằm HẲN NGOÀI bản mà chỉ lọt vào
    // vùng đệm sẽ ra 'Đất giao thông' phủ kín cả thửa — sai mà nhìn y như thật, đúng cái
    // bẫy đã từng làm mọi thửa ở Nha Trang hiện 'Đất giao thông'.
    if (!d || !demO[b.ma]) continue;
    // ⛔ ĐÃ BỎ luật "phủ dưới 20% thì không liệt kê".
    // Luật đó GIẤU LUÔN cả bản quy hoạch, mà giấu thì người tra cứu không hề biết là có thứ bị
    // giấu — nguy hiểm hơn hẳn cái nó định tránh. Nó cũng đo sai bản chất: thửa tờ 24 thửa 34
    // (Cam Đức) ra 19,8%, hụt 0,2% là mất trắng dòng QĐ893, trong khi 19,8% đó là do dữ liệu
    // THỦNG LỖ chứ không phải bản quy hoạch không phủ tới.
    // Nỗi lo ban đầu — in "Đất ở tại đô thị 63,6 m²" trên thửa 1.039 m² thì người đọc tưởng cả
    // thửa chỉ có ngần ấy — xử lý đúng cách là GHI NỐT PHẦN CÒN LẠI (xem NGOAI_BAN bên dưới),
    // để các con số cộng lại luôn bằng đúng diện tích thửa. Nói đủ, không cắt bớt.
    const soDiem = Object.values(d).reduce((s, n) => s + n, 0);
    const areas = Object.entries(d)
      .map(([type, n]) => ({ type, areaM2: Math.round((dienTich * n / ins) * 10) / 10 }))
      .filter((o) => o.areaM2 > 0.4)
      .sort((a, b2) => b2.areaM2 - a.areaM2);
    if (!areas.length) continue;
    // Cả thửa rơi vào chỗ bản vẽ KHÔNG GHI loại đất thì bản đó không nói được gì — đừng in ra
    // một dòng "Chưa ghi loại đất" trơ trọi, người đọc chỉ thêm hoang mang.
    if (areas.every((a) => a.type === CHUA_RO)) continue;
    // Phần thửa mà bản này KHÔNG với tới — ghi thành một dòng riêng, đặt cuối. Nhờ nó, các con số
    // trong mỗi bản cộng lại luôn bằng đúng diện tích thửa, nên không thể đọc nhầm "cả thửa chỉ
    // có ngần này m²" nữa. Bỏ qua chênh lệch vụn dưới 1 m² (do lấy mẫu lưới 44×44).
    const conLai = Math.round((dienTich - areas.reduce((t, a) => t + a.areaM2, 0)) * 10) / 10;
    if (conLai >= 1) areas.push({ type: NGOAI_BAN, areaM2: conLai });
    // Phủ bao nhiêu phần thửa — dưới 100% nghĩa là bản đó chỉ trùm một phần (mép ranh).
    ra.push({ ma: b.ma, ten: b.ten, areas, phuTramPhanTram: Math.round((soDiem / ins) * 100) });
  }
  return ra;
}
