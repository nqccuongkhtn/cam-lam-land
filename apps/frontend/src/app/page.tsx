'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Listing, PropertyType, PROPERTY_LABELS } from '@/lib/types';
import ListingCard from '@/components/ListingCard';
import HomeUtilities from '@/components/HomeUtilities';
import PromoBanner from '@/components/PromoBanner';
import FeaturedPartners from '@/components/FeaturedPartners';
import FeaturedProjects from '@/components/FeaturedProjects';
import SiteFooter from '@/components/SiteFooter';
import { useFlags } from '@/lib/flags';

const U = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=60`;
const CATS: { t: PropertyType; icon: string }[] = [
  { t: 'apartment', icon: '🏢' }, { t: 'house', icon: '🏠' }, { t: 'villa', icon: '🏡' },
  { t: 'land', icon: '🪧' }, { t: 'commercial', icon: '🏬' }, { t: 'farm', icon: '🌳' },
];
// Tin mẫu tĩnh — đảm bảo mục Nổi bật KHÔNG BAO GIỜ trống (kể cả khi backend chưa lên)
const STATIC: Listing[] = ([
  ['Biệt thự nghỉ dưỡng ven biển Bãi Dài', 9.8e9, 420, 'villa', 'Cam Hải Đông', 4, '1613490493576-7fde63acd811'],
  ['Đất nền mặt tiền đường ven biển', 4.2e9, 250, 'land', 'Cam Hải Đông', null, '1500382017468-9049fed747ef'],
  ['Nhà phố trung tâm Cam Đức', 2.8e9, 96, 'house', 'Cam Đức', 3, '1568605114967-8130f3a36994'],
  ['Căn hộ view đầm Thủy Triều', 1.75e9, 65, 'apartment', 'Cam Đức', 2, '1502672260266-1c1ef2d93688'],
  ['Mặt bằng kinh doanh QL1A', 6.5e9, 320, 'commercial', 'Cam Đức', null, '1497366216548-37526070297c'],
  ['Đất vườn Suối Tân có suối tự nhiên', 1.9e9, 2000, 'farm', 'Suối Tân', null, '1449844908441-8829872d2607'],
  ['Biệt thự đơn lập khu compound', 12.5e9, 360, 'villa', 'Cam Hải Đông', 5, '1564013799919-ab600027ffc6'],
  ['Đất thổ cư Cam Thành Bắc', 1.25e9, 150, 'land', 'Cam Thành Bắc', null, '1542621334-a254cf47733d'],
] as [string, number, number, PropertyType, string, number | null, string][]).map(([title, price, area, t, ward, bed, img], i) => ({
  id: -(i + 1), title, description: null, price, area, propertyType: t, address: null, ward, bedrooms: bed,
  status: 'active', images: [U(img)], lng: 109.09, lat: 12.07, createdAt: '',
}));
const AREAS = [
  { name: 'Cam Đức', ward: 'Cam Đức', sub: 'Trung tâm huyện', img: '/quyhoach-camlam.jpg' },
  { name: 'Cam Hải Đông', ward: 'Cam Hải Đông', sub: 'Bãi Dài · ven biển', img: U('1507525428034-b723cf961d3e') },
  { name: 'Cam Thành Bắc', ward: 'Cam Thành Bắc', sub: 'Ven đầm Thủy Triều', img: U('1449844908441-8829872d2607') },
  { name: 'Suối Tân', ward: 'Suối Tân', sub: 'Giáp Diên Khánh', img: U('1441974231531-c6227db76b6e') },
  { name: 'Cam Hiệp Bắc', ward: 'Cam Hiệp Bắc', sub: 'Sinh thái · nông nghiệp', img: U('1500382017468-9049fed747ef') },
  { name: 'Cam An Bắc', ward: 'Cam An Bắc', sub: 'Quỹ đất rộng', img: U('1470071459604-3b5ec3a7fe05') },
];
const STATS = [
  { n: '2,000+', l: 'Bất động sản', d: 'M3 21h18M5 21V7l6-4 6 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01' },
  { n: '5,000+', l: 'Khách hàng', d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { n: '50+', l: 'Dự án quy hoạch', d: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { n: '8', l: 'Xã / Khu vực', d: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
];

const NEWS: Record<string, { title: string; url: string; img?: string; date?: string; source?: string }[]> = {
  'Tin nổi bật': [
    { title: 'Thủ tướng phê duyệt Quy hoạch chung đô thị mới Cam Lâm đến năm 2045', url: 'https://thanhnien.vn/thu-tuong-phe-duyet-quy-hoach-chung-do-thi-moi-cam-lam-den-2045-185240228205628777.htm', img: U('1486406146926-c627a92ad1ab'), date: '28/02/2024' },
    { title: 'Cam Lâm trở thành cực tăng trưởng phía Nam Khánh Hòa và vùng Nam Trung Bộ', url: 'https://baochinhphu.vn/cam-lam-tro-thanh-cuc-tang-truong-vung-nam-trung-bo-102240228164301983.htm' },
    { title: 'Công bố 3 đồ án quy hoạch phân khu của Đô thị mới Cam Lâm', url: 'https://baokhanhhoa.vn/xa-hoi/202408/cong-bo-3-do-an-quy-hoach-phan-khu-cua-do-thi-moi-cam-lam-b956a11/' },
    { title: 'Đô thị sân bay Cam Lâm — tầm nhìn đô thị quốc tế đến năm 2045', url: 'https://quyhoach.xaydung.gov.vn/vn/quy-hoach/18260/quy-hoach-chung-do-thi-moi-cam-lam--tinh-khanh-hoa-den-nam-2045.aspx' },
    { title: 'Phê duyệt quy hoạch phân khu đô thị phía Bắc Cam Lâm', url: 'https://congbaokhanhhoa.gov.vn/noi-dung/id/3479/Phe-duyet-quy-hoach-phan-khu-do-thi-phia-Bac-Cam-Lam' },
    { title: 'Khánh Hòa hướng tới trở thành thành phố trực thuộc Trung ương', url: 'https://baochinhphu.vn/cam-lam-tro-thanh-cuc-tang-truong-vung-nam-trung-bo-102240228164301983.htm' },
  ],
  'Thị trường BĐS': [
    { title: 'Bất động sản Cam Lâm — cập nhật tin bán mới nhất', url: '/listings', img: U('1564013799919-ab600027ffc6'), date: 'Hôm nay' },
    { title: 'Nhà đất trung tâm Cam Đức', url: '/listings?q=Cam Đức' },
    { title: 'Đất nền ven biển Bãi Dài, Cam Hải Đông', url: '/listings?q=Cam Hải Đông' },
    { title: 'Ký gửi nhà đất — định giá & bán giúp miễn phí', url: '/listings' },
    { title: 'Đăng tin bán nhà đất miễn phí tại Cam Lâm', url: '/sales/post' },
  ],
};

function Ic({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-[#0A2540]/60 shrink-0"><path d={d} /></svg>;
}

const SEARCH_HINTS = [
  'Đất nền Cam Lâm dưới 1 tỷ',
  'Nhà phố trung tâm Cam Đức',
  'Đất ven biển Bãi Dài, Cam Hải Đông',
  'Biệt thự nghỉ dưỡng gần sân bay Cam Ranh',
  'Đất nông nghiệp giá tốt Suối Tân',
];
// Placeholder gõ chữ luân phiên các gợi ý tìm kiếm để kích thích người dùng nhập.
function useTypingHint(items: string[]): string {
  const [txt, setTxt] = useState('');
  useEffect(() => {
    let i = 0, ci = 0, del = false; let t: any;
    const tick = () => {
      const w = items[i % items.length];
      ci += del ? -1 : 1;
      setTxt(w.slice(0, Math.max(0, ci)));
      if (!del && ci >= w.length) { del = true; t = setTimeout(tick, 1500); return; }
      if (del && ci <= 0) { del = false; i++; t = setTimeout(tick, 350); return; }
      t = setTimeout(tick, del ? 35 : 70);
    };
    t = setTimeout(tick, 700);
    return () => clearTimeout(t);
  }, []);
  return txt;
}

type AreaWithCount = { name: string; ward: string; sub: string; img: string; count: number };
function AreaCard({ a, big }: { a: AreaWithCount; big?: boolean }) {
  return (
    <Link href={`/listings?ward=${encodeURIComponent(a.ward)}`}
      className={`group relative rounded-2xl overflow-hidden shadow-sm bg-slate-100 ${big ? 'col-span-2 md:row-span-2 h-64 md:h-auto' : 'h-[132px] md:h-auto'}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={a.img} alt={a.name} loading="lazy" decoding="async" onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://picsum.photos/seed/' + encodeURIComponent(a.name) + '/700/500'; }} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A2540]/90 via-[#0A2540]/25 to-transparent" />
      <div className={`absolute left-0 bottom-0 text-white ${big ? 'p-4 md:p-6' : 'p-3.5'}`}>
        <p className={`font-bold leading-tight ${big ? 'text-2xl md:text-3xl' : 'text-base'}`}>{a.name}</p>
        <p className={`text-white/85 ${big ? 'text-sm mt-1' : 'text-[12px] mt-0.5'}`}>{a.count > 0 ? `${a.count.toLocaleString('vi-VN')} tin đăng` : a.sub}</p>
      </div>
    </Link>
  );
}

export default function Home() {
  const router = useRouter();
  const { flags } = useFlags();
  const [listings, setListings] = useState<Listing[]>([]);
  const [marketNews, setMarketNews] = useState<{ title: string; url: string; img?: string; date?: string; source?: string }[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [q, setQ] = useState(''); const [type, setType] = useState<PropertyType | ''>(''); const [max, setMax] = useState(''); const [expanded, setExpanded] = useState(false); const [newsTab, setNewsTab] = useState('Tin nổi bật');
  const searchHint = useTypingHint(SEARCH_HINTS);
  useEffect(() => { api<{ listings: Listing[] }>('/listings?limit=20').then((d) => setListings(d.listings || [])).catch(() => {}); }, []);
  const [areaCounts, setAreaCounts] = useState<Record<string, number>>({});
  useEffect(() => { api<{ areas: { ward: string; count: number }[] }>('/listings/areas').then((d) => { const m: Record<string, number> = {}; (d.areas || []).forEach((a) => { m[a.ward] = a.count; }); setAreaCounts(m); }).catch(() => {}); }, []);
  useEffect(() => {
    setMarketLoading(true);
    fetch('/feed/news')
      .then((r) => r.json())
      .then((d) => setMarketNews((d.news || []).map((n: any) => ({ title: n.title, url: '/tin-tuc/' + n.slug, img: n.image || U('1486406146926-c627a92ad1ab'), date: n.publishedAt ? new Date(n.publishedAt).toLocaleDateString('vi-VN') : undefined, source: n.source }))))
      .catch(() => {})
      .finally(() => setMarketLoading(false));
  }, []);

  function search() {
    const p = new URLSearchParams();
    if (type) p.set('propertyType', type); if (max) p.set('maxPrice', String(Number(max) * 1e9)); if (q) p.set('q', q);
    router.push(`/listings?${p.toString()}`);
  }
  const featured = listings.length > 0 ? listings : STATIC;
  const fromApi = listings.length > 0;
  const newsItems = newsTab === 'Thị trường BĐS' ? (marketNews.length ? marketNews.slice(0, 8) : NEWS['Thị trường BĐS']) : NEWS[newsTab];
  const marketLoadingNow = newsTab === 'Thị trường BĐS' && marketLoading && !marketNews.length;
  const areasRanked: AreaWithCount[] = [...AREAS].map((a) => ({ ...a, count: areaCounts[a.ward] || 0 })).sort((x, y) => y.count - x.count);
  const bigArea = areasRanked[0]; const gridAreas = areasRanked.slice(1, 5);

  return (
    <div className="bg-slate-50">
      {/* HERO */}
      <section className="relative">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${U('1564013799919-ab600027ffc6')})` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/70 via-slate-900/35 to-slate-900/10" />
        <div className="relative mx-auto max-w-7xl px-4 pt-24 md:pt-28 pb-24 text-white">
          <p className="text-[#FFD56A] font-semibold tracking-wide drop-shadow">★ Nền tảng bất động sản & quy hoạch Cam Lâm</p>
          <h1 className="text-4xl md:text-6xl font-extrabold mt-3 max-w-3xl leading-[1.1] drop-shadow-[0_3px_18px_rgba(0,0,0,0.55)]">Tìm ngôi nhà mơ ước <span className="text-[#FFD56A]">của bạn</span></h1>
          <p className="mt-4 text-slate-100 text-lg max-w-2xl drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">Khám phá hàng ngàn bất động sản cao cấp và tra cứu quy hoạch chính xác trên toàn khu vực.</p>

          {/* Search card */}
          <div className="mt-9 bg-white rounded-2xl shadow-2xl p-3 max-w-5xl grid md:grid-cols-[1.3fr_1fr_1fr_auto] gap-2">
            <label className="flex items-center gap-2 px-3 rounded-xl border border-slate-200 focus-within:border-[#0A2540]">
              <Ic d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder={searchHint || 'Khu vực, dự án…'} className="py-3 w-full outline-none text-slate-800 text-sm" />
            </label>
            <label className="flex items-center gap-2 px-3 rounded-xl border border-slate-200">
              <Ic d="M3 11l9-8 9 8M5 10v10h14V10" />
              <select value={type} onChange={(e) => setType(e.target.value as PropertyType)} className="py-3 w-full outline-none text-slate-700 text-sm bg-transparent">
                <option value="">Loại hình</option>{CATS.map((c) => <option key={c.t} value={c.t}>{PROPERTY_LABELS[c.t]}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 px-3 rounded-xl border border-slate-200">
              <Ic d="M20.6 13.4 12 22l-9-9V3h8z M7 7h.01" />
              <select value={max} onChange={(e) => setMax(e.target.value)} className="py-3 w-full outline-none text-slate-700 text-sm bg-transparent">
                <option value="">Mức giá</option><option value="1">Dưới 1 tỷ</option><option value="3">Dưới 3 tỷ</option><option value="5">Dưới 5 tỷ</option><option value="10">Dưới 10 tỷ</option>
              </select>
            </label>
            <button onClick={search} className="bg-red-600 hover:bg-red-700 text-white font-bold px-7 py-3 rounded-xl whitespace-nowrap shadow-lg shadow-red-600/30">Tìm kiếm</button>
          </div>

          {/* Quick categories */}
          <div className="mt-5 flex flex-wrap gap-2">
            {CATS.map((c) => (
              <Link key={c.t} href={`/listings?propertyType=${c.t}`}
                className="bg-white/10 hover:bg-[#C8A14B] hover:text-[#0A2540] hover:border-[#C8A14B] backdrop-blur border border-white/25 rounded-full px-4 py-1.5 text-sm font-semibold transition">
                {c.icon} {PROPERTY_LABELS[c.t]}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* TIN TỨC & QUY HOẠCH — kiểu batdongsan */}
      <section className="mx-auto max-w-7xl px-4 pt-14">
        <div className="flex items-center gap-5 border-b border-slate-200 mb-5 overflow-x-auto">
          {Object.keys(NEWS).map((t) => (
            <button key={t} onClick={() => setNewsTab(t)} className={`pb-2.5 text-sm font-bold whitespace-nowrap border-b-2 -mb-px ${newsTab === t ? 'border-red-600 text-[#0A2540]' : 'border-transparent text-slate-500 hover:text-[#0A2540]'}`}>{t}</button>
          ))}
          <Link href="/tin-tuc" className="ml-auto text-red-600 text-sm font-semibold whitespace-nowrap shrink-0">Xem thêm →</Link>
        </div>
        <div className="grid lg:grid-cols-[1.05fr_1fr_0.62fr] gap-6">
          {marketLoadingNow ? (
            <div className="lg:col-span-2 grid place-items-center min-h-[220px] text-slate-400 text-sm">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-red-500 rounded-full animate-spin mx-auto" />
                <p className="mt-3">Đang tải tin thị trường…</p>
              </div>
            </div>
          ) : (<>
          {(() => { const feat = newsItems[0]; return (
            <a href={feat.url} target={feat.url.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="group block">
              <div className="aspect-[16/10] rounded-xl overflow-hidden bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={feat.img} alt={feat.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
              </div>
              <h3 className="font-extrabold text-[#0A2540] mt-3 text-lg leading-snug line-clamp-2 group-hover:text-red-600">{feat.title}</h3>
              {feat.date && <p className="text-xs text-slate-400 mt-2">🕒 {feat.date}{feat.source ? ` · ${feat.source}` : ''}</p>}
            </a>
          ); })()}
          <div className="divide-y divide-slate-100">
            {newsItems.slice(1).map((h) => (
              <a key={h.title} href={h.url} target={h.url.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="block py-2.5 text-[15px] text-slate-700 hover:text-red-600 leading-snug line-clamp-2">{h.title}</a>
            ))}
          </div>
          </>)}
          <div className="space-y-4">
            <Link href="/map" className="block rounded-xl bg-gradient-to-br from-[#a3121b] to-[#6d0d14] text-white p-5 hover:brightness-110 transition">
              <p className="text-[11px] tracking-wide text-white/70 font-semibold">CAM LÂM LAND</p>
              <p className="font-extrabold text-lg mt-1 leading-tight">Sàn BĐS & Bản đồ quy hoạch Cam Lâm</p>
              <p className="text-xs text-white/80 mt-1.5 leading-snug">Tra cứu quy hoạch, mua bán nhà đất, nền vệ tinh — tất cả tại một nơi.</p>
              <span className="inline-block mt-3 bg-white text-[#a3121b] text-xs font-bold px-3 py-1.5 rounded">Khám phá ngay →</span>
            </Link>
            <Link href="/sales/post" className="block rounded-xl bg-gradient-to-br from-[#0A2540] to-[#0d2f54] text-white p-5 hover:brightness-110 transition">
              <p className="text-[11px] tracking-wide text-[#C8A14B] font-semibold">MIỄN PHÍ</p>
              <p className="font-extrabold text-lg mt-1 leading-tight">Đăng tin — tiếp cận khách mua ngay</p>
              <span className="inline-block mt-3 bg-[#C8A14B] text-[#0A2540] text-xs font-bold px-3 py-1.5 rounded">Đăng tin ngay →</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED — kiểu batdongsan */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#0A2540]">Bất động sản dành cho bạn</h2>
          <div className="flex items-center gap-3 text-sm font-semibold text-[#0A2540]">
            <Link href="/listings" className="hover:text-red-600">Tin bán mới nhất</Link>
            <span className="text-slate-300">|</span>
            <Link href="/listings" className="hover:text-red-600">Tin cho thuê mới nhất</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {(expanded ? featured : featured.slice(0, 8)).map((l) => <ListingCard key={l.id} l={l} href={fromApi ? undefined : '/listings'} />)}
        </div>
        <div className="mt-8 text-center">
          {featured.length > 8 ? (
            <button onClick={() => setExpanded((v) => !v)} className="inline-flex items-center gap-1.5 border border-slate-300 hover:border-[#0A2540] hover:text-[#0A2540] text-slate-600 font-semibold rounded-full px-7 py-2.5 bg-white transition">
              {expanded ? 'Thu gọn' : 'Mở rộng'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" /></svg>
            </button>
          ) : (
            <Link href="/listings" className="inline-flex items-center gap-1.5 border border-slate-300 hover:border-[#0A2540] text-[#0A2540] font-semibold rounded-full px-7 py-2.5 bg-white">Xem tất cả →</Link>
          )}
        </div>
        {!fromApi && <p className="text-center text-xs text-slate-400 mt-4">* Đang hiển thị tin mẫu. Chạy <code className="bg-slate-100 px-1 rounded">start.bat</code> → <code className="bg-slate-100 px-1 rounded">them_tin_demo.bat</code> để có tin thật.</p>}
      </section>

      {/* DỰ ÁN BĐS NỔI BẬT — admin quản lý (kiểu batdongsan) */}
      <FeaturedProjects />

      {/* PROMO BANNER — quảng cáo (kiểu batdongsan) */}
      <PromoBanner />

      {/* BĐS THEO ĐỊA ĐIỂM — ô lớn + lưới + số tin (kiểu batdongsan) */}
      <section className="mx-auto max-w-7xl px-4 pt-8 pb-4">
        <h2 className="text-2xl md:text-3xl font-extrabold text-[#0A2540] mb-6">Bất động sản theo địa điểm</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 md:grid-rows-2 gap-3 md:gap-4 md:h-[420px]">
          <AreaCard a={bigArea} big />
          {gridAreas.map((a) => <AreaCard key={a.ward} a={a} />)}
        </div>
      </section>

      {/* HỖ TRỢ TIỆN ÍCH */}
      <HomeUtilities />

      {/* DOANH NGHIỆP TIÊU BIỂU — logo carousel (kiểu batdongsan) */}
      <FeaturedPartners />

      {/* PLANNING PROMO — dưới Tiện ích & Doanh nghiệp tiêu biểu */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="grid md:grid-cols-2 rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="p-8 md:p-12 flex flex-col justify-center">
            <span className="text-[#C8A14B] font-semibold text-sm tracking-wide">BẢN ĐỒ QUY HOẠCH</span>
            <h2 className="text-3xl font-extrabold text-[#0A2540] mt-2">Tra cứu quy hoạch & thửa đất chính xác</h2>
            <p className="text-slate-500 mt-3">Quy hoạch sử dụng đất, nền vệ tinh độ nét cao, tra cứu theo số tờ/số thửa/xã, toạ độ VN-2000, đo đạc trực tiếp trên bản đồ.</p>
            <div className="mt-6 flex gap-3">
              <Link href="/map" className="bg-[#0A2540] hover:bg-[#0d2f54] text-white font-semibold px-6 py-3 rounded-xl">Mở bản đồ →</Link>
              <Link href="/qr" className="border border-slate-300 text-[#0A2540] font-semibold px-6 py-3 rounded-xl hover:bg-slate-50">Tra cứu QR</Link>
            </div>
          </div>
          <div className="bg-slate-100 flex items-center justify-center min-h-[280px] p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/quyhoach-camlam.jpg" alt="Mô hình quy hoạch Cam Lâm" loading="lazy" decoding="async" className="w-full h-full object-contain max-h-[460px] rounded-xl" />
          </div>
        </div>
      </section>

      {/* AD CONTACT — tế nhị */}
      {flags.services_live && (
      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="font-bold text-[#0A2540]">📣 Quảng cáo cùng Cam Lâm Land</p>
            <p className="text-sm text-slate-500 mt-0.5">Đưa thương hiệu, dự án của bạn đến khách quan tâm bất động sản Cam Lâm — banner, logo trên bản đồ, đẩy tin nổi bật.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/dichvu" className="border border-slate-300 text-[#0A2540] font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-50 text-sm whitespace-nowrap">Xem dịch vụ</Link>
            <a href="tel:0988888888" className="bg-[#0A2540] hover:bg-[#0d2f54] text-white font-semibold px-5 py-2.5 rounded-xl text-sm whitespace-nowrap">Liên hệ quảng cáo</a>
          </div>
        </div>
      </section>
      )}

      {/* FOOTER — nhiều tầng (kiểu batdongsan) */}
      <SiteFooter />
    </div>
  );
}
