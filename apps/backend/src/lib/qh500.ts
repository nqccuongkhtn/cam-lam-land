// QH CHI TIẾT 1/500 CAM LÂM TRÊN MỘT THỬA (15/10/2026) — chủ dự án: "thông tin thửa chưa hiện thông tin quy hoạch 1-500".
// 6 đồ án QĐ 2043–2048/QĐ-UBND ngày 25/9/2026 (UBND xã Cam Lâm). SỐ LIỆU CHỈ GỬI CHO ADMIN (routes/parcels.ts kiểm bằng
// nguoiDungTuYeuCau — đủ chữ ký + tài khoản còn + không khoá + đúng đời phiên). Người khác: thửa nằm trong ranh 1/500 thì chỉ nhận dấu
// { ma:'ct500', khoa:true } — giao diện hiện trang có khoá "liên hệ admin", KHÔNG có loại đất / diện tích / số quyết định.
// Dữ liệu: bảng qh_500 (lô tô màu, đã tách KHÔNG CHỒNG theo đúng thứ tự vẽ của ảnh tô màu) + qh_500_ranh (ranh từng đồ án) —
// nạp bằng scripts/qh-tinh/to_mau_1_500.py nap-sql. Màu = màu ảnh lớp "QH chi tiết 1/500 · tô màu" (bảng mau-1-500.json).
// Cách tính giống phần PDF (qhPdf.ts): hình thửa DỊCH về đúng chỗ (lớp địa chính trượt +0,533 m đông / +0,141 m bắc — LECH_DIA_CHINH),
// đo trên elipxoit rồi đổi tỷ lệ về diện tích CHÍNH THỨC của thửa (mặt phẳng VN-2000, như sổ) → các dòng cộng lại đúng bằng diện tích
// thửa. Phần thửa TRONG ranh mà không có lô nào = Đất giao thông (bản vẽ 1/500 để trống lòng đường — như luật "khe trong ranh = đường"
// của bản phân khu); phần NGOÀI ranh = "Nằm ngoài phạm vi bản quy hoạch này" (giao diện không hiện dòng này, như các bản khác).
import { query } from './db.ts';
import { LECH_DIA_CHINH } from './qhCompute.ts';

export type Ban500 = { ma: 'ct500'; ten: string; nguon: '1/500'; qd?: string; khoa?: boolean;
  areas: { type: string; areaM2: number; mau?: string }[] };
const DUONG = 'Đất giao thông';
const NGOAI = 'Nằm ngoài phạm vi bản quy hoạch này';
const MAU_DUONG = '#c8c8c8';
// Phần đường / phần ngoài ranh nhỏ hơn số này (khe giữa hai lô, mép thửa chạm ranh) thì chia theo tỷ lệ cho các dòng khác.
const NGUONG_M2 = 0.5;

export async function qh500TrenThua(idThua: number, dtThua: number, coQuyen: boolean): Promise<Ban500 | null> {
  return tinh500('SELECT ST_Translate(ST_MakeValid(geom), $2, $3) AS geom FROM dia_chinh WHERE id = $1',
    [idThua, -LECH_DIA_CHINH.x, -LECH_DIA_CHINH.y], dtThua, coQuyen);
}

/** Cùng phép tính cho THỬA KHÁCH TỰ VẼ từ toạ độ VN-2000 (15/10/2026, POST /api/parcels/qh-tu-ve): `geojson` = Polygon WGS84 đổi thẳng từ
 *  toạ độ khách nhập — KHÔNG dịch (toạ độ chính thức đã đúng chỗ). Cùng luật khoá: không có quyền thì chỉ trả dấu khoá. */
export async function qh500TrenHinh(geojson: string, dtThua: number, coQuyen: boolean): Promise<Ban500 | null> {
  return tinh500('SELECT ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) AS geom', [geojson], dtThua, coQuyen);
}

async function tinh500(pSql: string, thamSo: any[], dtThua: number, coQuyen: boolean): Promise<Ban500 | null> {
  const P = `WITH p AS (${pSql})`;
  const ranh = await query<any>(`${P}
    SELECT r.ban, r.qd, ST_Area(ST_Intersection(r.geom, p.geom)::geography) AS dt, ST_Area(p.geom::geography) AS tong
    FROM qh_500_ranh r, p WHERE r.geom && p.geom AND ST_Intersects(r.geom, p.geom)`, thamSo)
    .catch((e) => { console.error('[qh500]', e?.message || e); return [] as any[]; });
  const trong = ranh.reduce((s: number, r: any) => s + (Number(r.dt) || 0), 0);
  if (!ranh.length || trong < NGUONG_M2) return null;          // thửa không nằm trong đồ án 1/500 nào (chạm mép ranh vài cm thì bỏ)
  if (!coQuyen) return { ma: 'ct500', ten: 'QH chi tiết 1/500', nguon: '1/500', khoa: true, areas: [] };
  const lo = await query<any>(`${P}
    SELECT z.ten, MIN(z.mau) AS mau, SUM(ST_Area(ST_Intersection(z.geom, p.geom)::geography)) AS dt
    FROM qh_500 z, p WHERE z.geom && p.geom AND ST_Intersects(z.geom, p.geom) GROUP BY z.ten`, thamSo)
    .catch((e) => { console.error('[qh500]', e?.message || e); return [] as any[]; });
  const tong = Number(ranh[0].tong) || 0;                    // diện tích thửa trên elipxoit — cùng thước với các phần giao
  if (!tong) return null;
  const coSo = dtThua > 0 ? dtThua : tong;                   // diện tích chính thức (mặt phẳng VN-2000) — tổng các dòng = số này
  const k = coSo / tong;
  const dong = lo.map((r: any) => ({ type: String(r.ten), v: (Number(r.dt) || 0) * k, mau: (r.mau || undefined) as string | undefined }))
    .filter((d) => d.v > 0);
  const tongLo = dong.reduce((s, d) => s + d.v, 0);
  let duong = Math.max(0, Math.min(trong, tong) * k - tongLo);
  let ngoai = Math.max(0, coSo - Math.min(trong, tong) * k);
  // Mẩu đường / ngoài ranh quá nhỏ (sai số đo, khe chạm) → chia đều theo tỷ lệ cho các dòng còn lại, không ghi thành dòng riêng.
  const lech = (duong < NGUONG_M2 ? duong : 0) + (ngoai < NGUONG_M2 ? ngoai : 0);
  if (duong < NGUONG_M2) duong = 0;
  if (ngoai < NGUONG_M2) ngoai = 0;
  if (duong > 0) dong.push({ type: DUONG, v: duong, mau: MAU_DUONG });
  if (ngoai > 0) dong.push({ type: NGOAI, v: ngoai, mau: undefined });
  if (!dong.length) return null;
  const tongDong = dong.reduce((s, d) => s + d.v, 0);
  if (lech > 0 && tongDong > 0) for (const d of dong) d.v *= coSo / tongDong;
  dong.sort((a, b) => b.v - a.v);
  // Làm tròn 0,1 m² mà TỔNG vẫn đúng bằng diện tích thửa (như qhPdf.ts): cắt xuống 0,1, phần thiếu cấp cho dòng có phần lẻ lớn nhất.
  const muc = Math.round(coSo * 10);
  const phan = dong.map((d) => Math.floor(d.v * 10 + 1e-9));
  const thuTu = dong.map((_, i) => i).sort((a, b) => (dong[b].v * 10 - phan[b]) - (dong[a].v * 10 - phan[a]));
  let du = muc - phan.reduce((s, x) => s + x, 0);
  for (let j = 0; du > 0 && thuTu.length; j = (j + 1) % thuTu.length, du--) phan[thuTu[j]]++;
  for (let j = thuTu.length - 1; du < 0 && j >= 0; j--) if (phan[thuTu[j]] > 0) { phan[thuTu[j]]--; du++; }
  const areas = dong.map((d, i) => ({ type: d.type, areaM2: phan[i] / 10, mau: d.mau })).filter((a) => a.areaM2 > 0);
  const qd = [...new Set(ranh.filter((r: any) => (Number(r.dt) || 0) >= NGUONG_M2).map((r: any) => String(r.qd)))].join(' · ');
  return { ma: 'ct500', ten: 'QH chi tiết 1/500', nguon: '1/500', qd, areas };
}
