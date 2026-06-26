'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth, type AuthUser } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [mode, setMode] = useState<'user' | 'sales'>('user');
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(''); const [password, setPassword] = useState('');
  const [code, setCode] = useState(''); const [devCode, setDevCode] = useState('');
  const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);

  async function register(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (mode === 'user') {
        const r = await api<{ token: string; user: AuthUser }>('/auth/register', { method: 'POST', body: JSON.stringify({ fullName, email, phone, password }) });
        login(r.token, r.user); router.push('/');
      } else {
        const r = await api<{ message: string; email: string; devCode?: string }>('/auth/register-sales', { method: 'POST', body: JSON.stringify({ fullName, email, phone, password }) });
        if (r.devCode) setDevCode(r.devCode); setMsg(r.message); setStep('verify');
      }
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await api<{ token: string; user: AuthUser }>('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email, code }) });
      login(r.token, r.user); router.push('/');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function resend() {
    setErr(''); try { const r = await api<{ devCode?: string }>('/auth/resend-code', { method: 'POST', body: JSON.stringify({ email }) }); if (r.devCode) setDevCode(r.devCode); setMsg('Đã gửi lại mã.'); } catch (e: any) { setErr(e.message); }
  }
  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#0A2540] outline-none';
  const tab = (m: 'user' | 'sales', label: string) => (
    <button type="button" onClick={() => setMode(m)} className={`flex-1 py-2 rounded-lg text-sm font-bold ${mode === m ? 'bg-white shadow text-[#0A2540]' : 'text-slate-500'}`}>{label}</button>
  );
  return (
    <div className="min-h-[calc(100vh-56px)] grid place-items-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-7">
        <h1 className="text-2xl font-extrabold text-[#0A2540]">Đăng ký tài khoản</h1>
        <p className="text-sm text-slate-500 mt-1 mb-4">Cam Lâm <span className="text-[#C8A14B] font-bold">Land</span></p>
        {step === 'form' && (
          <>
            <div className="flex gap-1 mb-4 bg-slate-100 rounded-xl p-1">{tab('user', 'Khách hàng')}{tab('sales', 'Môi giới')}</div>
            <p className="text-xs text-slate-500 mb-3">{mode === 'user' ? 'Đăng ký để xem đầy đủ số liên hệ & lưu tin quan tâm.' : 'Tài khoản môi giới để đăng tin (cần xác thực email).'}</p>
            <form onSubmit={register} className="space-y-3">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Họ và tên *" className={inp} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="Số điện thoại *" className={inp} />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email *" className={inp} />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required placeholder="Mật khẩu (≥ 6 ký tự) *" className={inp} />
              {err && <p className="text-red-600 text-sm">{err}</p>}
              <button disabled={busy} className="w-full bg-[#0A2540] hover:bg-[#0d2f54] disabled:opacity-60 text-white font-bold py-2.5 rounded-lg">{busy ? 'Đang xử lý…' : (mode === 'user' ? 'Đăng ký' : 'Đăng ký & nhận mã')}</button>
            </form>
          </>
        )}
        {step === 'verify' && (
          <form onSubmit={verify} className="space-y-3">
            <p className="text-sm text-slate-600">Đã gửi <b>mã 6 số</b> tới <b className="text-[#0A2540]">{email}</b>.</p>
            {devCode && <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">Bản demo: mã là <b className="tracking-widest">{devCode}</b>.</p>}
            <input value={code} onChange={(e) => setCode(e.target.value)} required maxLength={6} placeholder="Nhập mã 6 số" className={`${inp} tracking-[0.3em] text-center font-bold`} />
            {err && <p className="text-red-600 text-sm">{err}</p>}
            {msg && !err && <p className="text-emerald-600 text-sm">{msg}</p>}
            <button disabled={busy} className="w-full bg-[#0A2540] hover:bg-[#0d2f54] disabled:opacity-60 text-white font-bold py-2.5 rounded-lg">{busy ? 'Đang xác thực…' : 'Xác thực & vào trang'}</button>
            <button type="button" onClick={resend} className="w-full text-sm text-[#0A2540] font-semibold">Gửi lại mã</button>
          </form>
        )}
        <p className="text-sm text-slate-500 mt-4 text-center">Đã có tài khoản? <Link href="/login" className="text-[#0A2540] font-bold hover:text-[#C8A14B]">Đăng nhập</Link></p>
      </div>
    </div>
  );
}
