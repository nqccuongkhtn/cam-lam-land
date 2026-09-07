import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from './env.ts';
import type { Role } from '../shared.ts';

// role  = vai trò chính (giữ lại cho tương thích với bản cũ)
// roles = TOÀN BỘ vai trò của tài khoản — một người có thể vừa là biên tập GIS vừa quản lý văn bản…
export interface JwtPayload { id: number; email: string; role: Role; roles?: Role[]; }

/** Danh sách vai trò của một tài khoản. Tài khoản cũ chưa có `roles` thì lấy tạm `role`. */
export function dsVaiTro(u?: { role?: string | null; roles?: string[] | null } | null): string[] {
  if (!u) return [];
  const ds = Array.isArray(u.roles) ? u.roles.filter(Boolean) : [];
  if (ds.length) return ds;
  return u.role ? [u.role] : [];
}

/** Có ÍT NHẤT MỘT trong các vai trò kể ra không? */
export function coVaiTro(u: { role?: string | null; roles?: string[] | null } | null | undefined, ...canCo: string[]): boolean {
  const ds = dsVaiTro(u);
  return canCo.some((v) => ds.includes(v));
}

/** Quản trị viên — dùng thay cho kiểu so sánh cũ `user.role === 'admin'`. */
export const laAdmin = (u?: { role?: string | null; roles?: string[] | null } | null) => coVaiTro(u, 'admin');

/**
 * Chọn "vai trò chính" để ghi vào cột role cũ: admin đứng trên hết, rồi tới các vai trò quản lý,
 * cuối cùng mới là khách. Nhờ vậy chỗ nào còn đọc mỗi cột role vẫn hiểu đúng quyền lớn nhất.
 */
const THU_TU_VAI_TRO = ['admin', 'gis', 'vanban', 'hotlist', 'danhmuc', 'xacthuc', 'user'];
export function vaiTroChinh(roles: string[]): string {
  for (const v of THU_TU_VAI_TRO) if (roles.includes(v)) return v;
  return 'user';
}

/** Lọc bỏ vai trò lạ và trùng lặp. Không còn vai trò nào hợp lệ thì mặc định là khách. */
export const VAI_TRO_HOP_LE = ['user', 'admin', 'gis', 'vanban', 'hotlist', 'danhmuc', 'xacthuc'];
export function chuanHoaVaiTro(ds: unknown): string[] {
  const ra = Array.isArray(ds) ? Array.from(new Set(ds.map((x) => String(x)).filter((x) => VAI_TRO_HOP_LE.includes(x)))) : [];
  return ra.length ? ra : ['user'];
}

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const verifyPassword = (p: string, hash: string) => bcrypt.compare(p, hash);

export const signToken = (payload: JwtPayload) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as any });

export function verifyToken(token: string): JwtPayload | null {
  try { return jwt.verify(token, env.jwtSecret) as JwtPayload; }
  catch { return null; }
}
