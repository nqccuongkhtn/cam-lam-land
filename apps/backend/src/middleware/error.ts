import type { Request, Response, NextFunction } from 'express';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('[error]', err?.message ?? err);
  res.status(err?.status ?? 500).json({ error: err?.message ?? 'Internal server error' });
}
