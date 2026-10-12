'use client';
/* Ô "Môi giới chuyên nghiệp" trong trang Tài khoản (5/10/2026) — xem apps/backend/src/routes/moiGioiCn.ts.
   Hiện 4 điều kiện (đạt / chưa đạt), nút "Nhờ xác minh số" và nút "Xin duyệt" (chỉ bấm được khi đủ cả 4). */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';

type DK = { ma: string; ten: string; dat: boolean; chiTiet: string };
type TinhTrang = { trangThai: 'khong' | 'cho' | 'duyet' | 'tu_choi'; ghiChu: string | null; dieuKien: DK[]; duDieuKien: boolean; sdtOk: boolean; sdtXinLuc: string | null; phone: string | null };

export default function XinMoiGioiCn() {
  const [tt, setTt] = useState<TinhTrang | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<TinhTrang>('/moi-gioi-cn/cua-toi').then(setTt).catch(() => {}); }, []);
  if (!tt) return null;

  const goi = async (duong: string) => {
    // Kết quả báo bằng hộp nổi đầu màn hình như cả trang Tài khoản (chủ dự án 12/10/2026: "cho hiện popup").
    setBusy(true);
    try {
      setTt(await api<TinhTrang>(duong, { method: 'POST' }));
      toast.success(duong.endsWith('xin-duyet') ? 'Admin sẽ xem hồ sơ và duyệt sớm.' : 'Admin sẽ gọi xác minh số điện thoại.', 'Đã gửi yêu cầu');
    } catch (e: any) { toast.error(e?.message || 'Thử lại.', 'Chưa gửi được'); } finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <h2 className="font-bold text-[#0A2540]">Môi giới chuyên nghiệp</h2>
        {tt.trangThai === 'duyet' && <span className="rounded-full bg-[#009ba1]/10 px-2 py-0.5 text-[11px] font-bold text-[#00787d]">✓ Đã duyệt</span>}
        {tt.trangThai === 'cho' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">Đang chờ duyệt</span>}
      </div>
      <p className="mt-1 text-[13px] text-slate-500">
        {tt.trangThai === 'duyet'
          ? 'Tin của bạn đang hiện khung "Môi giới chuyên nghiệp" màu xanh ngọc ở trang xem tin.'
          : `Được duyệt thì tin của bạn hiện khung "Môi giới chuyên nghiệp" nổi bật, tạo tin tưởng với người mua. Cần đủ ${tt.dieuKien.length} điều kiện:`}
      </p>

      {tt.trangThai !== 'duyet' && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100">
          {tt.dieuKien.map((d) => (
            <li key={d.ma} className="flex items-center gap-3 px-3 py-2.5">
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${d.dat ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{d.dat ? '✓' : '–'}</span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${d.dat ? 'text-[#0A2540]' : 'text-slate-600'}`}>{d.ten}</span>
                <span className="block text-xs text-slate-400">{d.chiTiet}</span>
              </span>
              {d.ma === 'sdt' && !d.dat && tt.phone && !tt.sdtXinLuc && (
                <button onClick={() => goi('/moi-gioi-cn/nho-xac-minh-sdt')} disabled={busy} className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-[#0A2540] hover:bg-slate-50 disabled:opacity-60">Nhờ xác minh số</button>
              )}
              {d.ma === 'goi' && !d.dat && <Link href="/dichvu" className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-[#0A2540] hover:bg-slate-50">Xem gói</Link>}
            </li>
          ))}
        </ul>
      )}

      {tt.trangThai === 'tu_choi' && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">Yêu cầu lần trước chưa được duyệt{tt.ghiChu ? `: ${tt.ghiChu}` : '.'} Bạn có thể xin lại.</p>}
      {(tt.trangThai === 'khong' || tt.trangThai === 'tu_choi') && (
        <button onClick={() => goi('/moi-gioi-cn/xin-duyet')} disabled={busy || !tt.duDieuKien}
          className="mt-3 h-11 w-full rounded-lg bg-[#009ba1] text-sm font-bold text-white hover:bg-[#008a90] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 sm:w-auto sm:px-6">
          {tt.duDieuKien ? 'Xin duyệt môi giới chuyên nghiệp' : 'Chưa đủ điều kiện để xin duyệt'}
        </button>
      )}
      {tt.trangThai === 'cho' && <p className="mt-3 text-[13px] text-slate-500">Đã gửi yêu cầu. Admin sẽ xem hồ sơ và duyệt sớm.</p>}
    </div>
  );
}
