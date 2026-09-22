/* ============================================================================
 *  ĐĂNG NHẬP BẰNG VÂN TAY / KHUÔN MẶT — phần chạy trên trình duyệt.
 * ----------------------------------------------------------------------------
 *  Gọi tới /api/passkey của máy chủ. Xem lời giải thích đầy đủ ở
 *  apps/backend/src/routes/passkey.ts.
 *
 *  Nhắc lại chỗ quan trọng nhất: VÂN TAY VÀ KHUÔN MẶT KHÔNG RỜI KHỎI MÁY.
 *  Trình duyệt chỉ nhờ hệ điều hành xác nhận đúng chủ máy, rồi ký một chuỗi
 *  ngẫu nhiên bằng khoá nằm trong chip bảo mật. Web không đọc được vân tay.
 * ========================================================================== */
import { startRegistration, startAuthentication, browserSupportsWebAuthn }
  from '@simplewebauthn/browser';
import { api } from './api';

/** Máy này có dùng được vân tay / khuôn mặt không. */
export function mayCoHoTro(): boolean {
  try {
    // Phải là trang https (hoặc localhost) thì trình duyệt mới cho dùng.
    return browserSupportsWebAuthn() && (window.isSecureContext ?? false);
  } catch { return false; }
}

/** Máy này có sẵn vân tay / khuôn mặt đã cài trong hệ điều hành không. */
export async function mayCoVanTay(): Promise<boolean> {
  try {
    if (!mayCoHoTro()) return false;
    const f = (window as any).PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable;
    return typeof f === 'function' ? await f.call((window as any).PublicKeyCredential) : false;
  } catch { return false; }
}

/** Đăng ký vân tay cho máy đang dùng (phải đang đăng nhập bằng mật khẩu trước). */
export async function themVanTay(tenMay?: string): Promise<void> {
  const { khoa, options } = await api<{ khoa: string; options: any }>(
    '/passkey/dang-ky/bat-dau', { method: 'POST', body: '{}' });
  const response = await startRegistration({ optionsJSON: options });
  await api('/passkey/dang-ky/xong', {
    method: 'POST',
    body: JSON.stringify({ khoa, response, tenMay: tenMay || tenMayMacDinh() }),
  });
}

/** Đăng nhập bằng vân tay. Trả về token + hồ sơ người dùng. */
export async function dangNhapVanTay(email?: string): Promise<{ token: string; user: any }> {
  const { khoa, options } = await api<{ khoa: string; options: any }>(
    '/passkey/dang-nhap/bat-dau', {
      method: 'POST', body: JSON.stringify(email ? { email } : {}),
    });
  const response = await startAuthentication({ optionsJSON: options });
  return api<{ token: string; user: any }>('/passkey/dang-nhap/xong', {
    method: 'POST', body: JSON.stringify({ khoa, response }),
  });
}

export type MayDaDangKy = {
  id: number; ten_may: string | null; transports: string | null;
  created_at: string; last_used: string | null;
};
export const dsMayDaDangKy = () => api<{ ds: MayDaDangKy[] }>('/passkey/danh-sach');
export const xoaVanTay = (id: number) => api(`/passkey/${id}`, { method: 'DELETE' });

/** Đoán tên máy cho dễ nhận ra về sau: "iPhone · Safari". */
export function tenMayMacDinh(): string {
  const ua = navigator.userAgent;
  const may = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Điện thoại Android'
      : /Mac/.test(ua) ? 'máy Mac' : /Windows/.test(ua) ? 'máy Windows' : 'Máy này';
  const tr = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : '';
  return tr ? `${may} · ${tr}` : may;
}

/** Đổi lỗi kỹ thuật của trình duyệt thành câu người dùng hiểu được. */
export function loiDeHieu(e: any): string {
  const t = String(e?.name || '') + ' ' + String(e?.message || '');
  if (/NotAllowedError|cancel|abort/i.test(t))
    return 'Bạn đã huỷ, hoặc máy chờ quá lâu. Bấm lại rồi chạm vân tay giúp.';
  if (/InvalidStateError/i.test(t))
    return 'Máy này đã đăng ký vân tay cho tài khoản rồi.';
  if (/NotSupportedError|SecurityError/i.test(t))
    return 'Máy hoặc trình duyệt này chưa dùng được vân tay. Cần mở trang bằng https.';
  return e?.message || 'Không xác minh được. Thử lại giúp.';
}
