/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // TẮT nén trong Node: nginx phía trước đã nén gzip (viết bằng C, nhanh + ít RAM hơn hẳn nén bằng
  // JavaScript). Để cả hai cùng nén là Node tốn CPU/bộ nhớ vô ích khi đông khách (29/9/2026).
  // ⚠️ Chạy Next.js KHÔNG qua nginx (vd Render) thì bật lại true.
  compress: process.env.NEXT_COMPRESS === '1',
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    formats: ['image/webp'],
    minimumCacheTTL: 2678400, // 31 ngày: giữ ảnh đã tối ưu lâu hơn, đỡ xử lý lại
  },
  // Bỏ console.log/debug/info trong bản chạy thật (giữ error/warn) → JS nhẹ & sạch hơn.
  compiler: { removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};
module.exports = nextConfig;
