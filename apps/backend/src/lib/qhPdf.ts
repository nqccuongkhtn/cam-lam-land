// QHSDĐ 2030 CÁC HUYỆN/THỊ NGOÀI CAM LÂM — diện tích từng loại đất trên MỘT thửa, tính từ vùng loại đất BÓC TỪ BẢN ĐỒ PDF
// chính thức của Sở NN&MT (14/10/2026; scripts/qh-tinh/boc_loai_dat.py → nap_qh_pdf.py → bảng qh_pdf + qh_pdf_ranh).
// ⚠️ Chỉ để THAM KHẢO: bản in 1:25.000, ranh vùng sai số vài mét, có vùng bản vẽ chỉ cho biết NHÓM đất (màu dùng chung).
//    Khác hẳn Cam Lâm (tính từ CAD gốc — qhCompute.ts). Giao diện ghi rõ "bóc từ bản đồ PDF – tham khảo", không in phiếu.
// Thửa nằm trong ranh bản nào (theo ĐIỂM GIỮA thửa) thì chỉ tra bản đó → thửa sát ranh hai huyện không bị ghi hai bản.
import { query } from './db.ts';

export type BanPdf = { ma: string; ten: string; nguon: 'pdf'; areas: { type: string; areaM2: number; mau?: string }[] };

export async function qhTuPdf(idThua: number, dtThua: number): Promise<BanPdf[]> {
  const rows = await query<any>(`
    WITH p AS (SELECT ST_MakeValid(geom) AS geom FROM dia_chinh WHERE id = $1),
         b AS (SELECT r.ban, r.ten FROM qh_pdf_ranh r, p
               WHERE r.geom && p.geom AND ST_Intersects(r.geom, ST_PointOnSurface(p.geom)) LIMIT 1)
    SELECT b.ban, b.ten AS ten_ban, z.ten, MIN(z.mau) AS mau,
           SUM(ST_Area(ST_Intersection(z.geom, p.geom)::geography)) AS dt,
           MAX(ST_Area(p.geom::geography)) AS tong
    FROM b, p, qh_pdf z
    WHERE z.ban = b.ban AND z.geom && p.geom AND ST_Intersects(z.geom, p.geom)
    GROUP BY b.ban, b.ten, z.ten`, [idThua]).catch((e) => { console.error('[qhPdf]', e?.message || e); return [] as any[]; });
  if (!rows.length) return [];
  const tong = Number(rows[0].tong) || 0;
  const coSo = dtThua > 0 ? dtThua : tong;     // diện tích CHÍNH THỨC của thửa (mặt phẳng VN-2000, như sổ) — các loại cộng lại đúng bằng số này
  const sum = rows.reduce((s: number, r: any) => s + (Number(r.dt) || 0), 0);
  if (!tong || sum < Math.max(0.5, 0.005 * tong)) return [];
  // Vùng được nới nửa điểm ảnh cho khít nhau nên chỗ góc chồng nhẹ → tổng có thể nhỉnh hơn thửa ~1–2 %: chia lại theo tỷ lệ.
  const k = coSo / Math.max(tong, sum);
  const areas = rows
    .map((r: any) => ({ type: String(r.ten), areaM2: Math.round(Number(r.dt) * k * 10) / 10, mau: r.mau || undefined }))
    .filter((a) => a.areaM2 >= 0.1)
    .sort((a, b) => b.areaM2 - a.areaM2);
  const con = Math.round((coSo - areas.reduce((s, a) => s + a.areaM2, 0)) * 10) / 10;
  if (con >= Math.max(1, 0.01 * coSo)) areas.push({ type: 'Chưa xác định loại đất', areaM2: con, mau: undefined });
  return [{ ma: 'pdf-' + rows[0].ban, ten: String(rows[0].ten_ban), nguon: 'pdf', areas }];
}
