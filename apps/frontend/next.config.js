/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
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
