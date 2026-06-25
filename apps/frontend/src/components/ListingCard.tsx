'use client';
import Link from 'next/link';
import { Listing, PROPERTY_LABELS, formatVnd } from '@/lib/types';

export default function ListingCard({ l, href }: { l: Listing; href?: string }) {
  const pricePerM2 = l.area && l.area > 0 ? l.price / l.area : null;
  const m3 = Math.abs(l.id) % 3;
  const badge = m3 === 0 ? { t: 'HOT', icon: '🔥', cls: 'from-rose-500 to-orange-500 shadow-rose-500/50' }
    : m3 === 1 ? { t: 'MỚI', icon: '✦', cls: 'from-emerald-400 to-teal-500 shadow-emerald-500/50' } : null;
  return (
    <Link href={href ?? `/listings/${l.id}`}
      className="group block bg-white rounded-2xl overflow-hidden border border-slate-200 hover:shadow-2xl hover:-translate-y-1 transition duration-300">
      <div className="relative h-52 bg-slate-100 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={l.images?.[0] ?? `https://picsum.photos/seed/cl${l.id}/800/600`} alt={l.title}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://picsum.photos/seed/cl${l.id}/800/600`; }}
          loading="lazy" decoding="async"
          className="h-full w-full object-cover group-hover:scale-105 transition duration-500" />
        <span className="absolute top-3 left-3 bg-red-600/95 text-white text-[11px] font-semibold px-2.5 py-1 rounded-md backdrop-blur shadow-sm">
          {PROPERTY_LABELS[l.propertyType] ?? l.propertyType}
        </span>
        {badge && (
          <span className={`absolute top-3 right-3 inline-flex items-center gap-1 bg-gradient-to-r ${badge.cls} text-white text-[10px] font-extrabold uppercase tracking-wider pl-2 pr-2.5 py-1 rounded-full shadow-lg ring-1 ring-white/40 backdrop-blur-sm`}>
            <span className="text-[11px] leading-none">{badge.icon}</span>{badge.t}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-bold text-slate-800 line-clamp-2 min-h-[2.8rem] group-hover:text-[#0A2540]">{l.title}</h3>
        <div className="flex items-baseline gap-2 mt-1.5">
          <span className="text-[#0A2540] font-extrabold text-xl">{formatVnd(l.price)}</span>
          {pricePerM2 && <span className="text-xs text-[#C8A14B] font-semibold">{formatVnd(pricePerM2)}/m²</span>}
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500 mt-2.5 border-t border-slate-100 pt-2.5">
          {l.area && <span className="inline-flex items-center gap-1">⬛ {l.area} m²</span>}
          {l.bedrooms != null && <span className="inline-flex items-center gap-1">🛏 {l.bedrooms} PN</span>}
          <span className="inline-flex items-center gap-1 ml-auto truncate max-w-[45%]">📍 {l.ward ?? 'Cam Lâm'}</span>
        </div>
      </div>
    </Link>
  );
}
