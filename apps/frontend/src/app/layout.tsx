import './globals.css';
import type { Metadata, Viewport } from 'next';
import Nav from '@/components/Nav';
import Providers from './providers';
import PwaRegister from './pwa-register';
import ChatWidget from '@/components/ChatWidget';

export const metadata: Metadata = {
  applicationName: 'Cam Lâm Land',
  title: 'Cam Lâm Land — Bất động sản & Bản đồ quy hoạch',
  description: 'Sàn bất động sản và hệ thống bản đồ GIS quy hoạch cho huyện Cam Lâm, Khánh Hòa.',
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
        <Providers>
          <PwaRegister />
          <Nav />
          <main className="min-h-[calc(100vh-56px)]">{children}</main>
          <ChatWidget />
        </Providers>
      </body>
    </html>
  );
}
