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
  // ô email/mật khẩu nên tưởng web chưa làm tính năng này.
  // Nay: nút LÚC NÀO CŨNG HIỆN và bấm được. Máy chưa dùng được thì bấm vào hiện
  // bảng thông báo nói rõ vì sao và phải làm gì.
  const [vanTay, setVanTay] = useState<TinhTrangVanTay | null>(null);
  const [busyVt, setBusyVt] = useState(false);
  const [baoVanTay, setBaoVanTay] = useState('');   // nội dung bảng thông báo, rỗng = đóng
  useEffect(() => { kiemTraVanTay().then(setVanTay).catch(() => {}); }, []);

  async function vaoBangVanTay() {
    // Chưa kiểm xong thì kiểm ngay lúc bấm, khỏi bắt người dùng chờ.
    const tt = vanTay ?? await kiemTraVanTay();
    if (!vanTay) setVanTay(tt);
    if (!tt.dung) { setBaoVanTay(tt.loiNhan); return; }

    setErr(''); setBusyVt(true);
    try {
      const r = await dangNhapVanTay(email.trim() || undefined);
      login(r.token, r.user as AuthUser, true);
      router.push(laAdmin(r.user) ? '/admin' : '/');
    } catch (e: any) { setBaoVanTay(loiDeHieu(e)); } finally { setBusyVt(false); }
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
        {/* Nút vân tay để GỌN: không chiếm cả bề ngang, chữ ngắn, bỏ đoạn giải thích
            dài phía dưới (phần đó đã nói trong bảng thông báo và trang Tài khoản). */}
        <div className="mt-4 flex items-center justify-center">
          <button type="button" onClick={vaoBangVanTay} disabled={busyVt}
            title="Đăng nhập bằng vân tay hoặc khuôn mặt"
            className="cl-press inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3.5 py-1.5 text-[13px] font-semibold text-[#0A2540] hover:border-[#0A2540] disabled:opacity-60">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="h-4 w-4">
              <path d="M12 4c-3 0-5.5 1.8-5.5 5v2.5" /><path d="M12 4c3 0 5.5 1.8 5.5 5v5" />
              <path d="M9.2 9.5A2.8 2.8 0 0 1 12 7a2.8 2.8 0 0 1 2.8 2.5v6" />
              <path d="M12 10v5.5" /><path d="M6.5 14v2.5" /><path d="M17.5 17v2" /><path d="M9.2 13v5" />
            </svg>
            {busyVt ? 'Đang xác minh…' : 'Vân tay / khuôn mặt'}
          </button>
        </div>

        <p className="text-sm text-slate-500 mt-4 text-center">Chưa có tài khoản? <Link href="/register" className="text-[#0A2540] font-bold hover:text-[#C8A14B]">Đăng ký ngay</Link></p>

        {/* Bảng thông báo khi máy chưa dùng được vân tay.
            Dùng bảng tự vẽ chứ KHÔNG dùng alert() của trình duyệt — alert() khoá
            cả trang, trên điện thoại nhìn thô, và không viết xuống dòng được. */}
        {baoVanTay && (
          <div role="dialog" aria-modal="true" aria-label="Thông báo đăng nhập bằng vân tay"
            className="fixed inset-0 z-[80] grid place-items-center bg-black/45 px-4"
            onClick={() => setBaoVanTay('')}>
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-xl">🔒</span>
                <div className="min-w-0">
                  <h2 className="font-extrabold text-[#0A2540]">Máy này chưa dùng được vân tay</h2>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{baoVanTay}</p>
                </div>
              </div>
              <button type="button" onClick={() => setBaoVanTay('')}
                className="cl-press mt-4 w-full rounded-lg bg-[#0A2540] py-2.5 font-bold text-white">
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
