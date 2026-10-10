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

// Dạng ô đất TRONG FILE JSON (chỉ dùng lúc nạp): minx,miny,maxx,maxy, ring, loại, diện, bậc(2=QH/1=HT/0=chưa rõ)
type Zone = [number, number, number, number, number[][], string, number, number];

/* ══ KHO Ô ĐẤT GỌN — TỐI ƯU RAM (29/9/2026) ═══════════════════════════════════════════════
   ĐO THẬT: nạp y nguyên JSON (mỗi đỉnh là một mảng [x,y] riêng, chỉ mục lưới là Map khoá chữ
   "gx,gy") ăn 279 MB bộ nhớ heap cho 1.172.712 đỉnh — ~240 byte mỗi đỉnh, vì mỗi mảng nhỏ trong
   V8 mang phần đầu quản lý + con trỏ + kho số riêng.
   Nay dồn hết vào MẢNG SỐ LIỀN MẠCH (typed array, nằm ngoài heap JS, không có phần đầu từng phần tử):
     · xy     Float64Array — x,y của mọi đỉnh nối tiếp nhau: đúng 16 byte/đỉnh (2 số × 8 byte);
     · dau    Uint32Array  — ô k chiếm các đỉnh [dau[k], dau[k+1]) trong xy;
     · bb     Float64Array — khung bao 4 số/ô;  dien Float64Array; bac Int8Array (1 byte);
     · loai   Uint16Array  — SỐ THỨ TỰ loại đất (142 loại dùng chung một bảng tenLoai) thay cho
                             một con trỏ chuỗi mỗi ô;
     · chỉ mục lưới kiểu CSR: oDau[c]..oDau[c+1] trong oDs là danh sách ô của ô lưới c —
       thay Map<string, number[]> (mỗi ô lưới một chuỗi khoá + một mảng).
   ⚠️ GIỮ NGUYÊN 64 BIT (Float64), KHÔNG hạ xuống Float32: kết quả QĐ205 đã chỉnh khớp app tham
      chiếu ±3%, đổi độ chính xác là lệch diện tích. Thứ tự ô trong mỗi ô lưới giữ đúng thứ tự k
      tăng dần như bản cũ (quan trọng khi hai ô bằng bậc bằng diện tích) → kết quả TRÙNG TỪNG CHỮ SỐ
      (đã so bản cũ/bản mới trên thửa thật trước khi đưa lên). */
class KhoO {
  readonly n: number;
  readonly bb: Float64Array;
  readonly dau: Uint32Array;
  readonly xy: Float64Array;
  readonly loai: Uint16Array;
  readonly tenLoai: string[] = [];
  readonly dien: Float64Array;
  readonly bac: Int8Array;
  readonly gx0: number; readonly gy0: number; readonly gW: number; readonly gH: number;
  readonly oDau: Uint32Array;
  // Số thứ tự ô: bản nhiều ô nhất (QĐ893) có 11.044 ô < 65.535 → đủ chỗ trong SỐ 2 BYTE (Uint16),
  // tiết kiệm một nửa so với 4 byte. Bản nào vượt 65.535 ô thì tự dùng 4 byte.
  readonly oDs: Uint16Array | Uint32Array;

  constructor(zone: Zone[]) {
    const n = this.n = zone.length;
    let soDinh = 0;
    for (let k = 0; k < n; k++) soDinh += zone[k][4].length;
    this.bb = new Float64Array(n * 4);
    this.dau = new Uint32Array(n + 1);
    this.xy = new Float64Array(soDinh * 2);
    this.loai = new Uint16Array(n);
    this.dien = new Float64Array(n);
    this.bac = new Int8Array(n);
    const soLoai = new Map<string, number>();
    let d = 0, gxa = Infinity, gya = Infinity, gxb = -Infinity, gyb = -Infinity;
    for (let k = 0; k < n; k++) {
      const z = zone[k];
      this.bb[k * 4] = z[0]; this.bb[k * 4 + 1] = z[1]; this.bb[k * 4 + 2] = z[2]; this.bb[k * 4 + 3] = z[3];
      this.dau[k] = d;
      const r = z[4];
      for (let i = 0; i < r.length; i++) { this.xy[2 * d] = r[i][0]; this.xy[2 * d + 1] = r[i][1]; d++; }
      let li = soLoai.get(z[5]);
      if (li === undefined) { li = this.tenLoai.length; this.tenLoai.push(z[5]); soLoai.set(z[5], li); }
      this.loai[k] = li; this.dien[k] = z[6]; this.bac[k] = z[7];
      const a = Math.floor(z[0] / CELL), b = Math.floor(z[2] / CELL), c = Math.floor(z[1] / CELL), e = Math.floor(z[3] / CELL);
      if (a < gxa) gxa = a; if (b > gxb) gxb = b; if (c < gya) gya = c; if (e > gyb) gyb = e;
    }
    this.dau[n] = d;
    if (!n) { gxa = gya = 0; gxb = gyb = -1; }
    this.gx0 = gxa; this.gy0 = gya; this.gW = gxb - gxa + 1; this.gH = gyb - gya + 1;
    // Chỉ mục lưới CSR: đếm → cộng dồn → rải, duyệt k TĂNG DẦN để giữ thứ tự như Map cũ.
    const soO = Math.max(0, this.gW * this.gH);
    const dem = new Uint32Array(soO + 1);
    const moiO = (k: number, f: (c: number) => void) => {
      const z0 = this.bb[k * 4], z1 = this.bb[k * 4 + 1], z2 = this.bb[k * 4 + 2], z3 = this.bb[k * 4 + 3];
      const gx0 = Math.floor(z0 / CELL), gx1 = Math.floor(z2 / CELL), gy0 = Math.floor(z1 / CELL), gy1 = Math.floor(z3 / CELL);
      for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) f((gx - this.gx0) * this.gH + (gy - this.gy0));
    };
    for (let k = 0; k < n; k++) moiO(k, (c) => { dem[c + 1]++; });
    for (let c = 0; c < soO; c++) dem[c + 1] += dem[c];
    this.oDau = dem;
    this.oDs = n <= 0xffff ? new Uint16Array(soO ? dem[soO] : 0) : new Uint32Array(soO ? dem[soO] : 0);
    const con = dem.slice(0, soO);
    for (let k = 0; k < n; k++) moiO(k, (c) => { this.oDs[con[c]++] = k; });
  }

  /** Số thứ tự ô lưới (gx,gy); -1 nếu nằm ngoài lưới. */
  o(gx: number, gy: number): number {
    const a = gx - this.gx0, b = gy - this.gy0;
    return a < 0 || b < 0 || a >= this.gW || b >= this.gH ? -1 : a * this.gH + b;
  }
  coO(gx: number, gy: number): boolean { const c = this.o(gx, gy); return c >= 0 && this.oDau[c + 1] > this.oDau[c]; }

  /** Điểm (x,y) có nằm trong ô đất k — y hệt công thức pip() bên dưới, chỉ đọc từ mảng liền. */
  trong(k: number, x: number, y: number): boolean {
    const xy = this.xy, s = this.dau[k], e = this.dau[k + 1];
    let ins = false;
    for (let i = s, j = e - 1; i < e; j = i++) {
      const xi = xy[2 * i], yi = xy[2 * i + 1], xj = xy[2 * j], yj = xy[2 * j + 1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  }

  /** Bình phương khoảng cách ngắn nhất từ điểm tới viền ô k (cùng thứ tự cạnh như bản cũ). */
  d2Vien(k: number, x: number, y: number): number {
    const xy = this.xy, s = this.dau[k], e = this.dau[k + 1];
    let dmin = Infinity;
    for (let i = s, j = e - 1; i < e; j = i++) {
      const dd = d2seg(x, y, xy[2 * j], xy[2 * j + 1], xy[2 * i], xy[2 * i + 1]); if (dd < dmin) dmin = dd;
    }
    return dmin;
  }

  /** Ô đất CHỨA điểm: ưu tiên bậc cao (QH>HT); cùng bậc lấy ô NHỎ nhất (cụ thể nhất). */
  chua(x: number, y: number): string | null {
    const k = this.chuaK(x, y);
    return k < 0 ? null : this.tenLoai[this.loai[k]];
  }

  // "Ô TRÙM" = ô chứa trọn từ 2 ô khác trở lên (đường bao cả một khu, vẽ trùm qua các lô VÀ các con đường
  // giữa chúng). Chỉ đánh dấu khi gọi danhDauTrum(); QĐ205 không gọi nên không đổi gì.
  trum: Uint8Array | null = null;
  danhDauTrum(): number {
    const t = new Uint8Array(this.n); let soTrum = 0;
    for (let i = 0; i < this.n; i++) {
      // Sông suối / mặt nước KHÔNG BAO GIỜ là ô trùm: vùng nước hay ôm cồn bãi bên trong (nên trông như "chứa ô khác"),
      // và đường men theo suối sẽ biến mặt nước thành "đất giao thông" — đã thấy ở 3 thửa QĐ2076/QĐ918 (9/10/2026).
      if (/sông|suối|mặt nước|hồ|ao|kênh|rạch|biển/i.test(this.tenLoai[this.loai[i]])) continue;
      const q = i * 4, con = new Set<number>(), daXet = new Set<number>();
      const gx0 = Math.floor(this.bb[q] / CELL), gx1 = Math.floor(this.bb[q + 2] / CELL);
      const gy0 = Math.floor(this.bb[q + 1] / CELL), gy1 = Math.floor(this.bb[q + 3] / CELL);
      for (let gx = gx0; gx <= gx1 && con.size < 2; gx++) for (let gy = gy0; gy <= gy1 && con.size < 2; gy++) {
        const c = this.o(gx, gy); if (c < 0) continue;
        for (let s = this.oDau[c], het = this.oDau[c + 1]; s < het; s++) {
          const j = this.oDs[s];
          if (j === i || daXet.has(j)) continue;
          daXet.add(j);   // một ô con chạm nhiều ô lưới — chỉ xét một lần
          if (this.dien[j] >= this.dien[i] * 0.8) continue;
          const r = j * 4;
          if (this.bb[r] < this.bb[q] || this.bb[r + 2] > this.bb[q + 2] || this.bb[r + 1] < this.bb[q + 1] || this.bb[r + 3] > this.bb[q + 3]) continue;
          let het2 = true;
          // thử tối đa 16 đỉnh rải đều (đủ để biết ô con nằm trọn trong hay không; thử hết thì quá chậm với ô vài nghìn đỉnh)
          const sv = this.dau[j], ev = this.dau[j + 1], buoc = Math.max(1, Math.floor((ev - sv) / 16));
          for (let v = sv; v < ev && het2; v += buoc) if (!this.trong(i, this.xy[2 * v], this.xy[2 * v + 1]) && this.d2Vien(i, this.xy[2 * v], this.xy[2 * v + 1]) > 1e-12) het2 = false;
          if (het2) con.add(j);
        }
      }
      if (con.size >= 2) { t[i] = 1; soTrum++; }
    }
    this.trum = t;
    return soTrum;
  }

  /** Như chua() nhưng trả SỐ THỨ TỰ ô (-1 = không có). boTrum = bỏ qua các ô trùm. */
  chuaK(x: number, y: number, boTrum = false): number {
    const c = this.o(Math.floor(x / CELL), Math.floor(y / CELL));
    if (c < 0) return -1;
    let bt = -1, bar = Infinity, bk = -1;
    for (let t = this.oDau[c], het = this.oDau[c + 1]; t < het; t++) {
      const k = this.oDs[t];
      if (boTrum && this.trum && this.trum[k]) continue;
      if (this.bac[k] < bt) continue;
      const q = k * 4;
      if (x < this.bb[q] || x > this.bb[q + 2] || y < this.bb[q + 1] || y > this.bb[q + 3]) continue;
      if (!this.trong(k, x, y)) continue;
      if (this.bac[k] > bt || this.dien[k] < bar) { bt = this.bac[k]; bar = this.dien[k]; bk = k; }
    }
    return bk;
  }
}

let KHO: KhoO | null = null;
let ready = false;
// Khung bao của TOÀN BỘ dữ liệu quy hoạch (hiện chỉ có QĐ205 — huyện Cam Lâm cũ).
// Ra ngoài khung này là KHÔNG CÓ dữ liệu quy hoạch, phải nói thẳng "chưa có" chứ tuyệt đối
// không được đoán. Trước đây thiếu khung này nên một thửa ở Nha Trang bị trả về
// "Đất giao thông" phủ kín cả thửa — nhìn như kết quả thật, rất dễ tin nhầm.
let zX0 = Infinity, zY0 = Infinity, zX1 = -Infinity, zY1 = -Infinity;

try {
  // Mảng JSON tạm chỉ sống trong khối này; nạp xong là bộ gom rác thu hồi, chỉ còn KHO gọn.
  KHO = new KhoO(JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'qh_zones.json'), 'utf-8')));
  for (let k = 0; k < KHO.n; k++) {
    const q = k * 4;
    if (KHO.bb[q] < zX0) zX0 = KHO.bb[q]; if (KHO.bb[q + 1] < zY0) zY0 = KHO.bb[q + 1];
    if (KHO.bb[q + 2] > zX1) zX1 = KHO.bb[q + 2]; if (KHO.bb[q + 3] > zY1) zY1 = KHO.bb[q + 3];
  }
  ready = KHO.n > 0;
  console.log(`[qhCompute] nạp ${KHO.n} ô đất QH · phạm vi ${zX0.toFixed(4)},${zY0.toFixed(4)} → ${zX1.toFixed(4)},${zY1.toFixed(4)}`);
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
    if (KHO && KHO.coO(gx, gy)) return false;
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

// Ô đất CHỨA điểm (QĐ205) — xem KhoO.chua.
function landAt(x: number, y: number): string | null { return KHO ? KHO.chua(x, y) : null; }

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
  if (!KHO) return null;
  const seen = new Set<number>(); let bd = NEAR * NEAR, bt = -1; let blo: string | null = null;
  for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
    const c = KHO.o(gx, gy); if (c < 0) continue;
    for (let t = KHO.oDau[c], het = KHO.oDau[c + 1]; t < het; t++) {
      const k = KHO.oDs[t];
      if (seen.has(k)) continue; seen.add(k);
      const dmin = KHO.d2Vien(k, x, y), bk = KHO.bac[k];
      // ưu tiên bậc cao hơn; cùng phạm vi thì gần hơn
      if (bk > bt || (bk === bt && dmin < bd)) { if (dmin <= NEAR * NEAR) { bd = dmin; bt = bk; blo = KHO.tenLoai[KHO.loai[k]]; } }
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
  // ── MẨU LẺ SÁT MÉP THỬA (nghiên cứu 10/10/2026) ──
  // QĐ205 là quy hoạch CHUNG tỷ lệ nhỏ (~1/10.000): nét ranh lệch 0,15 mm trên giấy = 1,5 m thực địa, và ranh
  // không vẽ bám thửa → hay sinh "mẩu lẻ" là một DẢI HẸP chạy dọc mép thửa (đo 3.000 thửa ngẫu nhiên: 146 mẩu
  // nằm gọn trong 1,5 m sát mép, có mẩu tới 21 % thửa dài). Đó là sai số nét vẽ, không phải quy hoạch thật.
  // → Loại đất nào mà MỌI điểm của nó CHẮC CHẮN nằm trong dải 1,5 m sát mép thì tính vào loại chính của lõi thửa.
  //   "Chắc chắn" = độ sâu lớn nhất đo được + nửa đường chéo ô lưới mẫu vẫn < 1,5 m (thửa to, lưới thưa thì
  //   không đủ chắc → để nguyên, không gộp bừa).
  // CHỈ áp cho QĐ205. Bản 1/2000 + QĐ893 vẽ trên nền địa chính và cán bộ VPĐK ghi cả mẩu 1 m² → KHÔNG đụng.
  // 5/5 phiếu chính thức có ghi QĐ205 đều "toàn bộ" một loại — web khớp cả trước lẫn sau khi thêm bước này.
  const MEP = 1.5;
  const kx = 111320 * Math.cos(((miny + maxy) / 2) * Math.PI / 180), ky = 110574;
  const sauMep = (x: number, y: number) => {   // khoảng cách (m) từ điểm tới cạnh thửa gần nhất
    let d = Infinity;
    for (let i = 0; i + 1 < ring.length; i++) {
      const ax = ring[i][0] * kx, ay = ring[i][1] * ky, bx = ring[i + 1][0] * kx, by = ring[i + 1][1] * ky;
      const v = d2seg(x * kx, y * ky, ax, ay, bx, by); if (v < d) d = v;
    }
    return Math.sqrt(d);
  };
  const buocLuoi = Math.hypot((maxx - minx) * kx / N, (maxy - miny) * ky / N) / 2;
  const sauNhat: Record<string, number> = {};
  const loiThua: Record<string, number> = {};   // loại đất của các điểm ở LÕI thửa (cách mép ≥ 1,5 m)
  const diem: [string, number][] = [];
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
    const s = sauMep(x, y);
    if (!(sauNhat[lo] >= s)) sauNhat[lo] = s;
    if (s >= MEP) loiThua[lo] = (loiThua[lo] || 0) + 1;
    diem.push([lo, s]);
  }
  if (ins < 4) return null;
  const chinh = Object.entries(loiThua).sort((a, b) => b[1] - a[1])[0]?.[0];   // không có lõi (thửa hẹp < 3 m) → không gộp
  for (const [lo, s] of diem) {
    const leMep = chinh && lo !== chinh && sauNhat[lo] + buocLuoi < MEP;
    const k = leMep ? chinh! : lo;
    cnt[k] = (cnt[k] || 0) + 1;
  }
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
interface BanQh { ma: string; ten: string; kho: KhoO; na: MatNa | null; khung: [number, number, number, number]; }
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
  // Bản vẽ gốc: quyhoach2025/1-2000 Phan khu Tay Bac.dxf (nạp 14/9/2026).
  { ma: 'taybac', ten: 'Quy hoạch phân khu Tây Bắc 1/2000', tep: 'qh_zones_taybac.json' },
]) {
  try {
    const kho = new KhoO(JSON.parse(fs.readFileSync(path.join(DATA_DIR, b.tep), 'utf-8')));
    if (!kho.n) continue;
    let na: MatNa | null = null;
    try {
      const m = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `road_mask_${b.ma}.json`), 'utf-8'));
      na = { buf: fs.readFileSync(path.join(DATA_DIR, `road_mask_${b.ma}.bin`)),
             x0: m.x0, y0: m.y0, x1: m.x1, y1: m.y1, W: m.W, H: m.H, rb: m.rowbytes };
    } catch { na = null; }   // chưa có mặt nạ thì thôi, chỉ là phần trăm phủ thấp hơn
    // Bản phân khu (có mặt nạ đường) mới đánh dấu ô trùm — xem chỗ dùng trong computeQhTheoBan.
    const soTrum = na ? kho.danhDauTrum() : 0;
    // Khung bao mọi ô đất của bản — để bỏ qua sớm bản ở xa thửa (xem computeQhTheoBan)
    const khung: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    for (let k = 0; k < kho.n; k++) {
      khung[0] = Math.min(khung[0], kho.bb[k * 4]); khung[1] = Math.min(khung[1], kho.bb[k * 4 + 1]);
      khung[2] = Math.max(khung[2], kho.bb[k * 4 + 2]); khung[3] = Math.max(khung[3], kho.bb[k * 4 + 3]);
    }
    BAN_KHAC.push({ ma: b.ma, ten: b.ten, kho, na, khung });
    console.log(`[qhCompute] nạp bản ${b.ma}: ${kho.n} ô đất${na ? ` + mặt nạ đường ${na.W}x${na.H} · ${soTrum} ô trùm` : ' (chưa có mặt nạ đường)'}`);
  } catch {
    console.log(`[qhCompute] chưa có ${b.tep} — bỏ qua bản ${b.ma}`);
  }
}

// Ô đất chứa điểm, trong MỘT bản. Cùng kiểu chọn với landAt: bậc cao thắng, cùng bậc thì ô NHỎ
// hơn thắng (ô nhỏ = vẽ cụ thể hơn, vd lô nhà ở nằm trong khối đơn vị ở).
function landAtBan(b: BanQh, x: number, y: number): string | null { return b.kho.chua(x, y); }

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

// Điểm KHÔNG thuộc ô đất nào, cũng không dính mặt nạ đường — nhưng có bị Ô ĐẤT CỦA CHÍNH BẢN ĐÓ BAO QUANH không?
// Nhìn ra 8 hướng, mỗi hướng dò tới 60 m: từ 6 hướng trở lên gặp ô đất ⇒ điểm nằm lọt giữa các khu đất
// ⇒ là hành lang đường (bản vẽ phân khu chỉ tô ô đất, đường để trắng) ⇒ "Đất giao thông".
// Còn điểm ở rìa bản vẽ thì phía ngoài trống trơn, ít hướng gặp ô đất ⇒ vẫn là "ngoài phạm vi".
// VÌ SAO CẦN (9/10/2026): mặt nạ đường dựng bằng cách nới nét mép đường thêm 8 m, nên đường rộng
// (QL1A lộ giới 51 m) và chỗ nét vẽ đứt còn KHE HỞ. Đối chiếu 3 phiếu kiểm tra quy hoạch chính thức
// (VPĐK / Phòng Kinh tế): khe hở đó cán bộ đều tính là đất giao thông, web lại ghi "ngoài phạm vi"
// (QĐ2101 51,1 m² · QĐ918 119,1 m² · QĐ2222 12,4 m²). Cũng nhờ nó, thửa nằm TRỌN trong lòng đường
// không còn bị mất cả dòng quy hoạch (trước đây bản nào không có điểm rơi vào ô đất thật là bị bỏ).
const BAO_HUONG: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071]];
const DO_BUOC = 3 / 111000, DO_XA = 60 / 111000;   // bước dò 3 m, dò tối đa 60 m (độ, xấp xỉ ở vĩ độ Cam Lâm)
function biBaoQuanh(b: BanQh, x: number, y: number, boTrum = false): boolean {
  // Kiểm nhanh: trong phạm vi dò không có ô đất nào của bản thì khỏi dò 8 hướng
  let coGan = false;
  for (let gx = Math.floor((x - DO_XA) / CELL); gx <= Math.floor((x + DO_XA) / CELL) && !coGan; gx++)
    for (let gy = Math.floor((y - DO_XA) / CELL); gy <= Math.floor((y + DO_XA) / CELL) && !coGan; gy++) if (b.kho.coO(gx, gy)) coGan = true;
  if (!coGan) return false;
  let gap = 0;
  for (let h = 0; h < 8; h++) {
    const [dx, dy] = BAO_HUONG[h];
    for (let r = DO_BUOC; r <= DO_XA; r += DO_BUOC) {
      if (b.kho.chuaK(x + dx * r, y + dy * r, boTrum) >= 0) { gap++; break; }
    }
    if (gap + (7 - h) < 6) return false;   // các hướng còn lại có gặp hết cũng không đủ 6 → thôi
  }
  return gap >= 6;
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
  // Chỉ xét bản có ô đất trong vòng DO_XA quanh thửa — bản ở xa hơn không thể có điểm rơi vào ô đất
  // hay bị bao quanh, nên kết quả y hệt mà đỡ dò vô ích (trước đây vòng lặp chạy qua đủ 8 bản cho mọi điểm).
  const BAN = BAN_KHAC.filter((b) => !(b.khung[0] > maxx + DO_XA || b.khung[2] < minx - DO_XA || b.khung[1] > maxy + DO_XA || b.khung[3] < miny - DO_XA));
  const dem: Record<string, Record<string, number>> = {};
  const demO: Record<string, number> = {};   // số điểm rơi vào Ô ĐẤT THẬT của từng bản
  const demBao: Record<string, number> = {}; // số điểm lọt giữa các ô đất (khe hở hành lang đường) — xem biBaoQuanh
  const mauDuong: Record<string, number[][]> = {};
  // Nhớ kết quả dò theo ô lưới 3 m: các điểm mẫu sát nhau dùng chung, khỏi dò lại 8 hướng.
  const nhoBao = new Map<string, boolean>();
  const baoQuanh = (b: BanQh, x: number, y: number, boTrum = false) => {
    const k = `${b.ma}|${boTrum ? 1 : 0}|${Math.round(x / DO_BUOC)}|${Math.round(y / DO_BUOC)}`;
    let v = nhoBao.get(k);
    if (v === undefined) { v = biBaoQuanh(b, x, y, boTrum); nhoBao.set(k, v); }
    return v;
  };
  let ins = 0;
  for (let iy = 0; iy < N; iy++) for (let ix = 0; ix < N; ix++) {
    const x = minx + (maxx - minx) * (ix + 0.5) / N, y = miny + (maxy - miny) * (iy + 0.5) / N;
    if (!pip(x, y, ring)) continue;
    ins++;
    for (const b of BAN) {
      // Ô đất trước; không thuộc ô nào thì hỏi mặt nạ đường của CHÍNH bản đó (không mượn bản khác).
      const k = b.kho.chuaK(x, y);
      let o = k < 0 ? null : b.kho.tenLoai[b.kho.loai[k]];
      // Điểm chỉ rơi vào Ô TRÙM (đường bao cả khu, vẽ trùm qua lô lẫn đường) mà lại nằm trong lòng đường
      // VÀ bị các lô thật bao quanh → là con đường giữa các lô, không phải đất của ô trùm.
      // Đối chiếu phiếu chính thức (9/10/2026): thửa 3138/3139 Cam Hòa, ô 'Nhà ở chung cư' 5,7 ha của
      // QĐ2076 trùm qua đường → web ghi 190 m² chung cư, cán bộ ghi 191,8 m² đất giao thông.
      if (o && b.kho.trum?.[k] && duongBan(b, x, y) && baoQuanh(b, x, y, true)) o = 'Đất giao thông';
      if (o) demO[b.ma] = (demO[b.ma] || 0) + 1;
      let lo = o;
      if (!lo && duongBan(b, x, y)) {
        lo = 'Đất giao thông';
        // giữ vài điểm lòng đường làm mẫu — thửa nằm trọn trong đường thì dùng chúng để chứng minh bản có phủ tới
        if ((mauDuong[b.ma] ||= []).length < 5) mauDuong[b.ma].push([x, y]);
      } else if (!lo && b.na && baoQuanh(b, x, y)) {
        lo = 'Đất giao thông'; demBao[b.ma] = (demBao[b.ma] || 0) + 1;
      }
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
    // Ngoại lệ: không điểm nào trúng ô đất nhưng có điểm LỌT GIỮA các ô đất của bản này (thửa nằm trọn
    // trong lòng đường) — bị bao quanh thì chắc chắn nằm trong bản vẽ, khác hẳn vùng đệm rìa bản.
    if (d && !demO[b.ma] && !demBao[b.ma] && (mauDuong[b.ma] || []).some(([x, y]) => baoQuanh(b, x, y))) demBao[b.ma] = 1;
    if (!d || (!demO[b.ma] && !demBao[b.ma])) continue;
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
