import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from './env.ts';
import type { Role } from '../shared.ts';

export interface JwtPayload { id: number; email: string; role: Role; }

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const verifyPassword = (p: string, hash: string) => bcrypt.compare(p, hash);

export const signToken = (payload: JwtPayload) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as any });

export function verifyToken(token: string): JwtPayload | null {
  try { return jwt.verify(token, env.jwtSecret) as JwtPayload; }
  catch { return null; }
}
