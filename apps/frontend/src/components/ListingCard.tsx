'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Listing, formatVnd, TIER_BADGE, TIER_LABEL } from '@/lib/types';

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

export default function ListingCard({ l, href }: { l: Listing; href?: string }) {
  const [fav, setFav] = useState(false);
  const nImg = l.images?.length ?? 0;
  return (
    <Link href={href ?? `/listings/${l.id}`}
      className="group flex flex-col bg-white rounded-xl overflow-hidden border border-slate-200 hover:shadow-lg hover:border-slate-300 transition duration-200">
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={l.images?.[0] ?? `https://picsum.photos/seed/cl${l.id}/800/600`} alt={l.title}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://picsum.photos/seed/cl${l.id}/800/600`; }}
          loading="lazy" decoding="async" className="h-full w-full object-cover group-hover:scale-105 transition duration-500" />
        {l.tier && l.tier !== 'normal' && <span className={`absolute top-2 left-2 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow ${TIER_BADGE[l.tier] || 'bg-[#C8A14B]'}`}>{(TIER_LABEL[l.tier] || 'VIP').toUpperCase()}</span>}
        {nImg > 1 && <span className="absolute bottom-2 right-2 bg-black/55 backdrop-blur text-white text-[11px] font-medium px-2 py-0.5 rounded-md">📷 {nImg}</span>}
      </div>
      <div className="p-3 flex flex-col flex-1">
        <h3 className={`text-[15px] font-medium line-clamp-2 leading-snug min-h-[2.6rem] group-hover:text-red-700 ${l.tier === 'diamond' ? 'text-red-600 uppercase' : 'text-slate-800'}`}>{l.title}</h3>
        <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
          <span className="text-red-600 font-bold text-lg leading-none">{formatVnd(l.price)}</span>
          {l.area != null && <span className="text-slate-500 text-sm">· {l.area} m²</span>}
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-[13px] text-slate-500 truncate"><IPin /> <span className="truncate">{l.ward ?? 'Cam Lâm'}, Khánh Hòa</span></div>
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
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
