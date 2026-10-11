import type { Request, Response, NextFunction } from 'express';
import { logError, anBiMat } from '../lib/logger.ts';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = err?.status ?? 500;
  const ctx = `${req.method} ${anBiMat(req.originalUrl)} → ${status} ip=${req.ip}`;   // che mật khẩu / chìa khoá trên URL
  if (status >= 500) logError(`${ctx} · ${err?.message ?? err}`, err?.stack);   // lỗi hệ thống → GHI FILE để rà sau
  else console.warn('[warn]', ctx, err?.message ?? err);                          // lỗi người dùng (4xx) → chỉ cảnh báo
  // ⚠️ 29/9/2026 (rà soát bảo mật): lỗi HỆ THỐNG (≥500) KHÔNG trả nguyên văn cho người ngoài — trước
  //    đây lộ cả câu báo lỗi của database (vd `invalid input syntax for type integer`), cho kẻ xấu biết
  //    bên trong dùng gì, chạy ra sao. Chi tiết vẫn nằm đủ trong nhật ký lỗi ở trên để sửa.
  //    Lỗi NGƯỜI DÙNG (4xx) thì vẫn trả câu báo như cũ để họ biết sai chỗ nào.
  res.status(status).json({ error: status >= 500 ? 'Máy chủ gặp sự cố, vui lòng thử lại sau.' : (err?.message ?? 'Yêu cầu không hợp lệ') });
}
