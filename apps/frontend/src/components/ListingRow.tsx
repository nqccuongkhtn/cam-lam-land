'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Listing, formatVnd } from '@/lib/types';

function IPin() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="2.5" /></svg>; }

function postedLabel(iso?: string): string {
  if (!iso) return 'Đăng hôm nay';
  const d = new Date(iso); if (isNaN(d.getTime())) return 'Đăng hôm nay';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'Đăng hôm nay';
  if (days === 1) return 'Đăng hôm qua';
  if (days < 30) return `Đăng ${days} ngày trước`;
  return 'Đăng ' + d.toLocaleDateString('vi-VN');
}

export default function ListingRow({ l, href }: { l: Listing; href?: string }) {
  const [fav, setFav] = useState(false);
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
        {l.boosted && <span className="absolute top-2 left-2 bg-[#C8A14B] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded">VIP</span>}
        {nImg > 1 && <span className="absolute bottom-2 left-2 bg-black/55 backdrop-blur text-white text-[11px] font-medium px-1.5 py-0.5 rounded-md">📷 {nImg}</span>}
      </div>
      <div className="flex-1 min-w-0 py-2.5 pr-3 flex flex-col">
        <h3 className="text-[15px] font-semibold text-slate-800 line-clamp-2 leading-snug group-hover:text-red-700">{l.title}</h3>
        <div className="flex items-center flex-wrap gap-x-2 mt-1.5 text-sm">
          <span className="text-red-600 font-bold">{formatVnd(l.price)}</span>
          {l.area != null && <span className="text-slate-700">· {l.area} m²</span>}
          {perM2 != null && <span className="text-slate-400 text-[13px]">· {perM2.toFixed(1).replace('.', ',')} tr/m²</span>}
          {l.bedrooms != null && <span className="text-slate-500 text-[13px]">· 🛏 {l.bedrooms}</span>}
          {l.bathrooms != null && <span className="text-slate-500 text-[13px]">· 🛁 {l.bathrooms}</span>}
        </div>
        <div className="text-[13px] text-slate-500 mt-1 flex items-center gap-1 truncate"><IPin /> <span className="truncate">{l.ward ?? 'Cam Lâm'}, Khánh Hòa</span></div>
        {l.description && <p className="text-[13px] text-slate-500 mt-1 line-clamp-2 hidden sm:block">{l.description}</p>}
        <div className="mt-auto pt-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">{postedLabel(l.createdAt)}</span>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFav((v) => !v); }} aria-label="Lưu tin"
            className={`w-8 h-8 grid place-items-center rounded-lg border transition ${fav ? 'border-red-200 text-red-500 bg-red-50' : 'border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200'}`}>
            <svg viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
          </button>
        </div>
      </div>
    </Link>
  );
}
