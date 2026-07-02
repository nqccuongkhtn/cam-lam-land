'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

// Hệ sinh thái đối tác (hiển thị khi chưa có/ít logo doanh nghiệp thật) — nhãn ngành, không phải tên thương hiệu bịa.
const CATEGORY_PARTNERS = [
  { label: 'Sàn giao dịch BĐS', icon: '🏢' },
  { label: 'Chủ đầu tư dự án', icon: '🏗️' },
  { label: 'Văn phòng công chứng', icon: '📜' },
  { label: 'Ngân hàng hỗ trợ vay', icon: '🏦' },
  { label: 'Đo đạc – Bản đồ GIS', icon: '🗺️' },
  { label: 'Nhà thầu xây dựng', icon: '🧱' },
];

type Logo = { id: number; name: string; image?: string };

export default function FeaturedPartners() {
  const [logos, setLogos] = useState<Logo[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    api<{ ads: any[] }>('/map-ads/active').then((r) => {
      const seen = new Set<number>(); const out: Logo[] = [];
      for (const a of r.ads || []) { if (a?.image && !seen.has(a.id)) { seen.add(a.id); out.push({ id: a.id, name: a.name, image: a.image }); } }
      setLogos(out);
    }).catch(() => {});
  }, []);
  const by = (d: number) => scroller.current?.scrollBy({ left: d, behavior: 'smooth' });

  const cards = [
    ...logos.map((l) => ({ key: 'ad' + l.id, kind: 'logo' as const, name: l.name, image: l.image, icon: '' })),
    ...CATEGORY_PARTNERS.map((c, i) => ({ key: 'cat' + i, kind: 'cat' as const, name: c.label, image: '', icon: c.icon })),
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl md:text-3xl font-extrabold text-[#0A2540]">Doanh nghiệp tiêu biểu</h2>
        <div className="hidden md:flex gap-2">
          <button onClick={() => by(-340)} aria-label="Xem trước" className="w-9 h-9 grid place-items-center rounded-full border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-[#0A2540] text-lg leading-none">‹</button>
          <button onClick={() => by(340)} aria-label="Xem tiếp" className="w-9 h-9 grid place-items-center rounded-full border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-[#0A2540] text-lg leading-none">›</button>
        </div>
      </div>
      <div ref={scroller} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        className="flex gap-3 md:gap-4 overflow-x-auto pb-2 snap-x [&::-webkit-scrollbar]:hidden">
        {cards.map((c) => (
          <div key={c.key} className="group snap-start shrink-0 w-40 md:w-48 h-24 md:h-28 bg-white border border-slate-200 rounded-2xl grid place-items-center px-4 hover:shadow-md hover:border-slate-300 transition">
            {c.kind === 'logo' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.image} alt={c.name} loading="lazy" decoding="async" className="max-h-14 md:max-h-16 max-w-full object-contain grayscale group-hover:grayscale-0 transition" />
            ) : (
              <div className="text-center"><div className="text-2xl md:text-3xl">{c.icon}</div><div className="text-[11px] md:text-xs font-semibold text-slate-500 mt-1 leading-tight">{c.name}</div></div>
            )}
          </div>
        ))}
        <Link href="/dichvu" className="snap-start shrink-0 w-40 md:w-48 h-24 md:h-28 rounded-2xl grid place-items-center px-4 border-2 border-dashed border-[#C8A14B]/60 text-[#0A2540] hover:bg-[#C8A14B]/5 transition">
          <div className="text-center"><div className="text-2xl leading-none">＋</div><div className="text-[11px] md:text-xs font-bold mt-1.5 leading-tight">Doanh nghiệp<br />của bạn ở đây</div></div>
        </Link>
      </div>
    </section>
  );
}
