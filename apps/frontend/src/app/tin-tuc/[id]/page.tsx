import type { Metadata } from 'next';
import NewsReaderClient from './NewsReaderClient';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://camlamland.onrender.com';

async function getArticle(slug: string): Promise<any | null> {
  try {
    const r = await fetch(`${SITE}/feed/news`, { next: { revalidate: 300 } });
    if (!r.ok) return null;
    const d = await r.json();
    return (d.news || []).find((x: any) => x.slug === slug) || null;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const slug = decodeURIComponent(params.id);
  const a = await getArticle(slug);
  if (!a) return { title: 'Tin tức bất động sản Cam Lâm', description: 'Tin thị trường bất động sản Cam Lâm, Khánh Hòa.' };
  const title = String(a.title || 'Tin tức').replace(/\s+/g, ' ').trim();
  const desc = String(a.summary || a.body || title).replace(/\s+/g, ' ').trim().slice(0, 280);
  const img = (Array.isArray(a.images) && a.images[0]) || a.image || `${SITE}/icons/icon-512.png`;
  const url = `${SITE}/tin-tuc/${slug}`;
  return {
    title,
    description: desc,
    alternates: { canonical: `/tin-tuc/${slug}` },
    openGraph: { type: 'article', title, description: desc, url, siteName: 'Cam Lâm Land', images: [{ url: img }], ...(a.publishedAt ? { publishedTime: a.publishedAt } : {}) },
    twitter: { card: 'summary_large_image', title, description: desc, images: [img] },
  };
}

export default async function Page({ params }: { params: { id: string } }) {
  const slug = decodeURIComponent(params.id);
  const a = await getArticle(slug);
  const imgs = a ? ((Array.isArray(a.images) && a.images.length) ? a.images : (a.image ? [a.image] : undefined)) : undefined;
  const ld = a ? {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: String(a.title || '').slice(0, 110),
    image: imgs,
    datePublished: a.publishedAt,
    dateModified: a.publishedAt,
    author: { '@type': 'Organization', name: 'Cam Lâm Land' },
    publisher: { '@type': 'Organization', name: 'Cam Lâm Land', logo: { '@type': 'ImageObject', url: `${SITE}/icons/icon-512.png` } },
    mainEntityOfPage: `${SITE}/tin-tuc/${slug}`,
  } : null;
  return (
    <>
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />}
      <NewsReaderClient />
    </>
  );
}
