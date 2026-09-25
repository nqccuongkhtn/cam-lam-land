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
      setMsg('Đã bật cho máy này.');
      await nap();
    } catch (e: any) { setErr(loiDeHieu(e)); } finally { setBusy(false); }
  }

  async function xoa(id: number, ten: string) {
    if (!confirm(`Gỡ "${ten}"? Máy đó sẽ phải nhập mật khẩu.`)) return;
    setErr(''); setMsg('');
    try { await xoaVanTay(id); setMsg('Đã gỡ.'); await nap(); }
    catch (e: any) { setErr(e?.message || 'Không gỡ được'); }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      {/* ⚠️ CHỮ NGẮN NHƯ APP. Chủ dự án dặn "ghi đơn giản như app thôi, đừng
          dùng từ ngữ AI": mỗi câu một ý, không giải thích cơ chế, không kể
          điều kiện kỹ thuật. Người dùng chỉ cần biết bật để làm gì. */}
      <h2 className="text-[15px] font-extrabold text-[#0B4045]">🔐 Đăng nhập bằng khuôn mặt · vân tay</h2>
      <p className="mt-1 text-[12.5px] leading-snug text-slate-500">
        Bật rồi thì khỏi gõ mật khẩu. Bật riêng cho từng máy.
      </p>

      {!co && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] leading-snug text-amber-800">
          Máy này chưa dùng được.
        </p>
      )}

      {msg && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] font-semibold text-emerald-700">{msg}</p>}
      {err && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-semibold text-rose-700">{err}</p>}

      {ds.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {ds.map((m) => (
            <li key={m.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-[#0B4045]">{m.ten_may || 'Máy không tên'}</span>
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
        className="cl-press mt-3 w-full rounded-lg bg-[#0B4045] py-2.5 font-bold text-white disabled:opacity-50">
        {busy ? 'Đang chờ xác nhận trên máy…' : ds.length ? 'Bật thêm cho máy khác' : 'Bật cho máy này'}
      </button>
    </div>
  );
}
