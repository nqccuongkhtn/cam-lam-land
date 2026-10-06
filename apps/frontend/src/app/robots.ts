import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/tenMien';



export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/sales', '/account', '/api/', '/feed/'] }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
