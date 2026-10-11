import type { Request, Response, NextFunction } from 'express';

/** Security headers — tự đặt, không cần thư viện ngoài (helmet). */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // /api/images phục vụ ảnh + PDF công văn cần NHÚNG xem ngay trong web → KHÔNG đặt DENY cho nhánh này
  // (tệp public, không có gì để clickjack). Các nhánh còn lại vẫn chặn frame chống clickjacking.
  if (!req.path.startsWith('/api/images')) res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(self), microphone=(), payment=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  // HSTS chỉ khi đã chạy HTTPS (Render đứng sau proxy TLS).
  if (req.secure || req.headers['x-forwarded-proto'] === 'https')
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
}

/**
 * "Máy" dùng để ĐẾM giới hạn: IPv4 giữ nguyên; IPv6 gộp theo khối /64.
 * ⚠️ 11/10/2026 (rà soát bảo mật): mỗi nhà / mỗi điện thoại dùng IPv6 được nhà mạng cấp NGUYÊN một khối /64 (hàng tỉ tỉ
 *    địa chỉ). Đếm theo từng địa chỉ thì kẻ xấu chỉ việc đổi địa chỉ trong khối là né sạch mọi giới hạn (kể cả số lần
 *    thử mật khẩu). Gộp theo khối thì một nhà = một máy, y như IPv4 xưa nay.
 */
export function khoaMay(ip: string | undefined | null): string {
  let s = String(ip || '').trim().toLowerCase().replace(/%.*$/, '');   // bỏ phần "%eth0" nếu có
  if (s.startsWith('::ffff:') && s.includes('.')) return s.slice(7);     // IPv4 viết dạng IPv6
  if (!s.includes(':')) return s || 'khong-ro';
  const [dau, sau] = s.split('::');
  const a = dau ? dau.split(':') : [];
  const b = sau !== undefined && sau !== '' ? sau.split(':') : [];
  const du = sau !== undefined ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b] : a;
  return du.slice(0, 4).map((x) => x.replace(/^0+(?=.)/, '') || '0').join(':') + '::/64';
}

/**
 * Rate limiter in-memory (sliding window) theo IP — chống brute-force & lạm dụng.
 * Đủ dùng cho 1 tiến trình (backend Render chạy 1 instance). Không cần Redis.
 */
const TOI_DA_MAY = 50_000;   // mỗi bộ đếm theo dõi tối đa bấy nhiêu máy — chặn phình bộ nhớ khi bị dội từ rất nhiều địa chỉ
export function rateLimit(opts: { windowMs: number; max: number; key?: string; message?: string; skip?: (req: Request) => boolean }) {
  const hits = new Map<string, number[]>();
  const { windowMs, max } = opts;
  const don = () => {
    const now = Date.now();
    for (const [k, arr] of hits) {
      const keep = arr.filter((t) => now - t < windowMs);
      if (keep.length) hits.set(k, keep); else hits.delete(k);
    }
  };
  const timer = setInterval(don, windowMs);
  timer.unref?.(); // không giữ tiến trình sống chỉ vì timer này
  return (req: Request, res: Response, next: NextFunction) => {
    if (opts.skip?.(req)) return next(); // bỏ qua giới hạn (vd: GET /auth/me, tài khoản admin)
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const k = (opts.key || 'rl') + ':' + khoaMay(ip);
    if (hits.size > TOI_DA_MAY && !hits.has(k)) { don(); if (hits.size > TOI_DA_MAY) hits.clear(); }
    const now = Date.now();
    const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: opts.message || 'Quá nhiều yêu cầu — vui lòng thử lại sau ít phút.' });
    }
    arr.push(now);
    hits.set(k, arr);
    next();
  };
}
