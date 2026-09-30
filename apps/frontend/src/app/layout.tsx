import './globals.css';
import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import Nav from '@/components/Nav';
import Providers from './providers';
import PwaRegister from './pwa-register';
import ScrollToTop from '@/components/ScrollToTop';
import Tracker from '@/components/Tracker';
import BottomNav from '@/components/BottomNav';
import AppSplash from '@/components/AppSplash';
import InstallPrompt from '@/components/InstallPrompt';
import DeferredWidgets from '@/components/DeferredWidgets';

import { ldJson } from '@/lib/jsonld';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://batdongsancamlam.dpdns.org';
const JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'RealEstateAgent', '@id': SITE + '/#org', name: 'Cam Lâm Land', url: SITE, areaServed: 'Cam Lâm, Khánh Hòa, Việt Nam', image: SITE + '/icons/icon-512.png', description: 'Sàn bất động sản và bản đồ quy hoạch huyện Cam Lâm, Khánh Hòa.' },
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
  /* ⚠️ GẮN ?v= VÀO BIỂU TƯỢNG: Cloudflare giữ ảnh 7 ngày theo tên file, đổi logo
     mà giữ tên thì iPhone "Thêm vào Màn hình chính" vẫn ra biểu tượng CŨ (đã vấp
     25/9/2026 — ra ngôi nhà cũ). Đổi ảnh trong public/icons/ thì đổi luôn số này
     (lấy 8 ký tự đầu md5 của apple-180.png) và số trong manifest.webmanifest. */
  icons: { icon: '/icons/icon-192.png?v=c5b77735', shortcut: '/icons/icon-192.png?v=c5b77735', apple: '/icons/apple-180.png?v=f6114d8f' },
};
export const viewport: Viewport = { themeColor: '#0A2540', viewportFit: 'cover' };

// CSS splash NHÚNG THẲNG vào <head> — không chờ tải globals.css → phủ navy + splash ngay khung hình đầu (hết màn đen).
const SPLASH_CSS = `
html.pwa-app{background:#0A2540}
#app-splash{display:none;position:fixed;inset:0;z-index:99999;background:#0A2540;flex-direction:column;align-items:center;justify-content:center;opacity:1;transition:opacity .55s ease}
@media (display-mode:standalone),(display-mode:fullscreen),(display-mode:minimal-ui){#app-splash{display:flex}}
html.pwa-app #app-splash{display:flex}
#app-splash.is-hide{opacity:0;pointer-events:none}
html.splash-done #app-splash{display:none!important}
.cl-splash-card{transform:translateY(-6%);display:flex;flex-direction:column;align-items:center}
.cl-splash-tile{width:118px;height:118px;border-radius:28px;border:1.5px solid rgba(200,161,75,.5);display:grid;place-items:center;box-shadow:0 10px 34px rgba(0,0,0,.4);animation:clSplashPop .5s cubic-bezier(0.22,1,0.36,1) both}
.cl-splash-brand{margin-top:26px;font-size:30px;font-weight:900;color:#C8A14B;letter-spacing:.4px}
/* Một dòng, không ngắt: chủ dự án muốn 'Cam Lâm, Khánh Hòa' nằm cùng dòng
   với phần đầu. Cỡ chữ 12.5px để câu 45 ký tự vẫn vừa màn hẹp nhất (320px). */
.cl-splash-sub{margin-top:8px;font-size:12.5px;line-height:1.5;color:#cbd5e1;text-align:center;white-space:nowrap;padding:0 12px}
.cl-splash-dots{position:absolute;bottom:calc(48px + env(safe-area-inset-bottom));display:flex;gap:7px}
@keyframes clSplashPop{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:none}}
.cl-splash-dot{width:7px;height:7px;border-radius:50%;background:#C8A14B;opacity:.35;animation:clSplashDot 1s ease-in-out infinite}
@keyframes clSplashDot{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
/* Chế độ NHÚNG (?embed=1) — dùng cho hub Tiện ích: ẩn hết khung, chỉ còn nội dung công cụ */
html.embed .cl-chrome{display:none!important}
html.embed footer{display:none!important}
html.embed main{min-height:100dvh!important;padding-bottom:0!important}
html.embed{--chrome-h:0px}
html.embed,html.embed body{background:#fff}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        {/* Đánh dấu chế độ đã cài NGAY trước khi vẽ khung hình đầu — để splash phủ tức thì (fallback iOS) */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||matchMedia('(display-mode: minimal-ui)').matches||navigator.standalone===true){document.documentElement.classList.add('pwa-app')}if(sessionStorage.getItem('cl-splash-done')){document.documentElement.classList.add('splash-done')}else{sessionStorage.setItem('cl-splash-done','1')}if(new URLSearchParams(location.search).get('embed')==='1'||window.self!==window.top){document.documentElement.classList.add('embed')}}catch(e){}" }} />
        {/* CSS splash nhúng thẳng — không chờ globals.css, hết cảnh màn đen trước splash */}
        <style dangerouslySetInnerHTML={{ __html: SPLASH_CSS }} />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        {/* Màn hình chờ (splash) khi mở PWA trên iOS — giống app native */}
        <link rel="apple-touch-startup-image" media="screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/iphone-750x1334.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/iphone-828x1792.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/iphone-1125x2436.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/iphone-1242x2688.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/iphone-1170x2532.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/iphone-1284x2778.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/iphone-1179x2556.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/iphone-1290x2796.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/iphone-1206x2622.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/iphone-1320x2868.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/ipad-1536x2048.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/ipad-1620x2160.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/ipad-1640x2360.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/ipad-1668x2224.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/ipad-1668x2388.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/ipad-2048x2732.png" />
        {/* Catch-all: máy nào không khớp kích thước ở trên vẫn ra nền navy (không đen). Đặt CUỐI để ưu tiên khớp chính xác trước. */}
        <link rel="apple-touch-startup-image" href="/splash/universal.png" />
      </head>
      <body>
        <AppSplash />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(JSONLD) }} />
        <Providers>
          <PwaRegister />
          <ScrollToTop />
          <Suspense fallback={null}><Tracker /></Suspense>
          <div className="cl-chrome"><Suspense fallback={<div className="h-14" />}><Nav /></Suspense></div>
          <main className="min-h-[calc(100dvh-56px)] pb-[calc(48px+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
          <div className="cl-chrome">
            <DeferredWidgets />
            <InstallPrompt />
            <Suspense fallback={null}><BottomNav /></Suspense>
          </div>
        </Providers>
      </body>
    </html>
  );
}
