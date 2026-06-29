'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface N { title: string; url: string; source?: string; image?: string; summary?: string; publishedAt?: string; slug: string }
interface Ad { enabled?: boolean; image?: string; link?: string; title?: string; sub?: string; cta?: string }

// Mẫu quảng cáo đặt sẵn (hiện khi admin chưa cấu hình / backend chưa bật)
const SAMPLE_AD: Ad = { enabled: true, image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=600&h=1200&q=70', link: '/sales/post', title: 'ĐĂNG TIN NHÀ ĐẤT MIỄN PHÍ', sub: 'Tiếp cận hàng nghìn khách mua tại Cam Lâm', cta: 'Đăng ngay' };

function AdBanner({ ad }: { ad: Ad }) {
  const ext = (ad.link || '').startsWith('http');
  const tgt = ext ? '_blank' : undefined;
  if (ad.image) return (
    <a href={ad.link || '#'} target={tgt} rel="noreferrer" className="group block relative rounded-2xl overflow-hidden border border-slate-200 shadow-md hover:shadow-xl transition aspect-[300/600] bg-slate-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ad.image} alt={ad.title || 'Quảng cáo'} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500" />
      <span className="absolute top-2 right-2 bg-white/85 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded">QC</span>
      <div className="absolute inset-x-0 bottom-0 p-3 pt-12 bg-gradient-to-t from-black/85 via-black/40 to-transparent text-white text-center">
        <p className="font-extrabold text-base leading-tight drop-shadow">{ad.title}</p>
        {ad.sub && <p className="text-xs text-white/90 mt-1 drop-shadow">{ad.sub}</p>}
        <span className="mt-2.5 block bg-[#C8A14B] group-hover:bg-[#d4af5a] text-[#0A2540] text-sm font-extrabold px-3 py-2 rounded-lg transition">{ad.cta || 'Xem ngay'} →</span>
      </div>
    </a>
  );
  return (
    <a href={ad.link || '#'} target={tgt} rel="noreferrer" className="group block rounded-2xl overflow-hidden border border-slate-200 shadow-md hover:shadow-xl transition aspect-[300/600] bg-gradient-to-br from-[#0A2540] to-[#10355f] text-white p-4 flex flex-col justify-center text-center">
      <p className="text-[10px] tracking-wider text-white/50 font-semibold">QUẢNG CÁO</p>
      <p className="font-extrabold text-lg mt-2 leading-tight">{ad.title}</p>
      {ad.sub && <p className="text-xs text-white/80 mt-2 leading-snug">{ad.sub}</p>}
      <span className="mt-4 inline-block bg-[#C8A14B] text-[#0A2540] text-sm font-extrabold px-4 py-2 rounded-lg">{ad.cta || 'Xem ngay'} →</span>
    </a>
  );
}

export default function NewsIndex() {
  const [news, setNews] = useState<N[]>([]);
  const [loading, setLoading] = useState(true);
  const [ad, setAd] = useState<Ad>(SAMPLE_AD);

  useEffect(() => { fetch('/feed/news').then((r) => r.json()).then((d) => setNews(d.news || [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { fetch('/api/config/tintuc_ad').then((r) => r.json()).then((d) => { if (d && d.value && typeof d.value === 'object') setAd({ ...SAMPLE_AD, ...d.value }); }).catch(() => {}); }, []);

  const showAd = ad && ad.enabled !== false;

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-56px)]">
      <div className="max-w-[1440px] mx-auto px-4 py-8 xl:flex xl:gap-6">
        {showAd && <aside className="hidden xl:block w-56 shrink-0"><div className="sticky top-20"><AdBanner ad={ad} /></div></aside>}

        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-400 mb-2"><Link href="/" className="hover:text-[#0A2540]">Trang chủ</Link> › <span className="text-slate-600">Tin tức thị trường</span></div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#0A2540]">Tin tức thị trường bất động sản</h1>
          <p className="text-slate-500 mt-1 text-sm">Tổng hợp từ nguồn uy tín: VnExpress, CafeF, Báo Xây dựng — cập nhật tự động.</p>

          {loading ? (
            <p className="text-slate-400 mt-10">Đang tải tin…</p>
          ) : news.length === 0 ? (
            <p className="text-slate-400 mt-10">Chưa có tin. Vui lòng quay lại sau.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
              {news.map((n) => {
                const date = n.publishedAt ? new Date(n.publishedAt).toLocaleDateString('vi-VN') : '';
                return (
                  <Link key={n.slug} href={`/tin-tuc/${n.slug}`} className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-slate-300 transition flex flex-col">
                    <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                      {n.image && <img src={n.image} alt={n.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />}
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <h3 className="font-bold text-[#0A2540] leading-snug line-clamp-3 group-hover:text-red-600">{n.title}</h3>
                      {n.summary && <p className="text-sm text-slate-500 mt-2 line-clamp-2 flex-1">{n.summary}</p>}
                      <p className="text-xs text-slate-400 mt-3">{n.source}{n.source && date ? ' · ' : ''}{date}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {showAd && <aside className="hidden xl:block w-56 shrink-0"><div className="sticky top-20"><AdBanner ad={ad} /></div></aside>}
      </div>
    </div>
  );
}
