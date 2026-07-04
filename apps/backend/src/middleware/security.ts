import type { Request, Response, NextFunction } from 'express';

/** Security headers — tự đặt, không cần thư viện ngoài (helmet). */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
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
 * Rate limiter in-memory (sliding window) theo IP — chống brute-force & lạm dụng.
 * Đủ dùng cho 1 tiến trình (backend Render chạy 1 instance). Không cần Redis.
 */
export function rateLimit(opts: { windowMs: number; max: number; key?: string; message?: string }) {
  const hits = new Map<string, number[]>();
  const { windowMs, max } = opts;
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, arr] of hits) {
      const keep = arr.filter((t) => now - t < windowMs);
      if (keep.length) hits.set(k, keep); else hits.delete(k);
    }
  }, windowMs);
  timer.unref?.(); // không giữ tiến trình sống chỉ vì timer này
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const k = (opts.key || 'rl') + ':' + ip;
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
