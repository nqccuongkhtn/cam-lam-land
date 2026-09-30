import type { MetadataRoute } from 'next';
import { ALL_SLUGS } from '@/lib/seoLanding';
import { GUIDES } from '@/app/cam-nang/guides';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://batdongsancamlam.dpdns.org';
const BACKEND = process.env.BACKEND_HOST ? (process.env.BACKEND_HOST.startsWith('http') ? process.env.BACKEND_HOST : `https://${process.env.BACKEND_HOST}`) : '';

export const revalidate = 3600; // làm mới sitemap mỗi giờ

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls: MetadataRoute.Sitemap = ['', '/listings', '/nha-dat', '/map', '/tin-tuc', '/dau-tu', '/dichvu', '/cam-nang', '/bang-gia-dat', '/gia-dat', '/den-bu'].map((p) => ({
    url: `${SITE}${p}`, changeFrequency: p === '' || p === '/listings' ? 'daily' : 'weekly', priority: p === '' ? 1 : 0.8,
  }));
  // Trang đích SEO theo khu vực × loại hình (đất nền Cam Đức, nhà phố Bãi Dài…)
  const landing: MetadataRoute.Sitemap = ALL_SLUGS.map((slug) => ({
    url: `${SITE}/nha-dat/${slug}`, changeFrequency: 'daily', priority: 0.75,
  }));
  let listings: MetadataRoute.Sitemap = [];
  try {
    // Lúc ĐÓNG GÓI web máy chủ dữ liệu chưa chạy → gọi BACKEND hỏng, sitemap rỗng tin đăng suốt 1 tiếng.
    // Nên thử lần lượt: đường nội bộ, rồi tên miền thật (30/9/2026).
    for (const goc of [BACKEND, SITE].filter(Boolean)) {
      const r = await fetch(`${goc}/api/listings?limit=1000`, { next: { revalidate: 3600 } }).catch(() => null);
      if (r?.ok) {
        const d = await r.json();
        listings = (d.listings || []).map((l: any) => ({
          url: `${SITE}/listings/${l.id}`,
          lastModified: l.bumpedAt || l.createdAt || undefined,
          changeFrequency: 'weekly', priority: 0.7,
        }));
        if (listings.length) break;
      }
    }
  } catch { /* backend lỗi -> chỉ trả sitemap tĩnh */ }
  // Bài cẩm nang: "khoá mềm" (components/KhoaMem.tsx) — Google đọc được toàn bài, khách chưa đăng nhập xem phần đầu.
  const guides: MetadataRoute.Sitemap = GUIDES.map((g) => ({
    url: `${SITE}/cam-nang/${g.slug}`, lastModified: g.updated || undefined, changeFrequency: 'monthly', priority: 0.7,
  }));
  // Bài tin tức đã biên tập — trước đây KHÔNG có trong sitemap nên Google khó tìm ra.
  let news: MetadataRoute.Sitemap = [];
  try {
    const r = await fetch(`${SITE}/feed/news?gon=1`, { next: { revalidate: 3600 } });
    if (r.ok) {
      const d = await r.json();
      news = (d.news || []).filter((a: any) => a?.slug).slice(0, 500).map((a: any) => ({
        url: `${SITE}/tin-tuc/${encodeURIComponent(a.slug)}`,
        lastModified: a.publishedAt || undefined, changeFrequency: 'monthly', priority: 0.6,
      }));
    }
  } catch { /* kho tin lỗi -> bỏ qua phần tin tức */ }
  return [...staticUrls, ...landing, ...guides, ...news, ...listings];
}
