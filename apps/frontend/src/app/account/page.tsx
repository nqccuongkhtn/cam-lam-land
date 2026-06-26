'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, uploadImages } from '@/lib/api';
import { resizeImage } from '@/lib/img';
import { useAuth } from '@/lib/auth';
import PasswordInput from '@/components/PasswordInput';

export default function Account() {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();
  const [fullName, setFullName] = useState(''); const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [curPw, setCurPw] = useState(''); const [newPw, setNewPw] = useState('');
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (user) { setFullName(user.fullName || ''); setPhone(user.phone || ''); setAvatar(user.avatar || null); }
  }, [loading, user, router]);

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true); setErr(''); setMsg('');
    try { const r = await uploadImages([await resizeImage(f, 512, 0.85)]); setAvatar(r[0].url); }
    catch (e: any) { setErr('Lỗi tải ảnh: ' + e.message); } finally { setUploading(false); e.target.value = ''; }
  }
  async function saveInfo(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try { await api('/auth/me', { method: 'PATCH', body: JSON.stringify({ fullName, phone, avatar }) }); await refresh(); setMsg('Đã lưu thông tin tài khoản.'); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function savePw(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try { await api('/auth/me', { method: 'PATCH', body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }) }); setCurPw(''); setNewPw(''); setMsg('Đã đổi mật khẩu.'); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  if (loading || !user) return <div className="py-24 text-center text-slate-500">Đang tải…</div>;
  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-[#0A2540] outline-none';
  const lbl = 'block text-sm font-semibold text-slate-700 mb-1';

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)] py-8">
      <div className="mx-auto max-w-2xl px-4 space-y-5">
        <h1 className="text-2xl font-extrabold text-[#0A2540]">Tài khoản của tôi</h1>

        <form onSubmit={saveInfo} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-4">
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
          <button disabled={busy || uploading} className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded-xl shadow-sm shadow-red-600/30">Lưu thông tin</button>
        </form>

        <form onSubmit={savePw} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-bold text-[#0A2540]">Đổi mật khẩu</h2>
          <div><label className={lbl}>Mật khẩu hiện tại</label><PasswordInput value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" /></div>
          <div><label className={lbl}>Mật khẩu mới (≥ 6 ký tự)</label><PasswordInput value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" /></div>
          <button disabled={busy || !curPw || !newPw} className="bg-[#0A2540] hover:bg-[#0d2f54] disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded-xl">Đổi mật khẩu</button>
        </form>

        {err && <p className="text-red-600 text-sm font-semibold">{err}</p>}
        {msg && !err && <p className="text-emerald-600 text-sm font-semibold">{msg}</p>}
      </div>
    </div>
  );
}
