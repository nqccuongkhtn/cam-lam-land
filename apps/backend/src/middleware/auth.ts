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
// ⚠️ 11/10/2026 (chủ dự án báo lỗi): hỏi luôn "ĐỜI PHIÊN ĐĂNG NHẬP" (cột users.phien_dang_nhap). Đổi mật khẩu + chọn
//    "Đăng xuất khỏi mọi thiết bị khác" (hoặc admin đặt lại mật khẩu bằng TAO-TAI-KHOAN.bat) thì số này tăng → mọi thẻ cấp
//    trước đó (số pv trong thẻ nhỏ hơn) bị từ chối NGAY, dù chưa hết hạn 7 ngày. Thẻ cũ không có pv được hiểu là 0.
type TinhTrang = { ds: string[]; khoa: boolean; mat: boolean; pv?: number; luc: number };
const nhoVaiTro = new Map<number, TinhTrang>();
const NHO_MS = 30_000;

async function vaiTroMoiNhat(id: number, cu: string[]): Promise<TinhTrang> {
  const co = nhoVaiTro.get(id);
  if (co && Date.now() - co.luc < NHO_MS) return co;
  try {
    const [u] = await query('SELECT role, roles, status, phien_dang_nhap FROM users WHERE id=$1', [id]);
    const tt: TinhTrang = u
      ? { ds: dsVaiTro(u), khoa: u.status === 'suspended', mat: false, pv: Number(u.phien_dang_nhap) || 0, luc: Date.now() }
      : { ds: [], khoa: false, mat: true, luc: Date.now() };   // tài khoản đã bị xoá khỏi database
    if (nhoVaiTro.size > 2000) nhoVaiTro.clear();          // dọn cho khỏi phình bộ nhớ
    nhoVaiTro.set(id, tt);
    return tt;
  } catch {
    // database trục trặc thì tạm dùng vai trò ghi trong thẻ (giữ nguyên cách cũ — không làm hỏng việc đang dùng)
    return { ds: cu, khoa: false, mat: false, luc: Date.now() };
  }
}

/** Thẻ này thuộc "đời phiên" cũ (mật khẩu đã đổi + đăng xuất máy khác sau khi cấp thẻ) chưa? Không biết (DB lỗi) → coi là còn. */
const theDoiCu = (payload: JwtPayload, tt: TinhTrang) => tt.pv !== undefined && (Number(payload.pv) || 0) !== tt.pv;

/** Admin vừa đổi vai trò / khoá / mở khoá ai đó, hoặc vừa đổi mật khẩu → xoá phần nhớ tạm để áp dụng NGAY, không chờ 30 giây. */
export function quenVaiTro(id: number): void { nhoVaiTro.delete(id); }

/**
 * Kiểm một thẻ đăng nhập ĐẦY ĐỦ như authRequired (chữ ký + tài khoản còn tồn tại + không bị khoá + đúng đời phiên)
 * nhưng KHÔNG chặn yêu cầu: hợp lệ → trả người dùng (vai trò lấy từ database), không thì null.
 * Dùng cho các đường "không bắt buộc đăng nhập nhưng đăng nhập thì thấy thêm" (bản đồ, danh mục xã, tin đang ẩn…) —
 * trước đây các đường đó chỉ kiểm chữ ký thẻ, nên thẻ đã bị thu hồi (đổi mật khẩu / bị khoá) vẫn mở được phần thêm.
 */
export async function xacMinhThe(token: string | null | undefined): Promise<JwtPayload | null> {
  const p = token ? verifyToken(token) : null;
  if (!p) return null;
  const tt = await vaiTroMoiNhat(p.id, dsVaiTro(p));
  if (tt.mat || tt.khoa || theDoiCu(p, tt)) return null;
  return { ...p, roles: tt.ds as any, role: (tt.ds[0] || p.role) as any };
}
/** Như xacMinhThe nhưng đọc thẻ từ tiêu đề Authorization của yêu cầu. */
export function nguoiDungTuYeuCau(req: Request): Promise<JwtPayload | null> {
  const h = String(req.headers.authorization || '');
  return xacMinhThe(h.startsWith('Bearer ') ? h.slice(7) : null);
}

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
      if (theDoiCu(payload, tt))
        return res.status(401).json({ error: 'Phiên đăng nhập đã hết hiệu lực vì mật khẩu tài khoản vừa được đổi. Vui lòng đăng nhập lại.', maLoi: 'DA_DOI_MAT_KHAU' });
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
