'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface N { title: string; url: string; source?: string; image?: string; summary?: string; publishedAt?: string; slug: string }
interface Ad { enabled?: boolean; image?: string; images?: string[]; link?: string; title?: string; sub?: string; cta?: string }

const SAMPLE_AD: Ad = { enabled: true, images: ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=600&h=1400&q=70', 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=600&h=1400&q=70', 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=600&h=1400&q=70'], link: '/sales/post', title: 'ĐĂNG TIN NHÀ ĐẤT MIỄN PHÍ', sub: 'Tiếp cận hàng nghìn khách mua tại Cam Lâm', cta: 'Đăng ngay' };

const imgsOf = (ad: Ad) => ((ad.images && ad.images.length ? ad.images : ad.image ? [ad.image] : []) as string[]).filter(Boolean);
function useSlides(n: number) {
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (n < 2) return; const t = setInterval(() => setIdx((i) => (i + 1) % n), 4500); return () => clearInterval(t); }, [n]);
  return idx;
}

// Cánh gà dọc (skyscraper động)
function WingAd({ ad }: { ad: Ad }) {
  const imgs = imgsOf(ad); const idx = useSlides(imgs.length);
  const ext = (ad.link || '').startsWith('http'); const tgt = ext ? '_blank' : undefined;
  if (!imgs.length) return (
    <a href={ad.link || '#'} target={tgt} rel="noreferrer" className="group flex flex-col justify-center text-center h-full w-full rounded-2xl border border-slate-200 shadow-lg bg-gradient-to-br from-[#0A2540] to-[#10355f] text-white p-5">
      <p className="text-[10px] tracking-wider text-white/50 font-semibold">QUẢNG CÁO</p>
      <p className="font-extrabold text-xl mt-3 leading-tight">{ad.title}</p>
      {ad.sub && <p className="text-sm text-white/80 mt-2">{ad.sub}</p>}
      <span className="cl-pulse mt-5 inline-block bg-[#C8A14B] text-[#0A2540] text-sm font-extrabold px-4 py-2.5 rounded-lg">{ad.cta || 'Xem ngay'} →</span>
    </a>
  );
  return (
    <a href={ad.link || '#'} target={tgt} rel="noreferrer" className="group block relative rounded-2xl overflow-hidden border border-slate-200 shadow-lg h-full w-full bg-[#0A2540]">
      {imgs.map((src, i) => <div key={i} className={`absolute inset-0 transition-opacity duration-1000 ${i === idx ? 'opacity-100' : 'opacity-0'}`}><img src={src} alt="" className="w-full h-full object-cover cl-ken" /></div>)}
      <span className="absolute top-2 right-2 z-10 bg-white/85 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded">QC</span>
      <div className="absolute inset-x-0 bottom-0 z-10 p-4 pt-16 bg-gradient-to-t from-black/90 via-black/45 to-transparent text-white text-center">
        <p className="font-extrabold text-lg leading-tight drop-shadow">{ad.title}</p>
        {ad.sub && <p className="text-sm text-white/90 mt-1.5 drop-shadow">{ad.sub}</p>}
        <span className="cl-pulse mt-3 block bg-[#C8A14B] text-[#0A2540] text-sm font-extrabold px-3 py-2.5 rounded-lg">{ad.cta || 'Xem ngay'} →</span>
      </div>
    </a>
  );
}

// Dải ngang trên đầu (billboard động)
function BillboardAd({ ad }: { ad: Ad }) {
  const imgs = imgsOf(ad); const idx = useSlides(imgs.length);
  const ext = (ad.link || '').startsWith('http'); const tgt = ext ? '_blank' : undefined;
  return (
    <a href={ad.link || '#'} target={tgt} rel="noreferrer" className="group relative block h-28 rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-[#0A2540]">
      {imgs.map((src, i) => <img key={i} src={src} alt="" className={`absolute inset-0 w-full h-full object-cover cl-ken transition-opacity duration-1000 ${i === idx ? 'opacity-60' : 'opacity-0'}`} />)}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0A2540]/95 via-[#0A2540]/70 to-[#0A2540]/20" />
      <span className="absolute top-2 right-2 z-10 bg-white/85 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded">QC</span>
      <div className="relative z-10 h-full flex items-center justify-between gap-4 px-6 text-white">
        <div className="min-w-0">
          <p className="font-extrabold text-lg md:text-2xl leading-tight truncate">{ad.title}</p>
          {ad.sub && <p className="text-sm text-white/85 mt-1 truncate">{ad.sub}</p>}
        </div>
        <span className="cl-pulse shrink-0 bg-[#C8A14B] text-[#0A2540] text-sm font-extrabold px-5 py-2.5 rounded-lg whitespace-nowrap">{ad.cta || 'Xem ngay'} →</span>
      </div>
    </a>
  );
}

// Native chèn giữa danh sách (trông như 1 tin)
function NativeAd({ ad }: { ad: Ad }) {
  const img = imgsOf(ad)[0] || '';
  const ext = (ad.link || '').startsWith('http'); const tgt = ext ? '_blank' : undefined;
  return (
    <a href={ad.link || '#'} target={tgt} rel="noreferrer" className="group flex gap-4 items-start py-4">
      <div className="w-32 sm:w-48 aspect-[16/10] rounded-lg overflow-hidden bg-slate-100 shrink-0 relative">
        {img ? <img src={img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" /> : <div className="w-full h-full grid place-items-center text-slate-300">📰</div>}
        <span className="absolute top-1 left-1 bg-[#C8A14B] text-[#0A2540] text-[9px] font-bold px-1.5 py-0.5 rounded shadow">Tài trợ</span>
      </div>
      <div className="min-w-0">
        <h3 className="font-bold text-[#0A2540] leading-snug line-clamp-2 group-hover:text-red-600 text-[15px] md:text-base">{ad.title}</h3>
        {ad.sub && <p className="text-sm text-slate-500 mt-1.5 line-clamp-2">{ad.sub}</p>}
        <p className="text-xs text-[#C8A14B] font-bold mt-2">Quảng cáo · {ad.cta || 'Xem ngay'} →</p>
      </div>
    </a>
  );
}

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '');
const meta = (n: N) => `${n.source || ''}${n.source && fmtDate(n.publishedAt) ? ' · ' : ''}${fmtDate(n.publishedAt)}`;
function Thumb({ src, alt }: { src?: string; alt: string }) {
  return src ? <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" /> : <div className="w-full h-full grid place-items-center text-slate-300 text-2xl">📰</div>;
}
function Lead({ n }: { n: N }) {
  return (
    <Link href={`/tin-tuc/${n.slug}`} className="group block">
      <div className="aspect-[16/9] rounded-lg overflow-hidden bg-slate-100"><Thumb src={n.image} alt={n.title} /></div>
      <h2 className="text-xl md:text-2xl font-bold text-[#0A2540] mt-3 leading-snug group-hover:text-red-600">{n.title}</h2>
      {n.summary && <p className="text-slate-500 text-[15px] mt-2 line-clamp-3">{n.summary}</p>}
      <p className="text-xs text-slate-400 mt-2">{meta(n)}</p>
    </Link>
  );
}
function Small({ n }: { n: N }) {
  return (
    <Link href={`/tin-tuc/${n.slug}`} className="group flex gap-3 items-start py-3">
      <div className="w-24 h-16 rounded overflow-hidden bg-slate-100 shrink-0"><Thumb src={n.image} alt={n.title} /></div>
      <h3 className="text-sm font-semibold text-[#0A2540] leading-snug line-clamp-3 group-hover:text-red-600">{n.title}</h3>
    </Link>
  );
}
function Row({ n }: { n: N }) {
  return (
    <Link href={`/tin-tuc/${n.slug}`} className="group flex gap-4 items-start py-4">
      <div className="w-32 sm:w-48 aspect-[16/10] rounded-lg overflow-hidden bg-slate-100 shrink-0"><Thumb src={n.image} alt={n.title} /></div>
      <div className="min-w-0">
        <h3 className="font-bold text-[#0A2540] leading-snug line-clamp-2 group-hover:text-red-600 text-[15px] md:text-base">{n.title}</h3>
        {n.summary && <p className="text-sm text-slate-500 mt-1.5 line-clamp-2 hidden sm:block">{n.summary}</p>}
        <p className="text-xs text-slate-400 mt-2">{meta(n)}</p>
      </div>
    </Link>
  );
}

export default function NewsIndex() {
  const [news, setNews] = useState<N[]>([]);
  const [loading, setLoading] = useState(true);
  const [ad, setAd] = useState<Ad>(SAMPLE_AD);

  useEffect(() => { fetch('/feed/news').then((r) => r.json()).then((d) => setNews(d.news || [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { fetch('/api/config/tintuc_ad').then((r) => r.json()).then((d) => { if (d && d.value && typeof d.value === 'object') setAd({ ...SAMPLE_AD, ...d.value }); }).catch(() => {}); }, []);

  const showAd = ad && ad.enabled !== false;
  const lead = news[0];
  const sideList = news.slice(1, 5);
  const rest = news.slice(5);
  const rows: any[] = [];
  rest.forEach((n, i) => { rows.push(<Row key={n.slug} n={n} />); if (i === 2 && showAd) rows.push(<NativeAd key="native-ad" ad={ad} />); });

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)]">
      <div className="max-w-[1440px] mx-auto px-4 py-6">
        {showAd && <div className="hidden lg:block mb-5"><BillboardAd ad={ad} /></div>}

        <div className="xl:flex xl:gap-6">
          {showAd && <aside className="hidden xl:block w-60 shrink-0"><div className="sticky top-20 h-[calc(100vh-100px)]"><WingAd ad={ad} /></div></aside>}

          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-400 mb-3"><Link href="/" className="hover:text-[#0A2540]">Trang chủ</Link> › <span className="text-slate-600">Tin tức</span></div>
            <div className="flex items-center gap-2.5 border-b-2 border-red-600 pb-2 mb-5">
              <span className="w-1.5 h-6 bg-red-600 rounded-sm" />
              <h1 className="text-lg md:text-xl font-extrabold text-[#0A2540] uppercase tracking-tight">Tin tức thị trường BĐS</h1>
            </div>

            {loading ? (
              <p className="text-slate-400 py-10">Đang tải tin…</p>
            ) : news.length === 0 ? (
              <p className="text-slate-400 py-10">Chưa có tin. Vui lòng quay lại sau.</p>
            ) : (
              <>
                <div className="grid lg:grid-cols-[1.7fr_1fr] gap-x-7 gap-y-4 pb-6 mb-2 border-b border-slate-200">
                  {lead && <Lead n={lead} />}
                  <div className="divide-y divide-slate-100 lg:border-l lg:border-slate-100 lg:pl-6">{sideList.map((n) => <Small key={n.slug} n={n} />)}</div>
                </div>
                <div className="divide-y divide-slate-100">{rows}</div>
              </>
            )}
          </div>

          {showAd && <aside className="hidden xl:block w-60 shrink-0"><div className="sticky top-20 h-[calc(100vh-100px)]"><WingAd ad={ad} /></div></aside>}
        </div>
      </div>
    </div>
  );
}
