import type { Metadata } from 'next';
import ListingDetailClient from './ListingDetailClient';
import SiteFooter from '@/components/SiteFooter';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://camlamland.onrender.com';
const BACKEND = process.env.BACKEND_HOST ? (process.env.BACKEND_HOST.startsWith('http') ? process.env.BACKEND_HOST : `https://${process.env.BACKEND_HOST}`) : '';

async function getListing(id: string): Promise<any | null> {
  if (!BACKEND || !/^\d+$/.test(id)) return null;
  try {
    const r = await fetch(`${BACKEND}/api/listings/${id}`, { next: { revalidate: 60 } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

const fmtVnd = (n: number): string => {
  if (!n || n <= 0) return 'Thỏa thuận';
  if (n >= 1e9) return (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1).replace('.0', '') + ' tỷ';
  if (n >= 1e6) return Math.round(n / 1e6) + ' triệu';
  return n.toLocaleString('vi-VN') + 'đ';
};

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const l = await getListing(params.id);
  if (!l) return { title: 'Tin bất động sản Cam Lâm', description: 'Chi tiết bất động sản tại Cam Lâm, Khánh Hòa.' };
  const loc = [l.ward, 'Cam Lâm, Khánh Hòa'].filter(Boolean).join(', ');
  const title = `${l.title} — ${fmtVnd(l.price)}${l.area ? `, ${l.area}m²` : ''}`;
  const desc = String(l.description || `${l.title}. Giá ${fmtVnd(l.price)}${l.area ? `, diện tích ${l.area}m²` : ''} tại ${loc}. Liên hệ Cam Lâm Land để xem nhà.`).replace(/\s+/g, ' ').slice(0, 300);
  const img = (Array.isArray(l.images) && l.images[0]) || '/icons/icon-512.png';
  return {
    title, description: desc,
    alternates: { canonical: `/listings/${params.id}` },
    openGraph: { type: 'article', title, description: desc, url: `${SITE}/listings/${params.id}`, images: [{ url: img }] },
    twitter: { card: 'summary_large_image', title, description: desc, images: [img] },
  };
}

export default async function Page({ params }: { params: { id: string } }) {
  const l = await getListing(params.id);
  const ld = l ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: l.title,
    description: String(l.description || l.title || '').replace(/\s+/g, ' ').slice(0, 500),
    image: Array.isArray(l.images) && l.images.length ? l.images : undefined,
    category: 'Bất động sản',
    offers: { '@type': 'Offer', price: l.price > 0 ? l.price : undefined, priceCurrency: 'VND', availability: 'https://schema.org/InStock', url: `${SITE}/listings/${params.id}` },
  } : null;
  return (
    <>
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />}
      <ListingDetailClient />
      <SiteFooter />
    </>
  );
}
