'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Listing, priceLabel, TIER_BADGE, TIER_LABEL, postedLabel, fmtInt } from '@/lib/types';
import { displayViews, viewedReal } from '@/lib/views';
import { thumbUrl, NO_IMG } from '@/lib/api';

function IPin() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="2.5" /></svg>; }


// to: ĐIỆN THOẠI hiện tin TO như mẫu 52 (chủ dự án chọn 2/10/2026, dùng cho 2 tin VIP đầu ở trang chủ):
// thẻ trải HẾT BỀ NGANG lưới 2 cột (mỗi tin một hàng), ảnh ngang tỉ lệ 2:1, thẻ đổ bóng nhẹ thay cho viền.
// Máy tính / máy tính bảng vẫn là thẻ thường.
export default function ListingCard({ l, href, to = false }: { l: Listing; href?: string; to?: boolean }) {
  const [fav, setFav] = useState(false);
  const [extraViews, setExtraViews] = useState(0);
  useEffect(() => {
    const apply = () => setExtraViews(Math.max(0, viewedReal(l.id) - (l.views || 0)));
    apply();
    window.addEventListener('views-change', apply);
    return () => window.removeEventListener('views-change', apply);
  }, [l.id, l.views]);
  const nImg = l.images?.length ?? 0;
  return (
    <Link href={href ?? `/listings/${l.id}`}
      className={`cl-tap group flex flex-col bg-white rounded-xl overflow-hidden border border-slate-200 hover:shadow-lg hover:border-slate-300 transition duration-200 ${to ? 'max-sm:col-span-2 max-sm:border-0 max-sm:shadow-[0_3px_12px_rgba(15,23,42,.10)]' : ''}`}>
      <div className={`relative aspect-[16/10] bg-slate-100 overflow-hidden ${to ? 'max-sm:aspect-[2/1]' : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbUrl(l.images?.[0]) ?? NO_IMG} alt={l.title}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = NO_IMG; }}
          loading="lazy" decoding="async" className="h-full w-full object-cover group-hover:scale-105 transition duration-500" />
        <div className="absolute top-2 left-2 right-2 flex flex-row flex-wrap items-center gap-1 z-[1]">
          {l.tier && l.tier !== 'normal' && <span className={`text-white text-[9px] leading-none font-extrabold px-1 py-1 rounded shadow whitespace-nowrap ${TIER_BADGE[l.tier] || 'bg-[#C8A14B]'}`}>{(TIER_LABEL[l.tier] || 'VIP').toUpperCase()}</span>}
          {l.deal === 'rent' && <span className="bg-emerald-600 text-white text-[9px] leading-none font-extrabold px-1 py-1 rounded shadow whitespace-nowrap">CHO THUÊ</span>}
          {(l as any).verified && <span title="Đã xác thực bởi Cam Lâm Land" className="bg-blue-600 text-white text-[9px] leading-none font-extrabold px-1 py-1 rounded shadow whitespace-nowrap inline-flex items-center gap-0.5">✔ XÁC THỰC</span>}
        </div>
        {nImg > 1 && <span className="absolute bottom-2 right-2 bg-black/55 backdrop-blur text-white text-[11px] font-medium px-2 py-0.5 rounded-md">📷 {nImg}</span>}
      </div>
      {/* ĐIỆN THOẠI: tỉ lệ chữ theo trang mẫu chủ dự án khen (2/10/2026) — tiêu đề 12,5 đậm, giá 14, vị trí 11,
          dòng ngày đăng 9,5, đệm 8px. Máy tính giữ cỡ cũ. */}
      <div className="p-2 sm:p-3 flex flex-col flex-1">
        <h3 className={`text-[12.5px] font-bold sm:text-[15px] sm:font-medium line-clamp-2 leading-[1.35] sm:leading-snug min-h-[2.7em] sm:min-h-[2.6rem] group-hover:text-red-700 ${l.tier === 'diamond' ? 'text-red-600 uppercase' : 'text-slate-800'}`}>{l.title}</h3>
        <div className="mt-1 sm:mt-1.5 flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
          <span className="text-red-600 font-bold text-[14px] sm:text-lg leading-none">{priceLabel(l.price, l.deal)}</span>
          {l.area != null && <span className="text-slate-500 text-[11px] sm:text-sm">· {l.area} m²</span>}
        </div>
        <div className="mt-1 sm:mt-1.5 flex items-center gap-1 text-[11px] sm:text-[13px] text-slate-500 truncate"><IPin /> <span className="truncate">{l.ward ?? 'Cam Lâm'}, Khánh Hòa</span></div>
        {/* MỘT HÀNG: "Đăng 1 tuần trước · 👁 số xem · ♡" — điện thoại chữ nhỏ + không cho xuống dòng (chủ dự án 2/10/2026,
            trước bị gãy thành "Đăng 1 tuần / trước ·"). */}
        <div className="mt-1.5 sm:mt-2.5 pt-1.5 sm:pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
          <span suppressHydrationWarning className="min-w-0 truncate whitespace-nowrap text-[9.5px] sm:text-xs text-slate-400 inline-flex items-center gap-0.5 sm:gap-1">{postedLabel(l.createdAt)} ·<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ml-0.5"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>{fmtInt(displayViews(l) + extraViews)}</span>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFav((v) => !v); }} aria-label="Lưu tin"
            className={`shrink-0 w-5 h-5 sm:w-8 sm:h-8 grid place-items-center rounded sm:rounded-lg border transition ${fav ? 'border-red-200 text-red-500 bg-red-50' : 'border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200'}`}>
            <svg viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-3 h-3 sm:w-4 sm:h-4"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
          </button>
        </div>
      </div>
    </Link>
  );
}
