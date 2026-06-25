import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '../lib/auth.ts';

export interface AuthedRequest extends Request { user?: JwtPayload; }

export function authRequired(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  req.user = payload;
  next();
}

export function adminRequired(req: AuthedRequest, res: Response, next: NextFunction) {
  authRequired(req, res, () => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    next();
  });
}
