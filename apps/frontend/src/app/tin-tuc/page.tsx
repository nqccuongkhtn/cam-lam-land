'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface N { title: string; url: string; source?: string; image?: string; summary?: string; publishedAt?: string; slug: string }
interface Ad { enabled?: boolean; image?: string; images?: string[]; link?: string; title?: string; sub?: string; cta?: string }

const SAMPLE_AD: Ad = { enabled: true, images: ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1280&h=800&q=72', 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1280&h=800&q=72', 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1280&h=800&q=72'], link: '/sales/post', title: 'Đăng tin nhà đất miễn phí', sub: 'Tiếp cận hàng nghìn khách mua tại Cam Lâm', cta: 'Đăng ngay' };

const imgsOf = (ad: Ad) => ((ad.images && ad.images.length ? ad.images : ad.image ? [ad.image] : []) as string[]).filter(Boolean);
const isExt = (l?: string) => (l || '').startsWith('http');
function useSlides(n: number) {
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (n < 2) return; const t = setInterval(() => setIdx((i) => (i + 1) % n), 5000); return () => clearInterval(t); }, [n]);
  return idx;
}
function Cta({ text, className = '' }: { text: string; className?: string }) {
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
// Khung quảng cáo kiểu Znews: thẻ trắng, nút × đóng, nhãn QC
function AdFrame({ children, className = '' }: { children: any; className?: string }) {
  return (
    <div className={`cl-fadeup relative overflow-hidden border border-slate-200 shadow-sm bg-white ${className}`}>
      <span className="absolute top-1.5 left-1.5 z-20 bg-white/90 text-slate-400 text-[8px] font-bold px-1 py-0.5 rounded leading-none">QC</span>
      {children}
    </div>
  );
}

// Cánh gà dọc
function WingAd({ ad }: { ad: Ad }) {
  const imgs = imgsOf(ad); const idx = useSlides(imgs.length);
  const tgt = isExt(ad.link) ? '_blank' : undefined;
  return (
    <AdFrame className="h-full w-full flex flex-col rounded-2xl xl:rounded-t-none xl:border-t-0">
      <a href={ad.link || '#'} target={tgt} rel="noreferrer" className="group flex flex-col flex-1 min-h-0">
        <div className="relative flex-1 bg-slate-100 overflow-hidden">
          {imgs.length ? <Slides imgs={imgs} idx={idx} /> : <div className="absolute inset-0 bg-gradient-to-br from-[#0A2540] to-[#10355f]" />}
        </div>
        {(ad.title || ad.cta) && (
          <div className="bg-white px-3 py-3 text-center border-t border-slate-100">
            {ad.title && <p className="font-bold text-[#0A2540] text-sm leading-snug line-clamp-2">{ad.title}</p>}
            {ad.sub && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{ad.sub}</p>}
            {ad.cta && <Cta text={ad.cta} className="mt-2 inline-block text-xs px-4 py-1.5" />}
          </div>
        )}
      </a>
    </AdFrame>
  );
}

// Dải ngang trên đầu (billboard lớn, ảnh phủ full + chữ to bên trái)
function BillboardAd({ ad }: { ad: Ad }) {
  const imgs = imgsOf(ad); const idx = useSlides(imgs.length);
  const tgt = isExt(ad.link) ? '_blank' : undefined;
  return (
    <AdFrame className="h-56 md:h-64 rounded-2xl xl:rounded-b-none xl:border-b-0">
      <a href={ad.link || '#'} target={tgt} rel="noreferrer" className="group block relative h-full w-full bg-[#0A2540]">
        {imgs.length ? <Slides imgs={imgs} idx={idx} /> : <div className="absolute inset-0 bg-gradient-to-br from-[#0A2540] to-[#10355f]" />}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A2540]/95 via-[#0A2540]/55 to-transparent" />
        <div className="absolute inset-y-0 left-0 z-10 flex flex-col justify-center p-6 md:p-10 max-w-[62%] text-white">
          <p className="font-extrabold text-2xl md:text-4xl leading-tight drop-shadow">{ad.title}</p>
          {ad.sub && <p className="text-sm md:text-lg text-white/85 mt-2 md:mt-3 drop-shadow">{ad.sub}</p>}
          {ad.cta && <Cta text={ad.cta} className="mt-4 md:mt-5 self-start text-sm md:text-base px-6 py-3" />}
        </div>
      </a>
    </AdFrame>
  );
}

// Native chèn giữa danh sách
function NativeAd({ ad }: { ad: Ad }) {
  const img = imgsOf(ad)[0] || '';
  const tgt = isExt(ad.link) ? '_blank' : undefined;
  return (
    <div className="relative py-4">
      <a href={ad.link || '#'} target={tgt} rel="noreferrer" className="group flex gap-4 items-start">
        <div className="w-32 sm:w-48 aspect-[16/10] rounded-lg overflow-hidden bg-slate-100 shrink-0 relative">
          {img ? <img src={img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-700" /> : <div className="w-full h-full grid place-items-center text-slate-300">📰</div>}
          <span className="absolute top-1 left-1 bg-[#C8A14B] text-[#0A2540] text-[9px] font-bold px-1.5 py-0.5 rounded shadow">Tài trợ</span>
        </div>
        <div className="min-w-0 pr-5">
          <h3 className="font-bold text-[#0A2540] leading-snug line-clamp-2 group-hover:text-red-600 text-[15px] md:text-base">{ad.title}</h3>
          {ad.sub && <p className="text-sm text-slate-500 mt-1.5 line-clamp-2">{ad.sub}</p>}
          <p className="text-xs text-[#C8A14B] font-bold mt-2">Quảng cáo · {ad.cta || 'Xem ngay'} →</p>
        </div>
      </a>
    </div>
  );
}

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '');
const meta = (n: N) => `${n.source || ''}${n.source && fmtDate(n.publishedAt) ? ' · ' : ''}${fmtDate(n.publishedAt)}`;
const has = (t: string, ...ks: string[]) => ks.some((k) => t.includes(k));
function categoryOf(n: N): string {
  const t = (n.title + ' ' + (n.summary || '')).toLowerCase();
  if (has(t, 'cam lâm', 'khánh hòa', 'nha trang', 'cam ranh', 'bãi dài', 'diên khánh', 'vạn ninh')) return 'local';
  if (has(t, 'quy hoạch', 'đô thị', 'phân khu', 'hạ tầng', 'sân bay', 'cao tốc', 'vành đai')) return 'planning';
  if (has(t, 'dự án', 'mở bán', 'căn hộ', 'biệt thự', 'khu đô thị', 'resort', 'nghỉ dưỡng')) return 'project';
  return 'market';
}
const TABS: [string, string][] = [['all', 'Tất cả'], ['local', 'Tin Cam Lâm'], ['market', 'Thị trường'], ['planning', 'Quy hoạch'], ['project', 'Dự án']];
const isNew = (iso?: string) => !!iso && Date.now() - new Date(iso).getTime() < 2 * 864e5;

function Thumb({ src, alt }: { src?: string; alt: string }) {
  return src ? <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-700" /> : <div className="w-full h-full grid place-items-center text-slate-300 text-2xl">📰</div>;
}
function Lead({ n }: { n: N }) {
  return (
    <Link href={`/tin-tuc/${n.slug}`} className="group block">
      <div className="relative aspect-[16/9] rounded-lg overflow-hidden bg-slate-100">
        <Thumb src={n.image} alt={n.title} />
        {isNew(n.publishedAt) && <span className="absolute top-2 left-2 bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded shadow">MỚI</span>}
        {n.source && <span className="absolute bottom-2 left-2 bg-black/60 backdrop-blur text-white text-[11px] font-medium px-2 py-0.5 rounded">{n.source}</span>}
      </div>
      <h2 className="text-2xl md:text-[28px] font-bold text-[#0A2540] mt-3 leading-snug group-hover:text-red-600">{n.title}</h2>
      {n.summary && <p className="text-slate-500 text-[15px] mt-2 line-clamp-3">{n.summary}</p>}
      <p className="text-xs text-slate-400 mt-2">{meta(n)}</p>
    </Link>
  );
}
function SideItem({ n, rank }: { n: N; rank: number }) {
  return (
    <Link href={`/tin-tuc/${n.slug}`} className="group flex gap-3 items-center py-3">
      <span className={`shrink-0 w-6 text-center text-xl font-black leading-none ${rank <= 3 ? 'text-red-600' : 'text-slate-300'}`}>{rank}</span>
      <div className="w-20 h-14 rounded overflow-hidden bg-slate-100 shrink-0"><Thumb src={n.image} alt={n.title} /></div>
      <h3 className="text-[13px] font-semibold text-[#0A2540] leading-snug line-clamp-2 group-hover:text-red-600">{n.title}</h3>
    </Link>
  );
}
function Row({ n }: { n: N }) {
  return (
    <Link href={`/tin-tuc/${n.slug}`} className="group flex gap-5 items-start py-5">
      <div className="w-36 sm:w-56 aspect-[16/10] rounded-lg overflow-hidden bg-slate-100 shrink-0"><Thumb src={n.image} alt={n.title} /></div>
      <div className="min-w-0">
        <h3 className="font-bold text-[#0A2540] leading-snug line-clamp-2 group-hover:text-red-600 text-base md:text-lg">{n.title}</h3>
        {n.summary && <p className="text-[15px] text-slate-500 mt-2 line-clamp-2 hidden sm:block">{n.summary}</p>}
        <p className="text-xs text-slate-400 mt-2">{meta(n)}</p>
      </div>
    </Link>
  );
}

export default function NewsIndex() {
  const [news, setNews] = useState<N[]>([]);
  const [loading, setLoading] = useState(true);
  const [ad, setAd] = useState<Ad>(SAMPLE_AD);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(12);

  useEffect(() => { fetch('/feed/news').then((r) => r.json()).then((d) => setNews(d.news || [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { fetch('/api/config/tintuc_ad').then((r) => r.json()).then((d) => { if (d && d.value && typeof d.value === 'object') setAd({ ...SAMPLE_AD, ...d.value }); }).catch(() => {}); }, []);

  const showAd = ad && ad.enabled !== false;
  const kw = q.trim().toLowerCase();
  const filtered = news.filter((n) => (tab === 'all' || categoryOf(n) === tab) && (!kw || (n.title + ' ' + (n.summary || '')).toLowerCase().includes(kw)));
  const counts: Record<string, number> = {};
  news.forEach((n) => { const c = categoryOf(n); counts[c] = (counts[c] || 0) + 1; });
  const lead = filtered[0];
  const sideList = filtered.slice(1, 6);
  const rest = filtered.slice(6, limit);
  const rows: any[] = [];
  rest.forEach((n, i) => { rows.push(<Row key={n.slug} n={n} />); if (i === 2 && showAd) rows.push(<NativeAd key="native-ad" ad={ad} />); });
  const hasMore = filtered.length > limit;

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)]">
      <div className="max-w-[1680px] mx-auto px-4 py-6">
        {showAd && <div className="hidden lg:block"><BillboardAd ad={ad} /></div>}

        <div className="xl:flex xl:gap-8">
          {showAd && <aside className="hidden xl:block w-60 shrink-0"><div className="sticky top-20 h-[calc(100vh-100px)]"><WingAd ad={ad} /></div></aside>}

          <div className="flex-1 min-w-0 pt-5 xl:pt-6">
            <div className="text-xs text-slate-400 mb-3"><Link href="/" className="hover:text-[#0A2540]">Trang chủ</Link> › <span className="text-slate-600">Tin tức</span></div>
            <div className="flex flex-wrap items-center gap-3 border-b-2 border-red-600 pb-2 mb-4">
              <span className="w-1.5 h-6 bg-red-600 rounded-sm" />
              <h1 className="text-lg md:text-xl font-extrabold text-[#0A2540] uppercase tracking-tight">Tin tức BĐS Cam Lâm</h1>
              <div className="ml-auto relative">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tin…" className="w-36 sm:w-56 border border-slate-300 rounded-full pl-9 pr-3 py-1.5 text-sm outline-none focus:border-[#0A2540]" />
                <svg viewBox="0 0 24 24" className="absolute left-3 top-2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
              {TABS.map(([k, label]) => (
                <button key={k} onClick={() => { setTab(k); setLimit(12); }} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${tab === k ? 'bg-[#0A2540] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-[#0A2540]'}`}>{label}{k !== 'all' && counts[k] ? ` (${counts[k]})` : ''}</button>
              ))}
            </div>

            {loading ? (
              <p className="text-slate-400 py-10">Đang tải tin…</p>
            ) : filtered.length === 0 ? (
              <p className="text-slate-400 py-10">Không có tin phù hợp.</p>
            ) : (
              <>
                <div className="grid lg:grid-cols-[1.7fr_1fr] gap-x-7 gap-y-4 pb-6 mb-2 border-b border-slate-200">
                  {lead && <Lead n={lead} />}
                  <div className="lg:border-l lg:border-slate-100 lg:pl-6">
                    <p className="flex items-center gap-1.5 text-red-600 font-bold text-sm mb-1">🔥 Nổi bật</p>
                    <div className="divide-y divide-slate-100">{sideList.map((n, i) => <SideItem key={n.slug} n={n} rank={i + 1} />)}</div>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">{rows}</div>
                {hasMore && <div className="text-center mt-6"><button onClick={() => setLimit((l) => l + 12)} className="inline-flex items-center gap-2 bg-white border border-slate-300 hover:border-[#0A2540] text-[#0A2540] font-semibold px-8 py-3 rounded-full text-sm">Xem thêm tin →</button></div>}
              </>
            )}
          </div>

          {showAd && <aside className="hidden xl:block w-60 shrink-0"><div className="sticky top-20 h-[calc(100vh-100px)]"><WingAd ad={ad} /></div></aside>}
        </div>
      </div>
    </div>
  );
}
