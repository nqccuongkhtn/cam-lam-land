'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth, type AuthUser, laAdmin } from '@/lib/auth';
import PasswordInput from '@/components/PasswordInput';
import { dangNhapVanTay, kiemTraVanTay, loiDeHieu, type TinhTrangVanTay } from '@/lib/vanTay';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  // ⚠️ TRƯỚC ĐÂY: máy nào không dùng được thì ẨN LUÔN nút vân tay. Nhìn vào chỉ thấy
  // ô email/mật khẩu nên tưởng web chưa làm tính năng này. Nay LUÔN HIỆN phần đó,
  // máy nào chưa dùng được thì nói rõ vì sao và phải làm gì.
  const [vanTay, setVanTay] = useState<TinhTrangVanTay | null>(null);
  const [busyVt, setBusyVt] = useState(false);
  useEffect(() => { kiemTraVanTay().then(setVanTay).catch(() => {}); }, []);

  async function vaoBangVanTay() {
    setErr(''); setBusyVt(true);
    try {
      const r = await dangNhapVanTay(email.trim() || undefined);
      login(r.token, r.user as AuthUser, true);
      router.push(laAdmin(r.user) ? '/admin' : '/');
    } catch (e: any) { setErr(loiDeHieu(e)); } finally { setBusyVt(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await api<{ token: string; user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      login(r.token, r.user, remember);
      router.push(laAdmin(r.user) ? '/admin' : '/');
    } catch (e: any) { setErr(e.message || 'Đăng nhập thất bại'); } finally { setBusy(false); }
  }
  return (
    <div className="min-h-[calc(100dvh-56px)] grid place-items-center bg-slate-50 px-3 py-8 sm:px-4 sm:py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-5 sm:p-7">
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
          <button disabled={busy} className="cl-press w-full bg-[#0A2540] hover:bg-[#0d2f54] disabled:opacity-60 text-white font-bold py-2.5 rounded-lg">{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        </form>
        {vanTay && (
          <>
            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200" /><span className="text-[12px] text-slate-400">hoặc</span><span className="h-px flex-1 bg-slate-200" />
            </div>
            <button type="button" onClick={vaoBangVanTay} disabled={busyVt || !vanTay.dung}
              title={vanTay.dung ? undefined : vanTay.loiNhan}
              className="cl-press flex w-full items-center justify-center gap-2 rounded-lg border-2 border-[#0A2540] py-2.5 font-bold text-[#0A2540] disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="h-5 w-5">
                <path d="M12 4c-3 0-5.5 1.8-5.5 5v2.5" /><path d="M12 4c3 0 5.5 1.8 5.5 5v5" />
                <path d="M9.2 9.5A2.8 2.8 0 0 1 12 7a2.8 2.8 0 0 1 2.8 2.5v6" />
                <path d="M12 10v5.5" /><path d="M6.5 14v2.5" /><path d="M17.5 17v2" /><path d="M9.2 13v5" />
              </svg>
              {busyVt ? 'Đang xác minh…' : 'Đăng nhập bằng vân tay / khuôn mặt'}
            </button>
            {vanTay.dung ? (
              <p className="mt-2 text-center text-[11.5px] leading-snug text-slate-400">
                Vân tay và khuôn mặt <b>không rời khỏi máy của bạn</b> — máy chủ chỉ giữ khoá công khai.
                Cần đăng nhập bằng mật khẩu một lần rồi bật ở trang Tài khoản.
              </p>
            ) : (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] leading-snug text-amber-800">
                <b>Máy này chưa dùng được.</b> {vanTay.loiNhan}
              </p>
            )}
          </>
        )}
        <p className="text-sm text-slate-500 mt-4 text-center">Chưa có tài khoản? <Link href="/register" className="text-[#0A2540] font-bold hover:text-[#C8A14B]">Đăng ký ngay</Link></p>
      </div>
    </div>
  );
}
