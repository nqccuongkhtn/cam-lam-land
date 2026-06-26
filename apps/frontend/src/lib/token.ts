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
export function clearToken(): void {
  try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
