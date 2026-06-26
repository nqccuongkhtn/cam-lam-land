'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth, type AuthUser } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [fullName, setFullName] = useState(''); const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await api<{ token: string; user: AuthUser }>('/auth/register', { method: 'POST', body: JSON.stringify({ fullName, email, phone, password }) });
      login(r.token, r.user); router.push('/');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#0A2540] outline-none';
  return (
    <div className="min-h-[calc(100vh-56px)] grid place-items-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-7">
        <h1 className="text-2xl font-extrabold text-[#0A2540]">Đăng ký tài khoản</h1>
        <p className="text-sm text-slate-500 mt-1 mb-5">Một tài khoản — vừa <b>xem tin</b>, vừa <b>đăng tin</b> bán/cho thuê trên Cam Lâm <span className="text-[#C8A14B] font-bold">Land</span>.</p>
        <form onSubmit={submit} className="space-y-3">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Họ và tên *" className={inp} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="Số điện thoại *" className={inp} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email *" className={inp} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required placeholder="Mật khẩu (≥ 6 ký tự) *" className={inp} />
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <button disabled={busy} className="w-full bg-[#0A2540] hover:bg-[#0d2f54] disabled:opacity-60 text-white font-bold py-2.5 rounded-lg">{busy ? 'Đang tạo…' : 'Đăng ký'}</button>
        </form>
        <p className="text-sm text-slate-500 mt-4 text-center">Đã có tài khoản? <Link href="/login" className="text-[#0A2540] font-bold hover:text-[#C8A14B]">Đăng nhập</Link></p>
      </div>
    </div>
  );
}
