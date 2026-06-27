'use client';
import Link from 'next/link';
import { Listing, PROPERTY_LABELS, formatVnd } from '@/lib/types';

function IArea() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" /></svg>; }
function IBed() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M2 9V5M2 14h20M2 19v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M6 10V8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" /></svg>; }
function IPin() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="2.5" /></svg>; }

export default function ListingCard({ l, href }: { l: Listing; href?: string }) {
  const pricePerM2 = l.area && l.area > 0 ? l.price / l.area : null;
  const m3 = Math.abs(l.id) % 3;
  const badge = m3 === 0 ? { t: 'HOT', cls: 'from-rose-500 to-orange-500' } : m3 === 1 ? { t: 'MỚI', cls: 'from-emerald-400 to-teal-500' } : null;
  const nImg = l.images?.length ?? 0;
  return (
    <Link href={href ?? `/listings/${l.id}`}
      className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-[#C8A14B]/60 hover:shadow-xl hover:-translate-y-1 transition duration-300">
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={l.images?.[0] ?? `https://picsum.photos/seed/cl${l.id}/800/600`} alt={l.title}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://picsum.photos/seed/cl${l.id}/800/600`; }}
          loading="lazy" decoding="async" className="h-full w-full object-cover group-hover:scale-105 transition duration-500" />
        <span className="absolute top-3 left-3 bg-white/95 backdrop-blur text-[#0A2540] text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-sm">{PROPERTY_LABELS[l.propertyType] ?? l.propertyType}</span>
        {badge && <span className={`absolute top-3 right-3 inline-flex items-center bg-gradient-to-r ${badge.cls} text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full shadow ring-1 ring-white/40`}>{badge.t}</span>}
        {nImg > 1 && <span className="absolute bottom-3 right-3 bg-black/55 backdrop-blur text-white text-[11px] font-medium px-2 py-0.5 rounded-full">📷 {nImg}</span>}
      </div>
      <div className="p-3.5 flex flex-col flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-red-600 font-extrabold text-xl leading-none">{formatVnd(l.price)}</span>
          {pricePerM2 && <span className="text-xs text-slate-400 font-semibold">{formatVnd(pricePerM2)}/m²</span>}
        </div>
        <h3 className="font-semibold text-slate-700 line-clamp-2 leading-snug mt-1.5 group-hover:text-[#0A2540] min-h-[2.5rem]">{l.title}</h3>
        <div className="flex items-center gap-3 text-[13px] mt-auto pt-2.5 border-t border-slate-100">
          {l.area != null && <span className="inline-flex items-center gap-1 text-slate-600"><IArea /> {l.area} m²</span>}
          {l.bedrooms != null && <span className="inline-flex items-center gap-1 text-slate-600"><IBed /> {l.bedrooms} PN</span>}
          <span className="inline-flex items-center gap-1 ml-auto text-slate-400 truncate max-w-[50%]"><IPin /> {l.ward ?? 'Cam Lâm'}</span>
        </div>
      </div>
    </Link>
  );
}
