'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

export type Role = 'user' | 'admin' | 'sales';
export interface AuthUser {
  id: number; email: string; role: Role;
  fullName?: string | null; phone?: string | null;
  tier?: string; status?: string; emailVerified?: boolean;
}
interface Ctx { user: AuthUser | null; loading: boolean; login: (t: string, u: AuthUser) => void; logout: () => void; refresh: () => Promise<void>; }
const AuthCtx = createContext<Ctx>({ user: null, loading: true, login: () => {}, logout: () => {}, refresh: async () => {} });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('camlam_token') : null;
    if (!t) { setUser(null); setLoading(false); return; }
    try { const r = await api<{ user: AuthUser }>('/auth/me'); setUser(r.user); }
    catch { setUser(null); window.localStorage.removeItem('camlam_token'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const login = (t: string, u: AuthUser) => { window.localStorage.setItem('camlam_token', t); setUser(u); };
  const logout = () => { window.localStorage.removeItem('camlam_token'); setUser(null); };
  return <AuthCtx.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthCtx.Provider>;
}
