// CHỐNG CÀO KHO VĂN BẢN — phần GIỚI HẠN Ô TÌM CÔNG KHAI ở trang chủ (/api/van-ban/tim, không cần đăng nhập).
//
// Bảo vệ chính cho FILE văn bản là "kiểm tra người thật" Cloudflare Turnstile — xem lib/turnstile.ts.
// (Bộ đếm "30 văn bản/giờ, 100/ngày, khoá 12 giờ" làm thử 7/10/2026 đã BỎ theo ý chủ dự án — dùng biện pháp kỹ thuật thay.)
//
// Số chỉnh trong .env: VB_TIM_5P, VB_TIM_NGAY. VB_TAT_CHONG_CAO=true tắt (chỉ dùng khi thử nghiệm).
// Bộ đếm nằm trong bộ nhớ: khởi động lại backend là đếm lại từ đầu (máy chủ chạy 1 tiến trình).
import type { Request } from 'express';
import { ipCua } from './turnstile.ts';

const so = (k: string, md: number) => { const n = Number(process.env[k]); return Number.isFinite(n) && n > 0 ? n : md; };
const TIM_5P = so('VB_TIM_5P', 40);            // số lần tìm / 5 phút / địa chỉ máy
const TIM_NGAY = so('VB_TIM_NGAY', 400);       // số lần tìm / ngày / địa chỉ máy
const TAT = process.env.VB_TAT_CHONG_CAO === 'true';
const NGAY = 24 * 3600_000;

const lanGoi = new Map<string, number[]>();     // địa chỉ máy → các mốc thời gian đã tìm
setInterval(() => {   // dọn bộ nhớ mỗi 10 phút
  const now = Date.now();
  for (const [k, a] of lanGoi) { const g = a.filter((t) => now - t < NGAY); if (g.length) lanGoi.set(k, g); else lanGoi.delete(k); }
}, 10 * 60_000).unref?.();

/** Trả về câu báo lỗi (tiếng Việt) nếu máy này tìm quá nhiều, null nếu cho qua. */
export function kiemTimCongKhai(req: Request): string | null {
  if (TAT) return null;
  const k = ipCua(req) || 'khong-ro', now = Date.now();
  const a = (lanGoi.get(k) || []).filter((t) => now - t < NGAY);
  if (a.filter((t) => now - t < 5 * 60_000).length >= TIM_5P || a.length >= TIM_NGAY) {
    lanGoi.set(k, a);
    return 'Bạn tìm hơi nhiều — vui lòng thử lại sau ít phút, hoặc đăng nhập để dùng trang tra cứu đầy đủ.';
  }
  a.push(now); lanGoi.set(k, a);
  return null;
}
