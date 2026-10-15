// QHSDĐ 2030 CÁC HUYỆN/THỊ NGOÀI CAM LÂM — diện tích từng loại đất trên MỘT thửa, tính từ vùng loại đất BÓC TỪ BẢN ĐỒ PDF
// chính thức của Sở NN&MT (14/10/2026; scripts/qh-tinh/boc_loai_dat.py → nap_qh_pdf.py → bảng qh_pdf + qh_pdf_ranh).
// ⚠️ Chỉ để THAM KHẢO: bản in 1:25.000, ranh vùng sai số vài mét, có vùng bản vẽ chỉ cho biết NHÓM đất (màu dùng chung).
//    Khác hẳn Cam Lâm (tính từ CAD gốc — qhCompute.ts). Giao diện ghi rõ "bóc từ bản đồ PDF – tham khảo", không in phiếu.
// Mỗi thửa chỉ tra MỘT bản → thửa sát ranh hai huyện không bị ghi hai bản.
// Hình thửa DỊCH về đúng chỗ trước khi chồng (lớp dia_chinh trượt +0,533 m đông / +0,141 m bắc so với hệ VN-2000 của lớp quy hoạch —
// qhCompute.ts LECH_DC_X/Y, y như phần Cam Lâm). Trước 14/10/2026 tối phần PDF quên bước này → mép thửa lệch ~0,55 m.
import fs from 'node:fs';
import path from 'node:path';
import { query } from './db.ts';
import { LECH_DIA_CHINH } from './qhCompute.ts';

export type BanPdf = { ma: string; ten: string; nguon: 'pdf'; areas: { type: string; areaM2: number; mau?: string }[] };

// (15/10/2026) CHỌN BẢN THEO HUYỆN CŨ CỦA XÃ, không theo ranh. QHSDĐ 2030 lập theo từng huyện/TP cũ, còn ranh dựng từ vùng màu PDF của
// hai huyện cạnh nhau thì chồng lên nhau 380–2.760 ha (Diên Khánh ↔ Khánh Vĩnh 2.760 ha, ↔ Nha Trang 1.341 ha…). Mẫu 1/37 số thửa:
// 157 thửa nằm trong ≥ 2 ranh (trước "LIMIT 1" chọn hú hoạ — có thửa Nha Trang ra bản Diên Khánh, 100 % "chưa xác định"), 8 thửa Ninh
// Thuận cũ (Bác Ái, Thuận Bắc) lọt ranh Khánh Sơn / Cam Ranh nên từng hiện QHSDĐ của huyện khác. Nay: mã xã của thửa → huyện cũ
// (data/huyen-cu.json, theo trường huyenIdCu của danh mục Sở — scripts/dia-chinh/dung-huyen-cu.mjs) → bản của đúng huyện đó; huyện
// chưa có bản PDF (Cam Lâm — đã có CAD; Ninh Thuận cũ — chưa có bản đồ) thì không tra. Xã không có trong bảng mới lùi về chọn theo ranh.
let HUYEN_CU: Record<string, string> = {};
try {
  HUYEN_CU = JSON.parse(fs.readFileSync(path.resolve(process.env.QH_DATA_DIR || path.resolve(process.cwd(), 'data'), 'huyen-cu.json'), 'utf8'));
} catch { /* thiếu file → chọn bản theo ranh như trước */ }
const BAN_THEO_HUYEN: Record<string, string> = {
  'TP. Nha Trang': 'nhatrang2030', 'Thị xã Ninh Hòa': 'ninhhoa2030', 'Huyện Vạn Ninh': 'vanninh2030', 'TP. Cam Ranh': 'camranh2030',
  'Huyện Khánh Sơn': 'khanhson2030', 'Huyện Diên Khánh': 'dienkhanh2030', 'Huyện Khánh Vĩnh': 'khanhvinh2030',
};
const CHUA_XD = 'Chưa xác định loại đất';
// Phần thửa không có màu loại đất nào nhỏ hơn số này (khe giữa hai mảng tô) thì chia theo tỷ lệ cho các loại đã có, không ghi thành dòng.
const NGUONG_CHUA_XD_M2 = 0.5;

export async function qhTuPdf(idThua: number, dtThua: number): Promise<BanPdf[]> {
  const [thua] = await query<any>('SELECT xa_id FROM dia_chinh WHERE id = $1', [idThua]).catch(() => [] as any[]);
  return tinhTuPdf('SELECT ST_Translate(ST_MakeValid(geom), $2, $3) AS geom FROM dia_chinh WHERE id = $1',
    [idThua, -LECH_DIA_CHINH.x, -LECH_DIA_CHINH.y], thua ? String(thua.xa_id) : null, dtThua);
}

/** Cùng phép tính cho THỬA KHÁCH TỰ VẼ từ toạ độ VN-2000 (15/10/2026, routes/parcels.ts POST /qh-tu-ve): `geojson` = Polygon WGS84 đổi thẳng
 *  từ toạ độ khách nhập — KHÔNG dịch (toạ độ VN-2000 chính thức đã đúng chỗ, chỉ lớp địa chính mới bị trượt). `xaId` = mã xã của thửa địa
 *  chính ở giữa hình (để chọn đúng bản của huyện cũ). */
export async function qhTuPdfHinh(geojson: string, xaId: string | null, dtThua: number): Promise<BanPdf[]> {
  return tinhTuPdf('SELECT ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)) AS geom', [geojson], xaId, dtThua);
}

async function tinhTuPdf(pSql: string, thamSo: any[], xaId: string | null, dtThua: number): Promise<BanPdf[]> {
  const huyen = xaId ? HUYEN_CU[xaId] : undefined;
  const banHuyen = huyen ? BAN_THEO_HUYEN[huyen] : undefined;
  if (huyen && !banHuyen) return [];
  const iBan = thamSo.length + 1;     // số thứ tự tham số "bản của huyện cũ" — đứng sau các tham số của câu dựng hình thửa
  const rows = await query<any>(`
    WITH p AS (${pSql}),
         b AS (SELECT r.ban, r.ten FROM qh_pdf_ranh r, p
               WHERE CASE WHEN $${iBan}::text IS NOT NULL THEN r.ban = $${iBan}::text
                          ELSE r.geom && p.geom AND ST_Intersects(r.geom, ST_PointOnSurface(p.geom)) END
               LIMIT 1)
    SELECT b.ban, b.ten AS ten_ban, z.ten, MIN(z.mau) AS mau,
           SUM(ST_Area(ST_Intersection(z.geom, p.geom)::geography)) AS dt,
           MAX(ST_Area(p.geom::geography)) AS tong
    FROM b, p, qh_pdf z
    WHERE z.ban = b.ban AND z.geom && p.geom AND ST_Intersects(z.geom, p.geom)
    GROUP BY b.ban, b.ten, z.ten`, [...thamSo, banHuyen ?? null])
    .catch((e) => { console.error('[qhPdf]', e?.message || e); return [] as any[]; });
  if (!rows.length) return [];
  const tong = Number(rows[0].tong) || 0;      // diện tích thửa trên elipxoit — cùng thước với các phần giao
  const coSo = dtThua > 0 ? dtThua : tong;     // diện tích CHÍNH THỨC của thửa (mặt phẳng VN-2000, như sổ) — các dòng cộng lại đúng bằng số này
  const sum = rows.reduce((s: number, r: any) => s + (Number(r.dt) || 0), 0);
  if (!tong || sum < Math.max(0.5, 0.005 * tong)) return [];
  // Đổi thước elipxoit → mặt phẳng theo tỷ lệ. Phần thửa không tô màu nào (ngoài ranh bản vẽ, chỗ bản vẽ để trắng) từ NGUONG_CHUA_XD_M2
  // trở lên ghi "Chưa xác định loại đất"; nhỏ hơn thì chia theo tỷ lệ. Bản bóc kiểu ẢNH cũ (trước 14/10/2026 khuya) nới vùng nửa điểm
  // ảnh nên tổng có thể nhỉnh hơn thửa ~1–2 % — cũng chia lại theo tỷ lệ.
  // (15/10/2026) Trước: phần trống < 1 m² và < 1 % thửa bị BỎ LUÔN → các dòng cộng lại hụt diện tích thửa (vd 159,2 / 159,4 m²; thửa
  // 2,5 ha có thể hụt tới 250 m² mà không ghi gì).
  let k = coSo / Math.max(tong, sum);
  let con = Math.max(0, coSo - sum * k);
  if (con < NGUONG_CHUA_XD_M2) { k = coSo / sum; con = 0; }
  const dong = rows.map((r: any) => ({ type: String(r.ten), v: Number(r.dt) * k, mau: (r.mau || undefined) as string | undefined }))
    .sort((a, b) => b.v - a.v);
  if (con > 0) dong.push({ type: CHUA_XD, v: con, mau: undefined });
  // Làm tròn 0,1 m² mà TỔNG vẫn đúng bằng diện tích thửa: cắt mọi dòng xuống 0,1 m², phần còn thiếu cấp cho dòng có phần lẻ lớn nhất.
  const muc = Math.round(coSo * 10);
  const phan = dong.map((d) => Math.floor(d.v * 10 + 1e-9));
  const thuTu = dong.map((_, i) => i).sort((a, b) => (dong[b].v * 10 - phan[b]) - (dong[a].v * 10 - phan[a]));
  let du = muc - phan.reduce((s, x) => s + x, 0);
  for (let j = 0; du > 0; j = (j + 1) % thuTu.length, du--) phan[thuTu[j]]++;
  for (let j = thuTu.length - 1; du < 0 && j >= 0; j--) if (phan[thuTu[j]] > 0) { phan[thuTu[j]]--; du++; }
  const areas = dong.map((d, i) => ({ type: d.type, areaM2: phan[i] / 10, mau: d.mau })).filter((a) => a.areaM2 > 0);
  return [{ ma: 'pdf-' + rows[0].ban, ten: String(rows[0].ten_ban), nguon: 'pdf', areas }];
}
