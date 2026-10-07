// KIỂM TRA NGƯỜI THẬT — Cloudflare Turnstile (chủ dự án chọn 7/10/2026 để chống cào kho văn bản).
//
// Miễn phí, thường VÔ HÌNH: trình duyệt người thật tự qua, phần mềm cào tự động không qua được.
// Dùng ở 3 chỗ: ĐĂNG KÝ, ĐĂNG NHẬP (bằng mật khẩu) và MỞ VĂN BẢN.
// Riêng mở văn bản: kiểm 1 lần rồi cấp "VÉ NGƯỜI THẬT" (ký HMAC, gắn tài khoản + địa chỉ máy, 2 giờ)
// để khách không phải chờ kiểm lại mỗi lần mở một văn bản.
//
// CHƯA ĐIỀN KHOÁ trong .env (TURNSTILE_SITE_KEY + TURNSTILE_SECRET) ⇒ TẮT, mọi thứ chạy như cũ.
// Lấy khoá: dash.cloudflare.com → Turnstile → Add widget → tên miền batdongsancamlam.vn (+ dpdns.org đang chạy).
import crypto from 'node:crypto';
import type { Request } from 'express';
import { env } from './env.ts';

export const TURNSTILE_SITE_KEY = (process.env.TURNSTILE_SITE_KEY || '').trim();
const SECRET = (process.env.TURNSTILE_SECRET || '').trim();
export const turnstileBat = () => !!(TURNSTILE_SITE_KEY && SECRET);

// Địa chỉ máy thật: nginx đã ghi đè CF-Connecting-IP bằng địa chỉ thật (xem nginx.conf), người dùng không giả được.
export const ipCua = (req: Request) => String(req.headers['cf-connecting-ip'] || req.ip || '').slice(0, 64);

/** Hỏi Cloudflare: mã này có phải của người thật vừa qua kiểm tra không. Tắt tính năng → luôn đúng. */
export async function laNguoiThat(token: unknown, req: Request): Promise<boolean> {
  if (!turnstileBat()) return true;
  if (typeof token !== 'string' || !token || token.length > 4096) return false;
  try {
    const body = new URLSearchParams({ secret: SECRET, response: token, remoteip: ipCua(req) });
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(8000) });
    const j: any = await r.json();
    return !!j?.success;
  } catch {
    // Cloudflare không trả lời (mất mạng…) → CHO QUA, đừng khoá cả web vì lỗi bên ngoài.
    return true;
  }
}

// ── VÉ NGƯỜI THẬT cho việc mở văn bản ──
const VE_GIO = 2;
const ky = (s: string) => crypto.createHmac('sha256', 've-nguoi-that:' + env.jwtSecret).update(s).digest('base64url');
export function capVe(userId: number, req: Request): string {
  const het = Date.now() + VE_GIO * 3600_000;
  const than = `${userId}.${het}`;
  return `${than}.${ky(`${than}.${ipCua(req)}`)}`;
}
export function veHopLe(ve: unknown, userId: number, req: Request): boolean {
  if (!turnstileBat()) return true;
  if (typeof ve !== 'string') return false;
  const [uid, het, chu] = ve.split('.');
  if (Number(uid) !== userId || !(Number(het) > Date.now()) || !chu) return false;
  const dung = ky(`${uid}.${het}.${ipCua(req)}`);
  return chu.length === dung.length && crypto.timingSafeEqual(Buffer.from(chu), Buffer.from(dung));
}
