// KIỂM TRA NGƯỜI THẬT — Cloudflare Turnstile (chống cào kho văn bản, chủ dự án chọn 7/10/2026).
// Máy chủ chưa điền khoá thì layMaNguoiThat() trả '' ngay và mọi thứ chạy như cũ (xem backend lib/turnstile.ts).
// Kiểu "chỉ hiện khi cần": người thật thường không thấy gì; nghi ngờ thì hiện ô bấm nhỏ giữa màn hình.
import { api } from './api';

let khoaP: Promise<string> | null = null;
const layKhoa = () => (khoaP ??= api<{ siteKey: string }>('/auth/turnstile').then((r) => r.siteKey || '').catch(() => ''));

let scriptP: Promise<any> | null = null;
function napScript(): Promise<any> {
  if ((window as any).turnstile) return Promise.resolve((window as any).turnstile);
  return (scriptP ??= new Promise((ok, loi) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true;
    s.onload = () => ok((window as any).turnstile);
    s.onerror = () => { scriptP = null; loi(new Error('Không tải được bước kiểm tra người thật')); };
    document.head.appendChild(s);
  }));
}

/** Lấy mã "người thật" mới (dùng 1 lần). Chưa bật tính năng → ''. */
export async function layMaNguoiThat(): Promise<string> {
  const khoa = await layKhoa();
  if (!khoa) return '';
  const ts = await napScript();
  return new Promise((ok, loi) => {
    // Khung chứa nổi giữa màn hình — chỉ thấy khi Cloudflare cần khách bấm xác nhận.
    const hop = document.createElement('div');
    hop.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483000';
    document.body.appendChild(hop);
    const xong = (fn: () => void) => { setTimeout(() => { try { ts.remove(id); } catch {} hop.remove(); }, 0); fn(); };
    const id = ts.render(hop, {
      sitekey: khoa, appearance: 'interaction-only', language: 'vi',
      callback: (ma: string) => xong(() => ok(ma)),
      'error-callback': () => xong(() => loi(new Error('Không xác nhận được bạn là người thật. Vui lòng tải lại trang rồi thử lại.'))),
      'timeout-callback': () => xong(() => loi(new Error('Hết thời gian xác nhận người thật, vui lòng thử lại.'))),
    });
  });
}

// ── Vé xem văn bản (2 giờ, máy chủ cấp sau khi qua kiểm tra) — giữ trong phiên trình duyệt ──
const VE = 'camlam_ve_vb';
export async function layVeXemVanBan(moi = false): Promise<string> {
  if (!(await layKhoa())) return '';
  if (!moi) { try { const c = JSON.parse(sessionStorage.getItem(VE) || 'null'); if (c && c.het > Date.now() + 60_000) return c.ve; } catch {} }
  const token = await layMaNguoiThat();
  const r = await api<{ ve: string }>('/van-ban/ve-nguoi-that', { method: 'POST', body: JSON.stringify({ token }) });
  try { sessionStorage.setItem(VE, JSON.stringify({ ve: r.ve, het: Date.now() + 115 * 60_000 })); } catch {}
  return r.ve;
}
