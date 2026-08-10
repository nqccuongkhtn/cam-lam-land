import type { Request, Response, NextFunction } from 'express';
import { logError } from '../lib/logger.ts';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = err?.status ?? 500;
  const ctx = `${req.method} ${req.originalUrl} → ${status} ip=${req.ip}`;
  if (status >= 500) logError(`${ctx} · ${err?.message ?? err}`, err?.stack);   // lỗi hệ thống → GHI FILE để rà sau
  else console.warn('[warn]', ctx, err?.message ?? err);                          // lỗi người dùng (4xx) → chỉ cảnh báo
  res.status(status).json({ error: err?.message ?? 'Internal server error' });
}
