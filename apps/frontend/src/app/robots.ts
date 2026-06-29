import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://camlamland.onrender.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/sales', '/account', '/api/', '/feed/'] }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
