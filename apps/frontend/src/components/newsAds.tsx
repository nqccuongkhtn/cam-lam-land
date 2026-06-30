'use client';
import { useEffect, useState } from 'react';

export interface Ad { enabled?: boolean; image?: string; images?: string[]; link?: string; title?: string; sub?: string; cta?: string }

export const SAMPLE_AD: Ad = { enabled: true, images: ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1280&h=800&q=72', 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1280&h=800&q=72', 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1280&h=800&q=72'], link: '/sales/post', title: 'Đăng tin nhà đất miễn phí', sub: 'Tiếp cận hàng nghìn khách mua tại Cam Lâm', cta: 'Đăng ngay' };

export const imgsOf = (ad: Ad) => ((ad.images && ad.images.length ? ad.images : ad.image ? [ad.image] : []) as string[]).filter(Boolean);
const isExt = (l?: string) => (l || '').startsWith('http');
export const showAd = (ad?: Ad) => !!ad && ad.enabled !== false;

export function useSlides(n: number) {
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (n < 2) return; const t = setInterval(() => setIdx((i) => (i + 1) % n), 5000); return () => clearInterval(t); }, [n]);
  return idx;
}
// Lấy cấu hình quảng cáo từ admin (key tintuc_ad), fallback mẫu.
export function useNewsAd(): Ad {
  const [ad, setAd] = useState<Ad>(SAMPLE_AD);
  useEffect(() => { fetch('/api/config/tintuc_ad').then((r) => r.json()).then((d) => { if (d && d.value && typeof d.value === 'object') setAd({ ...SAMPLE_AD, ...d.value }); }).catch(() => {}); }, []);
  return ad;
}

export function Cta({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={`relative overflow-hidden bg-[#C8A14B] text-[#0A2540] font-bold rounded-md ${className}`}>
      <span className="relative z-10">{text} →</span>
      <span aria-hidden className="cl-shine pointer-events-none absolute top-0 bottom-0 w-1/4 bg-white/45 blur-[3px]" />
    </span>
  );
}
function Slides({ imgs, idx }: { imgs: string[]; idx: number }) {
  return <>{imgs.map((src, i) => <img key={i} src={src} alt="" className={`absolute inset-0 w-full h-full object-cover cl-ken transition-opacity duration-[1300ms] ease-in-out ${i === idx ? 'opacity-100' : 'opacity-0'}`} />)}</>;
}
export function AdFrame({ children, className = '' }: { children: any; className?: string }) {
  return (
    <div className={`cl-fadeup relative overflow-hidden border border-slate-200 shadow-sm bg-white ${className}`}>
      <span className="absolute top-1.5 left-1.5 z-20 bg-white/90 text-slate-400 text-[8px] font-bold px-1 py-0.5 rounded leading-none">QC</span>
      {children}
    </div>
  );
}
// Dải ngang trên đầu
export function BillboardAd({ ad }: { ad: Ad }) {
  const imgs = imgsOf(ad); const idx = useSlides(imgs.length);
  const tgt = isExt(ad.link) ? '_blank' : undefined;
  return (
    <AdFrame className="h-40 md:h-52 rounded-2xl">
      <a href={ad.link || '#'} target={tgt} rel="noreferrer" className="group block relative h-full w-full bg-[#0A2540]">
        {imgs.length ? <Slides imgs={imgs} idx={idx} /> : <div className="absolute inset-0 bg-gradient-to-br from-[#0A2540] to-[#10355f]" />}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A2540]/95 via-[#0A2540]/55 to-transparent" />
        <div className="absolute inset-y-0 left-0 z-10 flex flex-col justify-center p-5 md:p-8 max-w-[62%] text-white">
          <p className="font-extrabold text-xl md:text-3xl leading-tight drop-shadow">{ad.title}</p>
          {ad.sub && <p className="text-sm md:text-base text-white/85 mt-1.5 md:mt-2 drop-shadow line-clamp-2">{ad.sub}</p>}
          {ad.cta && <Cta text={ad.cta} className="mt-3 md:mt-4 self-start text-sm px-5 py-2.5" />}
        </div>
      </a>
    </AdFrame>
  );
}
// Native chèn giữa bài
export function NativeAd({ ad }: { ad: Ad }) {
  const img = imgsOf(ad)[0] || '';
  const tgt = isExt(ad.link) ? '_blank' : undefined;
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
      <a href={ad.link || '#'} target={tgt} rel="noreferrer" className="group flex gap-3.5 items-center">
        <div className="w-32 sm:w-44 aspect-[16/10] rounded-lg overflow-hidden bg-slate-100 shrink-0 relative">
          {img ? <img src={img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-700" /> : <div className="w-full h-full grid place-items-center text-slate-300">📰</div>}
          <span className="absolute top-1 left-1 bg-[#C8A14B] text-[#0A2540] text-[9px] font-bold px-1.5 py-0.5 rounded shadow">Tài trợ</span>
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-[#0A2540] leading-snug line-clamp-2 group-hover:text-red-600 text-[15px] md:text-base">{ad.title}</h3>
          {ad.sub && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{ad.sub}</p>}
          <p className="text-xs text-[#C8A14B] font-bold mt-1.5">Quảng cáo · {ad.cta || 'Xem ngay'} →</p>
        </div>
      </a>
    </div>
  );
}
// Quảng cáo cột phải (dọc)
export function SidebarAd({ ad }: { ad: Ad }) {
  const imgs = imgsOf(ad); const idx = useSlides(imgs.length);
  const tgt = isExt(ad.link) ? '_blank' : undefined;
  return (
    <AdFrame className="rounded-2xl">
      <a href={ad.link || '#'} target={tgt} rel="noreferrer" className="group block">
        <div className="relative aspect-[4/5] bg-slate-100 overflow-hidden">
          {imgs.length ? <Slides imgs={imgs} idx={idx} /> : <div className="absolute inset-0 bg-gradient-to-br from-[#0A2540] to-[#10355f]" />}
        </div>
        {(ad.title || ad.cta) && (
          <div className="bg-white px-3 py-3 text-center">
            {ad.title && <p className="font-bold text-[#0A2540] text-sm leading-snug line-clamp-2">{ad.title}</p>}
            {ad.sub && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{ad.sub}</p>}
            {ad.cta && <Cta text={ad.cta} className="mt-2 inline-block text-xs px-4 py-1.5" />}
          </div>
        )}
      </a>
    </AdFrame>
  );
}
