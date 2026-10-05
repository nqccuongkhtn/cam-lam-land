'use client';
/* ============================================================================
 *  DUYỆT MÔI GIỚI CHUYÊN NGHIỆP — trang của admin (5/10/2026)
 *  Máy chủ: apps/backend/src/routes/moiGioiCn.ts (mọi đường /admin/* đều kiểm quyền admin).
 *
 *  Ba việc:
 *    · Người "nhờ xác minh số" → admin gọi thử số đó → bấm "Đã xác minh số".
 *    · Người "xin duyệt" (máy chủ đã kiểm đủ 4 điều kiện) → Duyệt / Từ chối (kèm lý do).
 *    · Thu hồi nhãn của người đã duyệt.
 *  Ô tìm kiếm tìm được BẤT KỲ tài khoản nào (để xác minh số trước khi họ nhờ).
 * ========================================================================== */
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, laAdmin } from '@/lib/auth';

type DK = { ma: string; ten: string; dat: boolean; chiTiet: string };
type Dong = {
  id: number; email: string; ten: string | null; phone: string | null; avatar: string | null; taoLuc: string;
  trangThai: 'khong' | 'cho' | 'duyet' | 'tu_choi'; xinLuc: string | null; duyetLuc: string | null; ghiChu: string | null;
  sdtXinLuc: string | null; soTin: number; dieuKien: DK[]; duDieuKien: boolean; sdtOk: boolean; canSdt: boolean;
};
const TEN_TT: Record<Dong['trangThai'], [string, string]> = {
  khong: ['Chưa xin', 'bg-slate-100 text-slate-600'],
  cho: ['Đang xin duyệt', 'bg-amber-50 text-amber-700'],
  duyet: ['Đã duyệt', 'bg-[#009ba1]/10 text-[#00787d]'],
  tu_choi: ['Đã từ chối', 'bg-red-50 text-red-700'],
};
const ngay = (s: string | null) => (s ? new Date(s).toLocaleDateString('vi-VN') : '');

export default function DuyetMoiGioiCn() {
  const { user, loading } = useAuth();
  const [loc, setLoc] = useState<'cho' | 'duyet'>('cho');
  const [q, setQ] = useState('');
  const [tim, setTim] = useState('');
  const [ds, setDs] = useState<Dong[] | null>(null);
  const [loi, setLoi] = useState('');
  const [dang, setDang] = useState<number | null>(null);

  const tai = useCallback(() => {
    setDs(null); setLoi('');
    api<{ ds: Dong[] }>(`/moi-gioi-cn/admin/ds?loc=${loc}${tim ? `&q=${encodeURIComponent(tim)}` : ''}`)
      .then((r) => setDs(r.ds)).catch((e) => setLoi(e.message));
  }, [loc, tim]);
  useEffect(() => { if (laAdmin(user)) tai(); }, [user, tai]);

  const lam = async (id: number, duong: string, body: any) => {
    setDang(id); setLoi('');
    try {
      const r = await api<Dong>(`/moi-gioi-cn/admin/${id}/${duong}`, { method: 'POST', body: JSON.stringify(body) });
      setDs((cu) => cu?.map((d) => (d.id === id ? r : d)) ?? null);
    } catch (e: any) { setLoi(e.message); } finally { setDang(null); }
  };

  if (loading) return <div className="py-16 text-center text-slate-400">Đang tải…</div>;
  if (!laAdmin(user)) return <div className="py-16 text-center text-slate-500">Chỉ admin xem được trang này. <Link href="/" className="font-semibold text-[#C8A14B]">Về trang chủ</Link></div>;

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-slate-50 py-5 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-4 px-3 sm:px-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#0A2540] sm:text-2xl">Duyệt môi giới chuyên nghiệp</h1>
          <p className="mt-1 text-sm text-slate-500">Người được duyệt sẽ hiện khung xanh ngọc "Môi giới chuyên nghiệp" ở trang xem tin. Xin duyệt cần đủ: tài khoản trên 3 tháng · từ 30 tin · đã từng mua gói.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {([['cho', 'Cần xử lý'], ['duyet', 'Đã duyệt']] as const).map(([k, t]) => (
            <button key={k} onClick={() => { setLoc(k); setTim(''); setQ(''); }} className={`h-9 rounded-lg px-4 text-sm font-semibold ${loc === k && !tim ? 'bg-[#0A2540] text-white' : 'border border-slate-300 bg-white text-[#0A2540]'}`}>{t}</button>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); setTim(q.trim()); }} className="flex min-w-[220px] flex-1 gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tài khoản: tên, email, số điện thoại" className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#0A2540]" />
            <button className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-[#0A2540]">Tìm</button>
          </form>
        </div>

        {loi && <p className="text-sm font-semibold text-red-600">{loi}</p>}
        {!ds ? <p className="py-10 text-center text-slate-400">Đang tải…</p>
          : ds.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white py-10 text-center text-slate-400">{tim ? 'Không tìm thấy tài khoản nào.' : loc === 'cho' ? 'Không có ai đang chờ xử lý.' : 'Chưa có môi giới chuyên nghiệp nào.'}</p>
          : ds.map((d) => (
            <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                {d.avatar ? <img src={d.avatar} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" /> : <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 font-semibold text-slate-600">{(d.ten || d.email).charAt(0).toUpperCase()}</div>}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[#0A2540]">{d.ten || '(chưa đặt tên)'}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TEN_TT[d.trangThai][1]}`}>{TEN_TT[d.trangThai][0]}</span>
                  </div>
                  <p className="truncate text-xs text-slate-500">{d.email} · {d.phone || 'chưa có số'} · <Link href={`/moi-gioi/${d.id}`} className="text-[#0A2540] underline">trang cá nhân</Link></p>
                  {d.xinLuc && d.trangThai === 'cho' && <p className="text-xs text-slate-400">Xin duyệt ngày {ngay(d.xinLuc)}</p>}
                  {d.duyetLuc && d.trangThai === 'duyet' && <p className="text-xs text-slate-400">Duyệt ngày {ngay(d.duyetLuc)}</p>}
                  {d.ghiChu && <p className="text-xs text-slate-500">Ghi chú: {d.ghiChu}</p>}
                </div>
              </div>

              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {d.dieuKien.map((k) => (
                  <li key={k.ma} className="flex items-center gap-2 text-[13px]">
                    <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${k.dat ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{k.dat ? '✓' : '–'}</span>
                    <span className={k.dat ? 'text-slate-700' : 'text-slate-400'}>{k.chiTiet}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap gap-2">
                {/* Kiểm tra người xin duyệt: bấm mở Zalo của số đó để kết bạn — kết bạn được = số có thật, đúng người
                    (chủ dự án chọn cách này thay cho điều kiện "đã xác minh SĐT", 5/10/2026). */}
                {d.phone && <a href={`https://zalo.me/${d.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-[#0068ff] hover:bg-slate-50">Mở Zalo {d.phone}</a>}
                {d.canSdt && d.phone && (d.sdtOk
                  ? <button disabled={dang === d.id} onClick={() => lam(d.id, 'sdt', { xacMinh: false })} className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">Bỏ xác minh số</button>
                  : <a href={`tel:${d.phone.replace(/\s/g, '')}`} className="flex h-9 items-center rounded-lg border border-slate-300 px-3 text-xs font-semibold text-[#0A2540] hover:bg-slate-50">📞 Gọi {d.phone}</a>)}
                {d.canSdt && d.phone && !d.sdtOk && <button disabled={dang === d.id} onClick={() => lam(d.id, 'sdt', { xacMinh: true })} className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">✓ Đã xác minh số</button>}
                {d.trangThai !== 'duyet' && (
                  <button disabled={dang === d.id} onClick={() => lam(d.id, 'quyet', { hanhDong: 'duyet' })} className="h-9 rounded-lg bg-[#009ba1] px-4 text-xs font-bold text-white hover:bg-[#008a90] disabled:opacity-60" title={d.duDieuKien ? '' : 'Người này chưa đủ 4 điều kiện — admin vẫn duyệt tay được'}>
                    Duyệt{d.duDieuKien ? '' : ' (chưa đủ điều kiện)'}
                  </button>
                )}
                {d.trangThai === 'cho' && (
                  <button disabled={dang === d.id} onClick={() => { const l = window.prompt('Lý do từ chối (người dùng sẽ thấy):') ; if (l !== null) lam(d.id, 'quyet', { hanhDong: 'tu-choi', ghiChu: l }); }} className="h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50">Từ chối</button>
                )}
                {d.trangThai === 'duyet' && (
                  <button disabled={dang === d.id} onClick={() => { if (window.confirm(`Thu hồi nhãn môi giới chuyên nghiệp của ${d.ten || d.email}?`)) lam(d.id, 'quyet', { hanhDong: 'thu-hoi' }); }} className="h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50">Thu hồi nhãn</button>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
