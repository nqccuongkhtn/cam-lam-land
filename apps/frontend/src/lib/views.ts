// ─────────────────────────────────────────────────────────────────────────
// LƯỢT XEM HIỂN THỊ = lượt xem THẬT + phần "mồi" (seed) chỉ trong NĂM ĐẦU.
//
// Thuật toán:
//   • yearFade: hệ số giảm TUYẾN TÍNH từ 1 → 0 trong 1 năm kể từ ngày mở web.
//       yearFade = 1 - (nay - SITE_LAUNCH) / 1_năm   (kẹp trong [0,1])
//     → mới mở: mồi lớn nhất; đủ 1 năm: mồi = 0 → hiển thị ĐÚNG số thật.
//   • seed: con số nền ỔN ĐỊNH theo từng tin (băm từ id) để mỗi tin một khác,
//     nhân hệ số hạng VIP (tin VIP nhiều "view" hơn cho hợp lý).
//   • ramp: vài ngày đầu của mỗi tin cho tăng dần như view tích luỹ thật.
//
//   displayViews = viewsThật + round(seed × tierMult × ramp × yearFade)
//
// LƯU Ý: DB luôn lưu số THẬT (cột views). Đây chỉ là lớp HIỂN THỊ ở trang công khai.
// Sau 1 năm, tự động trùng khớp số thật. Đổi ngày mở web bên dưới hoặc đặt
// biến môi trường NEXT_PUBLIC_SITE_LAUNCH = 'YYYY-MM-DD'.
// ─────────────────────────────────────────────────────────────────────────
const DAY = 86_400_000;
const YEAR = 365 * DAY;
const SITE_LAUNCH = new Date(process.env.NEXT_PUBLIC_SITE_LAUNCH || '2026-07-01T00:00:00+07:00').getTime();

function hash(n: number): number { return Math.imul((n | 0) ^ 0x9e3779b9, 2654435761) >>> 0; }

/** Phần "mồi" cộng thêm cho 1 tin tại thời điểm now (0 sau năm đầu). */
export function fakeBoost(l: { id: number; createdAt?: string; tier?: string }, now = Date.now()): number {
  const yearFade = Math.max(0, Math.min(1, 1 - (now - SITE_LAUNCH) / YEAR));
  if (yearFade <= 0) return 0;
  const seed = 90 + (hash(l.id) % 160); // 90–250, ổn định theo tin
  const tierMult = l.tier === 'diamond' ? 2.4 : l.tier === 'gold' ? 1.8 : l.tier === 'silver' ? 1.3 : 1;
  const ageDays = l.createdAt ? Math.max(0, (now - new Date(l.createdAt).getTime()) / DAY) : 30;
  const ramp = Math.min(1, 0.25 + ageDays / 8); // ngày đầu tăng dần, bão hoà sau ~1 tuần
  return Math.round(seed * tierMult * ramp * yearFade);
}

/** Lượt xem để HIỂN THỊ (thật + mồi năm đầu). */
export function displayViews(l: { id: number; views?: number; createdAt?: string; tier?: string }, now = Date.now()): number {
  return (l.views || 0) + fakeBoost(l, now);
}
