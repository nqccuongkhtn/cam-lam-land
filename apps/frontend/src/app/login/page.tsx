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
        {/* Nút vân tay: CHỈ CÒN BIỂU TƯỢNG cho gọn. Vẫn có aria-label và title để
            người dùng rê chuột thấy chữ, và máy đọc màn hình đọc được. */}
        <div className="mt-4 flex items-center justify-center">
          <button type="button" onClick={vaoBangVanTay} disabled={busyVt}
            aria-label="Đăng nhập bằng khuôn mặt hoặc vân tay"
            title="Đăng nhập bằng khuôn mặt / vân tay (Face ID, Windows Hello)"
            className="cl-press grid h-11 w-11 place-items-center rounded-full border border-slate-300 text-[#0A2540] hover:border-[#0A2540] hover:bg-slate-50 disabled:opacity-60">
            {/* ⚠️ LOGO FACE ID, KHÔNG PHẢI VÂN TAY. Bản trước vẽ vân tay —
                mấy vòng cung lồng nhau, thu về 24px thành một cục xoắn khó
                hiểu, mà phần lớn người dùng mở web bằng điện thoại thì cái
                họ gặp là NHẬN DIỆN KHUÔN MẶT chứ không phải vân tay.
                Nay dùng đúng ký hiệu Face ID: bốn ngoặc góc + khuôn mặt.
                Bốn ngoặc góc mới là thứ ai cũng nhận ra ngay, đừng bỏ. */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <path d="M3 8.5V6a3 3 0 0 1 3-3h2.5" /><path d="M15.5 3H18a3 3 0 0 1 3 3v2.5" />
              <path d="M21 15.5V18a3 3 0 0 1-3 3h-2.5" /><path d="M8.5 21H6a3 3 0 0 1-3-3v-2.5" />
              <path d="M9 9.6v1.9" /><path d="M15 9.6v1.9" />
              <path d="M12 9.6v3.3a.9.9 0 0 1-.9.9h-.45" />
              <path d="M8.9 16.3c.9.85 1.95 1.25 3.1 1.25s2.2-.4 3.1-1.25" />
            </svg>
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
