'use client';
/* ============================================================================
 *  KHUNG BẬT / QUẢN LÝ ĐĂNG NHẬP BẰNG VÂN TAY · KHUÔN MẶT
 *  Đặt trong trang Tài khoản. Xem cách nó chạy ở apps/backend/src/routes/passkey.ts.
 * ========================================================================== */
import { useCallback, useEffect, useState } from 'react';
import {
  themVanTay, dsMayDaDangKy, xoaVanTay, mayCoVanTay, tenMayMacDinh, loiDeHieu,
  type MayDaDangKy,
} from '@/lib/vanTay';

const ngayVn = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export default function QuanLyVanTay() {
  const [co, setCo] = useState(false);
  const [ds, setDs] = useState<MayDaDangKy[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  const nap = useCallback(async () => {
    try { setDs((await dsMayDaDangKy()).ds || []); } catch { /* chưa đăng nhập thì thôi */ }
  }, []);

  useEffect(() => { mayCoVanTay().then(setCo).catch(() => {}); nap(); }, [nap]);

  async function them() {
    setErr(''); setMsg(''); setBusy(true);
    try {
      await themVanTay(tenMayMacDinh());
      setMsg('Đã bật. Lần sau vào trang đăng nhập, bấm "Đăng nhập bằng vân tay / khuôn mặt" là xong.');
      await nap();
    } catch (e: any) { setErr(loiDeHieu(e)); } finally { setBusy(false); }
  }

  async function xoa(id: number, ten: string) {
    if (!confirm(`Gỡ vân tay của "${ten}"? Máy đó sẽ phải đăng nhập lại bằng mật khẩu.`)) return;
    setErr(''); setMsg('');
    try { await xoaVanTay(id); setMsg('Đã gỡ.'); await nap(); }
    catch (e: any) { setErr(e?.message || 'Không gỡ được'); }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-[15px] font-extrabold text-[#0A2540]">🔐 Đăng nhập bằng vân tay · khuôn mặt</h2>
      <p className="mt-1 text-[12.5px] leading-snug text-slate-500">
        Bật rồi thì lần sau chỉ cần chạm vân tay là vào, khỏi gõ mật khẩu.
        <b className="text-slate-600"> Vân tay và khuôn mặt không rời khỏi máy này</b> — máy chủ chỉ
        giữ một khoá công khai, không đọc được vân tay của ai. Phải bật riêng trên từng máy.
      </p>

      {!co && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] leading-snug text-amber-800">
          Máy hoặc trình duyệt này chưa dùng được. Cần máy có vân tay / khuôn mặt (Face ID, Touch ID,
          Windows Hello) và trang phải mở bằng <b>https</b>.
        </p>
      )}

      {msg && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] font-semibold text-emerald-700">{msg}</p>}
      {err && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-semibold text-rose-700">{err}</p>}

      {ds.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {ds.map((m) => (
            <li key={m.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-[#0A2540]">{m.ten_may || 'Máy không tên'}</span>
                <span className="block text-[11.5px] text-slate-400">
                  Bật ngày {ngayVn(m.created_at)}
                  {m.last_used ? ` · dùng lần cuối ${ngayVn(m.last_used)}` : ' · chưa dùng lần nào'}
                </span>
              </span>
              <button onClick={() => xoa(m.id, m.ten_may || 'Máy không tên')}
                className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-semibold text-rose-600 hover:border-rose-300">
                Gỡ
              </button>
            </li>
          ))}
        </ul>
      )}

      <button onClick={them} disabled={!co || busy}
        className="cl-press mt-3 w-full rounded-lg bg-[#0A2540] py-2.5 font-bold text-white disabled:opacity-50">
        {busy ? 'Đang chờ xác nhận trên máy…' : ds.length ? 'Bật thêm cho máy khác' : 'Bật cho máy này'}
      </button>
    </div>
  );
}
