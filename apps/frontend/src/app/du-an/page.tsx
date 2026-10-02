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
import { KhungBangLoc, MucLoc, OLuoi, NutXemKetQua } from '@/components/LocNangCao';

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
  const [moLoc, setMoLoc] = useState(false);
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

        {/* ĐIỆN THOẠI — ĐỒNG BỘ với trang chủ & trang tin đăng (chủ dự án 2/10/2026: "chưa đồng bộ, chưa gọn"):
            ô tìm MỘT KHỐI (📍 chữ gõ … ⚙ [🔍]) + TAB GẠCH CHÂN tình trạng; loại dự án nằm trong bảng lọc dùng chung. */}
        <div className="mt-3 sm:hidden">
          <div className="flex h-11 items-center rounded-lg border border-transparent bg-slate-100 pr-1 transition-colors focus-within:border-[#C8A14B] focus-within:bg-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-3 h-[18px] w-[18px] shrink-0 text-slate-400"><path d="M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21Z" /><circle cx="12" cy="10.5" r="2.3" /></svg>
            <input value={tim} onChange={(e) => setTim(e.target.value)} enterKeyHint="search" placeholder="Tên dự án, khu vực…" aria-label="Tìm dự án"
              className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-800 outline-none placeholder:text-slate-400" />
            <button type="button" onClick={() => setMoLoc(true)} aria-label={loai ? 'Bộ lọc, đang bật 1' : 'Bộ lọc'}
              className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-md active:bg-slate-200 ${loai ? 'text-red-600' : 'text-slate-600'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-[18px] w-[18px]"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
              {loai && <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white">1</span>}
            </button>
            <button type="button" onClick={() => (document.activeElement as HTMLElement | null)?.blur()} aria-label="Tìm kiếm"
              className="cl-press ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-red-600 text-white active:bg-red-700">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="h-[18px] w-[18px]"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
            </button>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3 border-b border-slate-200">
            <div className="-mb-px flex gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {/* Tab điện thoại dùng chữ NGẮN (bỏ "Đang") cho vừa một hàng 4 tab. */}
              {([['', 'Tất cả'], ...TRANG_THAI_DU_AN.map((t) => [t.key, t.ten.replace(/^Đang\s+/, '').replace(/^./, (c) => c.toUpperCase())])] as [string, string][]).map(([k, ten]) => (
                <button key={k || 'tat'} onClick={() => setTt(k)}
                  className={`relative shrink-0 whitespace-nowrap pb-2 text-[14px] transition ${tt === k ? 'font-bold text-[#0A2540]' : 'font-medium text-slate-500'}`}>
                  {ten}
                  <span aria-hidden className={`absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-red-600 transition-opacity ${tt === k ? 'opacity-100' : 'opacity-0'}`} />
                </button>
              ))}
            </div>
          </div>
          {loai && (
            <p className="mt-2 text-[12.5px] text-slate-500">Loại: <b className="text-[#0A2540]">{LOAI_DU_AN.find((l) => l.key === loai)?.ten}</b>
              <button onClick={() => setLoai('')} className="ml-1.5 font-semibold text-red-600">Bỏ ×</button></p>
          )}
        </div>
        <KhungBangLoc mo={moLoc} dong={() => setMoLoc(false)} datLai={() => { setTt(''); setLoai(''); }} coLoc={!!(tt || loai)}
          chan={<NutXemKetQua onClick={() => setMoLoc(false)} so={loc.length} chuMacDinh="Xem dự án" donVi="dự án" />}>
          <MucLoc ten="Tình trạng">
            <div className="grid grid-cols-2 gap-2">
              <OLuoi on={!tt} onClick={() => setTt('')}>Tất cả</OLuoi>
              {TRANG_THAI_DU_AN.map((t) => <OLuoi key={t.key} on={tt === t.key} onClick={() => setTt(tt === t.key ? '' : t.key)}>{t.ten}</OLuoi>)}
            </div>
          </MucLoc>
          <MucLoc ten="Loại dự án">
            <div className="grid grid-cols-2 gap-2">
              <OLuoi on={!loai} onClick={() => setLoai('')}>Mọi loại</OLuoi>
              {LOAI_DU_AN.map((l) => <OLuoi key={l.key} on={loai === l.key} onClick={() => setLoai(loai === l.key ? '' : l.key)}>{l.ten}</OLuoi>)}
            </div>
          </MucLoc>
        </KhungBangLoc>

        {/* MÁY TÍNH: ô tìm + hai hàng chip (màn rộng, không cần bảng lọc) */}
        <div className="mt-4 hidden space-y-2.5 sm:block">
          <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="🔍 Tìm tên dự án, khu vực…" aria-label="Tìm dự án"
            className="h-11 w-full max-w-md rounded-lg border border-slate-200 bg-slate-50 px-3 text-[14px] outline-none focus:border-[#0A2540] focus:bg-white" />
          <div className="flex flex-wrap gap-2">
            <Chip on={!tt} onClick={() => setTt('')}>Tất cả tình trạng</Chip>
            {TRANG_THAI_DU_AN.map((t) => <Chip key={t.key} on={tt === t.key} onClick={() => setTt(tt === t.key ? '' : t.key)}>{t.ten}</Chip>)}
          </div>
          <div className="flex flex-wrap gap-2">
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
