'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';
import { getToken, setToken, clearToken } from './token';

// Khớp với packages/shared/src/index.ts và ràng buộc trong database.
export type Role = 'user' | 'admin' | 'gis' | 'vanban' | 'hotlist' | 'danhmuc';
export interface AuthUser {
  id: number; email: string; role: Role; roles?: Role[];
  fullName?: string | null; phone?: string | null;
  tier?: string; status?: string; emailVerified?: boolean; avatar?: string | null;
}
interface Ctx { user: AuthUser | null; loading: boolean; login: (t: string, u: AuthUser, remember?: boolean) => void; logout: () => void; refresh: () => Promise<void>; }
const AuthCtx = createContext<Ctx>({ user: null, loading: true, login: () => {}, logout: () => {}, refresh: async () => {} });
export const useAuth = () => useContext(AuthCtx);

// ── KIỂM TRA VAI TRÒ (một người có thể giữ nhiều vai trò) ──
/** Danh sách vai trò của tài khoản. Tài khoản cũ chỉ có một vai trò thì trả về đúng một. */
export const dsVaiTro = (u?: { role?: string | null; roles?: string[] | null } | null): string[] =>
  !u ? [] : (Array.isArray(u.roles) && u.roles.length ? u.roles : (u.role ? [u.role] : []));
/** Có ít nhất một trong các vai trò kể ra không? */
export const coVaiTro = (u: { role?: string | null; roles?: string[] | null } | null | undefined, ...canCo: string[]): boolean => {
  const ds = dsVaiTro(u); return canCo.some((v) => ds.includes(v));
};
/** Quản trị viên. */
export const laAdmin = (u?: { role?: string | null; roles?: string[] | null } | null) => coVaiTro(u, 'admin');
/** Tên tiếng Việt của từng vai trò — dùng chung cho trang quản trị và chỗ nào cần hiện ra. */
export const TEN_VAI_TRO: Record<string, string> = {
  user: 'Khách', admin: 'Admin', gis: 'Biên tập GIS', vanban: 'Quản lý văn bản',
  hotlist: '🔥 Tra cứu danh sách nóng', danhmuc: '🗄️ Kho danh mục hồ sơ',
};

const USER_KEY = 'camlam_user';
function readCachedUser(): AuthUser | null {
  try { const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY); return raw ? (JSON.parse(raw) as AuthUser) : null; } catch { return null; }
}
function writeCachedUser(u: AuthUser | null, remember?: boolean): void {
  try {
    if (!u) { localStorage.removeItem(USER_KEY); sessionStorage.removeItem(USER_KEY); return; }
    const rem = remember ?? !!localStorage.getItem('camlam_token');
    if (rem) { localStorage.setItem(USER_KEY, JSON.stringify(u)); sessionStorage.removeItem(USER_KEY); }
    else { sessionStorage.setItem(USER_KEY, JSON.stringify(u)); localStorage.removeItem(USER_KEY); }
  } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const t = getToken();
    if (!t) { setUser(null); writeCachedUser(null); setLoading(false); return; }
    try { const r = await api<{ user: AuthUser }>('/auth/me'); setUser(r.user); writeCachedUser(r.user); }
    catch { setUser(null); clearToken(); writeCachedUser(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const cached = readCachedUser();
    if (cached) setUser(cached); // hiện tên ngay, không chờ /auth/me
    refresh();                   // xác thực lại ở nền
  }, [refresh]);
  // ĐỒNG BỘ đăng nhập/đăng xuất giữa các cửa sổ & IFRAME (hub Tiện ích/Quản lý): token đổi ở nơi khác -> tự cập nhật, khỏi phải tải lại.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key === 'camlam_token' || e.key === USER_KEY) refresh(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);
  const login = (t: string, u: AuthUser, remember = true) => { setToken(t, remember); writeCachedUser(u, remember); setUser(u); };
  const logout = () => { clearToken(); writeCachedUser(null); setUser(null); };
  return <AuthCtx.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthCtx.Provider>;
}
