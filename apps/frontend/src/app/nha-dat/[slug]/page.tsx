import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ListingCard from '@/components/ListingCard';
import SiteFooter from '@/components/SiteFooter';
import AreaMap from '@/components/AreaMap';
import { PAGE_BY_SLUG, CORE_SLUGS, AREAS, TYPES, type PageDef } from '@/lib/seoLanding';
import { formatVnd, type Listing } from '@/lib/types';
import bangGia from '@/data/camlamBangGia.json';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://batdongsancamlam.dpdns.org';
const BACKEND = process.env.BACKEND_HOST ? (process.env.BACKEND_HOST.startsWith('http') ? process.env.BACKEND_HOST : `https://${process.env.BACKEND_HOST}`) : '';

export const revalidate = 600;          // ISR: làm mới mỗi 10 phút
export const dynamicParams = true;      // slug ngoài danh sách pre-render vẫn dựng theo yêu cầu

export function generateStaticParams() {
  return CORE_SLUGS.map((slug) => ({ slug })); // pre-render khu vực + loại hình đơn lẻ; tổ hợp render on-demand
}

// ----- Giá đất ở tham chiếu toàn Cam Lâm (từ bảng giá đất tỉnh) -----
function camLamPriceRange(): { min: number; max: number } {
  let min = Infinity, max = 0;
  for (const k of Object.keys(bangGia as any)) {
    for (const row of ((bangGia as any)[k]?.datO || [])) {
      for (const v of (row.vt || [])) { if (v > 0) { if (v < min) min = v; if (v > max) max = v; } }
    }
  }
  return { min: min === Infinity ? 0 : min, max };
}
const PRICE = camLamPriceRange();
const trieu = (v: number) => (v / 1e6).toFixed(v < 1e6 ? 2 : 1).replace(/\.0$/, '').replace('.', ',');

// ----- Nhãn/tiêu đề/mô tả/từ khóa theo trang -----
const YEAR = new Date().getFullYear();
function labels(p: PageDef) {
  const typeLabel = p.type ? p.type.label : 'Nhà đất';
  const areaShort = p.area ? p.area.name : 'Cam Lâm';
  const h1 = p.area ? `${typeLabel} ${p.area.name}` : `${typeLabel} Cam Lâm`;
  const locFull = p.area ? `${p.area.name}, Cam Lâm, Khánh Hòa` : 'Cam Lâm, Khánh Hòa';
  return { typeLabel, areaShort, h1, locFull };
}
function metaFor(p: PageDef): Metadata {
  const { typeLabel, areaShort, h1, locFull } = labels(p);
  const title = `${h1}, Khánh Hòa – Giá & tin mới ${YEAR}`;
  const lo = typeLabel.toLowerCase();
  const desc = `${typeLabel} ${locFull}: tổng hợp tin đăng mới nhất, giá đất khu vực, vị trí trên bản đồ quy hoạch và pháp lý. ${p.area?.blurb ?? p.type?.blurb ?? ''} Liên hệ trực tiếp qua Cam Lâm Land.`.replace(/\s+/g, ' ').slice(0, 300);
  const kw = [
    h1, `${lo} ${areaShort}`, `mua bán ${lo} ${areaShort}`, `bán ${lo} ${areaShort}`,
    `${typeLabel} ${areaShort} Cam Lâm`, `bất động sản ${areaShort}`, `nhà đất ${areaShort}`,
    `${lo} ${areaShort} giá rẻ`, `${typeLabel} Cam Lâm Khánh Hòa`,
    ...(p.area?.coastal ? [`đất ven biển ${areaShort}`, `${lo} gần biển ${areaShort}`] : []),
    ...(p.area ? [] : TYPES.slice(0, 6).map((t) => `${t.label} Cam Lâm`)),
  ];
  return {
    title, description: desc, keywords: kw,
    alternates: { canonical: `/nha-dat/${p.slug}` },
    openGraph: { type: 'website', title, description: desc, url: `${SITE}/nha-dat/${p.slug}`, images: [{ url: '/icons/icon-512.png' }] },
    twitter: { card: 'summary_large_image', title, description: desc, images: ['/icons/icon-512.png'] },
  };
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = PAGE_BY_SLUG[params.slug];
  if (!p) return { title: 'Nhà đất Cam Lâm, Khánh Hòa' };
  return metaFor(p);
}

async function fetchListings(p: PageDef): Promise<Listing[]> {
  if (!BACKEND) return [];
  const qs = new URLSearchParams({ deal: p.deal, limit: '24' });
  if (p.type) qs.set('propertyType', p.type.base);
  if (p.area) qs.set('ward', p.area.ward);
  try {
    const r = await fetch(`${BACKEND}/api/listings?${qs.toString()}`, { next: { revalidate: 300 } });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.listings || []) as Listing[];
  } catch { return []; }
}

export default async function Page({ params }: { params: { slug: string } }) {
  const p = PAGE_BY_SLUG[params.slug];
  if (!p) notFound();

  const { typeLabel, areaShort, h1, locFull } = labels(p);
  const listings = await fetchListings(p);
  const shown = listings.slice(0, 12);
  const count = listings.length;
  const prices = listings.map((l) => l.price).filter((n) => n > 0);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const lo = typeLabel.toLowerCase();

  const filterHref = `/listings?deal=${p.deal}${p.type ? `&propertyType=${p.type.base}` : ''}${p.area ? `&ward=${encodeURIComponent(p.area.ward)}` : ''}`;
  const center = p.area ? p.area.center : ([109.0983, 12.0716] as [number, number]);
  const points = listings.filter((l) => l.lng && l.lat).map((l) => ({ id: l.id, lng: l.lng, lat: l.lat, label: formatVnd(l.price), title: l.title }));

  // Liên kết nội bộ (mắt lưới cho Google bò + điều hướng)
  const saleTypes = TYPES.filter((t) => t.deal === 'sale');
  const otherTypes = saleTypes.filter((t) => t.slug !== p.type?.slug).map((t) => ({ label: p.area ? `${t.label} ${p.area.name}` : `${t.label} Cam Lâm`, href: `/nha-dat/${p.area ? `${t.slug}-${p.area.slug}` : t.slug}` }));
  const otherAreas = AREAS.filter((a) => a.slug !== p.area?.slug).map((a) => ({ label: p.type ? `${typeLabel} ${a.name}` : `Nhà đất ${a.name}`, href: `/nha-dat/${p.type ? `${p.type.slug}-${a.slug}` : a.slug}` }));

  const intro = `Bạn đang tìm ${lo} tại ${locFull}? ${p.area?.blurb ?? ''} ${p.type?.blurb ?? 'Cam Lâm Land tổng hợp mọi loại hình nhà đất trong khu vực.'} Cam Lâm Land cập nhật tin đăng mới nhất kèm vị trí trên bản đồ quy hoạch, giá đất tham chiếu và hỗ trợ pháp lý — giúp bạn chọn đúng thửa, đúng giá.`.replace(/\s+/g, ' ');

  const faqs = [
    { q: `Giá ${lo} tại ${areaShort} hiện bao nhiêu?`, a: `Giá đất ở tại Cam Lâm dao động khoảng ${trieu(PRICE.min)} – ${trieu(PRICE.max)} triệu đồng/m² tùy vị trí (theo bảng giá đất tỉnh Khánh Hòa). Giá giao dịch thực tế của từng ${lo} tùy diện tích, mặt tiền và pháp lý — xem chi tiết từng tin đăng hoặc tra Bảng giá đất trên Cam Lâm Land.` },
    { q: `Mua ${lo} ở ${areaShort} cần lưu ý pháp lý gì?`, a: `Nên kiểm tra sổ đỏ/sổ hồng, quy hoạch thửa đất và tình trạng tranh chấp trước khi đặt cọc. Cam Lâm Land có công cụ tra cứu quy hoạch, bảng giá đất và mẫu hợp đồng đặt cọc chuẩn Điều 328 Bộ luật Dân sự 2015 để bạn giao dịch an toàn.` },
    { q: `Làm sao xem ${lo} ${areaShort} trên bản đồ?`, a: `Bấm "Xem trên bản đồ" để mở toàn bộ ${lo} tại ${areaShort} trên bản đồ quy hoạch của Cam Lâm Land, lọc theo giá và diện tích, xem vị trí chính xác từng thửa.` },
  ];

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Nhà đất Cam Lâm', item: `${SITE}/nha-dat` },
        { '@type': 'ListItem', position: 3, name: h1, item: `${SITE}/nha-dat/${p.slug}` },
      ] },
      ...(shown.length ? [{ '@type': 'ItemList', itemListElement: shown.map((l, i) => ({
        '@type': 'ListItem', position: i + 1, url: `${SITE}/listings/${l.id}`, name: l.title,
      })) }] : []),
      { '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <div className="mx-auto max-w-6xl px-3 sm:px-4 py-5 sm:py-7">
        {/* Breadcrumb */}
        <nav className="text-[12px] text-slate-500 mb-3 flex flex-wrap items-center gap-1">
          <Link href="/" className="hover:text-[#C8A14B]">Trang chủ</Link><span>›</span>
          <Link href="/nha-dat" className="hover:text-[#C8A14B]">Nhà đất Cam Lâm</Link><span>›</span>
          <span className="text-slate-700 font-medium">{h1}</span>
        </nav>

        {/* Hero */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0A2540] leading-tight">{h1}, Khánh Hòa</h1>
        <p className="mt-2 text-[14px] sm:text-[15px] text-slate-600 leading-relaxed max-w-3xl">{intro}</p>

        {/* Thống kê + CTA */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 bg-[#0A2540] text-white text-[13px] font-bold px-3 py-1.5 rounded-full">🏠 {count} tin đang có</span>
          {minPrice > 0 && <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 text-[13px] font-bold px-3 py-1.5 rounded-full">Giá từ {formatVnd(minPrice)}</span>}
          <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-[13px] font-semibold px-3 py-1.5 rounded-full">📍 {p.area ? p.area.region : 'toàn huyện Cam Lâm'}</span>
          <Link href={filterHref} className="ml-auto inline-flex items-center gap-1.5 bg-[#C8A14B] hover:bg-[#b8923f] text-[#0A2540] text-[13px] font-extrabold px-4 py-2 rounded-xl shadow">🗺️ Xem trên bản đồ →</Link>
        </div>

        {/* Bản đồ khu vực (tải khi cuộn tới) */}
        <div className="mt-5">
          <AreaMap center={center} zoom={p.area ? 13 : 11.4} points={points} moreHref={filterHref} title={`${h1} trên bản đồ`} />
        </div>

        {/* Danh sách tin */}
        <h2 className="mt-5 sm:mt-7 text-lg sm:text-xl font-bold text-[#0A2540]">{typeLabel} {p.area ? `tại ${areaShort}` : 'tại Cam Lâm'} mới nhất</h2>
        {shown.length > 0 ? (
          <>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {shown.map((l) => <ListingCard key={l.id} l={l} />)}
            </div>
            <div className="mt-4 text-center">
              <Link href={filterHref} className="inline-flex items-center gap-2 bg-[#0A2540] hover:bg-[#0d2f54] text-white font-bold px-5 py-2.5 rounded-xl">Xem tất cả {typeLabel.toLowerCase()} {areaShort} →</Link>
            </div>
          </>
        ) : (
          <div className="mt-3 bg-white border border-dashed border-slate-300 rounded-2xl p-6 text-center">
            <p className="text-slate-600">Hiện chưa có tin <b>{lo}</b> tại <b>{areaShort}</b> phù hợp.</p>
            <p className="text-[13px] text-slate-500 mt-1">Bạn có thể xem trên bản đồ, tìm các khu vực lân cận bên dưới, hoặc đăng tin miễn phí.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Link href={filterHref} className="bg-[#C8A14B] text-[#0A2540] font-bold px-4 py-2 rounded-xl text-sm">Xem bản đồ khu vực</Link>
              <Link href="/sales/post" className="bg-[#0A2540] text-white font-bold px-4 py-2 rounded-xl text-sm">Đăng tin miễn phí</Link>
            </div>
          </div>
        )}

        {/* Giá đất khu vực */}
        <section className="mt-6 sm:mt-8 bg-gradient-to-br from-[#0A2540] to-[#0d3a6b] text-white rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg sm:text-xl font-extrabold">Giá đất {areaShort} & bảng giá tham khảo</h2>
          <p className="text-white/85 text-[14px] mt-2 max-w-2xl">Giá đất ở tại Cam Lâm dao động khoảng <b className="text-[#FFD56A]">{trieu(PRICE.min)} – {trieu(PRICE.max)} triệu đồng/m²</b> tùy vị trí (theo bảng giá đất tỉnh Khánh Hòa). Tra cứu giá chính thức từng tuyến đường và định giá nhanh thửa đất của bạn:</p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <Link href="/bang-gia-dat" className="bg-white/15 hover:bg-white/25 font-bold px-4 py-2 rounded-xl text-sm">📊 Bảng giá đất Khánh Hòa</Link>
            <Link href="/gia-dat" className="bg-white/15 hover:bg-white/25 font-bold px-4 py-2 rounded-xl text-sm">💰 Giá đất khu vực & định giá</Link>
            <Link href="/map" className="bg-white/15 hover:bg-white/25 font-bold px-4 py-2 rounded-xl text-sm">🗺️ Bản đồ quy hoạch</Link>
          </div>
        </section>

        {/* Về khu vực / loại hình */}
        <section className="mt-6 sm:mt-8">
          <h2 className="text-lg sm:text-xl font-bold text-[#0A2540]">Về {p.area ? areaShort : `${typeLabel.toLowerCase()} tại Cam Lâm`}</h2>
          <p className="mt-2 text-[14px] text-slate-600 leading-relaxed max-w-3xl">{p.area ? p.area.blurb : p.type?.blurb} {p.type ? p.type.blurb : ''} Cam Lâm nằm giữa TP. Nha Trang và sân bay quốc tế Cam Ranh, hạ tầng giao thông ngày càng hoàn thiện (Quốc lộ 1, cao tốc, đường ven biển) — là khu vực bất động sản giàu tiềm năng của Khánh Hòa.</p>
        </section>

        {/* FAQ */}
        <section className="mt-6 sm:mt-8">
          <h2 className="text-lg sm:text-xl font-bold text-[#0A2540]">Câu hỏi thường gặp</h2>
          <div className="mt-3 space-y-2.5">
            {faqs.map((f, i) => (
              <details key={i} className="bg-white border border-slate-200 rounded-xl p-4 group">
                <summary className="font-semibold text-[#0A2540] cursor-pointer list-none flex items-center justify-between gap-2">{f.q}<span className="text-[#C8A14B] group-open:rotate-45 transition">＋</span></summary>
                <p className="mt-2 text-[14px] text-slate-600 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Liên kết nội bộ */}
        <section className="mt-6 sm:mt-8 border-t border-slate-200 pt-5 sm:pt-6">
          {p.area && (
            <div className="mb-5">
              <h3 className="text-[15px] font-bold text-[#0A2540] mb-2">Loại hình khác tại {areaShort}</h3>
              <div className="flex flex-wrap gap-2">
                {otherTypes.map((x) => <Link key={x.href} href={x.href} className="text-[13px] bg-slate-100 hover:bg-[#C8A14B]/20 text-slate-700 px-3 py-1.5 rounded-full">{x.label}</Link>)}
              </div>
            </div>
          )}
          <div>
            <h3 className="text-[15px] font-bold text-[#0A2540] mb-2">{p.type ? `${typeLabel} ở khu vực khác` : 'Nhà đất theo khu vực'}</h3>
            <div className="flex flex-wrap gap-2">
              {otherAreas.map((x) => <Link key={x.href} href={x.href} className="text-[13px] bg-slate-100 hover:bg-[#C8A14B]/20 text-slate-700 px-3 py-1.5 rounded-full">{x.label}</Link>)}
            </div>
          </div>
          <div className="mt-5">
            <Link href="/nha-dat" className="text-[14px] font-semibold text-[#C8A14B] hover:underline">Xem tất cả khu vực & loại hình nhà đất Cam Lâm →</Link>
          </div>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
