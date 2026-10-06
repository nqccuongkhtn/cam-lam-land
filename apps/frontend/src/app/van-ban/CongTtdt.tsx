'use client';
/* MỤC "CỔNG THÔNG TIN ĐIỆN TỬ KHÁNH HÒA" — MẪU 34 chủ dự án chọn (6/10/2026): ô tìm nhanh + LƯỚI TẤT CẢ CỔNG
   (ô bằng nhau, thẳng hàng), gõ là lọc ngay. Gõ không dấu vẫn ra ("cam lam" → Cam Lâm), gõ tên nhóm cũng ra
   ("nha trang" → cả nhóm Nha Trang & Diên Khánh). Máy tính 5 cột · máy tính bảng 3 · điện thoại 2. */
import { useMemo, useState } from 'react';
import { PORTALS } from './data';

const boDau = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const TAT_CA = PORTALS.flatMap((g) => g.items.map(([ten, url]) => ({ ten, url, nhom: g.nhom, khoa: boDau(`${ten} ${g.nhom}`) })));

export default function CongTtdt() {
  const [q, setQ] = useState('');
  const ds = useMemo(() => { const k = boDau(q.trim()); return k ? TAT_CA.filter((c) => c.khoa.includes(k)) : TAT_CA; }, [q]);
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <label className="relative w-full max-w-sm">
          <span className="sr-only">Tìm cổng thông tin</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm cổng: Cam Lâm, Sở Xây dựng…"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-[#0A2540] outline-none placeholder:text-slate-400 focus:border-[#0A2540]" />
        </label>
        <span className="shrink-0 text-[13px] text-slate-500">{ds.length} cổng</span>
      </div>
      {ds.length ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
          {ds.map((c) => (
            <a key={c.url} href={c.url} target="_blank" rel="noreferrer" title={`${c.ten} — ${c.nhom}`}
              className="group flex min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-700 transition hover:border-slate-300 hover:text-red-600 sm:text-sm">
              <span className="min-w-0 leading-snug">{c.ten}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0 text-slate-300 group-hover:text-red-600" aria-hidden><path d="M7 17 17 7M9 7h8v8" /></svg>
            </a>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">Không có cổng nào khớp "{q}". Thử gõ tên xã, phường hoặc sở ngành khác.</p>
      )}
    </div>
  );
}
