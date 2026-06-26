'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth, type AuthUser } from '@/lib/auth';
import PasswordInput from '@/components/PasswordInput';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await api<{ token: string; user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      login(r.token, r.user, remember);
      router.push(r.user.role === 'admin' ? '/admin' : '/');
    } catch (e: any) { setErr(e.message || 'Đăng nhập thất bại'); } finally { setBusy(false); }
  }
  return (
    <div className="min-h-[calc(100vh-56px)] grid place-items-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-7">
        <h1 className="text-2xl font-extrabold text-[#0A2540]">Đăng nhập</h1>
        <p className="text-sm text-slate-500 mt-1 mb-5">Cam Lâm <span className="text-[#C8A14B] font-bold">Land</span> — sàn bất động sản & quy hoạch</p>
        <form onSubmit={submit} className="space-y-3">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="username" placeholder="Email" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#0A2540] outline-none" />
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu" autoComplete="current-password" required />
          {err && <p className="text-red-600 text-sm font-semibold">{err}</p>}
          <label className="flex items-center gap-2 text-sm text-slate-600 select-none cursor-pointer">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-[#0A2540] w-4 h-4" />
            Ghi nhớ đăng nhập
          </label>
          <button disabled={busy} className="w-full bg-[#0A2540] hover:bg-[#0d2f54] disabled:opacity-60 text-white font-bold py-2.5 rounded-lg">{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        </form>
        <p className="text-sm text-slate-500 mt-4 text-center">Chưa có tài khoản? <Link href="/register" className="text-[#0A2540] font-bold hover:text-[#C8A14B]">Đăng ký ngay</Link></p>
      </div>
    </div>
  );
}
