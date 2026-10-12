'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, uploadImages } from '@/lib/api';
import { resizeImage } from '@/lib/img';
import { useAuth } from '@/lib/auth';
import { thayToken } from '@/lib/token';
import PasswordInput from '@/components/PasswordInput';
import ImageCropper from '@/components/ImageCropper';
import QuanLyVanTay from '@/components/QuanLyVanTay';
import XinMoiGioiCn from '@/components/XinMoiGioiCn';
import ThietBiCuaToi from '@/components/ThietBiCuaToi';
import { toast } from '@/lib/toast';

export default function Account() {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();
  const [fullName, setFullName] = useState(''); const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [curPw, setCurPw] = useState(''); const [newPw, setNewPw] = useState('');
  // Đổi mật khẩu: mặc định ĐĂNG XUẤT mọi thiết bị khác (chủ dự án 11/10/2026: cho người dùng tự chọn, mặc định có đánh dấu).
  const [dangXuatKhac, setDangXuatKhac] = useState(true);
  const [lanDoiMk, setLanDoiMk] = useState(0);   // tăng sau mỗi lần đổi mật khẩu → khung "vân tay / khuôn mặt" tải lại danh sách
  // Thông báo kết quả hiện bằng HỘP NỔI ở đầu màn hình (lib/toast.tsx). Trước để chữ ở CUỐI TRANG — bấm "Đổi mật khẩu" xong
  // phải cuộn tận đáy mới thấy (chủ dự án 12/10/2026: "thông báo cho hiện popup chứ ai lại đi để ở dưới cùng").
  const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (user) { setFullName(user.fullName || ''); setPhone(user.phone || ''); setAvatar(user.avatar || null); }
  }, [loading, user, router]);

  function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''; if (f) setCropFile(f);
  }
  async function onCropDone(blob: Blob) {
    setCropFile(null); setUploading(true);
    try { const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' }); const r = await uploadImages([file]); setAvatar(r[0].url); }
    catch (e: any) { toast.error(e?.message || 'Thử lại.', 'Chưa tải được ảnh'); } finally { setUploading(false); }
  }
  async function saveInfo(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await api('/auth/me', { method: 'PATCH', body: JSON.stringify({ fullName, phone, avatar }) }); await refresh(); toast.success('Đã lưu thông tin tài khoản.'); }
    catch (e: any) { toast.error(e?.message || 'Thử lại.', 'Chưa lưu được'); } finally { setBusy(false); }
  }
  async function savePw(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api<{ token?: string; soVanTayDaTat?: number; daDangXuatMayKhac?: boolean }>('/auth/me', {
        method: 'PATCH', body: JSON.stringify({ currentPassword: curPw, newPassword: newPw, dangXuatMayKhac: dangXuatKhac }) });
      // Máy chủ đã thu hồi thẻ cũ và cấp THẺ MỚI cho chính máy này → thay ngay, máy này không bị đăng xuất.
      if (r.token) thayToken(r.token);
      setCurPw(''); setNewPw(''); setLanDoiMk((n) => n + 1);
      const them = [
        r.soVanTayDaTat ? 'Face ID / vân tay đã tắt — bấm “Bật cho máy này” để bật lại.' : '',
        r.daDangXuatMayKhac ? 'Các thiết bị khác đã bị đăng xuất.' : '',
      ].filter(Boolean).join(' ');
      toast.success(them || 'Lần sau đăng nhập bằng mật khẩu mới.', 'Đã đổi mật khẩu', them ? 8000 : undefined);
    }
    catch (e: any) { toast.error(e?.message || 'Thử lại.', 'Chưa đổi được mật khẩu'); } finally { setBusy(false); }
  }

  if (loading || !user) return <div className="py-24 text-center text-slate-500">Đang tải…</div>;
  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#0A2540] outline-none';
  const lbl = 'block text-sm font-semibold text-slate-700 mb-1';

  return (
    <div className="bg-slate-50 min-h-[calc(100dvh-56px)] py-5 sm:py-8">
      <div className="mx-auto max-w-2xl px-3 sm:px-4 space-y-4 sm:space-y-5">
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#0A2540]">Tài khoản của tôi</h1>

        <form onSubmit={saveInfo} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3 sm:gap-4">
            {avatar
              ? <img src={avatar} alt="" className="w-20 h-20 rounded-full object-cover ring-2 ring-[#C8A14B]/40" />
              : <div className="w-20 h-20 rounded-full bg-[#0A2540] text-[#C8A14B] grid place-items-center text-2xl font-extrabold">{(fullName || user.email || 'U').charAt(0).toUpperCase()}</div>}
            <div>
              <label className="inline-block bg-[#0A2540] hover:bg-[#0d2f54] text-white text-sm font-semibold px-4 py-2 rounded-lg cursor-pointer">
                <input type="file" accept="image/*" onChange={onAvatar} className="hidden" />
                {uploading ? 'Đang tải…' : 'Đổi ảnh đại diện'}
              </label>
              {avatar && <button type="button" onClick={() => setAvatar(null)} className="ml-2 text-sm text-slate-500 hover:text-red-600">Xoá ảnh</button>}
              <p className="text-xs text-slate-400 mt-1">Ảnh vuông đẹp nhất. Tối đa 8MB.</p>
            </div>
          </div>
          <div><label className={lbl}>Họ và tên</label><input className={inp} value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div><label className={lbl}>Số điện thoại</label><input className={inp} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><label className={lbl}>Email</label><input className={`${inp} bg-slate-50 text-slate-500`} value={user.email} disabled /></div>
          <button disabled={busy || uploading} className="cl-press bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded-xl shadow-sm shadow-red-600/30">Lưu thông tin</button>
        </form>

        <form onSubmit={savePw} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
          <h2 className="font-bold text-[#0A2540]">Đổi mật khẩu</h2>
          <div><label className={lbl}>Mật khẩu hiện tại</label><PasswordInput value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" /></div>
          <div><label className={lbl}>Mật khẩu mới (≥ 8 ký tự, có chữ và số)</label><PasswordInput value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" /></div>
          <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input type="checkbox" checked={dangXuatKhac} onChange={(e) => setDangXuatKhac(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0A2540]" />
            <span><b>Đăng xuất khỏi mọi thiết bị khác</b><span className="block text-xs text-slate-500">Máy này vẫn đăng nhập. Đăng nhập bằng vân tay / khuôn mặt luôn được tắt khi đổi mật khẩu.</span></span>
          </label>
          <button disabled={busy || !curPw || !newPw} className="cl-press bg-[#0A2540] hover:bg-[#0d2f54] disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded-xl">Đổi mật khẩu</button>
        </form>

        <XinMoiGioiCn />

        <QuanLyVanTay key={lanDoiMk} />

        <ThietBiCuaToi />

        {cropFile && <ImageCropper file={cropFile} title="Cân chỉnh ảnh đại diện" onCancel={() => setCropFile(null)} onDone={onCropDone} />}
      </div>
    </div>
  );
}
