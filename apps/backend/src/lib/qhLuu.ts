// ── LƯU SẴN KẾT QUẢ TÍNH QUY HOẠCH THEO THỬA (10/10/2026) ──
// Chủ dự án: "mấy thửa lớn sao không tính sẵn kết quả đi". Thửa nhỏ tính ~60 ms, nhưng thửa 1–2 ha có thể mất 0,3–2 giây.
//   · Xem thửa lần đầu → tính rồi lưu vào bảng qh_luu; lần sau trả ngay.
//   · Tiến trình RIÊNG (scripts/tinhSanQh.ts) tính sẵn các thửa ≥ 2.000 m² lúc khởi động — không làm chậm máy chủ web.
//   · Mỗi dòng lưu kèm pb (dấu dữ liệu + cách tính, qhPhienBan) và dau (dấu hình thửa + diện tích). Lệch một trong hai
//     là bỏ qua dòng cũ và tính lại → không bao giờ hiện kết quả cũ sau khi đổi dữ liệu / cách tính / nạp lại địa chính.
import crypto from 'node:crypto';
import { query } from './db.ts';
import { computeQhAreas, computeQhTheoBan, hoaHop205, qhPhienBan } from './qhCompute.ts';
import { wgs84ToVn2000 } from './vn2000.ts';

export interface KetQuaQh { pre: ReturnType<typeof computeQhAreas>; cacBan: ReturnType<typeof computeQhTheoBan> }

export function tinhQh(ring: number[][], dienTich: number): KetQuaQh {
  const cacBan = computeQhTheoBan(ring, dienTich);
  // QĐ205 chỉ lệch bản chi tiết ở mức NÉT VẼ (≤ 1,5 m, cùng nhóm đất) → lấy ranh bản chi tiết, giữ tên loại của QĐ205 (hoaHop205)
  const pre = hoaHop205(ring, dienTich, computeQhAreas(ring, dienTich), cacBan).kq;
  return { pre, cacBan };
}

// ── THỬA CÓ LỖ THỦNG / NHIỀU MẢNH (11/10/2026) ──
// Trước đây chỉ tính VÒNG NGOÀI lớn nhất rồi chia đều diện tích sổ cho mọi loại đất → phần lỗ (thửa khác nằm lọt bên trong)
// bị trừ đều khắp các loại, mảnh phụ của thửa nhiều mảnh thì bị bỏ. Vd thửa 95 tờ 15 Cam Đức có lỗ 11,6 m²: lỗ nằm ở đâu thì
// phải trừ đúng loại đất ở đó. Vùng có quy hoạch có 1.350 thửa có lỗ + 10 thửa nhiều mảnh (16.773 ha).
// Nay: tính RIÊNG từng vòng (mỗi mảnh: vòng ngoài cộng, các lỗ trừ), mỗi vòng theo đúng diện tích phẳng VN-2000 của nó.
type Vong = { r: number[][]; dau: 1 | -1; dt: number };

/** Diện tích (m²) của một vòng WGS84 trên mặt phẳng VN-2000 — như sổ / MicroStation (xem dienTichPhang.ts). */
export function dtPhangVong(ring: number[][]): number {
  const v = ring.map(([x, y]) => wgs84ToVn2000(x, y));
  let s = 0;
  for (let i = 0; i < v.length; i++) { const a = v[i], b = v[(i + 1) % v.length]; s += (a.x - v[0].x) * (b.y - v[0].y) - (b.x - v[0].x) * (a.y - v[0].y); }
  return Math.abs(s) / 2;
}

function cacVong(geom: any, dich: (r: number[][]) => number[][]): Vong[] {
  const dg: number[][][][] = geom?.type === 'Polygon' ? [geom.coordinates] : geom?.type === 'MultiPolygon' ? geom.coordinates : [];
  const ra: Vong[] = [];
  for (const p of dg || []) (p || []).forEach((r, i) => {
    if (!r || r.length < 4) return;
    const rr = dich(r);
    ra.push({ r: rr, dau: i === 0 ? 1 : -1, dt: dtPhangVong(rr) });
  });
  return ra;
}

const lam1 = (x: number) => Math.round(x * 10) / 10;
// Phần "ngoài phạm vi" của thửa nhiều vòng = diện tích thửa − mọi phần CÓ LOẠI (12/10/2026). Cộng/trừ theo từng vòng sẽ SÓT khi một
// LỖ THỦNG nằm trọn ngoài một bản: lỗ không có dòng của bản đó nên không trừ được → thửa 581 tờ 16 Cam An Nam (3,96 ha, có lỗ) từng
// ghi QĐ2101 "ngoài phạm vi" 48.351 m², các dòng cộng lại 63.912 m² — lớn hơn cả thửa.
const NGOAI = 'Nằm ngoài phạm vi bản quy hoạch này';

function gop(phan: { kq: KetQuaQh; dau: 1 | -1; dt: number }[], dtTong: number): KetQuaQh {
  // QĐ205
  let coPre = false;
  const mPre = new Map<string, { type: string; hz: string; areaM2: number }>();
  let hzNgoai = '';
  for (const { kq, dau } of phan) {
    if (!kq.pre) continue;
    if (dau > 0) coPre = true;
    for (const o of kq.pre) {
      if (o.type === NGOAI) { hzNgoai = o.hz; continue; }
      const k = o.type + '|' + o.hz;
      const g = mPre.get(k) || { type: o.type, hz: o.hz, areaM2: 0 };
      g.areaM2 += dau * o.areaM2; mPre.set(k, g);
    }
  }
  if (coPre) {
    const conLai = dtTong - [...mPre.values()].reduce((s, o) => s + o.areaM2, 0);
    if (conLai >= 1) mPre.set(NGOAI, { type: NGOAI, hz: hzNgoai, areaM2: conLai });
  }
  const pre = coPre ? [...mPre.values()].map((o) => ({ ...o, areaM2: lam1(o.areaM2) })).filter((o) => o.areaM2 > 0.4).sort((a, b) => b.areaM2 - a.areaM2) : null;
  // các bản khác
  const mBan = new Map<string, { ma: string; ten: string; a: Map<string, number>; phu: number; co: boolean }>();
  for (const { kq, dau, dt } of phan) for (const b of kq.cacBan || []) {
    const g = mBan.get(b.ma) || { ma: b.ma, ten: b.ten, a: new Map<string, number>(), phu: 0, co: false };
    if (dau > 0) g.co = true;
    for (const o of b.areas) if (o.type !== NGOAI) g.a.set(o.type, (g.a.get(o.type) || 0) + dau * o.areaM2);
    g.phu += dau * (b.phuTramPhanTram || 0) * dt;
    mBan.set(b.ma, g);
  }
  for (const g of mBan.values()) {
    const conLai = dtTong - [...g.a.values()].reduce((s, a) => s + a, 0);
    if (conLai >= 1) g.a.set(NGOAI, conLai);
  }
  const cacBan = [...mBan.values()].filter((g) => g.co).map((g) => ({
    ma: g.ma, ten: g.ten,
    areas: [...g.a.entries()].map(([type, a]) => ({ type, areaM2: lam1(a) })).filter((o) => o.areaM2 > 0.4).sort((a, b) => b.areaM2 - a.areaM2),
    phuTramPhanTram: Math.max(0, Math.min(100, Math.round(g.phu / (dtTong || 1)))),
  })).filter((b) => b.areas.length);
  return { pre, cacBan };
}

/** Quy hoạch của CẢ HÌNH thửa (GeoJSON Polygon / MultiPolygon). `dich` = hàm nắn toạ độ (chuanToaDoDiaChinh cho thửa địa chính).
 *  Thửa một vòng (đa số) tính y như cũ với `dienTich` (diện tích phẳng VN-2000 do SQL tính — xem dienTichPhang.ts). */
export function tinhQhHinh(geom: any, dienTich: number, dich: (r: number[][]) => number[][] = (r) => r): KetQuaQh {
  const vong = cacVong(geom, dich);
  if (vong.length <= 1) return tinhQh(vong[0]?.r || [], dienTich);
  const phan = vong.map((v) => ({ kq: tinhQh(v.r, v.dt), dau: v.dau, dt: v.dt }));
  return gop(phan, vong.reduce((s, v) => s + v.dau * v.dt, 0));
}

export function dauThua(ring: number[][], dienTich: number): string {
  return crypto.createHash('sha1').update(JSON.stringify(ring)).update('|' + dienTich).digest('hex').slice(0, 16);
}

/** Dấu của CẢ HÌNH thửa (mọi vòng) + diện tích — routes/parcels.ts và scripts/tinhSanQh.ts phải gọi giống hệt nhau. */
export function dauHinh(geom: any, dienTich: number): string {
  return crypto.createHash('sha1').update(JSON.stringify(geom?.coordinates ?? null)).update('|' + dienTich).digest('hex').slice(0, 16);
}

export async function luuQh(id: number, pb: string, dau: string, kq: KetQuaQh): Promise<void> {
  await query(`INSERT INTO qh_luu (id, pb, dau, kq) VALUES ($1,$2,$3,$4)
               ON CONFLICT (id) DO UPDATE SET pb=EXCLUDED.pb, dau=EXCLUDED.dau, kq=EXCLUDED.kq, luc=now()`, [id, pb, dau, JSON.stringify(kq)]);
}

/** Kết quả quy hoạch của thửa địa chính `id` (hình `geom` lấy thẳng từ dia_chinh, chưa nắn): lấy bản đã lưu nếu còn đúng
 *  phiên bản, không thì tính (cả lỗ thủng / nhiều mảnh) rồi lưu. */
export async function qhCoLuu(id: number, geom: any, dienTich: number, dich: (r: number[][]) => number[][]): Promise<KetQuaQh> {
  const pb = qhPhienBan();
  if (!pb) return tinhQhHinh(geom, dienTich, dich);
  const dau = dauHinh(geom, dienTich);
  try {
    const [r] = await query<{ kq: KetQuaQh }>('SELECT kq FROM qh_luu WHERE id=$1 AND pb=$2 AND dau=$3', [id, pb, dau]);
    if (r) return r.kq;
  } catch { /* bảng chưa có / DB chậm → cứ tính */ }
  const kq = tinhQhHinh(geom, dienTich, dich);
  luuQh(id, pb, dau, kq).catch(() => {});
  return kq;
}
