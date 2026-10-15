'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { layMaNguoiThat } from '@/lib/turnstile';
import { useAuth, type AuthUser } from '@/lib/auth';
import PasswordInput from './PasswordInput';
import LogoAnh from '@/components/LogoAnh';
import { dangNhapVanTay, kiemTraVanTay, loiDeHieu, laHuy, chuanBiVanTay, batGoiYBanPhim, tuTaoKhoa, type TinhTrangVanTay } from '@/lib/vanTay';

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

  // Hàm mới nhất của trang mẹ — lệnh gợi ý trên bàn phím treo lâu, xong việc phải gọi đúng bản mới nhất.
  const xongRef = useRef(onSuccess); xongRef.current = onSuccess;
  const loginRef = useRef(login); loginRef.current = login;

  useEffect(() => {
    if (!open) return;
    /* Mở ô là XIN SẴN thử thách Face ID (lib/vanTay.ts chuanBiVanTay) cho nút, máy chủ giữ 5 phút → làm mới mỗi 4 phút.
       Kèm TREO GỢI Ý TRÊN BÀN PHÍM (batGoiYBanPhim): chạm ô Email → iPhone hiện tài khoản ngay trên bàn phím → chạm vào là
       quét Face ID luôn, không qua hộp "Sử dụng Face ID để đăng nhập? — Tiếp tục" (hộp đó chỉ hiện khi bấm NÚT, Apple bắt buộc). */
    let huy = false;
    let lamMoi: ReturnType<typeof setInterval> | undefined;
    let goGoiY: (() => void) | undefined;
    kiemTraVanTay().then((tt) => {
      if (huy) return;
      setVanTay(tt);
      if (!tt.dung) return;
      chuanBiVanTay(); lamMoi = setInterval(() => chuanBiVanTay(true), 4 * 60 * 1000);
      goGoiY = batGoiYBanPhim(
        (r) => { loginRef.current(r.token, r.user as AuthUser, true); xongRef.current(); },
        (e) => { if (!laHuy(e)) setBaoVanTay(loiDeHieu(e)); });
    }).catch(() => {});
    return () => { huy = true; if (lamMoi) clearInterval(lamMoi); goGoiY?.(); };
  }, [open]);

  async function vaoBangVanTay() {
    // ⚠️ Không thêm lệnh chờ (await) nào trước dangNhapVanTay — iPhone đời cũ (iOS ≤ 17.3) không cho mở Face ID sau khi chờ.
    const tt = vanTay ?? await kiemTraVanTay();
    if (!vanTay) setVanTay(tt);
    if (!tt.dung) { setBaoVanTay(tt.loiNhan); return; }
    setErr(''); setBusyVt(true);
    try {
      const r = await dangNhapVanTay(email.trim() || undefined);
      login(r.token, r.user as AuthUser, true);
      onSuccess();
    } catch (e: any) {
      // Tự tắt bảng Face ID thì thôi, không hiện hộp báo (chủ dự án: "bỏ thông báo này đi", 12/10/2026).
      if (!laHuy(e)) setBaoVanTay(loiDeHieu(e));
    } finally { setBusyVt(false); chuanBiVanTay(); }
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
      const r = await api<{ token: string; user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, cfToken: await layMaNguoiThat() /* kiểm tra người thật — chống cào */ }) });
      login(r.token, r.user, remember);
      const tenDaGo = email;
      setEmail(''); setPassword('');
      onSuccess();
      // Vừa đăng nhập bằng mật khẩu: nếu mật khẩu do máy tự điền thì máy tự tạo luôn khoá Face ID / vân tay, không hỏi gì (lib/vanTay.ts)
      void tuTaoKhoa(tenDaGo);
    } catch (e: any) { setErr(e?.message || 'Đăng nhập thất bại'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto cl-fadeup">
        <div className="p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6">
          <button onClick={onClose} aria-label="Đóng" className="absolute top-3 right-3 w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 text-lg leading-none">✕</button>
          <div className="flex items-center gap-2.5">
            {/* ⚠️ KHÔNG BỌC LOGO TRONG Ô NAVY: logo tự là ô vuông navy viền vàng — bọc thêm thành
                hai khung lồng nhau, chữ CL bé tí (chủ dự án chụp màn hình báo lỗi 12/10/2026). */}
            <LogoAnh cao={44} />
            <div>
              <div className="font-extrabold text-[#0A2540] leading-tight">Cam Lâm <span className="text-[#C8A14B]">Land</span></div>
              <div className="text-[11px] text-slate-400">Sàn BĐS &amp; bản đồ quy hoạch</div>
            </div>
          </div>
          <h2 className="text-xl font-extrabold text-[#0A2540] mt-4">Đăng nhập để tiếp tục</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">{reason || 'Đăng nhập để dùng đầy đủ tính năng của Cam Lâm Land.'}</p>
          <form onSubmit={submit} className="space-y-3 mt-4">
            {/* autoComplete "username webauthn": chạm vào ô là iPhone gợi ý tài khoản đã bật Face ID ngay trên bàn phím
                (lib/vanTay.ts batGoiYBanPhim). Bỏ chữ "webauthn" là mất gợi ý. */}
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="username webauthn" placeholder="Email" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base sm:text-sm focus:border-[#0A2540] outline-none" />
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
          {showForgot && <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-[13px] leading-relaxed text-slate-500">Hiện chưa hỗ trợ tự đặt lại mật khẩu online. Vui lòng liên hệ <a href="tel:0567442996" className="font-bold text-[#0A2540]">0567 442 996</a> (gọi/Zalo) để được cấp lại mật khẩu.</p>}
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
