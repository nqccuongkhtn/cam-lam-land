// ── LƯU SẴN KẾT QUẢ TÍNH QUY HOẠCH THEO THỬA (10/10/2026) ──
// Chủ dự án: "mấy thửa lớn sao không tính sẵn kết quả đi". Thửa nhỏ tính ~60 ms, nhưng thửa 1–2 ha có thể mất 0,3–2 giây.
//   · Xem thửa lần đầu → tính rồi lưu vào bảng qh_luu; lần sau trả ngay.
//   · Tiến trình RIÊNG (scripts/tinhSanQh.ts) tính sẵn các thửa ≥ 2.000 m² lúc khởi động — không làm chậm máy chủ web.
//   · Mỗi dòng lưu kèm pb (dấu dữ liệu + cách tính, qhPhienBan) và dau (dấu hình thửa + diện tích). Lệch một trong hai
//     là bỏ qua dòng cũ và tính lại → không bao giờ hiện kết quả cũ sau khi đổi dữ liệu / cách tính / nạp lại địa chính.
import crypto from 'node:crypto';
import { query } from './db.ts';
import { computeQhAreas, computeQhTheoBan, hoaHop205, qhPhienBan } from './qhCompute.ts';

export interface KetQuaQh { pre: ReturnType<typeof computeQhAreas>; cacBan: ReturnType<typeof computeQhTheoBan> }

export function tinhQh(ring: number[][], dienTich: number): KetQuaQh {
  const cacBan = computeQhTheoBan(ring, dienTich);
  // QĐ205 chỉ lệch bản chi tiết ở mức NÉT VẼ (≤ 1,5 m, cùng nhóm đất) → lấy ranh bản chi tiết, giữ tên loại của QĐ205 (hoaHop205)
  const pre = hoaHop205(ring, dienTich, computeQhAreas(ring, dienTich), cacBan).kq;
  return { pre, cacBan };
}

export function dauThua(ring: number[][], dienTich: number): string {
  return crypto.createHash('sha1').update(JSON.stringify(ring)).update('|' + dienTich).digest('hex').slice(0, 16);
}

export async function luuQh(id: number, pb: string, dau: string, kq: KetQuaQh): Promise<void> {
  await query(`INSERT INTO qh_luu (id, pb, dau, kq) VALUES ($1,$2,$3,$4)
               ON CONFLICT (id) DO UPDATE SET pb=EXCLUDED.pb, dau=EXCLUDED.dau, kq=EXCLUDED.kq, luc=now()`, [id, pb, dau, JSON.stringify(kq)]);
}

/** Kết quả quy hoạch của thửa địa chính `id`: lấy bản đã lưu nếu còn đúng phiên bản, không thì tính rồi lưu. */
export async function qhCoLuu(id: number, ring: number[][], dienTich: number): Promise<KetQuaQh> {
  const pb = qhPhienBan();
  if (!pb) return tinhQh(ring, dienTich);
  const dau = dauThua(ring, dienTich);
  try {
    const [r] = await query<{ kq: KetQuaQh }>('SELECT kq FROM qh_luu WHERE id=$1 AND pb=$2 AND dau=$3', [id, pb, dau]);
    if (r) return r.kq;
  } catch { /* bảng chưa có / DB chậm → cứ tính */ }
  const kq = tinhQh(ring, dienTich);
  luuQh(id, pb, dau, kq).catch(() => {});
  return kq;
}
