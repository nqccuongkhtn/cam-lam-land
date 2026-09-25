import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import { AREAS, TYPES } from '@/lib/seoLanding';

import { ldJson } from '@/lib/jsonld';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://batdongsancamlam.dpdns.org';

export const metadata: Metadata = {
  title: 'Nhà đất Cam Lâm, Khánh Hòa — Mua bán & cho thuê theo khu vực, loại hình',
  description: 'Tổng hợp nhà đất Cam Lâm, Khánh Hòa theo từng khu vực (Cam Đức, Cam Hải Đông, Bãi Dài, Suối Tân…) và loại hình (đất nền, đất thổ cư, nhà phố, biệt thự, mặt bằng, phòng trọ…). Tin đăng mới, giá đất khu vực và bản đồ quy hoạch.',
  keywords: ['nhà đất Cam Lâm', 'bất động sản Cam Lâm', 'mua bán nhà đất Cam Lâm', 'đất nền Cam Lâm', 'nhà đất Khánh Hòa', 'đất Bãi Dài', 'nhà đất Cam Đức'],
  alternates: { canonical: '/nha-dat' },
  openGraph: { type: 'website', title: 'Nhà đất Cam Lâm, Khánh Hòa theo khu vực & loại hình', description: 'Mua bán & cho thuê nhà đất Cam Lâm theo khu vực và loại hình — tin mới, giá khu vực, bản đồ quy hoạch.', url: `${SITE}/nha-dat`, images: [{ url: '/icons/icon-512.png' }] },
};

const saleTypes = TYPES.filter((t) => t.deal === 'sale');
const rentTypes = TYPES.filter((t) => t.deal === 'rent');

const ld = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Nhà đất Cam Lâm', item: `${SITE}/nha-dat` },
    ] },
    { '@type': 'CollectionPage', name: 'Nhà đất Cam Lâm, Khánh Hòa', url: `${SITE}/nha-dat`, isPartOf: { '@id': `${SITE}/#web` } },
  ],
};

function Chip({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="text-[13px] bg-white border border-slate-200 hover:border-[#C8A14B] hover:text-[#0B4045] text-slate-700 px-3 py-1.5 rounded-full transition">{children}</Link>;
}

export default function NhaDatHub() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(ld) }} />
      <div className="mx-auto max-w-6xl px-3 sm:px-4 py-6 sm:py-8">
        <nav className="text-[12px] text-slate-500 mb-3 flex items-center gap-1">
          <Link href="/" className="hover:text-[#C8A14B]">Trang chủ</Link><span>›</span>
          <span className="text-slate-700 font-medium">Nhà đất Cam Lâm</span>
        </nav>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B4045] leading-tight">Nhà đất Cam Lâm, Khánh Hòa</h1>
        <p className="mt-2 text-[14px] sm:text-[15px] text-slate-600 leading-relaxed max-w-3xl">Chọn <b>khu vực</b> hoặc <b>loại hình</b> để xem tin đăng mới nhất, giá đất khu vực và vị trí trên bản đồ quy hoạch. Cam Lâm Land phủ toàn bộ 14 xã/thị trấn và điểm nóng Bãi Dài — mua bán, cho thuê đất nền, nhà phố, biệt thự, mặt bằng, phòng trọ…</p>

        {/* Khu vực */}
        <section className="mt-7">
          <h2 className="text-lg sm:text-xl font-bold text-[#0B4045]">Nhà đất theo khu vực</h2>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {AREAS.map((a) => (
              <Link key={a.slug} href={`/nha-dat/${a.slug}`} className="block bg-white border border-slate-200 rounded-2xl p-3.5 hover:border-[#C8A14B] hover:shadow-sm transition">
                <div className="font-bold text-[#0B4045] flex items-center gap-1.5">{a.coastal ? '🌊' : '📍'} {a.name}</div>
                <div className="text-[12px] text-slate-500 mt-0.5 line-clamp-2">{a.region}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* Loại hình mua bán */}
        <section className="mt-6 sm:mt-8">
          <h2 className="text-lg sm:text-xl font-bold text-[#0B4045]">Mua bán theo loại hình</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {saleTypes.map((t) => <Chip key={t.slug} href={`/nha-dat/${t.slug}`}>{t.label} Cam Lâm</Chip>)}
          </div>
        </section>

        {/* Cho thuê */}
        <section className="mt-6 sm:mt-8">
          <h2 className="text-lg sm:text-xl font-bold text-[#0B4045]">Cho thuê</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {rentTypes.map((t) => <Chip key={t.slug} href={`/nha-dat/${t.slug}`}>{t.label} Cam Lâm</Chip>)}
          </div>
        </section>

        {/* Khu vực nổi bật × loại hình chính (giúp Google bò sâu tới tổ hợp) */}
        <section className="mt-6 sm:mt-8">
          <h2 className="text-lg sm:text-xl font-bold text-[#0B4045]">Tìm nhanh theo khu vực nổi bật</h2>
          <div className="mt-3 space-y-4">
            {['cam-duc', 'cam-hai-dong', 'bai-dai', 'suoi-tan'].map((as) => {
              const a = AREAS.find((x) => x.slug === as); if (!a) return null;
              return (
                <div key={as}>
                  <div className="font-semibold text-[#0B4045] text-[14px] mb-1.5">{a.name}</div>
                  <div className="flex flex-wrap gap-2">
                    {saleTypes.slice(0, 8).map((t) => <Chip key={t.slug} href={`/nha-dat/${t.slug}-${a.slug}`}>{t.label} {a.name}</Chip>)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Công cụ */}
        <section className="mt-6 sm:mt-8 bg-gradient-to-br from-[#0B4045] to-[#10585e] text-white rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg sm:text-xl font-extrabold">Công cụ hỗ trợ giao dịch</h2>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <Link href="/bang-gia-dat" className="bg-white/15 hover:bg-white/25 font-bold px-4 py-2 rounded-xl text-sm">📊 Bảng giá đất Khánh Hòa</Link>
            <Link href="/gia-dat" className="bg-white/15 hover:bg-white/25 font-bold px-4 py-2 rounded-xl text-sm">💰 Giá đất & định giá</Link>
            <Link href="/map" className="bg-white/15 hover:bg-white/25 font-bold px-4 py-2 rounded-xl text-sm">🗺️ Bản đồ quy hoạch</Link>
            <Link href="/hop-dong-dat-coc" className="bg-white/15 hover:bg-white/25 font-bold px-4 py-2 rounded-xl text-sm">📝 Hợp đồng đặt cọc</Link>
            <Link href="/cam-nang" className="bg-white/15 hover:bg-white/25 font-bold px-4 py-2 rounded-xl text-sm">📚 Cẩm nang pháp lý</Link>
          </div>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}
