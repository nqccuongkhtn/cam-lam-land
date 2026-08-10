'use client';
// Danh sách cẩm nang: nạp trước toàn bộ, hiển thị theo TRANG (phân trang số).
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

type Item = { slug: string; title: string; desc: string };

export default function GuideList({ items }: { items: Item[] }) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(8); // desktop 8 bài/trang, mobile 6 bài/trang
  const topRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setPerPage(mq.matches ? 6 : 8);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const cur = Math.min(page, totalPages);
  const shown = items.slice((cur - 1) * perPage, cur * perPage);
  const go = (p: number) => { const np = Math.min(Math.max(1, p), totalPages); setPage(np); topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  // Dãy số trang có dấu … khi nhiều trang
  const nums: (number | '…')[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - cur) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  const box = 'grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm font-semibold transition';

  return (
    <div ref={topRef} className="scroll-mt-24">
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
        {shown.map((g) => (
          <Link key={g.slug} href={`/cam-nang/${g.slug}`} className="block rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 transition hover:border-[#C8A14B] hover:shadow-sm">
            <h2 className="text-base sm:text-lg font-bold leading-snug text-[#0A2540]">{g.title}</h2>
            <p className="mt-1.5 text-[13px] sm:text-sm text-slate-500">{g.desc}</p>
            <span className="mt-2.5 inline-block text-[13px] sm:text-sm font-semibold text-[#C8A14B]">Đọc tiếp →</span>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5" aria-label="Phân trang cẩm nang">
          <button onClick={() => go(cur - 1)} disabled={cur === 1} aria-label="Trang trước" className={`${box} border-slate-200 text-slate-600 hover:border-[#C8A14B] disabled:cursor-not-allowed disabled:opacity-40`}>‹</button>
          {nums.map((p, i) => p === '…'
            ? <span key={`e${i}`} className="px-1 text-slate-400">…</span>
            : <button key={p} onClick={() => go(p)} aria-current={p === cur ? 'page' : undefined} className={`${box} ${p === cur ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-slate-200 text-slate-600 hover:border-[#C8A14B] hover:text-[#0A2540]'}`}>{p}</button>)}
          <button onClick={() => go(cur + 1)} disabled={cur === totalPages} aria-label="Trang sau" className={`${box} border-slate-200 text-slate-600 hover:border-[#C8A14B] disabled:cursor-not-allowed disabled:opacity-40`}>›</button>
        </nav>
      )}
    </div>
  );
}
