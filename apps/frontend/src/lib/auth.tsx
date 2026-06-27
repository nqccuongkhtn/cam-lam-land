'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';
import { getToken, setToken, clearToken } from './token';

export type Role = 'user' | 'admin' | 'gis';
export interface AuthUser {
  id: number; email: string; role: Role;
  fullName?: string | null; phone?: string | null;
  tier?: string; status?: string; emailVerified?: boolean; avatar?: string | null;
}
interface Ctx { user: AuthUser | null; loading: boolean; login: (t: string, u: AuthUser, remember?: boolean) => void; logout: () => void; refresh: () => Promise<void>; }
const AuthCtx = createContext<Ctx>({ user: null, loading: true, login: () => {}, logout: () => {}, refresh: async () => {} });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const t = getToken();
    if (!t) { setUser(null); setLoading(false); return; }
    try { const r = await api<{ user: AuthUser }>('/auth/me'); setUser(r.user); }
    catch { setUser(null); clearToken(); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const login = (t: string, u: AuthUser, remember = true) => { setToken(t, remember); setUser(u); };
  const logout = () => { clearToken(); setUser(null); };
  return <AuthCtx.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthCtx.Provider>;
}
