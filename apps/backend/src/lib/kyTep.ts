// ── CHỮ KÝ CHO LINK TỆP RIÊNG trong kho /api/images (11/10/2026 — rà soát bảo mật) ──
// Kho /api/images vốn công khai (ảnh tin rao), số tệp lại tăng dần 1, 2, 3… nên ai cũng đoán được. Nhưng PDF / ảnh
// CÔNG VĂN đính kèm DANH SÁCH NÓNG (có tên, CCCD, địa chỉ người dân) cũng nằm chung kho đó → trước đây ai gõ
// /api/images/17.pdf là tải được. Nay những tệp đó được đánh dấu "riêng" và chỉ mở được bằng link có CHỮ KÝ:
//   · chữ ký do máy chủ cấp cho người có quyền xem danh sách nóng (routes/hotlist.ts), sống 2 giờ;
//   · ký bằng khoá bí mật của máy chủ (JWT_SECRET) → không ai tự chế được, cũng không dùng cho tệp khác được.
// Phải dùng link có chữ ký (thay vì thẻ đăng nhập) vì công văn được NHÚNG bằng khung xem / mở ở thẻ mới — những
// chỗ đó trình duyệt không gửi kèm thẻ đăng nhập.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env.ts';

const KHOA = 'tep-rieng:' + env.jwtSecret;
const SONG_GIAY = 2 * 3600;

const tinh = (id: number, het: number) => createHmac('sha256', KHOA).update(`${id}.${het}`).digest('base64url').slice(0, 32);

/** Cấp chữ ký cho tệp số `id` (hết hạn sau 2 giờ). Trả về 2 tham số để gắn vào link: ?het=…&ky=… */
export function kyTep(id: number): { het: number; ky: string } {
  const het = Math.floor(Date.now() / 1000) + SONG_GIAY;
  return { het, ky: tinh(id, het) };
}

/** Chữ ký gửi kèm link có đúng cho tệp này và còn hạn không? */
export function kyTepHopLe(id: number, het: unknown, ky: unknown): boolean {
  const h = Number(het);
  if (!Number.isInteger(h) || h * 1000 < Date.now() || h * 1000 > Date.now() + (SONG_GIAY + 60) * 1000) return false;
  if (typeof ky !== 'string' || !ky) return false;
  const dung = tinh(id, h);
  return ky.length === dung.length && timingSafeEqual(Buffer.from(ky), Buffer.from(dung));
}
