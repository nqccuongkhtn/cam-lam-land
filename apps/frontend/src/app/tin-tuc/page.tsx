'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useBoQc, BillboardAd, NativeAd, SidebarAd } from '@/components/newsAds'; // dùng chung với trang đọc bài
import type { OQc } from '@/components/OQuangCaoTrangChu';
import { decodeEntities } from '@/lib/htmlEntities';

interface N { title: string; url: string; source?: string; image?: string; summary?: string; publishedAt?: string; slug: string }

// Cánh gà kiểu Znews: fixed kẹp 2 bên cột nội dung, trượt vào khi cuộn xuống (màn ≥1536px).
// Mỗi bên XẾP CHỒNG 2 thẻ, ảnh giữ tỉ lệ ngang 4:3. KHÔNG kéo một ảnh cao hết màn hình: ảnh ngang bị cắt
// thành dải dọc, chữ trong ảnh còn "M L" — chủ dự án chê "cụt cụt" (5/10/2026).
// Dải trên = quảng cáo 0, giữa danh sách = 1, bên trái = 2 và 3, bên phải = 4 và 5 → 6 quảng cáo không trùng.
function WingRails({ ds }: { ds: OQc[] }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 340);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const cls = 'pointer-events-auto fixed top-20 z-20 flex max-h-[calc(100vh-6rem)] flex-col gap-4 overflow-hidden transition-all duration-500 ease-out';
  const w = 'calc((100vw - 1120px) * 0.3)';
  const off = 'calc((100vw - 1120px) * 0.1)';
  return (
    <div className="hidden 2xl:block">
      <aside className={`${cls} ${shown ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`} style={{ width: w, maxWidth: 260, left: off }}><SidebarAd ds={ds} batDau={2} /><SidebarAd ds={ds} batDau={3} /></aside>
      <aside className={`${cls} ${shown ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`} style={{ width: w, maxWidth: 260, right: off }}><SidebarAd ds={ds} batDau={4} /><SidebarAd ds={ds} batDau={5} /></aside>
    </div>
  );
}

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '');
const meta = (n: N) => `${n.source || ''}${n.source && fmtDate(n.publishedAt) ? ' · ' : ''}${fmtDate(n.publishedAt)}`;
const isNew = (iso?: string) => !!iso && Date.now() - new Date(iso).getTime() < 2 * 864e5;

function Thumb({ src, alt }: { src?: string; alt: string }) {
  return src ? <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-700" /> : <div className="w-full h-full grid place-items-center text-slate-300 text-2xl">📰</div>;
}
function Lead({ n }: { n: N }) {
  return (
    <Link href={`/tin-tuc/${n.slug}`} className="cl-tap group block">
      <div className="relative aspect-[16/9] rounded-lg overflow-hidden bg-slate-100">
        <Thumb src={n.image} alt={n.title} />
        {isNew(n.publishedAt) && <span className="absolute top-2 left-2 bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded shadow">MỚI</span>}
        {n.source && <span className="absolute bottom-2 left-2 bg-black/60 backdrop-blur text-white text-[11px] font-medium px-2 py-0.5 rounded">{n.source}</span>}
      </div>
      <h2 className="text-xl sm:text-2xl md:text-[28px] font-bold text-[#0A2540] mt-3 leading-snug group-hover:text-red-600">{n.title}</h2>
      {n.summary && <p className="text-slate-500 text-[15px] mt-2 line-clamp-3">{n.summary}</p>}
      <p className="text-xs text-slate-400 mt-2">{meta(n)}</p>
    </Link>
  );
}
function SideItem({ n, rank }: { n: N; rank: number }) {
  return (
    <Link href={`/tin-tuc/${n.slug}`} className="cl-tap group flex gap-3 items-center py-3">
      <span className={`shrink-0 w-6 text-center text-xl font-black leading-none ${rank <= 3 ? 'text-red-600' : 'text-slate-300'}`}>{rank}</span>
      <div className="w-20 h-14 rounded overflow-hidden bg-slate-100 shrink-0"><Thumb src={n.image} alt={n.title} /></div>
      <h3 className="text-[13px] font-semibold text-[#0A2540] leading-snug line-clamp-2 group-hover:text-red-600">{n.title}</h3>
    </Link>
  );
}
function Row({ n }: { n: N }) {
  return (
    <Link href={`/tin-tuc/${n.slug}`} className="cl-tap group flex gap-3 sm:gap-5 items-start py-4 sm:py-5">
      <div className="w-28 sm:w-36 md:w-56 aspect-[16/10] rounded-lg overflow-hidden bg-slate-100 shrink-0"><Thumb src={n.image} alt={n.title} /></div>
      <div className="min-w-0">
        <h3 className="font-bold text-[#0A2540] leading-snug line-clamp-2 group-hover:text-red-600 text-base md:text-lg">{n.title}</h3>
        {n.summary && <p className="text-[15px] text-slate-500 mt-2 line-clamp-2 hidden sm:block">{n.summary}</p>}
        <p className="text-xs text-slate-400 mt-2">{meta(n)}</p>
      </div>
    </Link>
  );
}

function SectionHead({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-slate-200 pb-2 mb-4">
      <span className="w-1 h-5 bg-red-600 rounded-sm" />
      <h2 className="text-base md:text-lg font-extrabold text-[#0A2540] uppercase tracking-tight">{title}</h2>
    </div>
  );
}
function NewsCard({ n }: { n: N }) {
  return (
    <Link href={`/tin-tuc/${n.slug}`} className="cl-tap group block">
      <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-slate-100">
        <Thumb src={n.image} alt={n.title} />
        {isNew(n.publishedAt) && <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">MỚI</span>}
      </div>
      <h3 className="font-bold text-[#0A2540] leading-snug line-clamp-2 mt-2.5 group-hover:text-red-600 text-[15px]">{n.title}</h3>
      <p className="text-xs text-slate-400 mt-1.5">{meta(n)}</p>
    </Link>
  );
}
function RankRow({ n, rank }: { n: N; rank: number }) {
  return (
    <Link href={`/tin-tuc/${n.slug}`} className="cl-tap group flex gap-3 items-start py-2.5">
      <span className={`shrink-0 w-5 text-center text-lg font-black leading-none ${rank <= 3 ? 'text-red-600' : 'text-slate-300'}`}>{rank}</span>
      <h4 className="text-[13px] font-semibold text-[#0A2540] leading-snug line-clamp-3 group-hover:text-red-600">{n.title}</h4>
    </Link>
  );
}

export default function NewsIndex() {
  const [news, setNews] = useState<N[]>([]);
  const [loading, setLoading] = useState(true);
  const boQc = useBoQc(); // kho quảng cáo chung với 2 ô trang chủ
  const [limit, setLimit] = useState(12);
  const [q, setQ] = useState('');

  useEffect(() => { fetch('/feed/news?gon=1').then((r) => r.json()).then((d) => setNews((d.news || []).map((n: any) => ({ ...n, title: decodeEntities(n.title), summary: decodeEntities(n.summary) })))).catch(() => {}).finally(() => setLoading(false)); }, []);

  const showAd = boQc.length > 0;
  const na = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  const toks = na(q).split(/\s+/).filter(Boolean);
  const filtered = toks.length ? news.filter((n) => { const d = na(n.title + ' ' + (n.summary || '')); return toks.every((t) => d.includes(t)); }) : news;
  const lead = filtered[0];
  const heroSide = filtered.slice(1, 5);
  const grid = filtered.slice(5, 11);
  const trending = filtered.slice(1, 7);
  const rest = filtered.slice(11);
  const shown = rest.slice(0, limit);
  const rows: any[] = [];
  shown.forEach((n, i) => { rows.push(<Row key={n.slug} n={n} />); if (i === 2 && showAd) rows.push(<NativeAd key="native-ad" ds={boQc} batDau={1} />); });
  const hasMore = rest.length > limit;

  return (
    <div className="relative min-h-[calc(100dvh-56px)] bg-white">
      {showAd && <WingRails ds={boQc} />}
      <div className="relative z-10 mx-auto max-w-[1120px] px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {showAd && <div className="hidden md:block mb-6"><BillboardAd ds={boQc} batDau={0} /></div>}
        <div>
          <div className="pt-0">
            <div className="text-xs text-slate-400 mb-3"><Link href="/" className="hover:text-[#0A2540]">Trang chủ</Link> › <span className="text-slate-600">Tin tức</span></div>
            <div className="flex flex-wrap items-center gap-3 border-b-2 border-red-600 pb-2 mb-5">
              <span className="w-1.5 h-6 bg-red-600 rounded-sm" />
              <h1 className="text-lg md:text-xl font-extrabold text-[#0A2540] uppercase tracking-tight">Tin tức thị trường BĐS</h1>
              <div className="ml-auto relative">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tin…" className="w-40 sm:w-64 border border-slate-300 rounded-full pl-9 pr-3 py-1.5 text-sm outline-none focus:border-[#0A2540]" />
                <svg viewBox="0 0 24 24" className="absolute left-3 top-2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              </div>
            </div>

            {loading ? (
              <p className="text-slate-400 py-10">Đang tải tin…</p>
            ) : filtered.length === 0 ? (
              <p className="text-slate-400 py-10">{news.length === 0 ? 'Chưa có tin. Vui lòng quay lại sau.' : 'Không tìm thấy tin phù hợp.'}</p>
            ) : (
              <>
                {/* Hero: tin chủ + Nổi bật đánh số */}
                <div className="grid lg:grid-cols-[1.7fr_1fr] gap-x-5 sm:gap-x-7 gap-y-3 sm:gap-y-4 pb-5 sm:pb-7 mb-6 sm:mb-8 border-b border-slate-200">
                  {lead && <Lead n={lead} />}
                  <div className="lg:border-l lg:border-slate-100 lg:pl-6">
                    <p className="flex items-center gap-1.5 text-red-600 font-bold text-sm mb-1">🔥 Nổi bật</p>
                    <div className="divide-y divide-slate-100">{heroSide.map((n, i) => <SideItem key={n.slug} n={n} rank={i + 1} />)}</div>
                  </div>
                </div>

                {/* Lưới thẻ: Mới cập nhật */}
                {grid.length > 0 && (
                  <section className="mb-6 sm:mb-8">
                    <SectionHead title="Mới cập nhật" />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 sm:gap-x-5 gap-y-5 sm:gap-y-7">{grid.map((n) => <NewsCard key={n.slug} n={n} />)}</div>
                  </section>
                )}

                {/* Tin khác — 1 cột gọn gàng */}
                <section>
                  <SectionHead title="Tin khác" />
                  <div className="divide-y divide-slate-100">{rows}</div>
                  {hasMore && <div className="text-center mt-6"><button onClick={() => setLimit((l) => l + 12)} className="inline-flex items-center gap-2 bg-white border border-slate-300 hover:border-[#0A2540] text-[#0A2540] font-semibold px-8 py-3 rounded-full text-sm">Xem thêm tin →</button></div>}
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
