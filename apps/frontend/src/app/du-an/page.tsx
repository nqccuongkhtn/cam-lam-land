'use client';
// TRANG "DỰ ÁN BẤT ĐỘNG SẢN" — tất cả dự án nổi bật (chủ dự án 2/10/2026: nút "Xem thêm" ở khối dự án trang chủ
// phải sổ vào trang dự án chứ không phải trang tin đăng). Dữ liệu lấy từ /api/projects (admin quản lý ở trang chủ).
// Lọc theo tình trạng / loại dự án dùng chung quy tắc suy chữ với bộ lọc trang chủ (lib/duAnLoc.ts).
// Điện thoại: danh sách dọc ảnh trái – chữ phải (giống khối dự án trang chủ). Máy tính: lưới thẻ có ảnh.
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import SiteFooter from '@/components/SiteFooter';
import { LOAI_DU_AN, TRANG_THAI_DU_AN, loaiCua, trangThaiCua, type DuAnGoiY } from '@/lib/duAnLoc';

const khongDau = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
function mauTinhTrang(t?: string | null) {
  const k = trangThaiCua({ id: 0, name: '', status: t });
  return k === 'mo-ban' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : k === 'hoat-dong' ? 'bg-sky-50 text-sky-700 ring-sky-200' : 'bg-amber-50 text-amber-700 ring-amber-200';
}

export default function DuAnPage() {
  const [ds, setDs] = useState<DuAnGoiY[] | null>(null);
  const [tt, setTt] = useState('');
  const [loai, setLoai] = useState('');
  const [tim, setTim] = useState('');
  useEffect(() => { api<{ projects: DuAnGoiY[] }>('/projects').then((r) => setDs(r.projects || [])).catch(() => setDs([])); }, []);

  const loc = useMemo(() => (ds || []).filter((p) =>
    (!tt || trangThaiCua(p) === tt) && (!loai || loaiCua(p).includes(loai))
    && (!tim.trim() || khongDau(`${p.name} ${p.scale || ''} ${p.location || ''}`).includes(khongDau(tim.trim())))), [ds, tt, loai, tim]);

  const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${on ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>{children}</button>
  );

  return (
    <>
      <div className="mx-auto max-w-7xl px-3 pb-10 pt-4 sm:px-4 sm:pt-8">
        <nav className="text-[12.5px] text-slate-400"><Link href="/" className="hover:text-[#C8A14B]">Trang chủ</Link> › <span className="text-slate-600">Dự án</span></nav>
        <h1 className="mt-1.5 text-xl font-extrabold text-[#0A2540] sm:text-3xl">Dự án bất động sản Cam Lâm</h1>
        <p className="mt-1 text-[13px] text-slate-500 sm:text-sm">Dự án đất nền, nghỉ dưỡng, khu đô thị tại Cam Lâm – Khánh Hòa{ds ? ` · ${ds.length} dự án` : ''}.</p>

        {/* Bộ lọc: ô tìm + 2 hàng chip cuộn ngang trên điện thoại */}
        <div className="mt-4 space-y-2.5">
          <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="🔍 Tìm tên dự án, khu vực…" aria-label="Tìm dự án"
            className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-[14px] outline-none focus:border-[#0A2540] focus:bg-white sm:max-w-md" />
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
            <Chip on={!tt} onClick={() => setTt('')}>Tất cả tình trạng</Chip>
            {TRANG_THAI_DU_AN.map((t) => <Chip key={t.key} on={tt === t.key} onClick={() => setTt(tt === t.key ? '' : t.key)}>{t.ten}</Chip>)}
          </div>
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
            <Chip on={!loai} onClick={() => setLoai('')}>Mọi loại</Chip>
            {LOAI_DU_AN.map((l) => <Chip key={l.key} on={loai === l.key} onClick={() => setLoai(loai === l.key ? '' : l.key)}>{l.ten}</Chip>)}
          </div>
        </div>

        {!ds && <p className="py-16 text-center text-slate-400">Đang tải dự án…</p>}
        {ds && !loc.length && (
          <div className="py-14 text-center text-slate-500">
            Không có dự án nào khớp bộ lọc.
            <button onClick={() => { setTt(''); setLoai(''); setTim(''); }} className="ml-1 font-semibold text-red-600">Bỏ lọc</button>
          </div>
        )}

        {/* ĐIỆN THOẠI: danh sách dọc */}
        <ul className="mt-5 space-y-3.5 sm:hidden">
          {loc.map((p) => (
            <li key={p.id + p.name}>
              <Link href={`/listings?q=${encodeURIComponent(p.name)}`} className="flex items-center gap-3 active:opacity-80">
                <span className="relative h-[84px] w-[124px] shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  {p.status ? <span className="block text-[11.5px] font-semibold text-emerald-600">{p.status}</span> : null}
                  <span className="mt-0.5 block line-clamp-2 text-[15px] font-bold leading-snug text-[#0A2540]">{p.name}</span>
                  {(p.scale || p.location) ? <span className="mt-0.5 block truncate text-[12.5px] text-slate-500">{[p.scale, p.location].filter(Boolean).join(' · ')}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* MÁY TÍNH / MÁY TÍNH BẢNG: lưới thẻ */}
        <div className="mt-6 hidden gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loc.map((p) => (
            <Link key={p.id + p.name} href={`/listings?q=${encodeURIComponent(p.name)}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-lg">
              <span className="relative block aspect-[16/10] overflow-hidden bg-slate-100">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                ) : null}
              </span>
              <span className="p-4">
                {p.status ? <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ring-1 ${mauTinhTrang(p.status)}`}>{p.status}</span> : null}
                <span className="mt-1.5 block font-bold text-[#0A2540] group-hover:text-red-700">{p.name}</span>
                {p.scale ? <span className="mt-1 block text-[13px] font-medium text-slate-700">{p.scale}</span> : null}
                {p.location ? <span className="mt-1 block text-[13px] text-slate-500">📍 {p.location}</span> : null}
              </span>
            </Link>
          ))}
        </div>

        {/* Mời chủ đầu tư quảng bá — dẫn sang trang dịch vụ */}
        <div className="mt-8 flex flex-col items-start gap-3 rounded-lg border border-slate-200 bg-[#f4f7fc] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="font-bold text-[#0A2540]">Có dự án muốn quảng bá tại Cam Lâm?</p>
            <p className="mt-0.5 text-[13px] text-slate-500">Đưa dự án lên trang chủ, gắn logo trên bản đồ quy hoạch, đẩy tin nổi bật.</p>
          </div>
          <Link href="/dichvu" className="shrink-0 rounded-lg bg-[#0A2540] px-4 py-2.5 text-[13.5px] font-bold text-white">Xem dịch vụ →</Link>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
