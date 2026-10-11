const KEY = 'camlam_token';
export function setToken(token: string, remember = true): void {
  try {
    if (remember) { localStorage.setItem(KEY, token); sessionStorage.removeItem(KEY); }
    else { sessionStorage.setItem(KEY, token); localStorage.removeItem(KEY); }
  } catch { /* ignore */ }
}
export function getToken(): string | null {
  try { return sessionStorage.getItem(KEY) || localStorage.getItem(KEY); } catch { return null; }
}
/** Thay thẻ đăng nhập bằng thẻ MỚI, giữ đúng chỗ đang cất (nhớ đăng nhập → localStorage, không nhớ → sessionStorage).
 *  Dùng khi đổi mật khẩu: máy chủ thu hồi thẻ cũ và cấp thẻ mới cho chính máy này (11/10/2026). */
export function thayToken(token: string): void {
  let nho = true;
  try { nho = !sessionStorage.getItem(KEY); } catch { /* ignore */ }
  setToken(token, nho);
}
export function clearToken(): void {
  try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
