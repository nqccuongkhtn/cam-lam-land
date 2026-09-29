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

/* ══ MẬT KHẨU — NÂNG CẤP BẢO MẬT (29/9/2026), GIỮ NGUYÊN MẬT KHẨU HIỆN TẠI ══════════════════
   · Độ khó bcrypt 10 → 12 (mỗi lần dò tốn gấp 4) cho mật khẩu MỚI.
   · Mật khẩu CŨ (băm độ khó 10) VẪN ĐĂNG NHẬP BÌNH THƯỜNG — bcrypt tự đọc độ khó ghi trong chuỗi băm.
     Đăng nhập đúng thì cần NangCap() → băm lại bằng độ khó 12 (người dùng không phải làm gì).
   · Luật mật khẩu MỚI (kiemMatKhauMoi) chỉ áp khi đăng ký / đổi mật khẩu, không đụng mật khẩu đang dùng.
   · Mật khẩu gửi lên quá dài bị từ chối (DAI_TOI_DA): chuỗi dài bất thường chỉ để làm máy chủ quá tải. */
export const DO_KHO_BCRYPT = 12;
export const DAI_TOI_DA = 128;
export const hashPassword = (p: string) => bcrypt.hash(p, DO_KHO_BCRYPT);
export const verifyPassword = (p: string, hash: string) => bcrypt.compare(p, hash);
/** Chuỗi băm này còn yếu hơn chuẩn hiện tại không (dạng "$2a$10$…" → độ khó 10). */
export const canNangCap = (hash: string | null | undefined): boolean => {
  const m = /^\$2[abxy]?\$(\d{2})\$/.exec(String(hash || ''));
  return !!m && Number(m[1]) < DO_KHO_BCRYPT;
};
/** Chuỗi băm GIẢ để so khi email không tồn tại → thời gian trả lời NHƯ NHAU, không đo được email nào đã có. */
export const BAM_GIA = bcrypt.hashSync('khong-co-tai-khoan-' + Math.random().toString(36), DO_KHO_BCRYPT);

// Mật khẩu quá phổ biến — kẻ dò mật khẩu luôn thử trước tiên.
const MAT_KHAU_DE = new Set(['12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', '88888888', '66666666',
  'password', 'password1', 'matkhau', 'matkhau123', 'qwerty123', 'abc12345', 'abcd1234', '123123123', 'iloveyou', 'admin123', 'admin12345', 'camlam123']);
/** Kiểm mật khẩu MỚI. Trả câu báo lỗi tiếng Việt, hoặc null nếu dùng được. */
export function kiemMatKhauMoi(p: unknown, email?: string | null): string | null {
  const s = String(p ?? '');
  if (s.length < 8) return 'Mật khẩu tối thiểu 8 ký tự.';
  if (s.length > DAI_TOI_DA) return `Mật khẩu tối đa ${DAI_TOI_DA} ký tự.`;
  if (MAT_KHAU_DE.has(s.toLowerCase())) return 'Mật khẩu này quá dễ đoán, hãy chọn mật khẩu khác.';
  if (/^(.)\1+$/.test(s)) return 'Mật khẩu không được lặp một ký tự.';
  const ten = String(email || '').split('@')[0].toLowerCase();
  if (ten.length >= 3 && s.toLowerCase().includes(ten)) return 'Mật khẩu không được chứa tên email.';
  if (!/[a-zA-ZÀ-ỹ]/.test(s) || !/\d/.test(s)) return 'Mật khẩu cần có cả chữ và số.';
  return null;
}

export const signToken = (payload: JwtPayload) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as any });

export function verifyToken(token: string): JwtPayload | null {
  try { return jwt.verify(token, env.jwtSecret) as JwtPayload; }
  catch { return null; }
}
