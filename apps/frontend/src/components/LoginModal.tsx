'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth, type AuthUser } from '@/lib/auth';
import PasswordInput from './PasswordInput';
import LogoAnh from '@/components/LogoAnh';
import { dangNhapVanTay, kiemTraVanTay, loiDeHieu, type TinhTrangVanTay } from '@/lib/vanTay';

/**
 * Popup ĐĂNG NHẬP dùng chung — hiện đè lên trang (không rời trang).
 * Mở qua useLoginGate().requireLogin({reason,onSuccess}). Đăng nhập xong tự chạy tiếp hành động đang chờ.
 */
export default function LoginModal({ open, reason, onClose, onSuccess }: { open: boolean; reason?: string; onClose: () => void; onSuccess: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  /* ⚠️ Ô ĐĂNG NHẬP BẬT LÊN CŨNG PHẢI CÓ VÂN TAY / KHUÔN MẶT.
     Trước đây chỉ trang /login mới có nút này, còn popup thì không — mà
     hầu hết người dùng gặp popup chứ ít khi vào thẳng /login, nên nhìn vào
     tưởng web chưa làm. Chủ dự án báo đúng chỗ này.
     Nút LÚC NÀO CŨNG HIỆN: máy chưa dùng được thì bấm vào hiện bảng nói rõ
     vì sao và phải làm gì, chứ ẩn nút đi là người dùng không biết đường nào. */
  const [vanTay, setVanTay] = useState<TinhTrangVanTay | null>(null);
  const [busyVt, setBusyVt] = useState(false);
  const [baoVanTay, setBaoVanTay] = useState('');

  useEffect(() => {
    if (!open) return;
    kiemTraVanTay().then(setVanTay).catch(() => {});
  }, [open]);

  async function vaoBangVanTay() {
    const tt = vanTay ?? await kiemTraVanTay();
    if (!vanTay) setVanTay(tt);
    if (!tt.dung) { setBaoVanTay(tt.loiNhan); return; }
    setErr(''); setBusyVt(true);
    try {
      const r = await dangNhapVanTay(email.trim() || undefined);
      login(r.token, r.user as AuthUser, true);
      onSuccess();
    } catch (e: any) { setBaoVanTay(loiDeHieu(e)); } finally { setBusyVt(false); }
  }

  useEffect(() => {
    if (!open) return;
    setErr(''); setShowForgot(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // khoá cuộn nền khi mở popup
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await api<{ token: string; user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      login(r.token, r.user, remember);
      setEmail(''); setPassword('');
      onSuccess();
    } catch (e: any) { setErr(e?.message || 'Đăng nhập thất bại'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto cl-fadeup">
        <div className="p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6">
          <button onClick={onClose} aria-label="Đóng" className="absolute top-3 right-3 w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 text-lg leading-none">✕</button>
          <div className="flex items-center gap-2.5">
            <span className="w-11 h-11 rounded-xl bg-[#0A2540] grid place-items-center shrink-0">
              <LogoAnh cao={26} nenToi />
            </span>
            <div>
              <div className="font-extrabold text-[#0A2540] leading-tight">Cam Lâm <span className="text-[#C8A14B]">Land</span></div>
              <div className="text-[11px] text-slate-400">Sàn BĐS &amp; bản đồ quy hoạch</div>
            </div>
          </div>
          <h2 className="text-xl font-extrabold text-[#0A2540] mt-4">Đăng nhập để tiếp tục</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">{reason || 'Đăng nhập để dùng đầy đủ tính năng của Cam Lâm Land.'}</p>
          <form onSubmit={submit} className="space-y-3 mt-4">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="username" placeholder="Email" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm focus:border-[#0A2540] outline-none" />
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu" autoComplete="current-password" required />
            {err && <p className="text-red-600 text-sm font-semibold">{err}</p>}
            <label className="flex items-center gap-2 text-sm text-slate-600 select-none cursor-pointer">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-[#0A2540] w-4 h-4" /> Ghi nhớ đăng nhập
            </label>
            <button disabled={busy} className="cl-press w-full bg-[#0A2540] hover:bg-[#0d2f54] disabled:opacity-60 text-white font-bold py-2.5 rounded-lg">{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
          </form>
          {/* Nút vân tay / khuôn mặt — giống hệt trang /login cho đồng bộ. */}
          <div className="mt-3 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <button type="button" onClick={vaoBangVanTay} disabled={busyVt}
              aria-label="Đăng nhập bằng khuôn mặt hoặc vân tay"
              title="Đăng nhập bằng khuôn mặt hoặc vân tay"
              className="cl-press grid h-11 w-11 place-items-center rounded-full border border-slate-300 text-[#0A2540] hover:border-[#0A2540] hover:bg-slate-50 disabled:opacity-60">
              {/* ⚠️ LOGO FACE ID, KHÔNG PHẢI VÂN TAY. Bản trước vẽ vân tay —
                  mấy vòng cung lồng nhau, thu về 24px thành một cục xoắn khó
                  hiểu, mà phần lớn người dùng mở web bằng điện thoại thì cái
                  họ gặp là NHẬN DIỆN KHUÔN MẶT chứ không phải vân tay.
                  Nay dùng đúng ký hiệu Face ID: bốn ngoặc góc + hình người.
                  Bốn ngoặc góc mới là thứ ai cũng nhận ra ngay, đừng bỏ. */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <path d="M3 8.5V6a3 3 0 0 1 3-3h2.5" /><path d="M15.5 3H18a3 3 0 0 1 3 3v2.5" />
                <path d="M21 15.5V18a3 3 0 0 1-3 3h-2.5" /><path d="M8.5 21H6a3 3 0 0 1-3-3v-2.5" />
                <circle cx="12" cy="10.3" r="2.6" />
                <path d="M7.7 17.6a4.7 4.7 0 0 1 8.6 0" />
              </svg>
            </button>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 text-sm">
            <button type="button" onClick={() => setShowForgot((v) => !v)} className="font-medium text-slate-500 hover:text-[#0A2540]">Quên mật khẩu?</button>
            <span className="text-slate-500">Chưa có tài khoản? <Link href="/register" onClick={onClose} className="font-bold text-[#0A2540] hover:text-[#C8A14B]">Đăng ký</Link></span>
          </div>
          {showForgot && <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-[13px] leading-relaxed text-slate-500">Hiện chưa hỗ trợ tự đặt lại mật khẩu online. Vui lòng liên hệ <a href="tel:0988888888" className="font-bold text-[#0A2540]">0988 888 888</a> (gọi/Zalo) để được cấp lại mật khẩu.</p>}
        </div>
      </div>

      {/* Bảng báo khi máy chưa dùng được vân tay.
          ⚠️ Dùng bảng tự vẽ chứ KHÔNG dùng alert() của trình duyệt: alert()
             khoá cả trang, trên điện thoại nhìn thô và không xuống dòng được.
          ⚠️ z-index phải CAO HƠN chính ô đăng nhập, nếu không bảng nằm lọt
             phía sau, bấm nút mà tưởng không có gì xảy ra. */}
      {baoVanTay && (
        <div role="dialog" aria-modal="true" aria-label="Thông báo đăng nhập bằng khuôn mặt"
          className="fixed inset-0 z-[90] grid place-items-center bg-black/45 px-4"
          onClick={() => setBaoVanTay('')}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-xl">🔒</span>
              <div className="min-w-0">
                <h2 className="font-extrabold text-[#0A2540]">Chưa dùng được</h2>
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
  );
}
