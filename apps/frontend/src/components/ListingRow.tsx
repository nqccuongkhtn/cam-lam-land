'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Listing, priceLabel, TIER_BADGE, TIER_LABEL, postedLabel } from '@/lib/types';
import { inCompare, toggleCompare } from '@/lib/compare';

function IPin() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="2.5" /></svg>; }


export default function ListingRow({ l, href }: { l: Listing; href?: string }) {
  const [fav, setFav] = useState(false);
  const [cmp, setCmp] = useState(false);
  useEffect(() => {
    const sync = () => setCmp(inCompare(l.id));
    sync();
    window.addEventListener('compare-change', sync);
    return () => window.removeEventListener('compare-change', sync);
  }, [l.id]);
  const nImg = l.images?.length ?? 0;
  const perM2 = l.area && l.area > 0 ? l.price / l.area / 1e6 : null;
  return (
    <Link href={href ?? `/listings/${l.id}`}
      className="group flex gap-3 bg-white rounded-xl border border-slate-200 hover:shadow-md hover:border-slate-300 transition overflow-hidden">
      <div className="relative w-[42%] sm:w-48 md:w-56 shrink-0 self-stretch min-h-[124px] bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={l.images?.[0] ?? `https://picsum.photos/seed/cl${l.id}/800/600`} alt={l.title}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://picsum.photos/seed/cl${l.id}/800/600`; }}
          loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
        {l.tier && l.tier !== 'normal' && <span className={`absolute top-2 left-2 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow ${TIER_BADGE[l.tier] || 'bg-[#C8A14B]'}`}>{(TIER_LABEL[l.tier] || 'VIP').toUpperCase()}</span>}
        {l.deal === 'rent' && <span className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow">CHO THUÊ</span>}
        {nImg > 1 && <span className="absolute bottom-2 left-2 bg-black/55 backdrop-blur text-white text-[11px] font-medium px-1.5 py-0.5 rounded-md">📷 {nImg}</span>}
      </div>
      <div className="flex-1 min-w-0 py-2.5 pr-3 flex flex-col">
        <h3 className={`text-[15px] font-semibold line-clamp-2 leading-snug group-hover:text-red-700 ${l.tier === 'diamond' ? 'text-red-600 uppercase' : 'text-slate-800'}`}>{l.title}</h3>
        <div className="flex items-center flex-wrap gap-x-2 mt-1.5 text-sm">
          <span className="text-red-600 font-bold">{priceLabel(l.price, l.deal)}</span>
          {l.area != null && <span className="text-slate-700">· {l.area} m²</span>}
          {perM2 != null && l.deal !== 'rent' && <span className="text-slate-400 text-[13px]">· {perM2.toFixed(1).replace('.', ',')} tr/m²</span>}
          {l.bedrooms != null && <span className="text-slate-500 text-[13px]">· 🛏 {l.bedrooms}</span>}
          {l.bathrooms != null && <span className="text-slate-500 text-[13px]">· 🛁 {l.bathrooms}</span>}
        </div>
        <div className="text-[13px] text-slate-500 mt-1 flex items-center gap-1 truncate"><IPin /> <span className="truncate">{l.ward ?? 'Cam Lâm'}, Khánh Hòa</span></div>
        {l.description && <p className="text-[13px] text-slate-500 mt-1 line-clamp-2 hidden sm:block">{l.description}</p>}
        <div className="mt-auto pt-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">{postedLabel(l.createdAt)}</span>
          <div className="flex items-center gap-1.5">
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCompare(l); }} aria-label="So sánh" title="So sánh"
              className={`w-8 h-8 grid place-items-center rounded-lg border transition ${cmp ? 'border-[#0A2540] text-[#0A2540] bg-[#0A2540]/5' : 'border-slate-200 text-slate-400 hover:text-[#0A2540] hover:border-[#0A2540]/40'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" /></svg>
            </button>
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFav((v) => !v); }} aria-label="Lưu tin"
              className={`w-8 h-8 grid place-items-center rounded-lg border transition ${fav ? 'border-red-200 text-red-500 bg-red-50' : 'border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200'}`}>
              <svg viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
