import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://camlamland.onrender.com';
const BACKEND = process.env.BACKEND_HOST ? (process.env.BACKEND_HOST.startsWith('http') ? process.env.BACKEND_HOST : `https://${process.env.BACKEND_HOST}`) : '';

export const revalidate = 3600; // làm mới sitemap mỗi giờ

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls: MetadataRoute.Sitemap = ['', '/listings', '/map', '/tin-tuc', '/dichvu'].map((p) => ({
    url: `${SITE}${p}`, changeFrequency: p === '' || p === '/listings' ? 'daily' : 'weekly', priority: p === '' ? 1 : 0.8,
  }));
  let listings: MetadataRoute.Sitemap = [];
  try {
    if (BACKEND) {
      const r = await fetch(`${BACKEND}/api/listings?limit=1000`, { next: { revalidate: 3600 } });
      if (r.ok) {
        const d = await r.json();
        listings = (d.listings || []).map((l: any) => ({
          url: `${SITE}/listings/${l.id}`,
          lastModified: l.bumpedAt || l.createdAt || undefined,
          changeFrequency: 'weekly', priority: 0.7,
        }));
      }
    }
  } catch { /* backend lỗi -> chỉ trả sitemap tĩnh */ }
  return [...staticUrls, ...listings];
}
