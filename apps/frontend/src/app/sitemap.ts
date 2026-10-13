import type { MetadataRoute } from 'next';
import { ALL_SLUGS } from '@/lib/seoLanding';
import { TAT_CA_SLUG as DIA_DANH } from '@/lib/diaDanh';
import { CONG_CU } from '@/lib/congCu';
import { GUIDES } from '@/app/cam-nang/guides';
import { SITE } from '@/lib/tenMien';


const BACKEND = process.env.BACKEND_HOST ? (process.env.BACKEND_HOST.startsWith('http') ? process.env.BACKEND_HOST : `https://${process.env.BACKEND_HOST}`) : '';

export const revalidate = 3600; // làm mới sitemap mỗi giờ

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls: MetadataRoute.Sitemap = ['', '/listings', '/nha-dat', '/map', '/tin-tuc', '/dau-tu', '/dichvu', '/cam-nang', '/bang-gia-dat', '/gia-dat', '/den-bu', '/du-an', '/chuyen-doi-toa-do-vn2000'].map((p) => ({
    url: `${SITE}${p}`, changeFrequency: p === '' || p === '/listings' ? 'daily' : 'weekly', priority: p === '' ? 1 : 0.8,
  }));
  // Trang đích SEO theo khu vực × loại hình (đất nền Cam Đức, nhà phố Bãi Dài…)
  const landing: MetadataRoute.Sitemap = ALL_SLUGS.map((slug) => ({
    url: `${SITE}/nha-dat/${slug}`, changeFrequency: 'daily', priority: 0.75,
  }));
  // TRANG ĐỊA DANH (13/10/2026): 65 xã/phường mới + xã cũ + huyện cũ, nối tên trước ↔ sau sáp nhập (lib/diaDanh.ts)
  const diaDanh: MetadataRoute.Sitemap = [
    { url: `${SITE}/ban-do`, changeFrequency: 'monthly', priority: 0.8 },
    ...DIA_DANH.map((slug) => ({ url: `${SITE}/ban-do/${slug}`, changeFrequency: 'monthly' as const, priority: 0.7 })),
  ];
  // TRANG ĐÍCH CÔNG CỤ (13/10/2026): bản công khai của từng công cụ (lib/congCu.ts)
  const congCu: MetadataRoute.Sitemap = [
    { url: `${SITE}/cong-cu`, changeFrequency: 'monthly', priority: 0.8 },
    ...CONG_CU.map((c) => ({ url: `${SITE}/cong-cu/${c.slug}`, changeFrequency: 'monthly' as const, priority: 0.75 })),
  ];
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
  return [...staticUrls, ...landing, ...diaDanh, ...congCu, ...guides, ...news, ...listings];
}
