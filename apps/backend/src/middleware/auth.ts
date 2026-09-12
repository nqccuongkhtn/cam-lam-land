import type { Request, Response, NextFunction } from 'express';
import { verifyToken, coVaiTro, laAdmin, dsVaiTro, type JwtPayload } from '../lib/auth.ts';
import { query } from '../lib/db.ts';

export interface AuthedRequest extends Request { user?: JwtPayload; }

// ── LUÔN LẤY VAI TRÒ MỚI NHẤT TỪ DATABASE ──
// Thẻ đăng nhập (token) có ghi sẵn vai trò lúc người đó đăng nhập. Nếu chỉ tin vào thẻ thì admin
// vừa cấp thêm quyền xong, người kia PHẢI đăng xuất rồi đăng nhập lại mới dùng được — rất khó hiểu
// với người dùng (đúng lỗi vừa gặp: cấp quyền kho danh mục mà vẫn báo khoá).
// Nên ở đây hỏi lại database, và nhớ tạm 30 giây cho khỏi hỏi liên tục.
const nhoVaiTro = new Map<number, { ds: string[]; luc: number }>();
const NHO_MS = 30_000;

async function vaiTroMoiNhat(id: number, cu: string[]): Promise<string[]> {
  const co = nhoVaiTro.get(id);
  if (co && Date.now() - co.luc < NHO_MS) return co.ds;
  try {
    const [u] = await query('SELECT role, roles FROM users WHERE id=$1', [id]);
    const ds = u ? dsVaiTro(u) : cu;
    nhoVaiTro.set(id, { ds, luc: Date.now() });
    if (nhoVaiTro.size > 2000) nhoVaiTro.clear();          // dọn cho khỏi phình bộ nhớ
    return ds;
  } catch {
    return cu;                                             // database trục trặc thì tạm dùng vai trò ghi trong thẻ
  }
}

/** Admin vừa đổi vai trò của ai đó → xoá phần nhớ tạm để áp dụng NGAY, không phải chờ 30 giây. */
export function quenVaiTro(id: number): void { nhoVaiTro.delete(id); }

export function authRequired(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  req.user = payload;
  vaiTroMoiNhat(payload.id, dsVaiTro(payload))
    .then((ds) => { req.user = { ...payload, roles: ds as any, role: (ds[0] || payload.role) as any }; next(); })
    .catch(() => next());
}

export function adminRequired(req: AuthedRequest, res: Response, next: NextFunction) {
  authRequired(req, res, () => {
    if (!laAdmin(req.user)) return res.status(403).json({ error: 'Admin only' });
    next();
  });
}

/**
 * Cửa chặn dùng chung: đi tiếp nếu người dùng giữ ÍT NHẤT MỘT trong các vai trò kể ra.
 * Admin luôn qua được. Một người có thể giữ nhiều vai trò cùng lúc nên phải xét cả danh sách,
 * chứ không so mỗi "vai trò chính" như bản cũ.
 */
export function canVaiTro(loi: string, ...vaiTro: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) =>
    authRequired(req, res, () => {
      if (!coVaiTro(req.user, 'admin', ...vaiTro)) return res.status(403).json({ error: loi });
      next();
    });
}

export const gisRequired = canVaiTro('Cần quyền quản lý bản đồ (admin hoặc GIS)', 'gis');

// Quản lý văn bản: admin HOẶC vai trò 'vanban'.
export const vanBanRequired = canVaiTro('Cần quyền quản lý văn bản (admin hoặc quản lý văn bản)', 'vanban');
