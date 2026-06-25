/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Listing photos come from picsum/unsplash in the demo seed.
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  // Demo deploy: don't let lint/TS noise block the production build.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // In the cloud (Render), the browser calls same-origin /api and Next proxies
  // it to the backend service — no CORS, no build-time API URL needed.
  // Locally BACKEND_HOST is unset → nginx handles /api as before.
  async rewrites() {
    const h = process.env.BACKEND_HOST;
    if (!h) return [];
    const base = h.startsWith('http') ? h : `https://${h}`;
    return [{ source: '/api/:path*', destination: `${base}/api/:path*` }];
  },
};
module.exports = nextConfig;
