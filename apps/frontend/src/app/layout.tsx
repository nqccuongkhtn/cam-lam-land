import './globals.css';
import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import Nav from '@/components/Nav';
import Providers from './providers';
import PwaRegister from './pwa-register';
import ChatWidget from '@/components/ChatWidget';
import AiAssistant from '@/components/AiAssistant';
import CompareBar from '@/components/CompareBar';
import ScrollToTop from '@/components/ScrollToTop';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://camlamland.onrender.com';
const JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'RealEstateAgent', '@id': SITE + '/#org', name: 'Cam Lâm Land', url: SITE, telephone: '+84988888888', areaServed: 'Cam Lâm, Khánh Hòa, Việt Nam', image: SITE + '/icons/icon-512.png', description: 'Sàn bất động sản và bản đồ quy hoạch huyện Cam Lâm, Khánh Hòa.' },
    { '@type': 'WebSite', '@id': SITE + '/#web', url: SITE, name: 'Cam Lâm Land', inLanguage: 'vi-VN', publisher: { '@id': SITE + '/#org' }, potentialAction: { '@type': 'SearchAction', target: SITE + '/listings?q={q}', 'query-input': 'required name=q' } },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  applicationName: 'Cam Lâm Land',
  title: { default: 'Cam Lâm Land — Mua bán nhà đất & Bản đồ quy hoạch Cam Lâm, Khánh Hòa', template: '%s | Cam Lâm Land' },
  description: 'Sàn bất động sản Cam Lâm, Khánh Hòa: mua bán nhà đất, đất nền ven biển Bãi Dài, tra cứu bản đồ quy hoạch và giá đất khu vực. Tin đăng cập nhật mỗi ngày.',
  keywords: ['bất động sản Cam Lâm', 'nhà đất Cam Lâm', 'đất nền Cam Lâm', 'mua bán nhà đất Khánh Hòa', 'bản đồ quy hoạch Cam Lâm', 'đất Bãi Dài', 'Cam Đức', 'Cam Hải Đông', 'sân bay Cam Ranh'],
  alternates: { canonical: '/' },
  openGraph: { type: 'website', locale: 'vi_VN', siteName: 'Cam Lâm Land', url: SITE, title: 'Cam Lâm Land — Mua bán nhà đất & Bản đồ quy hoạch Cam Lâm', description: 'Sàn bất động sản & bản đồ quy hoạch Cam Lâm, Khánh Hòa — minh bạch, chính xác.', images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'Cam Lâm Land' }] },
  twitter: { card: 'summary_large_image', title: 'Cam Lâm Land — Bất động sản Cam Lâm', description: 'Mua bán nhà đất & bản đồ quy hoạch Cam Lâm, Khánh Hòa.', images: ['/icons/icon-512.png'] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Cam Lâm Land', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icons/icon-192.png', shortcut: '/icons/icon-192.png', apple: '/icons/apple-180.png' },
};
export const viewport: Viewport = { themeColor: '#0A2540' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }} />
        <Providers>
          <PwaRegister />
          <ScrollToTop />
          <Suspense fallback={<div className="h-14" />}><Nav /></Suspense>
          <main className="min-h-[calc(100vh-56px)]">{children}</main>
          <ChatWidget />
          <AiAssistant />
          <CompareBar />
        </Providers>
      </body>
    </html>
  );
}
