'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';

// Doanh nghiệp tiêu biểu. Hiện dạng chữ (wordmark); nếu có file logo thật ở `logo` thì tự hiển thị ảnh.
type Partner = { name: string; logo?: string; wordmark: ReactNode };

const PARTNERS: Partner[] = [
  {
    name: 'Vingroup',
    logo: '/partners/vingroup.png',
    wordmark: (
      <span className="font-serif font-bold text-[26px] md:text-3xl tracking-tight text-slate-600">
        Vin<span className="text-[#b01e2e]">group</span>
      </span>
    ),
  },
  {
    name: 'Cam Lâm Land',
    logo: '/partners/cam-lam-land.png',
    wordmark: (
      <span className="flex items-center gap-2">
        <span className="w-8 h-8 grid place-items-center rounded-lg bg-[#0A2540] text-[#C8A14B] text-lg leading-none">⌂</span>
        <span className="font-extrabold text-lg md:text-xl leading-none">
          <span className="text-[#0A2540]">Cam Lâm</span> <span className="text-[#C8A14B]">Land</span>
        </span>
      </span>
    ),
  },
];

function PartnerTile({ p }: { p: Partner }) {
  const [imgOk, setImgOk] = useState(!!p.logo);
  return (
    <div className="group snap-start shrink-0 w-44 md:w-52 h-24 md:h-28 bg-white border border-slate-200 rounded-2xl grid place-items-center px-5 hover:shadow-md hover:border-slate-300 transition">
      {imgOk && p.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.logo} alt={p.name} loading="lazy" decoding="async" onError={() => setImgOk(false)}
          className="max-h-14 md:max-h-16 max-w-full object-contain grayscale group-hover:grayscale-0 transition" />
      ) : (
        p.wordmark
      )}
    </div>
  );
}

export default function FeaturedPartners() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-4">
      <h2 className="text-2xl md:text-3xl font-extrabold text-[#0A2540] mb-6">Doanh nghiệp tiêu biểu</h2>
      <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 snap-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {PARTNERS.map((p) => <PartnerTile key={p.name} p={p} />)}
        <Link href="/dichvu" className="snap-start shrink-0 w-44 md:w-52 h-24 md:h-28 rounded-2xl grid place-items-center px-4 border-2 border-dashed border-[#C8A14B]/60 text-[#0A2540] hover:bg-[#C8A14B]/5 transition">
          <div className="text-center"><div className="text-2xl leading-none">＋</div><div className="text-[11px] md:text-xs font-bold mt-1.5 leading-tight">Doanh nghiệp<br />của bạn ở đây</div></div>
        </Link>
      </div>
    </section>
  );
}
