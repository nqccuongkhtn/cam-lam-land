import type { Request, Response, NextFunction } from 'express';
import { verifyToken, coVaiTro, laAdmin, dsVaiTro, type JwtPayload } from '../lib/auth.ts';
import { query } from '../lib/db.ts';
import { kiemMoiYeuCau } from '../lib/thietBi.ts';

export interface AuthedRequest extends Request { user?: JwtPayload; }

// ── LUÔN LẤY VAI TRÒ MỚI NHẤT TỪ DATABASE ──
// Thẻ đăng nhập (token) có ghi sẵn vai trò lúc người đó đăng nhập. Nếu chỉ tin vào thẻ thì admin
// vừa cấp thêm quyền xong, người kia PHẢI đăng xuất rồi đăng nhập lại mới dùng được — rất khó hiểu
// với người dùng (đúng lỗi vừa gặp: cấp quyền kho danh mục mà vẫn báo khoá).
// Nên ở đây hỏi lại database, và nhớ tạm 30 giây cho khỏi hỏi liên tục.
// ⚠️ 11/10/2026 (rà soát bảo mật): hỏi luôn TRẠNG THÁI tài khoản. Trước đây thẻ đăng nhập (sống 7 ngày) vẫn dùng
//    được sau khi admin KHOÁ tài khoản, và tài khoản đã XOÁ vẫn giữ nguyên vai trò ghi trong thẻ — kể cả vai trò
//    admin. Nay: bị khoá → 403, không còn tồn tại → 401, áp dụng ngay (admin đổi gì thì gọi quenVaiTro).
type TinhTrang = { ds: string[]; khoa: boolean; mat: boolean; luc: number };
const nhoVaiTro = new Map<number, TinhTrang>();
const NHO_MS = 30_000;

async function vaiTroMoiNhat(id: number, cu: string[]): Promise<TinhTrang> {
  const co = nhoVaiTro.get(id);
  if (co && Date.now() - co.luc < NHO_MS) return co;
  try {
    const [u] = await query('SELECT role, roles, status FROM users WHERE id=$1', [id]);
    const tt: TinhTrang = u
      ? { ds: dsVaiTro(u), khoa: u.status === 'suspended', mat: false, luc: Date.now() }
      : { ds: [], khoa: false, mat: true, luc: Date.now() };   // tài khoản đã bị xoá khỏi database
    if (nhoVaiTro.size > 2000) nhoVaiTro.clear();          // dọn cho khỏi phình bộ nhớ
    nhoVaiTro.set(id, tt);
    return tt;
  } catch {
    // database trục trặc thì tạm dùng vai trò ghi trong thẻ (giữ nguyên cách cũ — không làm hỏng việc đang dùng)
    return { ds: cu, khoa: false, mat: false, luc: Date.now() };
  }
}

/** Admin vừa đổi vai trò / khoá / mở khoá ai đó → xoá phần nhớ tạm để áp dụng NGAY, không phải chờ 30 giây. */
export function quenVaiTro(id: number): void { nhoVaiTro.delete(id); }

export function authRequired(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  req.user = payload;
  // Chỉ gọi next() ĐÚNG MỘT LẦN (phòng khi có lỗi lạ rơi xuống .catch sau khi đã đi tiếp).
  let daDiTiep = false;
  const diTiep = () => { if (!daDiTiep && !res.headersSent) { daDiTiep = true; next(); } };
  vaiTroMoiNhat(payload.id, dsVaiTro(payload))
    .then(async (tt) => {
      if (tt.mat) return res.status(401).json({ error: 'Tài khoản không còn tồn tại. Vui lòng đăng nhập lại.' });
      if (tt.khoa) return res.status(403).json({ error: 'Tài khoản đã bị khoá' });
      const ds = tt.ds;
      req.user = { ...payload, roles: ds as any, role: (ds[0] || payload.role) as any };
      // GIỚI HẠN THIẾT BỊ (lib/thietBi.ts): ghi máy đang dùng; khi bật giới hạn thì thẻ chỉ dùng được trên đúng máy đã đăng nhập
      const loi = await kiemMoiYeuCau(req.user!, req).catch(() => null);
      if (loi) return res.status(401).json({ error: loi, maLoi: 'THIET_BI' });
      diTiep();
    })
    .catch(() => diTiep());
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
