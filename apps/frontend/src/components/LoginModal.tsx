'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth, type AuthUser } from '@/lib/auth';
import PasswordInput from './PasswordInput';

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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C8A14B" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.3V20h14V9.3" /><circle cx="12" cy="13.6" r="1.5" fill="#C8A14B" stroke="none" /></svg>
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
          <div className="mt-4 flex items-center justify-between gap-2 text-sm">
            <button type="button" onClick={() => setShowForgot((v) => !v)} className="font-medium text-slate-500 hover:text-[#0A2540]">Quên mật khẩu?</button>
            <span className="text-slate-500">Chưa có tài khoản? <Link href="/register" onClick={onClose} className="font-bold text-[#0A2540] hover:text-[#C8A14B]">Đăng ký</Link></span>
          </div>
          {showForgot && <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-[13px] leading-relaxed text-slate-500">Hiện chưa hỗ trợ tự đặt lại mật khẩu online. Vui lòng liên hệ <a href="tel:0988888888" className="font-bold text-[#0A2540]">0988 888 888</a> (gọi/Zalo) để được cấp lại mật khẩu.</p>}
        </div>
      </div>
    </div>
  );
}
